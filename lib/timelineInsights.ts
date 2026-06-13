import { NoteIndex, Folder } from "@/lib/types";

const DAY_MS = 86_400_000;

const startOfDay = (d: Date | string | number) => {
    const n = new Date(d);
    n.setHours(0, 0, 0, 0);
    return n;
};

const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase()).trim();

/**
 * Safe replacements for Math.min/max spread.
 *
 * Math.min(...array) and Math.max(...array) use the JS call stack and will
 * throw "Maximum call stack size exceeded" for arrays with ~100 000+ elements.
 * These loop-based versions are O(n) and never blow the stack.
 */
const safeMin = (arr: number[]): number => {
    if (arr.length === 0) return Infinity;
    let m = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
    return m;
};

const safeMax = (arr: number[]): number => {
    if (arr.length === 0) return -Infinity;
    let m = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    return m;
};

/**
 * Guard against invalid / unparseable date strings.
 * Returns null instead of an Invalid Date object so callers can skip bad data.
 */
const safeDate = (raw: string | undefined | null): Date | null => {
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
};

/* ------------------------------------------------------------------ */
/* Public interfaces                                                    */
/* ------------------------------------------------------------------ */

export interface Milestone {
    id: string;
    date: Date;
    title: string;
    detail: string;
    icon: "first-note" | "count" | "folder" | "tag-streak" | "first-tag";
    noteId?: string;
    folderId?: string;
}

export interface KnowledgeCluster {
    id: string;
    title: string;
    subtitle: string;
    start: Date;
    end: Date;
    noteCount: number;
    folderCount: number;
    noteIds: string[];
    accent: string;
}

export interface LearningJourney {
    id: string;
    topic: string;
    start: Date;
    lastActivity: Date;
    noteIds: string[];
    steps: { label: string; date: Date; noteId?: string }[];
}

export interface IdeaEvolution {
    id: string;
    rootTitle: string;
    steps: { label: string; date: Date; noteId: string }[];
}

export interface MemoryAnchor {
    id: string;
    title: string;
    body: string;
    date: Date;
    noteId: string;
}

export interface GrowthPoint {
    date: Date;
    count: number;
}

/* ------------------------------------------------------------------ */
/* computeMilestones                                                    */
/* ------------------------------------------------------------------ */

export const computeMilestones = (notes: NoteIndex[], folders: Folder[]): Milestone[] => {
    if (notes.length === 0) return [];

    // FIX: skip notes with invalid createdAt so sorting and Date construction
    // never produce NaN, which would corrupt the entire sorted order.
    const chron = notes
        .filter((n) => safeDate(n.createdAt) !== null)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (chron.length === 0) return [];

    const milestones: Milestone[] = [];

    // 1. First Note
    milestones.push({
        id: "ms-first-note",
        date: new Date(chron[0].createdAt),
        title: "First Note Penned",
        detail: `You started your local knowledge base with "${chron[0].title || "Untitled"}".`,
        icon: "first-note",
        noteId: chron[0].id,
    });

    // 2. Count thresholds
    const thresholds = [10, 50, 100, 250, 500];
    for (const t of thresholds) {
        if (chron.length >= t) {
            const targetNote = chron[t - 1];
            milestones.push({
                id: `ms-count-${t}`,
                date: new Date(targetNote.createdAt),
                title: `${t} Notes Reached`,
                detail: `A growing second brain. Note #${t} was "${targetNote.title || "Untitled"}".`,
                icon: "count",
                noteId: targetNote.id,
            });
        }
    }

    // 3. Folders — skip any with an invalid createdAt
    for (const f of folders) {
        const d = safeDate(f.createdAt);
        if (!d) continue;
        milestones.push({
            id: `ms-folder-${f.id}`,
            date: d,
            title: `Folder: ${f.name}`,
            detail: `Created a dedicated structural hub named "${f.name}".`,
            icon: "folder",
            folderId: f.id,
        });
    }

    return milestones.sort((a, b) => b.date.getTime() - a.date.getTime());
};

/* ------------------------------------------------------------------ */
/* computeClusters                                                      */
/* ------------------------------------------------------------------ */

