'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import * as Y from 'yjs';
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
    conn: DataConnection;
}

// ─── Wire messages ────────────────────────────────────────────────────────────

type Msg =
    | { type: 'ACCESS_REQUEST'; displayName: string }
    | { type: 'ACCESS_GRANTED'; update: number[] }   // full Y.Doc state
    | { type: 'ACCESS_DENIED' }
    | { type: 'SYNC'; update: number[] };             // incremental Y.Doc update

// ─── Peer ID derivation ───────────────────────────────────────────────────────
// PeerJS public server requires IDs ≤ 50 chars, alphanumeric + hyphen only.
// We hash the roomId to 8 hex chars and prefix with "nh" → always 10 chars.

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
    /** Guests: pass '' until the user submits their name to gate PeerJS init. */
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
    /** Call with the full updated blocks array on every editor onChange */
    applyLocalChange: (blocks: NoteBlock[]) => void;
}

export function useCollaboration({
    roomId,
    initialBlocks,
    isHost,
    displayName = 'Anonymous',
}: UseCollaborationOptions): UseCollaborationReturn {
    const role: CollabRole = isHost ? 'host' : roomId ? 'guest' : 'idle';

    // ── Yjs ───────────────────────────────────────────────────────────────────
    const ydocRef = useRef<Y.Doc>(new Y.Doc());
    // blocks live at ydoc.getArray<NoteBlock>('blocks')

    // ── PeerJS ────────────────────────────────────────────────────────────────
    const peerRef = useRef<Peer | null>(null);
    const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const retryCountRef = useRef(0);
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── React state ───────────────────────────────────────────────────────────
    const [sharedBlocks, setSharedBlocks] = useState<NoteBlock[]>(initialBlocks);
    const [connectedPeers, setConnectedPeers] = useState<ConnectedPeer[]>([]);
    const [pendingGuests, setPendingGuests] = useState<PendingGuest[]>([]);
    const [accessStatus, setAccessStatus] = useState<'idle' | 'pending' | 'granted' | 'denied'>('idle');
    const [isReady, setIsReady] = useState(false);

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Read current blocks out of the Y.Array and push to React state */
    const flushBlocks = useCallback(() => {
        const arr = ydocRef.current.getArray<NoteBlock>('blocks');
        setSharedBlocks(arr.toArray());
    }, []);

    /** Encode the full Y.Doc state as a transferable number[] */
    const encodeFullState = useCallback((): number[] => {
        return Array.from(Y.encodeStateAsUpdate(ydocRef.current));
    }, []);

    /** Apply an incoming Y.Doc update (from any peer) */
    const applyRemoteUpdate = useCallback(
        (update: number[]) => {
            Y.applyUpdate(ydocRef.current, new Uint8Array(update));
            flushBlocks();
        },
        [flushBlocks]
    );

    /** Broadcast a Y.Doc update to all currently connected peers */
    const broadcastUpdate = useCallback((update: Uint8Array) => {
        const msg: Msg = { type: 'SYNC', update: Array.from(update) };
        connectionsRef.current.forEach((conn) => {
            if (conn.open) conn.send(msg);
        });
    }, []);

    // ── Wire a DataConnection ─────────────────────────────────────────────────

    const wireConnection = useCallback(
        (conn: DataConnection) => {
            conn.on('data', (raw) => {
                const msg = raw as Msg;

                if (msg.type === 'ACCESS_REQUEST' && isHost) {
                    connectionsRef.current.set(conn.peer, conn);
                    setPendingGuests((prev) => [
                        ...prev.filter((g) => g.peerId !== conn.peer),
                        { peerId: conn.peer, displayName: msg.displayName, requestedAt: Date.now() },
                    ]);
                }

                if (msg.type === 'ACCESS_GRANTED') {
                    setAccessStatus('granted');
                    applyRemoteUpdate(msg.update); // hydrate Y.Doc from host snapshot
                }

                if (msg.type === 'ACCESS_DENIED') {
                    setAccessStatus('denied');
                    conn.close();
                }

                if (msg.type === 'SYNC') {
                    applyRemoteUpdate(msg.update);
                    // Host fans the update out to all other peers
                    if (isHost) {
                        const raw = new Uint8Array(msg.update);
                        connectionsRef.current.forEach((otherConn, otherPeerId) => {
                            if (otherPeerId !== conn.peer && otherConn.open)
                                otherConn.send({ type: 'SYNC', update: msg.update } as Msg);
                        });
                    }
                }
            });

            conn.on('close', () => {
                connectionsRef.current.delete(conn.peer);
                setConnectedPeers((prev) => prev.filter((p) => p.peerId !== conn.peer));
                setPendingGuests((prev) => prev.filter((g) => g.peerId !== conn.peer));
            });

            conn.on('error', (err) => console.error('[collab] conn error', err));
        },
        [isHost, applyRemoteUpdate]
    );

    // ── Guest: connect to host (with retry) ──────────────────────────────────

    const connectToHost = useCallback(
        (peer: Peer, hostPeerId: string) => {
            const conn = peer.connect(hostPeerId, { reliable: true });

            conn.on('open', () => {
                retryCountRef.current = 0;
                connectionsRef.current.set(hostPeerId, conn);
                wireConnection(conn);
                conn.send({ type: 'ACCESS_REQUEST', displayName } as Msg);
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
        },
        [displayName, wireConnection]
    );

    // ── PeerJS lifecycle ──────────────────────────────────────────────────────

    useEffect(() => {
        if (!roomId) return; // guests: wait until name submitted

        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryCountRef.current = 0;

        const myPeerId = isHost ? hostPeerIdForRoom(roomId) : undefined;
        const peer = new Peer(myPeerId as string, { debug: 1 });
        peerRef.current = peer;

        // Register BEFORE open so no connections are missed
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
            setIsReady(false);
        };
    }, [roomId, isHost, connectToHost, wireConnection]);

    // ── Seed Y.Doc from OPFS blocks (host only, once) ────────────────────────

    const seeded = useRef(false);
    useEffect(() => {
        if (!isHost || seeded.current || !initialBlocks.length) return;
        seeded.current = true;
        const arr = ydocRef.current.getArray<NoteBlock>('blocks');
        ydocRef.current.transact(() => {
            arr.delete(0, arr.length);
            arr.insert(0, initialBlocks);
        });
        setSharedBlocks(initialBlocks);
    }, [isHost, initialBlocks]);

    // ── Subscribe to local Y.Doc changes so we can broadcast them ────────────

    useEffect(() => {
        const ydoc = ydocRef.current;
        const handler = (update: Uint8Array, origin: unknown) => {
            // origin === null means the change came from our own transact() call
            if (origin === null) broadcastUpdate(update);
        };
        ydoc.on('update', handler);
        return () => ydoc.off('update', handler);
    }, [broadcastUpdate]);

    // ── Host: approve ─────────────────────────────────────────────────────────

    const approveGuest = useCallback(
        (peerId: string) => {
            const conn = connectionsRef.current.get(peerId);
            if (!conn) return;

            // Send full Y.Doc state so the guest starts in sync
            conn.send({ type: 'ACCESS_GRANTED', update: encodeFullState() } as Msg);

            setPendingGuests((prev) => {
                const guest = prev.find((g) => g.peerId === peerId);
                if (guest) {
                    setConnectedPeers((cp) => [
                        ...cp.filter((p) => p.peerId !== peerId),
                        { peerId, displayName: guest.displayName, conn },
                    ]);
                }
                return prev.filter((g) => g.peerId !== peerId);
            });
        },
        [encodeFullState]
    );

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

    const applyLocalChange = useCallback(
        (blocks: NoteBlock[]) => {
            const arr = ydocRef.current.getArray<NoteBlock>('blocks');
            // transact with origin=null so the update handler knows to broadcast it
            ydocRef.current.transact(() => {
                arr.delete(0, arr.length);
                arr.insert(0, blocks);
            }, null);
            setSharedBlocks(blocks);
        },
        []
    );

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