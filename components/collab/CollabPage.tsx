/**
 * components/collab/CollabPage.tsx
 *
 * Moved out of app/ into components/ so page.tsx can import it cleanly.
 * 'use client' is declared on the page.tsx entry — this file inherits it.
 */
'use client';

import React, { useCallback, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

import NotionEditor from '@/components/NotionEditor';
import { SidebarTrigger } from '@/components/ui/sidebar';
import FloatingToolbar from '@/components/utility/FloatingToolbar';
import { useNotesContext } from '@/contexts/NotesContext';
import { useActiveNote } from '@/hooks/useActiveNotes';
import { NoteBlock } from '@/lib/types';
import { useCollaboration } from '@/hooks/useCollaboration';

import CollabAccessModal from '@/components/collab/CollabAccessModal';
import CollabHostPanel from '@/components/collab/CollabHostPanel';
import CollabStatusBar from '@/components/collab/CollabStatusBar';

export default function CollabPage() {
    const params = useParams();
    const roomId = (params?.roomId as string) ?? '';
    const searchParams = useSearchParams();
    const noteId = searchParams.get('noteid') ?? '';
    const isHost = searchParams.get('host') === '1';

    // ── OPFS note data ────────────────────────────────────────────────────────
    const { blocks, isLoading: isBlocksLoading } = useActiveNote(noteId);

    // ── Guest name gate ───────────────────────────────────────────────────────
    // guestRoomId stays '' until the guest submits their display name.
    // This prevents PeerJS from initialising prematurely (and the host from
    // seeing the guest modal, since isHost=true skips this gate entirely).
    const [guestDisplayName, setGuestDisplayName] = useState('');
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
    } = useCollaboration({
        roomId: effectiveRoomId,
        initialBlocks: blocks ?? [],
        isHost,
        displayName: guestDisplayName || 'Guest',
    });

    const handleBlockChanges = useCallback(
        (updates: NoteBlock[]) => applyLocalChange(updates),
        [applyLocalChange]
    );

    const handleRequestAccess = useCallback(
        (name: string) => {
            setGuestDisplayName(name);
            setGuestRoomId(roomId);
        },
        [roomId]
    );

    const shareUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/collab/${roomId}?noteid=${noteId}`
            : '';

    const editorBlocks = sharedBlocks.length > 0 ? sharedBlocks : (blocks ?? []);
    const showEditor = !isBlocksLoading && (isHost || accessStatus === 'granted');
    const modalStatus = guestRoomId ? accessStatus : 'idle';

    return (
        <>
            {!isHost && (
                <CollabAccessModal status={modalStatus} onRequestAccess={handleRequestAccess} />
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

            {isHost && isReady && (
                <CollabHostPanel
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