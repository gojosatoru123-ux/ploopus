/**
 * components/collab/CollabPage.tsx
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

import NotionEditor from '@/components/NotionEditor';
import { SidebarTrigger } from '@/components/ui/sidebar';
import FloatingToolbar from '@/components/utility/FloatingToolbar';
import { useActiveNote } from '@/hooks/useActiveNotes';
import { useNotesContext } from '@/contexts/NotesContext';
import { StorageEngine } from '@/lib/storage-engine';
import { NoteBlock } from '@/lib/types';
import { useCollaboration } from '@/hooks/useCollaboration';
import { authClient } from '@/lib/auth-client';

import CollabAccessModal       from '@/components/collab/CollabAccessModal';
import CollabPanel             from '@/components/collab/CollabPanel';
import CollabSaveIndicator, { SaveStatus } from '@/components/collab/CollabSaveIndicator';
import CollabSessionEndedModal from '@/components/collab/CollabSessionEndedModal';

/**
 * useStableBlocks
 * Ref-based content equality check so NotionEditor never sees a new prop
 * reference unless blocks actually changed — prevents onChange render loops.
 */
function useStableBlocks(blocks: NoteBlock[]): NoteBlock[] {
    const stableRef    = useRef<NoteBlock[]>(blocks);
    const serialiseRef = useRef<string>(JSON.stringify(blocks));
    const serialised   = JSON.stringify(blocks);
    if (serialised !== serialiseRef.current) {
        serialiseRef.current = serialised;
        stableRef.current    = blocks;
    }
    return stableRef.current;
}

