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
    // We track save status here in CollabPage because saving is done via
    // setBlocks (which lives here, not in the hook). The hook only broadcasts.
    const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('unsaved');
    const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
    const saveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Trigger a save: call setBlocks so useActiveNote's debounced auto-save fires.
    // Also touch updatedAt on the index so the note floats to top of recents.
    // Never awaits anything — completely non-blocking.
    const triggerSave = useCallback(() => {
        if (!isHost || !noteId) return;
        setSaveStatus('saving');
        setBlocks([...sharedBlocks]); // new ref triggers useActiveNote's effect
        updateNoteIndex(noteId, { updatedAt: new Date().toISOString() });
        // Show "saving" for 600 ms then flip to "saved" — matches the debounce
        // window in StorageEngine so the indicator resolves after the write starts.
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            setLastSavedAt(Date.now());
            setSaveStatus('saved');
        }, 600);
    }, [isHost, noteId, setBlocks, sharedBlocks, updateNoteIndex]);

    // Mark unsaved whenever sharedBlocks change after the last save
    useEffect(() => {
        if (!isHost || !isReady) return;
        setSaveStatus('unsaved');
    }, [sharedBlocks, isHost, isReady]);

    // Auto-save every 30 s while the host is live
    useEffect(() => {
        if (!isHost || !isReady) return;
        const id = setInterval(triggerSave, 30_000);
        return () => clearInterval(id);
    }, [isHost, isReady, triggerSave]);

    // Cleanup save timer on unmount
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

    // ── Derived ───────────────────────────────────────────────────────────────

    const shareUrl =
    typeof window !== 'undefined'
        ? `${window.location.origin}/collab/${roomId}?noteid=cursorbits`
        : '';

    const showEditor  = !isBlocksLoading && (isHost || accessStatus === 'granted' || accessStatus === 'host_left');
    const modalStatus = (guestRoomId || accessStatus === 'room_full') ? accessStatus : 'idle';

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
                            {/* Save status indicator — styled like SyncStatusIndicator */}
                            {isReady && (
                                <CollabSaveIndicator
                                    status={saveStatus}
                                    lastSavedAt={lastSavedAt}
                                />
                            )}

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