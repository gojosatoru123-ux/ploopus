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

interface RosterEntry {
    peerId: string;
    displayName: string;
    isHost?: boolean;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
//
// Keys are scoped to roomId so sessions in different rooms don't interfere.
//
//  collab:<roomId>:guestPeerId   — guest's stable PeerJS peer ID
//  collab:<roomId>:guestName     — guest's display name
//  collab:<roomId>:approvedPeers — host's JSON set of approved peer IDs

function lsKey(roomId: string, suffix: string) {
    return `collab:${roomId}:${suffix}`;
}

/** Guest: persist display name so it survives refresh and new tabs */
function saveGuestName(roomId: string, name: string) {
    localStorage.setItem(lsKey(roomId, 'guestName'), name);
}
function loadGuestName(roomId: string): string {
    return localStorage.getItem(lsKey(roomId, 'guestName')) ?? '';
}

/** Host: approved display-name set (keyed by name, not peerId) */
function loadApprovedNames(roomId: string): Set<string> {
    try {
        const raw = localStorage.getItem(lsKey(roomId, 'approvedNames'));
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
        return new Set();
    }
}
function saveApprovedNames(roomId: string, set: Set<string>) {
    localStorage.setItem(lsKey(roomId, 'approvedNames'), JSON.stringify([...set]));
}
function addApprovedName(roomId: string, displayName: string) {
    const set = loadApprovedNames(roomId);
    set.add(displayName);
    saveApprovedNames(roomId, set);
}
function removeApprovedName(roomId: string, displayName: string) {
    const set = loadApprovedNames(roomId);
    set.delete(displayName);
    saveApprovedNames(roomId, set);
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
    displayName?: string;
}

interface UseCollaborationReturn {
    role: CollabRole;
    sharedBlocks: NoteBlock[];
    connectedPeers: ConnectedPeer[];
    pendingGuests: PendingGuest[];
    accessStatus: 'idle' | 'pending' | 'granted' | 'denied';
    isReady: boolean;
    /** Saved display name recovered from localStorage (guests only) */
    savedDisplayName: string;
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
    const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
    const retryCountRef  = useRef(0);
    const retryTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Stable ref mirrors ────────────────────────────────────────────────────
    const isHostRef      = useRef(isHost);
    const displayNameRef = useRef(displayName);
    const roomIdRef      = useRef(roomId);
    useEffect(() => { isHostRef.current      = isHost;      }, [isHost]);
    useEffect(() => { displayNameRef.current = displayName; }, [displayName]);
    useEffect(() => { roomIdRef.current      = roomId;      }, [roomId]);

    // ── Saved display name (guests) ───────────────────────────────────────────
    // Loaded once so CollabPage can pre-fill the name input on refresh.
    const [savedDisplayName] = useState<string>(() =>
        !isHost && roomId ? loadGuestName(roomId) : ''
    );

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

    const pendingGuestsRef  = useRef<PendingGuest[]>([]);
    const connectedPeersRef = useRef<ConnectedPeer[]>([]);
    useEffect(() => { pendingGuestsRef.current  = pendingGuests;  }, [pendingGuests]);
    useEffect(() => { connectedPeersRef.current = connectedPeers; }, [connectedPeers]);

    const isApplyingRemoteRef = useRef(false);

    // ── Roster helpers ────────────────────────────────────────────────────────

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

    // ── Broadcast blocks ──────────────────────────────────────────────────────

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

                const approvedNames = loadApprovedNames(roomIdRef.current);

                if (approvedNames.has(msg.displayName)) {
                    // ── Auto-approve ──────────────────────────────────────────
                    // Deduplicate by displayName (not peerId) so the same person
                    // reconnecting from a refresh or a new tab replaces their old
                    // entry rather than creating a second one.
                    const nextPeers: ConnectedPeer[] = [
                        ...connectedPeersRef.current.filter((p) => p.displayName !== msg.displayName),
                        { peerId: conn.peer, displayName: msg.displayName },
                    ];
                    conn.send({
                        type: 'ACCESS_GRANTED',
                        blocks: sharedBlocksRef.current,
                        roster: buildRoster(nextPeers),
                    } as Msg);
                    setConnectedPeersAndBroadcast(() => nextPeers);
                } else {
                    // ── Normal flow: show knock notification to host ───────────
                    setPendingGuests((prev) => [
                        ...prev.filter((g) => g.peerId !== conn.peer),
                        { peerId: conn.peer, displayName: msg.displayName, requestedAt: Date.now() },
                    ]);
                }
            }

