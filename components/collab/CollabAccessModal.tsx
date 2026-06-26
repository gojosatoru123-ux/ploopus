'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldX, Users, DoorClosed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
    status: 'idle' | 'pending' | 'granted' | 'denied' | 'room_full';
    /** Pre-filled from localStorage if the guest has visited this room before */
    savedName?: string;
    onRequestAccess: (displayName: string) => void;
}

export default function CollabAccessModal({ status, savedName = '', onRequestAccess }: Props) {
    const visible = status === 'idle' || status === 'pending' || status === 'denied' || status === 'room_full';
    const [name, setName] = useState(savedName);

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
        if (savedName)              return `Welcome back, ${savedName}! Confirm your name or change it below.`;
        return "Enter your name so the host knows who's knocking.";
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="collab-modal-backdrop"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
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

                        {status === 'idle' && (
                            <div className="w-full flex flex-col gap-3">
                                <Input
                                    placeholder="Your display name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && name.trim()) onRequestAccess(name.trim());
                                    }}
                                    autoFocus
                                    className="text-center"
                                />
                                <Button
                                    className="w-full"
                                    disabled={!name.trim()}
                                    onClick={() => onRequestAccess(name.trim())}
                                >
                                    {savedName ? 'Rejoin session' : 'Request access'}
                                </Button>
                            </div>
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