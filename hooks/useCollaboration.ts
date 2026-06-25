'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { NoteBlock } from '@/lib/types';

export type CollabRole = 'host' | 'guest' | 'idle';

export interface PendingGuest {
    peerId: string;
    displayName: string;
    requestedAt: number;
}
export interface ConnectedPeer {
    peerId: string;
    displayName: string;
    isHost?: boolean;
}

// ─── Wire messages ────────────────────────────────────────────────────────────

type Msg =
    | { type: 'ACCESS_REQUEST'; displayName: string }
    | { type: 'ACCESS_GRANTED'; blocks: NoteBlock[]; roster: RosterEntry[] }
    | { type: 'ACCESS_DENIED' }
    | { type: 'SYNC'; blocks: NoteBlock[] }
    | { type: 'ROSTER'; roster: RosterEntry[] };

// Lightweight peer descriptor sent in roster broadcasts
interface RosterEntry {
    peerId: string;
    displayName: string;
    isHost?: boolean;
}

// ─── Peer ID derivation ───────────────────────────────────────────────────────

function djb2(str: string): number {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    return h;
}
function hostPeerIdForRoom(roomId: string): string {
    return `nh${djb2(roomId).toString(16).padStart(8, '0')}`;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseCollaborationOptions {
    roomId: string;
    initialBlocks: NoteBlock[];
    isHost: boolean;
    displayName?: string;
}

interface UseCollaborationReturn {
    role: CollabRole;
    sharedBlocks: NoteBlock[];
    connectedPeers: ConnectedPeer[];
    pendingGuests: PendingGuest[];
    accessStatus: 'idle' | 'pending' | 'granted' | 'denied';
    isReady: boolean;
    approveGuest: (peerId: string) => void;
    denyGuest: (peerId: string) => void;
    applyLocalChange: (blocks: NoteBlock[]) => void;
}

export function useCollaboration({
    roomId,
    initialBlocks,
    isHost,
    displayName = 'Anonymous',
}: UseCollaborationOptions): UseCollaborationReturn {
    const role: CollabRole = isHost ? 'host' : roomId ? 'guest' : 'idle';

    // ── PeerJS ────────────────────────────────────────────────────────────────
    const peerRef        = useRef<Peer | null>(null);
    // For host: maps peerId → { conn, displayName } for approved peers
    // For guest: just holds the single host connection
    const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const retryCountRef  = useRef(0);
    const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Stable ref mirrors ────────────────────────────────────────────────────
    const isHostRef      = useRef(isHost);
    const displayNameRef = useRef(displayName);
    useEffect(() => { isHostRef.current      = isHost;      }, [isHost]);
    useEffect(() => { displayNameRef.current = displayName; }, [displayName]);

    // ── Shared blocks ─────────────────────────────────────────────────────────
    const [sharedBlocks, setSharedBlocks] = useState<NoteBlock[]>(initialBlocks);
    const sharedBlocksRef                 = useRef<NoteBlock[]>(initialBlocks);

    const updateBlocks = useCallback((blocks: NoteBlock[]) => {
        sharedBlocksRef.current = blocks;
        setSharedBlocks(blocks);
    }, []);

    // ── Peers & guests ────────────────────────────────────────────────────────
    const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
    const [pendingGuests,  setPendingGuests]  = useState<PendingGuest[]>([]);
    const [accessStatus,   setAccessStatus]   = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
    const [isReady,        setIsReady]        = useState(false);

    // Ref mirrors for synchronous reads inside stable callbacks
    const pendingGuestsRef  = useRef<PendingGuest[]>([]);
    const connectedPeersRef = useRef<ConnectedPeer[]>([]);
    useEffect(() => { pendingGuestsRef.current  = pendingGuests;  }, [pendingGuests]);
    useEffect(() => { connectedPeersRef.current = connectedPeers; }, [connectedPeers]);

    const isApplyingRemoteRef = useRef(false);

    // ── Roster helpers (host only) ────────────────────────────────────────────
    // Builds a full roster including the host and broadcasts it to all approved
    // peers so every guest knows who else is in the room.

    const buildRoster = useCallback(
        (peers: ConnectedPeer[]): RosterEntry[] => [
            { peerId: hostPeerIdForRoom(roomId), displayName: displayNameRef.current, isHost: true },
            ...peers.map((p) => ({ peerId: p.peerId, displayName: p.displayName })),
        ],
        [roomId]
    );

    const broadcastRoster = useCallback(
        (peers: ConnectedPeer[]) => {
            if (!isHostRef.current) return;
            const msg: Msg = { type: 'ROSTER', roster: buildRoster(peers) };
            connectionsRef.current.forEach((conn) => {
                if (conn.open) conn.send(msg);
            });
        },
        [buildRoster]
    );

    const broadcastRosterRef = useRef(broadcastRoster);
    useEffect(() => { broadcastRosterRef.current = broadcastRoster; }, [broadcastRoster]);

    // Wrapper: update connectedPeers state and immediately broadcast the new roster
    const setConnectedPeersAndBroadcast = useCallback(
        (updater: (prev: ConnectedPeer[]) => ConnectedPeer[]) => {
            setConnectedPeers((prev) => {
                const next = updater(prev);
                // Schedule broadcast after state is committed
                setTimeout(() => broadcastRosterRef.current(next), 0);
                return next;
            });
        },
        []
    );

    // ── Broadcast helpers ─────────────────────────────────────────────────────

    const broadcastBlocks = useCallback((blocks: NoteBlock[], excludePeerId?: string) => {
        const msg: Msg = { type: 'SYNC', blocks };
        connectionsRef.current.forEach((conn, peerId) => {
            if (peerId !== excludePeerId && conn.open) conn.send(msg);
        });
    }, []);

    const broadcastBlocksRef = useRef(broadcastBlocks);
    useEffect(() => { broadcastBlocksRef.current = broadcastBlocks; }, [broadcastBlocks]);

    // ── Wire a DataConnection ─────────────────────────────────────────────────

    const wireConnection = useCallback((conn: DataConnection) => {
        conn.on('data', (raw) => {
            const msg = raw as Msg;

            if (msg.type === 'ACCESS_REQUEST' && isHostRef.current) {
                connectionsRef.current.set(conn.peer, conn);
                setPendingGuests((prev) => [
                    ...prev.filter((g) => g.peerId !== conn.peer),
                    { peerId: conn.peer, displayName: msg.displayName, requestedAt: Date.now() },
                ]);
            }

            if (msg.type === 'ACCESS_GRANTED') {
                setAccessStatus('granted');
                isApplyingRemoteRef.current = true;
                updateBlocks(msg.blocks);
                // Hydrate the guest's peer list from the host's roster snapshot
                setConnectedPeers(msg.roster.map((r) => ({
                    peerId: r.peerId,
                    displayName: r.displayName,
                    isHost: r.isHost,
                })));
                Promise.resolve().then(() => { isApplyingRemoteRef.current = false; });
            }

            if (msg.type === 'ACCESS_DENIED') {
                setAccessStatus('denied');
                conn.close();
            }

            if (msg.type === 'SYNC') {
                isApplyingRemoteRef.current = true;
                updateBlocks(msg.blocks);
                // Host fans SYNC out to all other approved peers
                if (isHostRef.current) {
                    connectionsRef.current.forEach((otherConn, otherPeerId) => {
                        if (otherPeerId !== conn.peer && otherConn.open) {
                            otherConn.send({ type: 'SYNC', blocks: msg.blocks } as Msg);
                        }
                    });
                }
                Promise.resolve().then(() => { isApplyingRemoteRef.current = false; });
            }

            // Guest receives roster update from host
            if (msg.type === 'ROSTER') {
                setConnectedPeers(msg.roster.map((r) => ({
                    peerId: r.peerId,
                    displayName: r.displayName,
                    isHost: r.isHost,
                })));
            }
        });

        conn.on('close', () => {
            connectionsRef.current.delete(conn.peer);
            setPendingGuests((prev) => prev.filter((g) => g.peerId !== conn.peer));
            if (isHostRef.current) {
                // Remove from connectedPeers and broadcast the updated roster
                setConnectedPeersAndBroadcast((prev) =>
                    prev.filter((p) => p.peerId !== conn.peer)
                );
            } else {
                // Guest: mark the peer as gone in local list
                setConnectedPeers((prev) => prev.filter((p) => p.peerId !== conn.peer));
            }
        });

        conn.on('error', (err) => console.error('[collab] conn error', err));
    }, [updateBlocks, setConnectedPeersAndBroadcast]);

    // ── Guest: connect to host ────────────────────────────────────────────────

    const connectToHost = useCallback((peer: Peer, hostPeerId: string) => {
        const conn = peer.connect(hostPeerId, { reliable: true });

        wireConnection(conn);

        conn.on('open', () => {
            retryCountRef.current = 0;
            connectionsRef.current.set(hostPeerId, conn);
            conn.send({ type: 'ACCESS_REQUEST', displayName: displayNameRef.current } as Msg);
            setAccessStatus('pending');
        });

        conn.on('error', () => {
            if (retryCountRef.current < 5) {
                retryCountRef.current += 1;
                retryTimerRef.current = setTimeout(() => connectToHost(peer, hostPeerId), 1000);
            } else {
                console.error('[collab] host unreachable after retries');
                setAccessStatus('denied');
            }
        });
    }, [wireConnection]);

    // ── PeerJS lifecycle ──────────────────────────────────────────────────────

    useEffect(() => {
        if (!roomId) return;

        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryCountRef.current = 0;

        const peer = isHost
            ? new Peer(hostPeerIdForRoom(roomId), { debug: 1 })
            : new Peer({ debug: 1 });

        peerRef.current = peer;

        if (isHost) {
            peer.on('connection', (conn) => wireConnection(conn));
        }

        peer.on('open', () => {
            setIsReady(true);
            if (!isHost) connectToHost(peer, hostPeerIdForRoom(roomId));
        });

        peer.on('error', (err: any) => {
            if (!isHost && err?.type === 'peer-unavailable') {
                if (retryCountRef.current < 5) {
                    retryCountRef.current += 1;
                    retryTimerRef.current = setTimeout(
                        () => connectToHost(peer, hostPeerIdForRoom(roomId)),
                        1000
                    );
                } else {
                    setAccessStatus('denied');
                }
                return;
            }
            console.error('[collab] peer error', err?.type, err);
        });

        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            peer.destroy();
            peerRef.current = null;
            connectionsRef.current.clear();
            setIsReady(false);
        };
    }, [roomId, isHost, connectToHost, wireConnection]);

    // ── Seed shared blocks from OPFS (host only, once) ───────────────────────

    const seeded = useRef(false);
    useEffect(() => {
        if (!isHost || seeded.current || !initialBlocks.length) return;
        seeded.current = true;
        updateBlocks(initialBlocks);
    }, [isHost, initialBlocks, updateBlocks]);

    // ── Host: approve ─────────────────────────────────────────────────────────

    const approveGuest = useCallback((peerId: string) => {
        const conn = connectionsRef.current.get(peerId);
        if (!conn) return;

        const guest = pendingGuestsRef.current.find((g) => g.peerId === peerId);

        // Build next connectedPeers synchronously so we can include it in
        // ACCESS_GRANTED's roster snapshot before the state update lands.
        const nextPeers: ConnectedPeer[] = [
            ...connectedPeersRef.current.filter((p) => p.peerId !== peerId),
            ...(guest ? [{ peerId, displayName: guest.displayName }] : []),
        ];

        conn.send({
            type: 'ACCESS_GRANTED',
            blocks: sharedBlocksRef.current,
            roster: buildRoster(nextPeers),
        } as Msg);

        setPendingGuests((prev) => prev.filter((g) => g.peerId !== peerId));
        setConnectedPeersAndBroadcast(() => nextPeers);
    }, [buildRoster, setConnectedPeersAndBroadcast]);

    // ── Host: deny ────────────────────────────────────────────────────────────

    const denyGuest = useCallback((peerId: string) => {
        const conn = connectionsRef.current.get(peerId);
        if (conn) {
            conn.send({ type: 'ACCESS_DENIED' } as Msg);
            setTimeout(() => conn.close(), 300);
            connectionsRef.current.delete(peerId);
        }
        setPendingGuests((prev) => prev.filter((g) => g.peerId !== peerId));
    }, []);

    // ── Apply local editor change ─────────────────────────────────────────────

    const applyLocalChange = useCallback((blocks: NoteBlock[]) => {
        if (isApplyingRemoteRef.current) return;
        if (JSON.stringify(sharedBlocksRef.current) === JSON.stringify(blocks)) return;
        updateBlocks(blocks);
        broadcastBlocksRef.current(blocks);
    }, [updateBlocks]);

    return {
        role,
        sharedBlocks,
        connectedPeers,
        pendingGuests,
        accessStatus,
        isReady,
        approveGuest,
        denyGuest,
        applyLocalChange,
    };
}