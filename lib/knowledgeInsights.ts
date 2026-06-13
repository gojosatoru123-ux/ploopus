import { NoteIndex } from "@/lib/types";
import { useEffect, useState } from "react";

const META_KEY = "ploopus-note-meta";
const VIEWS_KEY = "ploopus-note-views";
const FEED_SNAPSHOT_KEY = "ploopus-feed-snapshot";
const REMINDER_COMPLETED_KEY = "ploopus-reminder-completed";

export interface NoteMeta {
    important?: boolean;
    archived?: boolean;
    snoozedUntil?: string | null;
    reviewLater?: boolean;
    ignored?: boolean;
}

type MetaMap = Record<string, NoteMeta>;
type ViewMap = Record<string, { lastViewedAt: string; count: number }>;

// All localStorage and window access is gated behind isBrowser so this
// module is safe to import in Next.js server components and API routes.
const isBrowser = typeof window !== "undefined";

const readJSON = <T,>(key: string, fallback: T): T => {
    if (!isBrowser) return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
};

const writeJSON = (key: string, value: unknown) => {
    if (!isBrowser) return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* ignore quota errors */ }
};

const dispatch = (event: string) => {
    if (isBrowser) window.dispatchEvent(new Event(event));
};

/* ------------------------------------------------------------------ */
/* Meta & view state                                                    */
/* ------------------------------------------------------------------ */

export const getAllMeta = (): MetaMap => readJSON<MetaMap>(META_KEY, {});
export const getAllViews = (): ViewMap => readJSON<ViewMap>(VIEWS_KEY, {});

export const getMeta = (id: string): NoteMeta => getAllMeta()[id] ?? {};

export const setMeta = (id: string, patch: Partial<NoteMeta>) => {
    const all = getAllMeta();
    all[id] = { ...all[id], ...patch };
    writeJSON(META_KEY, all);
    dispatch("ploopus-meta-change");
};

export const recordView = (id: string) => {
    const all = getAllViews();
    const prev = all[id]?.count ?? 0;
    all[id] = { lastViewedAt: new Date().toISOString(), count: prev + 1 };
    writeJSON(VIEWS_KEY, all);
    dispatch("ploopus-views-change");
};

export const getLastViewed = (id: string): Date | null => {
    const v = getAllViews()[id];
    return v ? new Date(v.lastViewedAt) : null;
};

/* ------------------------------------------------------------------ */
/* Date utilities                                                       */
/* ------------------------------------------------------------------ */