            if (msg.type === 'ACCESS_GRANTED') {
                setAccessStatus('granted');
                isApplyingRemoteRef.current = true;
                updateBlocks(msg.blocks);
                // Filter out the guest's own entry — they are rendered separately
                // as "You" in CollabPanel, so including themselves in connectedPeers
                // would show them twice and inflate the count by 1.
                setConnectedPeers(msg.roster
                    .filter((r) => r.displayName !== displayNameRef.current)
                    .map((r) => ({
                        peerId: r.peerId,
                        displayName: r.displayName,
                        isHost: r.isHost,
                    }))
                );
                Promise.resolve().then(() => { isApplyingRemoteRef.current = false; });
            }

            if (msg.type === 'ACCESS_DENIED') {
                setAccessStatus('denied');
                conn.close();
            }

            if (msg.type === 'SYNC') {
                isApplyingRemoteRef.current = true;
                updateBlocks(msg.blocks);
                if (isHostRef.current) {
                    connectionsRef.current.forEach((otherConn, otherPeerId) => {
                        if (otherPeerId !== conn.peer && otherConn.open) {
                            otherConn.send({ type: 'SYNC', blocks: msg.blocks } as Msg);
                        }
                    });
                }
                Promise.resolve().then(() => { isApplyingRemoteRef.current = false; });
            }

            if (msg.type === 'ROSTER') {
                // Same self-filter as ACCESS_GRANTED — don't include the local
                // guest in their own connectedPeers list.
                setConnectedPeers(msg.roster
                    .filter((r) => r.displayName !== displayNameRef.current)
                    .map((r) => ({
                        peerId: r.peerId,
                        displayName: r.displayName,
                        isHost: r.isHost,
                    }))
                );
            }
        });

        conn.on('close', () => {
            connectionsRef.current.delete(conn.peer);
            setPendingGuests((prev) => prev.filter((g) => g.peerId !== conn.peer));
            if (isHostRef.current) {
                // Find the display name that's closing
                const closingName = connectedPeersRef.current.find(
                    (p) => p.peerId === conn.peer
                )?.displayName;

                // Only evict from the roster if no other open connection in
                // connectionsRef belongs to the same display name. This handles
                // the case where the same person has two tabs open — closing one
                // should not remove them from the roster while the other is live.
                const sameNameStillConnected = closingName
                    ? connectedPeersRef.current
                        .filter((p) => p.displayName === closingName && p.peerId !== conn.peer)
                        .some((p) => connectionsRef.current.get(p.peerId)?.open)
                    : false;

                if (!sameNameStillConnected) {
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
                type: 'ACCESS_REQUEST',
                displayName: displayNameRef.current,
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

        let peer: Peer;
        if (isHost) {
            peer = new Peer(hostPeerIdForRoom(roomId), { debug: 1 });
        } else {
            peer = new Peer({ debug: 1 }); // random ID fine — identity is now the display name
        }

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

        // Deduplicate by displayName — if this person already has another
        // connection (e.g. they were approved from a different tab earlier),
        // replace that entry rather than appending a second one.
        const nextPeers: ConnectedPeer[] = [
            ...connectedPeersRef.current.filter((p) =>
                p.peerId !== peerId && p.displayName !== guest?.displayName
            ),
            ...(guest ? [{ peerId, displayName: guest.displayName }] : []),
        ];

        conn.send({
            type: 'ACCESS_GRANTED',
            blocks: sharedBlocksRef.current,
            roster: buildRoster(nextPeers),
        } as Msg);

        // Persist approval by display name so any tab/refresh with this name auto-rejoins
        addApprovedName(roomId, guest?.displayName ?? '');

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
        // Remove from approved names so this person must knock again
        const deniedGuest = pendingGuestsRef.current.find((g) => g.peerId === peerId);
        if (deniedGuest) removeApprovedName(roomId, deniedGuest.displayName);
        setPendingGuests((prev) => prev.filter((g) => g.peerId !== peerId));
    }, [roomId]);

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
        savedDisplayName,
        approveGuest,
        denyGuest,
        applyLocalChange,
    };
}