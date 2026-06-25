'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    Link2,
    Users,
    X,
    UserCheck,
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PendingGuest, ConnectedPeer } from '@/hooks/useCollaboration';

interface Props {
    roomUrl: string;
    pendingGuests: PendingGuest[];
    connectedPeers: ConnectedPeer[];
    onApprove: (peerId: string) => void;
    onDeny: (peerId: string) => void;
}

export default function CollabHostPanel({
    roomUrl,
    pendingGuests,
    connectedPeers,
    onApprove,
    onDeny,
}: Props) {
    const [open, setOpen] = useState(true);
    const [copied, setCopied] = useState(false);

    const totalNotifications = pendingGuests.length;

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
                    <span className="text-sm font-medium">Collaboration</span>
                    {totalNotifications > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                            {totalNotifications}
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-xs">{connectedPeers.length} connected</span>
                    {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                </div>
            </button>

            {/* ── Body ── */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="host-panel-body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="bg-card overflow-hidden"
                    >
                        <div className="flex flex-col gap-4 p-4">
                            {/* ── Share link ── */}
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                    <Link2 className="h-3 w-3" /> Share link
                                </span>
                                <div className="flex items-center gap-2">
                                    <p className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate font-mono text-muted-foreground">
                                        {roomUrl}
                                    </p>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={copyLink}>
                                        {copied ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* ── Pending requests ── */}
                            {pendingGuests.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Waiting to join
                                    </span>
                                    <div className="flex flex-col gap-2">
                                        {pendingGuests.map((guest) => (
                                            <motion.div
                                                key={guest.peerId}
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2"
                                            >
                                                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <span className="text-xs font-semibold text-primary">
                                                        {guest.displayName[0]?.toUpperCase()}
                                                    </span>
                                                </div>
                                                <span className="flex-1 text-sm font-medium truncate">{guest.displayName}</span>
                                                <div className="flex items-center gap-1">
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
                                    </div>
                                </div>
                            )}

                            {/* ── Connected peers ── */}
                            {connectedPeers.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <UserCheck className="h-3 w-3" /> In this session
                                    </span>
                                    <div className="flex flex-col gap-1.5">
                                        {connectedPeers.map((peer) => (
                                            <div
                                                key={peer.peerId}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30"
                                            >
                                                <div className="relative">
                                                    <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                                        <span className="text-xs font-semibold text-emerald-600">
                                                            {peer.displayName[0]?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                                                </div>
                                                <span className="flex-1 text-sm truncate">{peer.displayName}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {connectedPeers.length === 0 && pendingGuests.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-2">
                                    No one has joined yet. Share the link above!
                                </p>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}