export const computeClusters = (notes: NoteIndex[], _folders: Folder[]): KnowledgeCluster[] => {
    if (notes.length === 0) return [];

    const tagGroups: Record<string, { noteIds: string[]; tagLabel: string; dates: number[] }> = {};

    for (const n of notes) {
        if (!n.tags) continue;
        const d = safeDate(n.createdAt);
        if (!d) continue; // FIX: skip notes with invalid dates
        for (const t of n.tags) {
            const key = t.label.toLowerCase().trim();
            if (!key) continue; // FIX: skip blank tag labels
            if (!tagGroups[key]) {
                tagGroups[key] = { noteIds: [], tagLabel: t.label, dates: [] };
            }
            tagGroups[key].noteIds.push(n.id);
            tagGroups[key].dates.push(d.getTime());
        }
    }

    const colors = ["#a78bfa", "#60a5fa", "#34d399", "#fb923c", "#f472b6"];
    const clusters: KnowledgeCluster[] = [];

    Object.entries(tagGroups).forEach(([tagKey, data], idx) => {
        if (data.noteIds.length < 2) return;

        // FIX: use safeMin/safeMax instead of Math.min/max spread — the spread
        // operator pushes every element onto the call stack and throws
        // "Maximum call stack size exceeded" for large (100 000+) arrays.
        const start = new Date(safeMin(data.dates));
        const end = new Date(safeMax(data.dates));

        const noteIdSet = new Set(data.noteIds);
        const associatedFolders = new Set(
            notes
                .filter((n) => noteIdSet.has(n.id) && n.folderId)
                .map((n) => n.folderId),
        );

        clusters.push({
            id: `cluster-${tagKey}`,
            title: `${cap(data.tagLabel)} Nexus`,
            subtitle: `${data.noteIds.length} notes connected under #${data.tagLabel}`,
            start,
            end,
            noteCount: data.noteIds.length,
            folderCount: associatedFolders.size,
            noteIds: data.noteIds,
            accent: colors[idx % colors.length],
        });
    });

    // Sort richest clusters first
    clusters.sort((a, b) => b.noteCount - a.noteCount);

    // Fallback: surface a single "All Notes" cluster when no tags are shared.
    if (clusters.length === 0 && notes.length >= 2) {
        const validDates = notes
            .map((n) => safeDate(n.createdAt)?.getTime())
            .filter((t): t is number => t !== undefined);

        if (validDates.length >= 2) {
            clusters.push({
                id: "cluster-all",
                title: "Your Knowledge Base",
                subtitle: `${notes.length} notes across your entire collection`,
                start: new Date(safeMin(validDates)),
                end: new Date(safeMax(validDates)),
                noteCount: notes.length,
                folderCount: new Set(
                    notes.filter((n) => n.folderId).map((n) => n.folderId),
                ).size,
                noteIds: notes.map((n) => n.id),
                accent: colors[0],
            });
        }
    }

    return clusters.slice(0, 6);
};

/* ------------------------------------------------------------------ */
/* computeLearningJourneys                                              */
/* ------------------------------------------------------------------ */

export const computeLearningJourneys = (notes: NoteIndex[]): LearningJourney[] => {
    if (notes.length === 0) return [];

    const tagGroups: Record<string, NoteIndex[]> = {};

    for (const n of notes) {
        if (!safeDate(n.createdAt)) continue; // FIX: skip invalid dates
        n.tags?.forEach((t) => {
            const key = t.label.toLowerCase().trim();
            if (!key) return; // FIX: skip blank tag labels
            if (!tagGroups[key]) tagGroups[key] = [];
            tagGroups[key].push(n);
        });
    }

    const journeys: LearningJourney[] = [];

    for (const [key, list] of Object.entries(tagGroups)) {
        if (list.length < 2) continue;

        const sorted = [...list].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

        // cap() is idempotent so double-calling is harmless, but keep it clean.
        const topic = cap(key);
        const steps = sorted.map((n) => ({
            label: n.title || "Untitled Study Milestone",
            date: new Date(n.createdAt),
            noteId: n.id,
        }));

        journeys.push({
            id: `journey-${key}`,
            topic,
            start: new Date(sorted[0].createdAt),
            lastActivity: new Date(sorted[sorted.length - 1].createdAt),
            noteIds: sorted.map((n) => n.id),
            steps,
        });
    }

    return journeys;
};

// Alias kept for any existing callers.
export const computeJourneys = computeLearningJourneys;

/* ------------------------------------------------------------------ */
/* computeIdeaEvolutions                                                */
/* ------------------------------------------------------------------ */

export const computeIdeaEvolutions = (notes: NoteIndex[]): IdeaEvolution[] => {
    if (notes.length < 2) return [];

    // FIX: filter out invalid dates before sorting so NaN timestamps don't
    // corrupt the sort order and produce nonsensical evolution chains.
    const sorted = notes
        .filter((n) => safeDate(n.createdAt) !== null)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const evolutions: IdeaEvolution[] = [];
    const mappedIds = new Set<string>();

    for (const root of sorted) {
        if (mappedIds.has(root.id) || !root.title) continue;

        const tokens = root.title.split(/[:|-]/);
        if (tokens.length < 2) continue;

        const rootPrefix = tokens[0].trim().toLowerCase();
        if (rootPrefix.length < 3) continue;

        const branches = sorted.filter(
            (n) =>
                n.id !== root.id &&
                n.title &&
                n.title.toLowerCase().startsWith(rootPrefix) &&
                !mappedIds.has(n.id),
        );

        if (branches.length >= 1) {
            const chain = [root, ...branches];
            mappedIds.add(root.id);
            branches.forEach((b) => mappedIds.add(b.id));

            evolutions.push({
                id: `evolution-${root.id}`,
                rootTitle: cap(tokens[0].trim()),
                steps: chain.map((n) => ({
                    // FIX: IdeaEvolution.steps.label is typed as `string` but
                    // n.title could be undefined/null on NoteIndex. Coerce here
                    // so consumers never receive undefined in a string field.
                    label: n.title ?? "Untitled",
                    date: new Date(n.createdAt),
                    noteId: n.id,
                })),
            });
        }
    }

    return evolutions.slice(0, 3);
};

