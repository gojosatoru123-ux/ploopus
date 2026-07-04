'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { NoteBlock } from '@/lib/types';

export type CollabRole = 'host' | 'guest' | 'idle';

export interface PendingGuest {
    peerId: string;
    displayName: string;
    email: string;
    requestedAt: number;
}
export interface ConnectedPeer {
    peerId: string;
    displayName: string;
    email: string;
    isHost?: boolean;
}

// ─── Room limit ───────────────────────────────────────────────────────────────
const MAX_ROOM_SIZE = 10;

// ─── Wire messages ────────────────────────────────────────────────────────────
// email is the unique identity — displayName is for UI only.

type Msg =
    | { type: 'ACCESS_REQUEST'; displayName: string; email: string }
    | { type: 'ACCESS_GRANTED'; blocks: NoteBlock[]; roster: RosterEntry[] }
    | { type: 'ACCESS_DENIED' }
    | { type: 'ROOM_FULL' }
    | { type: 'SYNC'; blocks: NoteBlock[] }
    | { type: 'ROSTER'; roster: RosterEntry[] }
    | { type: 'HOST_LEAVING' };

interface RosterEntry {
    peerId: string;
    displayName: string;
    email: string;
    isHost?: boolean;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
// collab:<roomId>:approvedEmails — host's approved email set

function lsKey(roomId: string, suffix: string) {
    return `collab:${roomId}:${suffix}`;
}

function loadApprovedEmails(roomId: string): Set<string> {
    try {
        const raw = localStorage.getItem(lsKey(roomId, 'approvedEmails'));
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
        return new Set();
    }
}
function saveApprovedEmails(roomId: string, set: Set<string>) {
    localStorage.setItem(lsKey(roomId, 'approvedEmails'), JSON.stringify([...set]));
}
function addApprovedEmail(roomId: string, email: string) {
    const set = loadApprovedEmails(roomId);
    set.add(email);
    saveApprovedEmails(roomId, set);
}
function removeApprovedEmail(roomId: string, email: string) {
    const set = loadApprovedEmails(roomId);
    set.delete(email);
    saveApprovedEmails(roomId, set);
}

// ─── Peer ID derivation (host) ────────────────────────────────────────────────

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
    displayName: string;
    email: string;
}

interface UseCollaborationReturn {
    role: CollabRole;
    sharedBlocks: NoteBlock[];
    connectedPeers: ConnectedPeer[];
    pendingGuests: PendingGuest[];
    accessStatus: 'idle' | 'pending' | 'granted' | 'denied' | 'room_full' | 'host_left';
    isReady: boolean;
    approveGuest: (peerId: string) => void;
    denyGuest: (peerId: string) => void;
    applyLocalChange: (blocks: NoteBlock[]) => void;
    /** Host only: broadcast HOST_LEAVING to all guests then destroy peer */
    endSession: () => void;
}

