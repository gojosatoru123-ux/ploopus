/**
 * components/collab/CollabPage.tsx
 */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

import NotionEditor from '@/components/NotionEditor';
import { SidebarTrigger } from '@/components/ui/sidebar';
import FloatingToolbar from '@/components/utility/FloatingToolbar';
import { useActiveNote } from '@/hooks/useActiveNotes';
import { NoteBlock } from '@/lib/types';
import { useCollaboration } from '@/hooks/useCollaboration';

import CollabAccessModal from '@/components/collab/CollabAccessModal';
import CollabPanel from '@/components/collab/CollabPanel';
import CollabStatusBar from '@/components/collab/CollabStatusBar';

/**
 * useStableBlocks
 *
 * Returns a blocks array whose reference only changes when the serialised
 * content actually differs from the previous value. This prevents NotionEditor
 * from seeing a new prop reference on every render (which would fire onChange,
 * which would call applyLocalChange, which would trigger another render…).
 *
 * Why not useMemo with JSON.stringify in the dep array?
 * React compares deps with Object.is. JSON.stringify returns a NEW string
 * object on every call, so Object.is always returns false → the memo never
 * stabilises → the loop continues. A ref-based comparison is the only
 * reliable way to gate on content equality across renders.
 */
function useStableBlocks(blocks: NoteBlock[]): NoteBlock[] {
    const stableRef    = useRef<NoteBlock[]>(blocks);
    const serialiseRef = useRef<string>(JSON.stringify(blocks));

    const serialised = JSON.stringify(blocks);
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

    // ── OPFS note data ────────────────────────────────────────────────────────
    const { blocks, isLoading: isBlocksLoading } = useActiveNote(noteId);

    // ── Guest name gate ───────────────────────────────────────────────────────
    // `savedDisplayName` comes from the hook (read from localStorage on mount).
    // We initialise guestDisplayName from it so returning guests skip the modal.
    const [guestRoomId, setGuestRoomId] = useState('');
    // Host display name — wire to your auth/profile if available
    const [hostDisplayName] = useState('Host');

    // Bootstrap the hook with roomId='', displayName='' until we have a name.
    // We need savedDisplayName from the hook first, so we call the hook with
    // a temporary empty state and then auto-submit if a saved name is found.
    const [guestDisplayName, setGuestDisplayName] = useState('');
    const effectiveRoomId  = isHost ? roomId : guestRoomId;
    const localDisplayName = isHost ? hostDisplayName : guestDisplayName;

    const {
        role,
        sharedBlocks,
        connectedPeers,
        pendingGuests,
        accessStatus,
        isReady,
        savedDisplayName,
        approveGuest,
        denyGuest,
        applyLocalChange,
    } = useCollaboration({
        roomId:        effectiveRoomId,
        initialBlocks: blocks ?? [],
        isHost,
        displayName:   localDisplayName || (isHost ? 'Host' : 'Guest'),
    });

    // ── Auto-rejoin for guests with a saved name ──────────────────────────────
    // If localStorage has a name for this room (from a previous visit), skip
    // the modal entirely and connect straight away — same as if they'd typed
    // their name and hit "Request access".
    const autoJoinedRef = useRef(false);
    useEffect(() => {
        if (isHost || autoJoinedRef.current || !savedDisplayName || guestRoomId) return;
        autoJoinedRef.current = true;
        setGuestDisplayName(savedDisplayName);
        setGuestRoomId(roomId);
    }, [isHost, savedDisplayName, guestRoomId, roomId]);

    // ── Stable editor blocks ──────────────────────────────────────────────────
    // Prefer sharedBlocks (collab) over OPFS blocks; fall back to OPFS while
    // sharedBlocks is empty (i.e. before the Y.Doc is seeded / synced).
    // useStableBlocks ensures the reference is only replaced when content
    // actually changes, breaking the onChange → applyLocalChange → re-render loop.
    const rawEditorBlocks   = sharedBlocks.length > 0 ? sharedBlocks : (blocks ?? []);
    const editorBlocks      = useStableBlocks(rawEditorBlocks);

    // ── Debounced applyLocalChange ────────────────────────────────────────────
    // Batches rapid keystrokes into a single Y.Doc transact + broadcast.
    // 120 ms is imperceptible to the typist but dramatically reduces the number
    // of updates sent to peers and Y.Doc writes per second.
    const debounceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingBlocks   = useRef<NoteBlock[] | null>(null);

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

    // Flush on unmount so no changes are silently dropped
    useEffect(() => {
        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
                if (pendingBlocks.current) {
                    applyLocalChange(pendingBlocks.current);
                }
            }
        };
    }, [applyLocalChange]);

    // ── Callbacks ─────────────────────────────────────────────────────────────

    const handleRequestAccess = useCallback(
        (name: string) => {
            // Persist so this guest is recognised on refresh / new tab
            localStorage.setItem(`collab:${roomId}:guestName`, name);
            setGuestDisplayName(name);
            setGuestRoomId(roomId);
        },
        [roomId]
    );

    // ── Derived ───────────────────────────────────────────────────────────────

    const shareUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/collab/${roomId}?noteid=cursorbits`
            : '';

    const showEditor  = !isBlocksLoading && (isHost || accessStatus === 'granted');
    // room_full: show modal so guest sees the message. If they want to retry
    // later, they can refresh — the modal's idle state will let them re-request.
    const modalStatus = (guestRoomId || accessStatus === 'room_full') ? accessStatus : 'idle';

    return (
        <>
            {!isHost && (
                <CollabAccessModal
                    status={modalStatus}
                    savedName={savedDisplayName}
                    onRequestAccess={handleRequestAccess}
                />
            )}

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
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-medium">
                            Host
                        </span>
                    )}
                </div>
            </motion.div>

            <CollabStatusBar
                role={role}
                isReady={isReady}
                accessStatus={accessStatus}
                connectedCount={connectedPeers.length}
            />

            <div className="overflow-y-auto p-4 min-h-screen">
                <FloatingToolbar />
                {showEditor && (
                    <NotionEditor blocks={editorBlocks} onChange={handleBlockChanges} />
                )}
            </div>

            {/* Show the panel for host always, and for guests once they're granted access */}
            {isReady && (isHost || accessStatus === 'granted') && (
                <CollabPanel
                    role={role}
                    localDisplayName={localDisplayName || (isHost ? 'Host' : 'Guest')}
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