/* ------------------------------------------------------------------ */
/* computeMemoryAnchors                                                 */
/* ------------------------------------------------------------------ */

// ANCHOR_BUCKET_DAYS controls the cadence of Memory Anchors.
// 1 = daily, 7 = weekly (default), 30 = monthly.
const ANCHOR_BUCKET_DAYS: number = 7;

export const computeMemoryAnchors = (notes: NoteIndex[]): MemoryAnchor[] => {
    if (notes.length === 0) return [];

    const now = new Date();
    const BUCKET_MS = ANCHOR_BUCKET_DAYS * DAY_MS;

    // FIX: filter invalid dates before sorting.
    const sorted = notes
        .filter((n) => safeDate(n.createdAt) !== null)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const buckets = new Map<number, NoteIndex[]>();
    for (const n of sorted) {
        const ageMs = now.getTime() - new Date(n.createdAt).getTime();
        if (ageMs < 0) continue; // skip future-dated notes
        const bucketIndex = Math.floor(ageMs / BUCKET_MS);
        if (!buckets.has(bucketIndex)) buckets.set(bucketIndex, []);
        buckets.get(bucketIndex)!.push(n);
    }

    const bucketLabel = (idx: number): string => {
        if (ANCHOR_BUCKET_DAYS === 1) {
            if (idx === 0) return "Today";
            if (idx === 1) return "Yesterday";
            return `${idx} Days Ago`;
        }
        if (ANCHOR_BUCKET_DAYS === 7) {
            if (idx === 0) return "This Week";
            if (idx === 1) return "Last Week";
            return `${idx} Weeks Ago`;
        }
        if (ANCHOR_BUCKET_DAYS === 30) {
            if (idx === 0) return "This Month";
            if (idx === 1) return "Last Month";
            return `${idx} Months Ago`;
        }
        return `${idx * ANCHOR_BUCKET_DAYS} Days Ago`;
    };

    const anchors: MemoryAnchor[] = [];
    const sortedBuckets = [...buckets.entries()].sort((a, b) => a[0] - b[0]);

    for (const [bucketIndex, group] of sortedBuckets) {
        const representative = group[0]; // oldest-first, already sorted
        const d = new Date(representative.createdAt);
        const count = group.length;

        anchors.push({
            id: `anchor-bucket-${bucketIndex}-${representative.id}`,
            title: bucketLabel(bucketIndex),
            body: count === 1
                ? `You wrote "${representative.title || "Untitled"}" during this period.`
                : `${count} notes written — including "${representative.title || "Untitled"}".`,
            date: d,
            noteId: representative.id,
        });

        if (anchors.length >= 6) break;
    }

    return anchors;
};

/* ------------------------------------------------------------------ */
/* computeGrowth                                                        */
/* ------------------------------------------------------------------ */

export const computeGrowth = (notes: NoteIndex[]): GrowthPoint[] => {
    if (notes.length === 0) return [];

    // FIX: filter invalid dates before sorting so NaN doesn't corrupt buckets.
    const sorted = notes
        .filter((n) => safeDate(n.createdAt) !== null)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    if (sorted.length === 0) return [];

    const first = startOfDay(sorted[0].createdAt).getTime();
    const last = startOfDay(new Date()).getTime();

    // FIX: when all notes were created today, first === last and span = 0.
    // The original code divided by buckets which could be 0, producing NaN
    // for bucketMs and an infinite loop in the for loop.
    if (first === last) {
        return [{ date: new Date(first), count: sorted.length }];
    }

    const span = Math.max(1, Math.round((last - first) / DAY_MS));
    const bucketCount = Math.min(40, Math.max(6, span));
    const bucketMs = (last - first) / bucketCount; // always > 0 since first !== last

    // FIX: the original used a .filter() inside the loop — O(n × buckets).
    // Replaced with a single linear pass using a pointer, making it O(n + buckets).
    const points: GrowthPoint[] = [];
    let cum = 0;
    let noteIdx = 0;

    for (let i = 0; i <= bucketCount; i++) {
        const bucketEnd = first + i * bucketMs;
        // Advance pointer for all notes that fall within this bucket's end.
        while (noteIdx < sorted.length && new Date(sorted[noteIdx].createdAt).getTime() <= bucketEnd) {
            cum++;
            noteIdx++;
        }
        points.push({ date: new Date(bucketEnd), count: cum });
    }

    return points;
};