export default function CollabPage() {
    const params       = useParams();
    const roomId       = (params?.roomId as string) ?? '';
    const searchParams = useSearchParams();
    const noteId       = searchParams.get('noteid') ?? '';
    const isHost       = searchParams.get('host') === '1';

    // ── Auth ──────────────────────────────────────────────────────────────────
    // Collaboration is only accessible to logged-in users, so session is
    // always present here — no null guards needed for actual usage.
    const { data: session } = authClient.useSession();
    const displayName = session?.user?.name  ?? '';
    const email       = session?.user?.email ?? '';

    // ── OPFS note data ────────────────────────────────────────────────────────
    const { blocks, setBlocks, isLoading: isBlocksLoading } = useActiveNote(noteId);
    const { createNoteIndex, updateNoteIndex } = useNotesContext();

    // ── Guest connection gate ─────────────────────────────────────────────────
    const [guestRoomId, setGuestRoomId] = useState('');
    const effectiveRoomId = isHost ? roomId : guestRoomId;

    const {
        role,
        sharedBlocks,
        connectedPeers,
        pendingGuests,
        accessStatus,
        isReady,
        approveGuest,
        denyGuest,
        applyLocalChange,
        endSession,
    } = useCollaboration({
        roomId:        effectiveRoomId,
        initialBlocks: blocks ?? [],
        isHost,
        displayName,
        email,
    });

    // ── Host: save state ──────────────────────────────────────────────────────
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('unsaved');
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const versionRef = useRef(0);

    useEffect(() => {
        if (!isHost || !noteId) return;
        versionRef.current += 1;
        const thisVersion = versionRef.current;

        // 1. Update data instantly in the background so the auto-save engine works
        setBlocks([...sharedBlocks]);
        updateNoteIndex(noteId, { updatedAt: new Date().toISOString() });

        // 2. Clear any pending UI updates while the user is actively typing
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        // 3. This block runs ONLY when the user pauses typing for 800ms
        saveTimerRef.current = setTimeout(() => {
            if (versionRef.current === thisVersion) {
                // Step A: Show 'saving' exactly when StorageEngine's 800ms buffer hits
                setSaveStatus('saving');

                // Step B: Hold it for a brief moment while the write finishes, then mark as saved
                setTimeout(() => {
                    if (versionRef.current === thisVersion) {
                        setLastSavedAt(Date.now());
                        setSaveStatus('saved');
                    }
                }, 500); // 500ms visual confirmation window for the write operation
            }
        }, 800); // Matches your exact StorageEngine 800ms debounce threshold!

    }, [sharedBlocks, isHost, noteId, setBlocks, updateNoteIndex]);

    // Manual "Save now" button — identical logic, callable on demand.
    const triggerSave = useCallback(() => {
        if (!isHost || !noteId) return;
        versionRef.current += 1;
        const thisVersion = versionRef.current;

        setSaveStatus('saving');
        setBlocks([...sharedBlocks]);
        updateNoteIndex(noteId, { updatedAt: new Date().toISOString() });

        setTimeout(() => {
            if (versionRef.current === thisVersion) {
                setLastSavedAt(Date.now());
                setSaveStatus('saved');
            }
        }, 600);
    }, [isHost, noteId, setBlocks, sharedBlocks, updateNoteIndex]);

    // Cleanup any in-flight timer only on actual unmount
    useEffect(() => () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    }, []);

    // ── beforeunload warning ──────────────────────────────────────────────────
    // Ref-based so the handler never goes stale without re-registering.
    const saveStatusRef = useRef(saveStatus);
    useEffect(() => { saveStatusRef.current = saveStatus; }, [saveStatus]);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            // Only warn host when there are genuinely unsaved changes
            if (isHost && saveStatusRef.current === 'unsaved') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isHost]);

    // ── Host: end session ─────────────────────────────────────────────────────
    const router = useRouter();

    const handleEndSession = useCallback(() => {
        // Save first (fire-and-forget), then broadcast HOST_LEAVING + destroy peer
        triggerSave();
        endSession();
        // Navigate back to the note after 400 ms — enough for HOST_LEAVING to
        // flush through DataChannel and for the save debounce to start
        setTimeout(() => router.push(`/note/ideas/${noteId}`), 400);
    }, [triggerSave, endSession, router, noteId]);

    // ── Guest: session ended modal ────────────────────────────────────────────
    const [sessionEndedVisible, setSessionEndedVisible] = useState(false);
    useEffect(() => {
        if (accessStatus === 'host_left') setSessionEndedVisible(true);
    }, [accessStatus]);

    // Guest saves a copy: create a new note index + write blocks to OPFS
    const handleGuestSaveCopy = useCallback(async () => {
        const newNoteId = createNoteIndex(null);
        updateNoteIndex(newNoteId, {
            title:     `Collab copy — ${new Date().toLocaleString()}`,
            updatedAt: new Date().toISOString(),
        });
        await StorageEngine.saveNoteBlocksDebounced(newNoteId, sharedBlocks);
    }, [createNoteIndex, updateNoteIndex, sharedBlocks]);

    // ── Auto-connect for guests ───────────────────────────────────────────────
    // Check localStorage on mount — if this email was previously approved in
    // this room, skip the modal and connect straight away.
    const autoJoinedRef = useRef(false);
    useEffect(() => {
        if (isHost || autoJoinedRef.current || guestRoomId) return;

        const approvedEmails = (() => {
            try {
                const raw = localStorage.getItem(`collab:${roomId}:approvedEmails`);
                return raw ? new Set(JSON.parse(raw) as string[]) : new Set<string>();
            } catch { return new Set<string>(); }
        })();

        if (email && approvedEmails.has(email)) {
            autoJoinedRef.current = true;
            setGuestRoomId(roomId);
        }
        // Otherwise wait for modal button click
    }, [isHost, email, guestRoomId, roomId]);

    // ── Stable editor blocks ──────────────────────────────────────────────────
    const rawEditorBlocks = sharedBlocks.length > 0 ? sharedBlocks : (blocks ?? []);
    const editorBlocks    = useStableBlocks(rawEditorBlocks);

    // ── Debounced applyLocalChange ────────────────────────────────────────────
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingBlocks = useRef<NoteBlock[] | null>(null);

    const handleBlockChanges = useCallback(
        (updates: NoteBlock[]) => {
            pendingBlocks.current = updates;
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
                if (pendingBlocks.current) {
                    applyLocalChange(pendingBlocks.current);
                    pendingBlocks.current = null;
                }
            }, 120);
        },
        [applyLocalChange]
    );

    // Flush on unmount so no pending changes are silently dropped
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                if (pendingBlocks.current) applyLocalChange(pendingBlocks.current);
            }
        };
    }, [applyLocalChange]);

    // ── Guest: request access ─────────────────────────────────────────────────
    const handleRequestAccess = useCallback(() => {
        setGuestRoomId(roomId);
    }, [roomId]);

    // ── Navigation guard ──────────────────────────────────────────────────────
    // Catches accidental in-app link clicks and browser back/forward while the
    // host is mid-session, and asks for confirmation before actually leaving.
    // On confirm: ends the collab session, then performs the navigation.
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
    const pendingNavRef = useRef<{ type: 'link' | 'popstate'; href?: string } | null>(null);

    // Kept in a ref so the click/popstate listeners (registered once) always
    // see the latest guard-active state without needing to re-subscribe.
    // (Populated further down, once `showEditor` has been computed.)
    const guardActiveRef = useRef(false);

    // Intercept clicks on any in-app <a> link
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (!guardActiveRef.current) return;

            const anchor = (e.target as HTMLElement)?.closest('a');
            if (!anchor) return;

            const href = anchor.getAttribute('href');
            const isExternal =
                anchor.target === '_blank' ||
                (href && /^(https?:)?\/\//i.test(href) && !href.startsWith(window.location.origin));

            if (!href || href.startsWith('#') || isExternal) return;

            e.preventDefault();
            e.stopPropagation();
            pendingNavRef.current = { type: 'link', href };
            setShowLeaveConfirm(true);
        };

        // Capture phase so we intercept before Next.js's own Link handler runs
        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, []);

    // Intercept browser back/forward
    useEffect(() => {
        // Seed an extra history entry so the first back-press fires a popstate
        // we can catch and cancel, rather than immediately leaving the page.
        window.history.pushState({ collabGuard: true }, '');

        const handlePopState = () => {
            if (!guardActiveRef.current) return;

            // Re-push immediately so the URL/history doesn't actually move yet —
            // the modal decides whether the navigation really happens.
            window.history.pushState({ collabGuard: true }, '');
            pendingNavRef.current = { type: 'popstate' };
            setShowLeaveConfirm(true);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleConfirmLeave = useCallback(() => {
        setShowLeaveConfirm(false);

        // Save + broadcast HOST_LEAVING, same as the explicit "End session" button
        triggerSave();
        endSession();

        const pending = pendingNavRef.current;
        pendingNavRef.current = null;

        setTimeout(() => {
            if (pending?.type === 'link' && pending.href) {
                router.push(pending.href);
            } else {
                // Back/forward press, or no target captured — leave to the note
                router.push(`/note/ideas/${noteId}`);
            }
        }, 400);
    }, [triggerSave, endSession, router, noteId]);

    const handleCancelLeave = useCallback(() => {
        setShowLeaveConfirm(false);
        pendingNavRef.current = null;
    }, []);

    // ── Derived ───────────────────────────────────────────────────────────────

    const shareUrl =
    typeof window !== 'undefined'
        ? `${window.location.origin}/collab/${roomId}?noteid=cursorbits`
        : '';

    const showEditor  = !isBlocksLoading && (isHost || accessStatus === 'granted' || accessStatus === 'host_left');
    const modalStatus = (guestRoomId || accessStatus === 'room_full') ? accessStatus : 'idle';

    // Keep the nav-guard ref in sync now that showEditor is available
    useEffect(() => {
        guardActiveRef.current = isHost && showEditor;
    }, [isHost, showEditor]);

    return (
        <>
            {/* ── Guest: access modal ── */}
            {!isHost && (
                <CollabAccessModal
                    status={modalStatus}
                    displayName={displayName}
                    email={email}
                    onRequestAccess={handleRequestAccess}
                />
            )}

            {/* ── Guest: host left modal ── */}
            <CollabSessionEndedModal
                visible={sessionEndedVisible}
                onSaveCopy={handleGuestSaveCopy}
                onDismiss={() => setSessionEndedVisible(false)}
            />

            {/* ── Host: confirm-before-leaving modal ── */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.15 }}
                        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
                    >
                        <h2 className="text-sm font-semibold text-foreground">Leave this session?</h2>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                            Navigating away will end the collaboration session for everyone
                            currently connected. Your changes will be saved first.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={handleCancelLeave}
                                className="text-xs bg-muted hover:bg-muted/80 px-3 py-1.5 rounded-md transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmLeave}
                                className="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 px-3 py-1.5 rounded-md transition-colors font-medium"
                            >
                                Exit
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ── Top bar ── */}
            <motion.div
                className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-sm"
                initial={false}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                <SidebarTrigger />
                <div className="flex items-center gap-3">
                    {roomId && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded-md">
                            Room: {roomId}
                        </span>
                    )}
                    {isHost && (
                        <>
                            {/* Save status indicator — now connection-independent */}
                            <CollabSaveIndicator
                                status={saveStatus}
                                lastSavedAt={lastSavedAt}
                            />

                            {/* Manual save */}
                            <button
                                onClick={triggerSave}
                                disabled={saveStatus === 'saving'}
                                className="text-xs bg-muted hover:bg-muted/80 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                            >
                                Save now
                            </button>

                            {/* End session */}
                            <button
                                onClick={handleEndSession}
                                className="text-xs bg-destructive/10 text-destructive hover:bg-destructive/20 px-2 py-1 rounded-md transition-colors font-medium"
                            >
                                End session
                            </button>
                        </>
                    )}
                </div>
            </motion.div>

            <div className="overflow-y-auto p-4 min-h-screen">
                <FloatingToolbar />
                {showEditor && (
                    <NotionEditor blocks={editorBlocks} onChange={handleBlockChanges} />
                )}
            </div>

            {isReady && (isHost || accessStatus === 'granted' || accessStatus === 'host_left') && (
                <CollabPanel
                    role={role}
                    localDisplayName={displayName}
                    localEmail={email}
                    roomUrl={shareUrl}
                    pendingGuests={pendingGuests}
                    connectedPeers={connectedPeers}
                    onApprove={approveGuest}
                    onDeny={denyGuest}
                />
            )}
        </>
    );
}