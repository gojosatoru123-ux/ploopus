'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    Crown,
    Link2,
    Users,
    X,
    UserCheck,
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PendingGuest, ConnectedPeer, CollabRole } from '@/hooks/useCollaboration';

interface Props {
    role: CollabRole;
    localDisplayName: string;
    localEmail: string;
    roomUrl: string;
    pendingGuests: PendingGuest[];
    connectedPeers: ConnectedPeer[];
    onApprove: (peerId: string) => void;
    onDeny: (peerId: string) => void;
}

// Avatar colour is keyed on email (unique) not display name,
// so two people named "Alex" get different colours.
const AVATAR_COLOURS = [
    'bg-violet-500/15 text-violet-600',
    'bg-blue-500/15 text-blue-600',
    'bg-emerald-500/15 text-emerald-600',
    'bg-amber-500/15 text-amber-600',
    'bg-rose-500/15 text-rose-600',
    'bg-cyan-500/15 text-cyan-600',
    'bg-fuchsia-500/15 text-fuchsia-600',
    'bg-orange-500/15 text-orange-600',
];
function avatarColour(email: string): string {
    let h = 0;
    for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    return AVATAR_COLOURS[h % AVATAR_COLOURS.length];
}

export default function CollabPanel({
    role,
    localDisplayName,
    localEmail,
    roomUrl,
    pendingGuests,
    connectedPeers,
    onApprove,
    onDeny,
}: Props) {
    const [open,   setOpen]   = useState(true);
    const [copied, setCopied] = useState(false);

    const isHost             = role === 'host';
    const totalNotifications = pendingGuests.length;
    const totalInRoom        = connectedPeers.length + 1; // +1 for local user
    const MAX_ROOM_SIZE      = 10;

    const copyLink = async () => {
        await navigator.clipboard.writeText(roomUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed bottom-6 right-6 z-40 w-80 flex flex-col gap-0 shadow-2xl rounded-2xl overflow-hidden border border-border">

            {/* ── Header / toggle ── */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/60 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                        {isHost ? 'Collaboration' : 'In this room'}
                    </span>
                    {totalNotifications > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                            {totalNotifications}
                        </Badge>
                    )}
                    {isHost && totalInRoom >= MAX_ROOM_SIZE && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-xs text-amber-600 bg-amber-500/10">
                            Full
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    {/* +1 to include the local user (shown as "You") who is
                        filtered out of connectedPeers to avoid duplication */}
                    <span className="text-xs">
                        {isHost
                            ? `${totalInRoom} / ${MAX_ROOM_SIZE}`
                            : `${totalInRoom} connected`}
                    </span>
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </div>
            </button>

            {/* ── Body ── */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="collab-panel-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="bg-card overflow-hidden"
                    >
                        <div className="flex flex-col gap-4 p-4">

                            {/* ── Share link (host only) ── */}
                            {isHost && (
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <Link2 className="h-3 w-3" /> Share link
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <p className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate font-mono text-muted-foreground">
                                            {roomUrl}
                                        </p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={copyLink}
                                        >
                                            {copied ? (
                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* ── Pending requests (host only) ── */}
                            {isHost && pendingGuests.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Waiting to join
                                    </span>
                                    <div className="flex flex-col gap-2">
                                        <AnimatePresence>
                                            {pendingGuests.map((guest) => (
                                                <motion.div
                                                    key={guest.peerId}
                                                    initial={{ opacity: 0, y: -6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -6 }}
                                                    className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2"
                                                >
                                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${avatarColour(guest.email)}`}>
                                                        <span className="text-xs font-semibold">
                                                            {guest.displayName[0]?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">{guest.displayName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{guest.email}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => onDeny(guest.peerId)}
                                                            title="Deny"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-green-600 hover:text-green-600 hover:bg-green-600/10"
                                                            onClick={() => onApprove(guest.peerId)}
                                                            title="Approve"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            )}

                            {/* ── People in this session ── */}
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" /> In this session
                                </span>
                                <div className="flex flex-col gap-1.5">

                                    {/* Local user (always shown first) */}
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/10">
                                        <div className="relative">
                                            <div className={`h-7 w-7 rounded-full flex items-center justify-center ${avatarColour(localEmail)}`}>
                                                <span className="text-xs font-semibold">
                                                    {localDisplayName[0]?.toUpperCase()}
                                                </span>
                                            </div>
                                            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{localDisplayName}</p>
                                            <p className="text-xs text-muted-foreground truncate">{localEmail}</p>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            {isHost && (
                                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                                                    <Crown className="h-2.5 w-2.5" /> Host
                                                </span>
                                            )}
                                            <span className="text-[10px] text-muted-foreground">You</span>
                                        </div>
                                    </div>

                                    {/* Remote peers */}
                                    <AnimatePresence>
                                        {connectedPeers.map((peer) => (
                                            <motion.div
                                                key={peer.peerId}
                                                initial={{ opacity: 0, y: -4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -4 }}
                                                transition={{ duration: 0.18 }}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30"
                                            >
                                                <div className="relative">
                                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center ${avatarColour(peer.email)}`}>
                                                        <span className="text-xs font-semibold">
                                                            {peer.displayName[0]?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm truncate">{peer.displayName}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{peer.email}</p>
                                                </div>
                                                {peer.isHost && (
                                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 shrink-0">
                                                        <Crown className="h-2.5 w-2.5" /> Host
                                                    </span>
                                                )}
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>

                                    {/* Empty state (host only — guests always see at least the host) */}
                                    {isHost && connectedPeers.length === 0 && pendingGuests.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-2">
                                            No one has joined yet. Share the link above!
                                        </p>
                                    )}
                                </div>
                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}