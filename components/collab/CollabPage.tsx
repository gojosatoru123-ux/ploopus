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
import { authClient } from '@/lib/auth-client';

import CollabAccessModal from '@/components/collab/CollabAccessModal';
import CollabPanel from '@/components/collab/CollabPanel';
import CollabStatusBar from '@/components/collab/CollabStatusBar';

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
    const { blocks, isLoading: isBlocksLoading } = useActiveNote(noteId);

    // ── Guest connection gate ─────────────────────────────────────────────────
    // Guests don't connect until they click "Request access" in the modal.
    // Hosts connect immediately since they have all info from the start.
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
        roomId:        effectiveRoomId,
        initialBlocks: blocks ?? [],
        isHost,
        displayName,
        email,
    });

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

    // Share URL contains only roomId — noteId is the host's private OPFS
    // identifier and is meaningless (and a minor info leak) for guests.
    const shareUrl =
        typeof window !== 'undefined'
            ? `${window.location.origin}/collab/${roomId}?noteid=cursorbits`
            : '';

    const showEditor  = !isBlocksLoading && (isHost || accessStatus === 'granted');
    const modalStatus = (guestRoomId || accessStatus === 'room_full') ? accessStatus : 'idle';

    return (
        <>
            {/* Modal only shown to guests — host connects immediately */}
            {!isHost && (
                <CollabAccessModal
                    status={modalStatus}
                    displayName={displayName}
                    email={email}
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

            {isReady && (isHost || accessStatus === 'granted') && (
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