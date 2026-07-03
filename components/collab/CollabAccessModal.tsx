'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldX, Users, DoorClosed } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    status: 'idle' | 'pending' | 'granted' | 'denied' | 'room_full' | 'host_left';
    displayName: string;
    email: string;
    onRequestAccess: () => void;
}

export default function CollabAccessModal({
    status,
    displayName,
    email,
    onRequestAccess,
}: Props) {
    const visible =
        status === 'idle' ||
        status === 'pending' ||
        status === 'denied' ||
        status === 'room_full';
    // host_left is handled by CollabSessionEndedModal — not this modal

    const icon = () => {
        if (status === 'denied')    return <ShieldX    className="h-8 w-8 text-destructive" />;
        if (status === 'room_full') return <DoorClosed className="h-8 w-8 text-amber-500" />;
        return <Users className="h-8 w-8 text-primary" />;
    };

    const iconBg = () => {
        if (status === 'denied')    return 'bg-destructive/10';
        if (status === 'room_full') return 'bg-amber-500/10';
        return 'bg-primary/10';
    };

    const title = () => {
        if (status === 'denied')    return 'Access denied';
        if (status === 'room_full') return 'Room is full';
        return 'Join collaboration';
    };

    const subtitle = () => {
        if (status === 'denied')    return "The host didn't let you in. You can close this tab.";
        if (status === 'room_full') return 'This room has reached the 10-member limit. Try again later or ask someone to leave.';
        if (status === 'pending')   return 'Your request has been sent — waiting for the host to approve you.';
        return 'You\'re joining as the account below. Click the button to request access.';
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="collab-modal-backdrop"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        key="collab-modal"
                        className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl p-8 flex flex-col items-center gap-5"
                        initial={{ scale: 0.92, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 16 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    >
                        <div className={`rounded-full p-4 ${iconBg()}`}>
                            {icon()}
                        </div>

                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-semibold tracking-tight">{title()}</h2>
                            <p className="text-sm text-muted-foreground">{subtitle()}</p>
                        </div>

                        {/* Identity card — shown in idle and pending states */}
                        {(status === 'idle' || status === 'pending') && (
                            <div className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center gap-3">
                                {/* Avatar initial */}
                                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-semibold text-primary">
                                        {displayName?.[0]?.toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-medium truncate">{displayName}</span>
                                    <span className="text-xs text-muted-foreground truncate">{email}</span>
                                </div>
                            </div>
                        )}

                        {status === 'idle' && (
                            <Button className="w-full" onClick={onRequestAccess}>
                                Request access
                            </Button>
                        )}

                        {status === 'pending' && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Waiting for host…</span>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}