export function useCollaboration({
    roomId,
    initialBlocks,
    isHost,
    displayName,
    email,
}: UseCollaborationOptions): UseCollaborationReturn {
    const role: CollabRole = isHost ? 'host' : roomId ? 'guest' : 'idle';

    // ── PeerJS ────────────────────────────────────────────────────────────────
    const peerRef        = useRef<Peer | null>(null);
    const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const retryCountRef  = useRef(0);
    const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Stable ref mirrors ────────────────────────────────────────────────────
    const isHostRef      = useRef(isHost);
    const displayNameRef = useRef(displayName);
    const emailRef       = useRef(email);
    const roomIdRef      = useRef(roomId);
    useEffect(() => { isHostRef.current      = isHost;      }, [isHost]);
    useEffect(() => { displayNameRef.current = displayName; }, [displayName]);
    useEffect(() => { emailRef.current       = email;       }, [email]);
    useEffect(() => { roomIdRef.current      = roomId;      }, [roomId]);

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
    const [accessStatus,   setAccessStatus]   = useState<'idle' | 'pending' | 'granted' | 'denied' | 'room_full' | 'host_left'>('idle');
    const [isReady,        setIsReady]        = useState(false);

    const pendingGuestsRef  = useRef<PendingGuest[]>([]);
    const connectedPeersRef = useRef<ConnectedPeer[]>([]);
    useEffect(() => { pendingGuestsRef.current  = pendingGuests;  }, [pendingGuests]);
    useEffect(() => { connectedPeersRef.current = connectedPeers; }, [connectedPeers]);

    const isApplyingRemoteRef = useRef(false);

    // ── Roster helpers ────────────────────────────────────────────────────────

    const buildRoster = useCallback(
        (peers: ConnectedPeer[]): RosterEntry[] => [
            {
                peerId:      hostPeerIdForRoom(roomId),
                displayName: displayNameRef.current,
                email:       emailRef.current,
                isHost:      true,
            },
            ...peers.map((p) => ({
                peerId:      p.peerId,
                displayName: p.displayName,
                email:       p.email,
            })),
        ],
        [roomId]
    );

    const broadcastRosterRef = useRef<(peers: ConnectedPeer[]) => void>(() => {});

    const setConnectedPeersAndBroadcast = useCallback(
        (updater: (prev: ConnectedPeer[]) => ConnectedPeer[]) => {
            setConnectedPeers((prev) => {
                const next = updater(prev);
                setTimeout(() => broadcastRosterRef.current(next), 0);
                return next;
            });
        },
        []
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
    useEffect(() => { broadcastRosterRef.current = broadcastRoster; }, [broadcastRoster]);

    // ── Broadcast blocks ──────────────────────────────────────────────────────

    const broadcastBlocks = useCallback((blocks: NoteBlock[]) => {
        const msg: Msg = { type: 'SYNC', blocks };
        connectionsRef.current.forEach((conn) => {
            if (conn.open) conn.send(msg);
        });
    }, []);

    const broadcastBlocksRef = useRef(broadcastBlocks);
    useEffect(() => { broadcastBlocksRef.current = broadcastBlocks; }, [broadcastBlocks]);

    // ── Wire a DataConnection ─────────────────────────────────────────────────

    const wireConnection = useCallback((conn: DataConnection) => {
        conn.on('data', (raw) => {
            const msg = raw as Msg;

            // ── ACCESS_REQUEST ────────────────────────────────────────────────
            if (msg.type === 'ACCESS_REQUEST' && isHostRef.current) {
                connectionsRef.current.set(conn.peer, conn);

                const approvedEmails   = loadApprovedEmails(roomIdRef.current);
                const isReturning      = approvedEmails.has(msg.email);
                const currentOccupancy = connectedPeersRef.current.length + 1; // +1 for host

                // Room full — only block new guests, not returning approved ones
                if (!isReturning && currentOccupancy >= MAX_ROOM_SIZE) {
                    conn.send({ type: 'ROOM_FULL' } as Msg);
                    setTimeout(() => conn.close(), 300);
                    connectionsRef.current.delete(conn.peer);
                    return;
                }

                if (isReturning) {
                    // Auto-approve: deduplicate by email (unique identity)
                    const nextPeers: ConnectedPeer[] = [
                        ...connectedPeersRef.current.filter((p) => p.email !== msg.email),
                        { peerId: conn.peer, displayName: msg.displayName, email: msg.email },
                    ];
                    conn.send({
                        type: 'ACCESS_GRANTED',
                        blocks: sharedBlocksRef.current,
                        roster: buildRoster(nextPeers),
                    } as Msg);
                    setConnectedPeersAndBroadcast(() => nextPeers);
                } else {
                    // Normal flow: show knock to host
                    setPendingGuests((prev) => [
                        ...prev.filter((g) => g.email !== msg.email),
                        {
                            peerId:      conn.peer,
                            displayName: msg.displayName,
                            email:       msg.email,
                            requestedAt: Date.now(),
                        },
                    ]);
                }
            }

            // ── ACCESS_GRANTED ────────────────────────────────────────────────
            if (msg.type === 'ACCESS_GRANTED') {
                setAccessStatus('granted');
                isApplyingRemoteRef.current = true;
                updateBlocks(msg.blocks);
                // Filter self out — guest is shown as "You" in CollabPanel
                setConnectedPeers(
                    msg.roster
                        .filter((r) => r.email !== emailRef.current)
                        .map((r) => ({
                            peerId:      r.peerId,
                            displayName: r.displayName,
                            email:       r.email,
                            isHost:      r.isHost,
                        }))
                );
                Promise.resolve().then(() => { isApplyingRemoteRef.current = false; });
            }

            // ── ACCESS_DENIED ─────────────────────────────────────────────────
            if (msg.type === 'ACCESS_DENIED') {
                setAccessStatus('denied');
                conn.close();
            }

            // ── ROOM_FULL ─────────────────────────────────────────────────────
            if (msg.type === 'ROOM_FULL') {
                setAccessStatus('room_full');
                conn.close();
            }

            // ── HOST_LEAVING ──────────────────────────────────────────────────
            // Host is shutting down gracefully. Surface to UI so guest can
            // save a copy. Editor stays readable — don't close the connection
            // here, it will drop naturally when the host destroys their peer.
            if (msg.type === 'HOST_LEAVING') {
                setAccessStatus('host_left');
            }

            // ── SYNC ──────────────────────────────────────────────────────────
            if (msg.type === 'SYNC') {
                isApplyingRemoteRef.current = true;
                updateBlocks(msg.blocks);
                // Host fans out to all other approved peers
                if (isHostRef.current) {
                    connectionsRef.current.forEach((otherConn, otherPeerId) => {
                        if (otherPeerId !== conn.peer && otherConn.open) {
                            otherConn.send({ type: 'SYNC', blocks: msg.blocks } as Msg);
                        }
                    });
                }
                Promise.resolve().then(() => { isApplyingRemoteRef.current = false; });
            }

            // ── ROSTER ────────────────────────────────────────────────────────
            if (msg.type === 'ROSTER') {
                // Filter self out — same as ACCESS_GRANTED
                setConnectedPeers(
                    msg.roster
                        .filter((r) => r.email !== emailRef.current)
                        .map((r) => ({
                            peerId:      r.peerId,
                            displayName: r.displayName,
                            email:       r.email,
                            isHost:      r.isHost,
                        }))
                );
            }
        });

        conn.on('close', () => {
            connectionsRef.current.delete(conn.peer);
            setPendingGuests((prev) => prev.filter((g) => g.peerId !== conn.peer));

            if (isHostRef.current) {
                // Find the email of the closing peer
                const closingEmail = connectedPeersRef.current.find(
                    (p) => p.peerId === conn.peer
                )?.email;

                // Only evict if no other open connection for the same email exists
                // (same person in two tabs — closing one shouldn't evict them)
                const sameEmailStillConnected = closingEmail
                    ? connectedPeersRef.current
                        .filter((p) => p.email === closingEmail && p.peerId !== conn.peer)
                        .some((p) => connectionsRef.current.get(p.peerId)?.open)
                    : false;

                if (!sameEmailStillConnected) {
                    setConnectedPeersAndBroadcast((prev) =>
                        prev.filter((p) => p.peerId !== conn.peer)
                    );
                }
            } else {
                setConnectedPeers((prev) => prev.filter((p) => p.peerId !== conn.peer));
            }
        });

        conn.on('error', (err) => console.error('[collab] conn error', err));
    }, [updateBlocks, setConnectedPeersAndBroadcast, buildRoster]);

    // ── Guest: connect to host ────────────────────────────────────────────────

    const connectToHost = useCallback((peer: Peer, hostPeerId: string) => {
        const conn = peer.connect(hostPeerId, { reliable: true });

        wireConnection(conn);

        conn.on('open', () => {
            retryCountRef.current = 0;
            connectionsRef.current.set(hostPeerId, conn);
            conn.send({
                type:        'ACCESS_REQUEST',
                displayName: displayNameRef.current,
                email:       emailRef.current,
            } as Msg);
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
        const conn  = connectionsRef.current.get(peerId);
        if (!conn) return;

        const guest = pendingGuestsRef.current.find((g) => g.peerId === peerId);

        // Guard: room may have filled while guest was waiting in queue
        if (connectedPeersRef.current.length + 1 >= MAX_ROOM_SIZE) {
            conn.send({ type: 'ROOM_FULL' } as Msg);
            setTimeout(() => conn.close(), 300);
            connectionsRef.current.delete(peerId);
            setPendingGuests((prev) => prev.filter((g) => g.peerId !== peerId));
            return;
        }

        // Deduplicate by email
        const nextPeers: ConnectedPeer[] = [
            ...connectedPeersRef.current.filter((p) =>
                p.peerId !== peerId && p.email !== guest?.email
            ),
            ...(guest ? [{ peerId, displayName: guest.displayName, email: guest.email }] : []),
        ];

        conn.send({
            type:   'ACCESS_GRANTED',
            blocks: sharedBlocksRef.current,
            roster: buildRoster(nextPeers),
        } as Msg);

        // Persist by email so this person auto-rejoins on refresh / new tab
        if (guest?.email) addApprovedEmail(roomId, guest.email);

        setPendingGuests((prev) => prev.filter((g) => g.peerId !== peerId));
        setConnectedPeersAndBroadcast(() => nextPeers);
    }, [roomId, buildRoster, setConnectedPeersAndBroadcast]);

    // ── Host: deny ────────────────────────────────────────────────────────────

    const denyGuest = useCallback((peerId: string) => {
        const conn = connectionsRef.current.get(peerId);
        if (conn) {
            conn.send({ type: 'ACCESS_DENIED' } as Msg);
            setTimeout(() => conn.close(), 300);
            connectionsRef.current.delete(peerId);
        }
        const deniedGuest = pendingGuestsRef.current.find((g) => g.peerId === peerId);
        if (deniedGuest?.email) removeApprovedEmail(roomId, deniedGuest.email);
        setPendingGuests((prev) => prev.filter((g) => g.peerId !== peerId));
    }, [roomId]);

    // ── Apply local editor change ─────────────────────────────────────────────

    const applyLocalChange = useCallback((blocks: NoteBlock[]) => {
        if (isApplyingRemoteRef.current) return;
        if (JSON.stringify(sharedBlocksRef.current) === JSON.stringify(blocks)) return;
        updateBlocks(blocks);
        broadcastBlocksRef.current(blocks);
    }, [updateBlocks]);

    // ── Host: end session ─────────────────────────────────────────────────────
    // 1. Broadcast HOST_LEAVING synchronously — DataChannel send is fire-and-forget,
    //    never blocks or hangs regardless of peer state.
    // 2. Destroy peer after 300 ms so the message has time to flush through
    //    the DataChannel before the underlying RTCPeerConnection closes.
    // CollabPage calls this then navigates away after a further 100 ms gap.

    const endSession = useCallback(() => {
        if (!isHostRef.current) return;
        const msg: Msg = { type: 'HOST_LEAVING' };
        connectionsRef.current.forEach((conn) => {
            try { if (conn.open) conn.send(msg); } catch { /* ignore closed conn */ }
        });
        setTimeout(() => {
            peerRef.current?.destroy();
            peerRef.current = null;
            connectionsRef.current.clear();
            setIsReady(false);
        }, 300);
    }, []);

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
        endSession,
    };
}