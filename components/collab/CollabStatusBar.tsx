'use client';

/**
 * CollabStatusBar.tsx
 *
 * A slim coloured strip below the main toolbar that indicates:
 *  – "Connecting…"   (isReady === false)
 *  – "Live · N collaborator(s)"  (granted, peers > 0)
 *  – "Connected to host"  (guest, granted, no extra peers shown)
 *  – nothing         (idle / not in a collab session)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Loader2 } from 'lucide-react';
import { CollabRole } from '@/hooks/useCollaboration';

interface Props {
    role: CollabRole;
    isReady: boolean;
    accessStatus: 'idle' | 'pending' | 'granted' | 'denied';
    connectedCount: number;
}

export default function CollabStatusBar({ role, isReady, accessStatus, connectedCount }: Props) {
    const visible = role !== 'idle' && accessStatus !== 'idle' && accessStatus !== 'denied';
    const isLive = isReady && (role === 'host' || accessStatus === 'granted');

    let label = '';
    if (!isReady) {
        label = 'Connecting to collaboration server…';
    } else if (role === 'host') {
        label =
            connectedCount === 0
                ? 'Live — waiting for collaborators'
                : `Live · ${connectedCount} collaborator${connectedCount > 1 ? 's' : ''}`;
    } else if (accessStatus === 'granted') {
        label = 'Collaborating live with host';
    } else if (accessStatus === 'pending') {
        label = 'Waiting for host approval…';
    }

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="collab-status"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`overflow-hidden ${isLive
                        ? 'bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400'
                        }`}
                >
                    <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium">
                        {isLive ? (
                            <Radio className="h-3 w-3 animate-pulse" />
                        ) : (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        <span>{label}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}