export const daysSince = (date: Date | string | null | undefined): number => {
    if (!date) return Infinity;
    const d = typeof date === "string" ? new Date(date) : date;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDuration = (days: number): string => {
    if (!isFinite(days)) return "never";
    if (days < 1) return "today";
    if (days < 7) return `${days}d`;
    if (days < 30) return `${Math.round(days / 7)}w`;
    if (days < 365) return `${Math.round(days / 30)}mo`;
    return `${(days / 365).toFixed(1)}y`;
};

export const formatDays = formatDuration;

/* ------------------------------------------------------------------ */
/* Note scoring                                                         */
/* ------------------------------------------------------------------ */

/**
 * Builds a searchable string from NoteIndex metadata only.
 * NoteIndex has no block content — full block text lives on Note.
 */
const noteText = (note: NoteIndex) => {
    const tagString = note.tags?.map((t) => t.label).join(" ") ?? "";
    return `${note.title || ""} ${tagString}`.toLowerCase();
};

/** Approximate backlink count: how many other notes mention this note's title. */
export const getConnectionCount = (note: NoteIndex, all: NoteIndex[]): number => {
    const title = note.title?.trim().toLowerCase();
    if (!title || title === "untitled" || title.length < 3) return 0;
    let count = 0;
    for (const other of all) {
        if (other.id === note.id) continue;
        if (noteText(other).includes(title)) count++;
    }
    return count;
};

export interface ScoredNote {
    note: NoteIndex;
    score: number;
    reasons: string[];
    connections: number;
    daysSinceCreated: number;
    daysSinceUpdated: number;
    daysSinceViewed: number;
}

export const buildContextMessage = (s: ScoredNote): string => {
    if (s.connections >= 5) return `Referenced by ${s.connections} notes`;
    if (s.daysSinceViewed > 180) return `Not viewed for ${formatDuration(s.daysSinceViewed)}`;
    if (s.daysSinceCreated > 180) return `Created ${formatDuration(s.daysSinceCreated)} ago`;
    if (s.daysSinceUpdated > 30) return `Last edited ${formatDuration(s.daysSinceUpdated)} ago`;
    return `Recently active`;
};

export const scoreNotes = (notes: NoteIndex[]): ScoredNote[] => {
    return notes.map((note) => {
        const created = new Date(note.createdAt);
        const updated = new Date(note.updatedAt);
        const viewed = getLastViewed(note.id);
        const dsc = daysSince(created);
        const dsu = daysSince(updated);
        const dsv = viewed ? daysSince(viewed) : dsc;
        const connections = getConnectionCount(note, notes);

        // Resurfacing score: forgotten notes with connections win.
        const ageBoost = Math.min(dsc, 720) / 30;   // up to ~24
        const forgottenBoost = Math.min(dsv, 720) / 20;  // up to ~36
        const connectionBoost = connections * 8;
        const pinPenalty = note.isPinned ? -5 : 0;
        const recencyPenalty = dsu < 3 ? -15 : 0;        // don't resurface fresh edits
        const score = ageBoost + forgottenBoost + connectionBoost + pinPenalty + recencyPenalty;

        const reasons: string[] = [];
        if (dsc > 365) reasons.push(`Created ${formatDuration(dsc)} ago`);
        if (dsv > 90) reasons.push(`Not viewed for ${formatDuration(dsv)}`);
        if (connections > 0) reasons.push(`Linked by ${connections} note${connections > 1 ? "s" : ""}`);
        if (dsu > 180) reasons.push(`Last edited ${formatDuration(dsu)} ago`);

        return { note, score, reasons, connections, daysSinceCreated: dsc, daysSinceUpdated: dsu, daysSinceViewed: dsv };
    });
};

export const isStale = (s: ScoredNote): boolean =>
    s.daysSinceUpdated > 120 || (s.daysSinceViewed > 180 && s.connections > 0);

export const isForgottenGold = (s: ScoredNote): boolean =>
    s.connections >= 2 && s.daysSinceViewed > 60;

export const isUnfinishedProject = (s: ScoredNote): boolean => {
    const text = noteText(s.note);
    return /project|plan|roadmap|todo|build|launch/.test(text) && s.daysSinceUpdated > 60;
};

/** Surface notes that are old and unviewed but heavily tagged. */
export const isHiddenGem = (s: ScoredNote): boolean =>
    s.connections === 0 && (s.note.tags?.length ?? 0) >= 2 && s.daysSinceViewed > 90;

/* ------------------------------------------------------------------ */
/* Grouping & streaks                                                   */
/* ------------------------------------------------------------------ */

/** Group notes by ISO month (YYYY-MM), newest first. */
export const groupByMonth = (notes: NoteIndex[]) => {
    const groups = new Map<string, NoteIndex[]>();
    for (const n of notes) {
        const d = new Date(n.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(n);
    }
    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
};

/**
 * Compute consecutive-day note-creation streak ending on today or yesterday.
 *
 * Anchor: if the user hasn't written today yet, anchor on yesterday so an
 * active streak isn't immediately broken at midnight. A result of 0 means no
 * note was created today or yesterday.
 */
export const computeStreak = (notes: NoteIndex[]): number => {
    const days = new Set(
        notes.map((n) => new Date(n.createdAt).toISOString().slice(0, 10)),
    );
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!days.has(cursor.toISOString().slice(0, 10))) {
        cursor.setDate(cursor.getDate() - 1);
    }
    while (days.has(cursor.toISOString().slice(0, 10))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
};

/* ------------------------------------------------------------------ */
/* Daily feed snapshot (note-review feed, separate from story feed)     */
/* ------------------------------------------------------------------ */

export interface FeedSnapshot {
    date: string; // YYYY-MM-DD
    noteIds: string[];
    completed: string[];
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export const getFeedSnapshot = (): FeedSnapshot | null =>
    readJSON<FeedSnapshot | null>(FEED_SNAPSHOT_KEY, null);

/** Returns today's snapshot, generating a fresh one if missing or stale. */
export const ensureDailyFeed = (notes: NoteIndex[], limit = 12): FeedSnapshot => {
    const today = todayKey();
    const existing = getFeedSnapshot();
    if (existing && existing.date === today) {
        // Drop any notes deleted since the snapshot was generated.
        const valid = existing.noteIds.filter((id) => notes.some((n) => n.id === id));
        if (valid.length === existing.noteIds.length) return existing;
        const cleaned: FeedSnapshot = {
            date: today,
            noteIds: valid,
            completed: existing.completed.filter((id) => valid.includes(id)),
        };
        writeJSON(FEED_SNAPSHOT_KEY, cleaned);
        return cleaned;
    }
    const meta = getAllMeta();
    const ranked = scoreNotes(notes)
        .filter((s) => {
            const m = meta[s.note.id];
            return !m?.archived && !m?.ignored;
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.note.id);
    const snap: FeedSnapshot = { date: today, noteIds: ranked, completed: [] };
    writeJSON(FEED_SNAPSHOT_KEY, snap);
    // Use a distinct event so FeedPage (which only cares about story changes)
    // is not unnecessarily re-triggered by note-review feed updates.
    dispatch("ploopus-feed-change");
    return snap;
};

export const markFeedCompleted = (id: string) => {
    const snap = getFeedSnapshot();
    if (!snap || snap.completed.includes(id)) return;
    writeJSON(FEED_SNAPSHOT_KEY, { ...snap, completed: [...snap.completed, id] });
    dispatch("ploopus-feed-change");
};

export const unmarkFeedCompleted = (id: string) => {
    const snap = getFeedSnapshot();
    if (!snap) return;
    writeJSON(FEED_SNAPSHOT_KEY, { ...snap, completed: snap.completed.filter((x) => x !== id) });
    dispatch("ploopus-feed-change");
};

/* ------------------------------------------------------------------ */
/* Reminder log                                                         */
/* ------------------------------------------------------------------ */

type ReminderLog = Record<string, string>; // id -> ISO timestamp of completion

export const getReminderLog = (): ReminderLog =>
    readJSON<ReminderLog>(REMINDER_COMPLETED_KEY, {});

export const markReminderDone = (id: string) => {
    const log = getReminderLog();
    log[id] = new Date().toISOString();
    writeJSON(REMINDER_COMPLETED_KEY, log);
    dispatch("ploopus-reminder-change");
};

export const clearReminderDone = (id: string) => {
    const log = getReminderLog();
    delete log[id];
    writeJSON(REMINDER_COMPLETED_KEY, log);
    dispatch("ploopus-reminder-change");
};

/* ------------------------------------------------------------------ */
/* React version hook                                                   */
/* ------------------------------------------------------------------ */

/**
 * Re-renders subscribers whenever meta/views/feed/reminder/story state changes.
 *
 * FeedPage uses this hook. Note: "ploopus-feed-change" (from ensureDailyFeed)
 * and "ploopus-story-change" (from feedStories) are separate events. FeedPage
 * only needs to react to "ploopus-story-change", but listening to both is
 * harmless — it just causes one extra re-render on note-review feed updates,
 * which is cheap since generateStories is memoised by notes reference.
 */
export const useInsightsVersion = () => {
    const [v, setV] = useState(0);
    useEffect(() => {
        // Guard for test environments (Jest + jsdom) and any future server-
        // component context where window may not exist even inside useEffect.
        if (typeof window === "undefined") return;
        const bump = () => setV((x) => x + 1);
        const events = [
            "ploopus-meta-change",
            "ploopus-views-change",
            "ploopus-story-change",
            "ploopus-reminder-change",
        ];
        events.forEach((e) => window.addEventListener(e, bump));
        // Refresh once per minute so the day rolls over without a full page reload.
        const interval = window.setInterval(bump, 60_000);
        return () => {
            events.forEach((e) => window.removeEventListener(e, bump));
            window.clearInterval(interval);
        };
    }, []);
    return v;
};

/* ------------------------------------------------------------------ */
/* Anniversaries                                                        */
/* ------------------------------------------------------------------ */

/** Notes created exactly N years ago today (±2 day window). */
export const findAnniversaries = (notes: NoteIndex[]) => {
    const now = new Date();
    return notes
        .map((n) => {
            const d = new Date(n.createdAt);
            const years = now.getFullYear() - d.getFullYear();
            if (years < 1) return null;
            const sameDay =
                Math.abs(now.getMonth() - d.getMonth()) === 0 &&
                Math.abs(now.getDate() - d.getDate()) <= 2;
            return sameDay ? { note: n, years } : null;
        })
        .filter((x): x is { note: NoteIndex; years: number } => !!x);
};