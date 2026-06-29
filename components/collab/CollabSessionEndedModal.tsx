'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookCopy, Check, DoorOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    visible: boolean;
    onSaveCopy: () => Promise<void>;
    onDismiss: () => void;
}

export default function CollabSessionEndedModal({ visible, onSaveCopy, onDismiss }: Props) {
    const [saving, setSaving] = useState(false);
    const [saved,  setSaved]  = useState(false);

    const handleSave = async () => {
        if (saving || saved) return;
        setSaving(true);
        try {
            await onSaveCopy();
            setSaved(true);
        } catch (err) {
            console.error('[collab] guest save error', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="session-ended-backdrop"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        key="session-ended-modal"
                        className="relative w-full max-w-sm mx-4 rounded-2xl border border-border bg-card shadow-2xl p-8 flex flex-col items-center gap-5"
                        initial={{ scale: 0.92, opacity: 0, y: 16 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.92, opacity: 0, y: 16 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    >
                        <div className="rounded-full bg-amber-500/10 p-4">
                            <DoorOpen className="h-8 w-8 text-amber-500" />
                        </div>

                        <div className="text-center space-y-1">
                            <h2 className="text-xl font-semibold tracking-tight">Session ended</h2>
                            <p className="text-sm text-muted-foreground">
                                The host has ended this collaboration session.
                                Save a copy to keep the latest version in your notes.
                            </p>
                        </div>

                        <div className="w-full flex flex-col gap-2">
                            <Button className="w-full" onClick={handleSave} disabled={saving || saved}>
                                {saved ? (
                                    <span className="flex items-center gap-2">
                                        <Check className="h-4 w-4 text-green-500" /> Saved to your notes
                                    </span>
                                ) : saving ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <BookCopy className="h-4 w-4" /> Save a copy to my notes
                                    </span>
                                )}
                            </Button>
                            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onDismiss}>
                                {saved ? 'Close' : 'Dismiss without saving'}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}