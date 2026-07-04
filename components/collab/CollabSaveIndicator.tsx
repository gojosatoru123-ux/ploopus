'use client';

import { Cloud, CloudOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SaveStatus = 'unsaved' | 'saving' | 'saved' | 'error';

interface Props {
    status: SaveStatus;
    lastSavedAt: number | null;
}

export default function CollabSaveIndicator({ status, lastSavedAt }: Props) {
    const config: Record<SaveStatus, {
        icon: React.ElementType;
        text: string;
        color: string;
        bg: string;
        dot: string;
    }> = {
        unsaved: {
            icon:  CloudOff,
            text:  'Unsaved changes',
            color: 'text-amber-500',
            bg:    'bg-amber-500/10',
            dot:   'bg-amber-500',
        },
        saving: {
            icon:  Loader2,
            text:  'Saving…',
            color: 'text-blue-500',
            bg:    'bg-blue-500/10',
            dot:   'bg-blue-500 animate-pulse',
        },
        saved: {
            icon:  CheckCircle2,
            text:  lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Saved',
            color: 'text-emerald-500',
            bg:    'bg-emerald-500/10',
            dot:   'bg-emerald-500',
        },
        error: {
            icon:  AlertCircle,
            text:  'Save failed',
            color: 'text-destructive',
            bg:    'bg-destructive/10',
            dot:   'bg-destructive',
        },
    };

    const active = config[status];
    const Icon   = active.icon;

    return (
        <div className="flex items-center gap-2">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg shadow-sm', active.bg)}>
                <Icon className={cn('h-3.5 w-3.5', active.color, status === 'saving' && 'animate-spin')} />
            </div>
            <span className="text-[11px] font-medium tracking-tight text-foreground/80">
                {active.text}
            </span>
            <div className={cn('h-1.5 w-1.5 rounded-full ring-4 ring-background', active.dot)} />
        </div>
    );
}