'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldX, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
    status: 'idle' | 'pending' | 'granted' | 'denied';
    onRequestAccess: (displayName: string) => void;
}

export default function CollabAccessModal({ status, onRequestAccess }: Props) {
    const visible = status === 'idle' || status === 'pending' || status === 'denied';
    const [name, setName] = useState("");

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
                        {/* Icon */}
                        <div className="rounded-full bg-primary/10 p-4">
                            {status === 'denied' ? (
                                <ShieldX className="h-8 w-8 text-destructive" />
                            ) : (
                                <Users className="h-8 w-8 text-primary" />
                            )}
                        </div>
                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-semibold tracking-tight">
                                {status === 'denied' ? 'Access denied' : 'Join collaboration'}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {status === 'denied'
                                    ? "The host didn't let you in. You can close this tab."
                                    : status === 'pending'
                                        ? "Your request has been sent — waiting for the host to approve you."
                                        : "Enter your name so the host knows who's knocking."}
                            </p>
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
                                    Request access
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