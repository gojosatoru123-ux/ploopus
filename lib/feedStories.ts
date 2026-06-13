import { NoteIndex } from "@/lib/types";
import {
    daysSince,
    getLastViewed,
    getAllMeta,
    computeStreak,
} from "@/lib/knowledgeInsights";

/**
 * Narrative-driven feed.
 *
 * Each "story" is a piece of intelligence the app has inferred from the user's
 * own notes — relationships across tags, folders, dates, edits, and views —
 * presented as a small, emotionally resonant card.
 */

export type StoryKind =
    | "dormant-relevant" // old idea, recent related notes
    | "cluster"          // notes sharing tags, created apart
    | "anniversary"      // N years ago today
    | "growth-area"      // hot tag/folder
    | "forgotten-gold"   // tagged note unviewed for a long time
    | "dormant-project"  // 200+ days untouched folder
    | "milestone"        // streaks, totals
    | "companion"        // related to recent activity in a folder
    | "first-of-topic"   // started documenting a topic N time ago
    | "neglected";       // simply not opened in a long time

export type RelationKind =
    | "hero"
    | "first"
    | "recent"
    | "referenced"
    | "shared-tags"
    | "same-folder"
    | "connected"
    | "related-topic"
    | "dormant"
    | "anniversary"
    | "growing";

export interface NoteRelation {
    emoji: string;
    label: string;
    reason: string;
}

export interface StorySignal {
    label: string;
    value: string;
    detail?: string;
}

export interface Story {
    id: string;
    kind: StoryKind;
    headline: string;
    narrative: string;
    eyebrow: string;
    stats?: { label: string; value: string }[];
    notes: NoteIndex[];
    relations: Record<string, NoteRelation>;
    signals: StorySignal[];
    involvedTags?: { label: string; color: string }[];
    topic?: { label: string; color: string };
    score: number;
    hue: number;
}

const rel = (emoji: string, label: string, reason: string): NoteRelation =>
    ({ emoji, label, reason });

export const RELATION_PRESETS: Record<RelationKind, Omit<NoteRelation, "reason">> = {
    hero: { emoji: "✨", label: "Hero Note" },
    first: { emoji: "🌱", label: "First Note" },
    recent: { emoji: "📈", label: "Most Recent Note" },
    referenced: { emoji: "⭐", label: "Most Referenced" },
    "shared-tags": { emoji: "🏷", label: "Shared Tags" },
    "same-folder": { emoji: "📚", label: "Same Folder" },
    connected: { emoji: "🔗", label: "Connected Knowledge" },
    "related-topic": { emoji: "🧠", label: "Related Topic" },
    dormant: { emoji: "💤", label: "Dormant Idea" },
    anniversary: { emoji: "🎂", label: "On This Day" },
    growing: { emoji: "🚀", label: "Growth Spark" },
};

/* ------------------------------------------------------------------ */
/* Text helpers                                                         */
/* ------------------------------------------------------------------ */

/**
 * Builds a searchable string from NoteIndex metadata only.
 * NoteIndex has no block content — full block text lives on Note.
 */
const noteText = (n: NoteIndex) => {
    const tagString = n.tags?.map((t) => t.label).join(" ") ?? "";
    return `${n.title || ""} ${tagString}`.toLowerCase();
};

const fmtDays = (days: number): string => {
    if (!isFinite(days)) return "ages";
    if (days < 1) return "today";
    if (days < 30) return `${days} day${days === 1 ? "" : "s"}`;
    if (days < 365) {
        const m = Math.round(days / 30);
        return `${m} month${m === 1 ? "" : "s"}`;
    }
    const y = days / 365;
    return y < 1.6 ? `${Math.round(y * 10) / 10} year` : `${Math.round(y)} years`;
};

/* ------------------------------------------------------------------ */
/* Index builders                                                       */
/* ------------------------------------------------------------------ */

const tagIndex = (notes: NoteIndex[]) => {
    const idx = new Map<string, { label: string; color: string; notes: NoteIndex[] }>();
    for (const n of notes) {
        for (const t of n.tags ?? []) {
            const key = t.label.toLowerCase();
            if (!idx.has(key)) idx.set(key, { label: t.label, color: t.color, notes: [] });
            idx.get(key)!.notes.push(n);
        }
    }
    return idx;
};

const folderIndex = (notes: NoteIndex[]) => {
    const idx = new Map<string, NoteIndex[]>();
    for (const n of notes) {
        if (!n.folderId) continue;
        if (!idx.has(n.folderId)) idx.set(n.folderId, []);
        idx.get(n.folderId)!.push(n);
    }
    return idx;
};

const isEligible = (n: NoteIndex, meta: ReturnType<typeof getAllMeta>) => {
    const m = meta[n.id];
    return !m?.archived && !m?.ignored;
};

/* ------------------------------------------------------------------ */
/* Story generators                                                     */
/* ------------------------------------------------------------------ */

const dormantRelevantStories = (notes: NoteIndex[]): Story[] => {
    const meta = getAllMeta();
    const tags = tagIndex(notes);
    const stories: Story[] = [];

    for (const n of notes) {
        if (!isEligible(n, meta)) continue;
        const viewed = getLastViewed(n.id);
        const dsv = viewed ? daysSince(viewed) : daysSince(n.createdAt);
        if (dsv < 180) continue;
        if (!n.tags?.length) continue;

        const sinceCreated = new Date(n.createdAt).getTime();
        let relatedRecent = 0;
        for (const t of n.tags) {
            const bucket = tags.get(t.label.toLowerCase());
            if (!bucket) continue;
            for (const other of bucket.notes) {
                if (other.id === n.id) continue;
                if (new Date(other.createdAt).getTime() > sinceCreated) relatedRecent++;
            }
        }
        if (relatedRecent < 3) continue;

        const dsc = daysSince(n.createdAt);
        const tag = n.tags[0];
        stories.push({
            id: `dormant-rel-${n.id}`,
            kind: "dormant-relevant",
            eyebrow: "Resurfaced for you",
            headline: n.title || "An idea worth a second look",
            narrative: `You created this ${fmtDays(dsc)} ago and haven't opened it in ${fmtDays(dsv)}. Since then you've added ${relatedRecent} notes tagged ${n.tags.slice(0, 2).map((t) => `#${t.label}`).join(" / ")}, suggesting it may be more relevant today than when you first wrote it.`,
            stats: [
                { label: "Age", value: fmtDays(dsc) },
                { label: "Last seen", value: fmtDays(dsv) + " ago" },
                { label: "Related since", value: `${relatedRecent} notes` },
            ],
            notes: [n],
            relations: {
                [n.id]: rel("💤", "Dormant Idea", `Unopened for ${fmtDays(dsv)} — but ${relatedRecent} newer notes share its tags`),
            },
            signals: [
                { label: "Created", value: fmtDays(dsc) + " ago", detail: new Date(n.createdAt).toLocaleDateString() },
                { label: "Last viewed", value: fmtDays(dsv) + " ago" },
                { label: "Related notes since", value: String(relatedRecent) },
                { label: "Tags matched", value: n.tags.map((t) => "#" + t.label).join(", ") },
            ],
            involvedTags: n.tags,
            topic: { label: tag.label, color: tag.color },
            score: 80 + Math.min(relatedRecent, 20) + Math.min(dsv / 30, 24),
            hue: 0,
        });
    }
    return stories;
};

const clusterStories = (notes: NoteIndex[]): Story[] => {
    const tags = tagIndex(notes);
    const stories: Story[] = [];
    const seenTriples = new Set<string>();

    const tagList = Array.from(tags.entries()).filter(([, v]) => v.notes.length >= 3);
    for (let i = 0; i < tagList.length; i++) {
        for (let j = i + 1; j < tagList.length; j++) {
            const [aKey, aVal] = tagList[i];
            const [bKey, bVal] = tagList[j];
            const shared = aVal.notes.filter((n) =>
                n.tags.some((t) => t.label.toLowerCase() === bKey),
            );
            if (shared.length < 3) continue;
            const dates = shared.map((n) => new Date(n.createdAt).getTime());
            const spread = Math.max(...dates) - Math.min(...dates);
            const spreadDays = spread / (1000 * 60 * 60 * 24);
            if (spreadDays < 30) continue;
            const key = [aKey, bKey].sort().join("|");
            if (seenTriples.has(key)) continue;
            seenTriples.add(key);
            const sortedByDate = [...shared].sort(
                (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
            );
            const featured = sortedByDate.slice(0, 4);
            const relations: Record<string, NoteRelation> = {};
            featured.forEach((nn, idx) => {
                if (idx === 0)
                    relations[nn.id] = rel("🌱", "First Note", `Where the #${aVal.label} × #${bVal.label} thread began`);
                else if (idx === featured.length - 1)
                    relations[nn.id] = rel("📈", "Most Recent Note", `Latest entry in this thread, ${fmtDays(daysSince(nn.createdAt))} ago`);
                else
                    relations[nn.id] = rel("🏷", "Shared Tags", `Carries both #${aVal.label} and #${bVal.label}`);
            });
            stories.push({
                id: `cluster-${key}`,
                kind: "cluster",
                eyebrow: "A pattern in your thinking",
                headline: `${shared.length} notes form a #${aVal.label} × #${bVal.label} thread`,
                narrative: `These notes share #${aVal.label} and #${bVal.label} but were created ${fmtDays(spreadDays)} apart. Together they may already form a coherent strategy worth revisiting as one.`,
                stats: [
                    { label: "Notes", value: String(shared.length) },
                    { label: "Spread", value: fmtDays(spreadDays) },
                ],
                notes: featured,
                relations,
                signals: [
                    { label: "Shared tags", value: `#${aVal.label}, #${bVal.label}` },
                    { label: "Total notes in cluster", value: String(shared.length) },
                    { label: "Time span", value: fmtDays(spreadDays) },
                    { label: "First → latest", value: `${new Date(Math.min(...dates)).toLocaleDateString()} → ${new Date(Math.max(...dates)).toLocaleDateString()}` },
                ],
                involvedTags: [
                    { label: aVal.label, color: aVal.color },
                    { label: bVal.label, color: bVal.color },
                ],
                topic: { label: aVal.label, color: aVal.color },
                score: 60 + shared.length * 4 + Math.min(spreadDays / 30, 12),
                hue: 1,
            });
        }
    }
    return stories;
};

const anniversaryStories = (notes: NoteIndex[]): Story[] => {
    const meta = getAllMeta();
    const now = new Date();
    const stories: Story[] = [];
    for (const n of notes) {
        if (!isEligible(n, meta)) continue;
        const d = new Date(n.createdAt);
        const years = now.getFullYear() - d.getFullYear();
        if (years < 1) continue;
        const sameWindow =
            now.getMonth() === d.getMonth() && Math.abs(now.getDate() - d.getDate()) <= 2;
        if (!sameWindow) continue;

        let relatedSince = 0;
        if (n.tags?.length) {
            const tagSet = new Set(n.tags.map((t) => t.label.toLowerCase()));
            for (const other of notes) {
                if (other.id === n.id) continue;
                if (new Date(other.createdAt) <= d) continue;
                if (other.tags?.some((t) => tagSet.has(t.label.toLowerCase()))) relatedSince++;
            }
        }

        stories.push({
            id: `anniv-${n.id}`,
            kind: "anniversary",
            eyebrow: `On this day, ${years} year${years > 1 ? "s" : ""} ago`,
            headline: n.title || "A note from your past",
            narrative: relatedSince > 0
                ? `Exactly ${years} year${years > 1 ? "s" : ""} ago today you started documenting this topic — and have since written ${relatedSince} related notes.`
                : `${years} year${years > 1 ? "s" : ""} ago today, this thought entered your archive. Where has your thinking gone since?`,
            stats: [
                { label: "Anniversary", value: `${years}y` },
                ...(relatedSince > 0 ? [{ label: "Related since", value: `${relatedSince}` }] : []),
            ],
            notes: [n],
            relations: {
                [n.id]: rel("🎂", "On This Day", `Created exactly ${years} year${years > 1 ? "s" : ""} ago today`),
            },
            signals: [
                { label: "Created", value: new Date(n.createdAt).toLocaleDateString() },
                { label: "Years ago", value: String(years) },
                { label: "Related notes since", value: String(relatedSince) },
            ],
            involvedTags: n.tags,
            topic: n.tags?.[0],
            score: 95 + Math.min(years * 3, 20) + Math.min(relatedSince, 10),
            hue: 2,
        });
    }
    return stories;
};

const growthAreaStories = (notes: NoteIndex[]): Story[] => {
    const tags = tagIndex(notes);
    const now = Date.now();
    const stories: Story[] = [];
    for (const [key, val] of tags.entries()) {
        if (val.notes.length < 5) continue;
        // Use updatedAt so recently-edited notes count as growth, not only new ones.
        const recent = val.notes.filter(
            (n) => now - new Date(n.updatedAt).getTime() < 60 * 24 * 60 * 60 * 1000,
        ).length;
        if (recent < 3) continue;
        const ratio = recent / val.notes.length;
        const hero = [...val.notes].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )[0];
        const others = val.notes.filter((n) => n.id !== hero.id).slice(0, 3);
        const firstEver = [...val.notes].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0];
        const relations: Record<string, NoteRelation> = {
            [hero.id]: rel("📈", "Most Recent Note", `Last edited ${fmtDays(daysSince(hero.updatedAt))} ago — your latest thinking on #${val.label}`),
        };
        others.forEach((o) => {
            relations[o.id] = o.id === firstEver?.id
                ? rel("🌱", "First Note", `Where #${val.label} began, ${fmtDays(daysSince(o.createdAt))} ago`)
                : rel("🧠", "Related Topic", `Also tagged #${val.label}`);
        });
        stories.push({
            id: `growth-${key}`,
            kind: "growth-area",
            eyebrow: "A growing knowledge area",
            headline: `#${val.label} is one of your fastest-growing topics`,
            narrative: `You've added ${recent} new notes about #${val.label} in the last two months — ${Math.round(ratio * 100)}% of everything you've written on it. Your thinking here is accelerating.`,
            stats: [
                { label: "Total", value: String(val.notes.length) },
                { label: "Last 60d", value: String(recent) },
            ],
            notes: [hero, ...others],
            relations,
            signals: [
                { label: "Tag", value: "#" + val.label },
                { label: "Total notes", value: String(val.notes.length) },
                { label: "Active in last 60 days", value: String(recent) },
                { label: "Share of recent activity", value: Math.round(ratio * 100) + "%" },
            ],
            involvedTags: [{ label: val.label, color: val.color }],
            topic: { label: val.label, color: val.color },
            score: 55 + recent * 3,
            hue: 3,
        });
    }
    return stories;
};

const forgottenGoldStories = (notes: NoteIndex[]): Story[] => {
    const meta = getAllMeta();
    const tags = tagIndex(notes);
    const now = Date.now();
    const stories: Story[] = [];
    for (const n of notes) {
        if (!isEligible(n, meta)) continue;
        if (!n.tags?.length) continue;
        const viewed = getLastViewed(n.id);
        const dsv = viewed ? daysSince(viewed) : daysSince(n.createdAt);
        if (dsv < 365) continue;

        let activeNeighbors = 0;
        for (const t of n.tags) {
            const bucket = tags.get(t.label.toLowerCase());
            if (!bucket) continue;
            for (const o of bucket.notes) {
                if (o.id === n.id) continue;
                if (now - new Date(o.updatedAt).getTime() < 90 * 24 * 60 * 60 * 1000)
                    activeNeighbors++;
            }
        }
        if (activeNeighbors < 2) continue;
        stories.push({
            id: `gold-${n.id}`,
            kind: "forgotten-gold",
            eyebrow: "Forgotten gold",
            headline: n.title || "A note you may have forgotten",
            narrative: `This idea has sat untouched for ${fmtDays(dsv)}, yet its topic is one of your most active areas right now — ${activeNeighbors} related notes were edited in the last 90 days.`,
            stats: [
                { label: "Dormant", value: fmtDays(dsv) },
                { label: "Active siblings", value: String(activeNeighbors) },
            ],
            notes: [n],
            relations: {
                [n.id]: rel("💤", "Dormant Idea", `Untouched for ${fmtDays(dsv)} while its topic stays active`),
            },
            signals: [
                { label: "Last viewed", value: fmtDays(dsv) + " ago" },
                { label: "Active sibling notes (90d)", value: String(activeNeighbors) },
                { label: "Tags", value: n.tags.map((t) => "#" + t.label).join(", ") },
            ],
            involvedTags: n.tags,
            topic: n.tags[0],
            score: 70 + Math.min(dsv / 30, 24) + activeNeighbors * 2,
            hue: 4,
        });
    }
    return stories;
};

const dormantProjectStories = (notes: NoteIndex[]): Story[] => {
    const meta = getAllMeta();
    const folders = folderIndex(notes);
    const stories: Story[] = [];
    for (const [folderId, bucket] of folders.entries()) {
        const lastEdit = Math.max(...bucket.map((n) => new Date(n.updatedAt).getTime()));
        const days = daysSince(new Date(lastEdit));
        if (days < 200) continue;
        const hero = [...bucket]
            .filter((n) => isEligible(n, meta))
            .sort((a, b) => (b.tags?.length ?? 0) - (a.tags?.length ?? 0))[0];
        if (!hero) continue;
        const others = bucket.filter((n) => n.id !== hero.id).slice(0, 3);
        const relations: Record<string, NoteRelation> = {
            [hero.id]: rel("⭐", "Most Referenced", `The most categorized note in this dormant project (${hero.tags?.length ?? 0} tags)`),
        };
        others.forEach((o) =>
            (relations[o.id] = rel("📚", "Same Folder", "Lives inside the same dormant project")),
        );
        stories.push({
            id: `dormproj-${folderId}`,
            kind: "dormant-project",
            eyebrow: "A dormant project",
            headline: hero.title || "An untouched project",
            narrative: `This project hasn't been touched in ${fmtDays(days)}. It contains ${bucket.length} notes of work — was it abandoned, or is it waiting for the right moment to return?`,
            stats: [
                { label: "Notes inside", value: String(bucket.length) },
                { label: "Untouched", value: fmtDays(days) },
            ],
            notes: [hero, ...others],
            relations,
            signals: [
                { label: "Project size", value: `${bucket.length} notes` },
                { label: "Last edit", value: fmtDays(days) + " ago" },
                { label: "Last edit date", value: new Date(lastEdit).toLocaleDateString() },
            ],
            score: 50 + Math.min(days / 30, 24) + bucket.length,
            hue: 5,
        });
    }
    return stories;
};

const milestoneStories = (notes: NoteIndex[]): Story[] => {
    const stories: Story[] = [];
    const milestones = [10, 25, 50, 100, 250, 500, 1000];
    const lastMilestone = [...milestones].reverse().find((m) => notes.length >= m);
    if (lastMilestone) {
        const sortedByCreated = [...notes].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const sortedByUpdated = [...notes].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
        const firstEver = sortedByCreated[0];
        const mostRecent = sortedByUpdated[0];
        const pool: NoteIndex[] = [];
        const seen = new Set<string>();
        const push = (n?: NoteIndex) => {
            if (!n || seen.has(n.id)) return;
            seen.add(n.id);
            pool.push(n);
        };
        push(mostRecent);
        push(firstEver);
        for (const n of sortedByUpdated) {
            if (pool.length >= 9) break;
            push(n);
        }
        const relations: Record<string, NoteRelation> = {};
        pool.forEach((n) => {
            if (n.id === mostRecent?.id)
                relations[n.id] = rel("📈", "Most Recent Note", `Your latest note, edited ${fmtDays(daysSince(n.updatedAt))} ago`);
            else if (n.id === firstEver?.id)
                relations[n.id] = rel("🌱", "First Note", `Where your archive began, ${fmtDays(daysSince(n.createdAt))} ago`);
            else
                relations[n.id] = rel("🧠", "Milestone Note", `One of the ${notes.length} notes counted toward this milestone — edited ${fmtDays(daysSince(n.updatedAt))} ago`);
        });
        stories.push({
            id: `milestone-notes-${lastMilestone}`,
            kind: "milestone",
            eyebrow: "A quiet achievement",
            headline: `You've crossed ${lastMilestone} notes`,
            narrative: `Your archive has grown to ${notes.length} notes. Each one is a small artifact of a thought you found worth keeping.`,
            stats: [{ label: "Total", value: String(notes.length) }],
            notes: pool,
            relations,
            signals: [
                { label: "Total notes", value: String(notes.length) },
                { label: "Milestone crossed", value: String(lastMilestone) },
            ],
            score: 65,
            hue: 6,
        });
    }
    const streak = computeStreak(notes);
    if (streak >= 3) {
        const streakNotes = [...notes]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, Math.min(9, Math.max(3, streak)));
        const relations: Record<string, NoteRelation> = {};
        streakNotes.forEach((n) =>
            (relations[n.id] = rel("🔥", "Streak Note", `Captured during your current ${streak}-day streak`)),
        );
        stories.push({
            id: `milestone-streak-${streak}`,
            kind: "milestone",
            eyebrow: "A learning streak",
            headline: `${streak}-day streak of capturing ideas`,
            narrative: `For ${streak} consecutive days, you've written something down. Streaks like this are how archives turn into bodies of work.`,
            stats: [{ label: "Days", value: String(streak) }],
            notes: streakNotes,
            relations,
            signals: [{ label: "Streak length", value: `${streak} days` }],
            score: 60 + Math.min(streak, 30),
            hue: 6,
        });
    }
    return stories;
};

const companionStories = (notes: NoteIndex[]): Story[] => {
    const meta = getAllMeta();
    const folders = folderIndex(notes);
    const now = Date.now();
    const stories: Story[] = [];
    for (const [folderId, bucket] of folders.entries()) {
        const recent = bucket.filter(
            (n) => now - new Date(n.updatedAt).getTime() < 14 * 24 * 60 * 60 * 1000,
        );
        if (recent.length < 2) continue;
        const stale = bucket
            .filter((n) => isEligible(n, meta))
            .filter((n) => now - new Date(n.updatedAt).getTime() > 120 * 24 * 60 * 60 * 1000);
        if (!stale.length) continue;
        const hero = [...stale].sort((a, b) => (b.tags?.length ?? 0) - (a.tags?.length ?? 0))[0];
        const relations: Record<string, NoteRelation> = {
            [hero.id]: rel("⭐", "Most Referenced", `The most categorized older note in this folder (${hero.tags?.length ?? 0} tags)`),
        };
        recent.slice(0, 3).forEach((n) =>
            (relations[n.id] = rel("📚", "Same Folder", `Added recently — ${fmtDays(daysSince(n.updatedAt))} ago`)),
        );
        stories.push({
            id: `companion-${folderId}-${hero.id}`,
            kind: "companion",
            eyebrow: "A companion to your recent work",
            headline: hero.title || "An older sibling note",
            narrative: `You wrote this while working in this project — and you've added ${recent.length} new notes to the same folder in the last two weeks. It may be ready to merge back into your current thinking.`,
            stats: [
                { label: "Recent in folder", value: String(recent.length) },
                { label: "Age", value: fmtDays(daysSince(hero.createdAt)) },
            ],
            notes: [hero, ...recent.slice(0, 3)],
            relations,
            signals: [
                { label: "Recent in folder (14d)", value: String(recent.length) },
                { label: "Hero age", value: fmtDays(daysSince(hero.createdAt)) + " old" },
                { label: "Hero tag categories", value: `${hero.tags?.length ?? 0} tags` },
            ],
            score: 58 + recent.length * 3,
            hue: 7,
        });
    }
    return stories;
};

const firstOfTopicStories = (notes: NoteIndex[]): Story[] => {
    const tags = tagIndex(notes);
    const stories: Story[] = [];
    for (const [key, val] of tags.entries()) {
        if (val.notes.length < 5) continue;
        const first = [...val.notes].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0];
        const dsc = daysSince(first.createdAt);
        if (dsc < 365) continue;
        stories.push({
            id: `firstof-${key}`,
            kind: "first-of-topic",
            eyebrow: "Where it all began",
            headline: `Your first note on #${val.label}`,
            narrative: `You started writing about #${val.label} ${fmtDays(dsc)} ago — and have since produced ${val.notes.length} notes on it. This is where the thread began.`,
            stats: [
                { label: "Started", value: fmtDays(dsc) + " ago" },
                { label: "Notes since", value: String(val.notes.length) },
            ],
            notes: [first],
            relations: {
                [first.id]: rel("🌱", "First Note", `Your archive started this topic ${fmtDays(dsc)} ago`),
            },
            signals: [
                { label: "Tag", value: "#" + val.label },
                { label: "First written", value: new Date(first.createdAt).toLocaleDateString() },
                { label: "Notes since", value: String(val.notes.length) },
            ],
            involvedTags: [{ label: val.label, color: val.color }],
            topic: { label: val.label, color: val.color },
            score: 50 + Math.min(dsc / 60, 18) + val.notes.length,
            hue: 8,
        });
    }
    return stories;
};

const neglectedStories = (notes: NoteIndex[]): Story[] => {
    const meta = getAllMeta();

    // Explicit min/maxDays per bucket — safe to add new buckets without
    // touching any filter logic.
    type Bucket = { label: string; minDays: number; maxDays: number; eyebrow: string };
    const buckets: Bucket[] = [
        { label: "Gone quiet", minDays: 90, maxDays: 179, eyebrow: "Not opened in a while" },
        { label: "Slipping away", minDays: 180, maxDays: 364, eyebrow: "Fading from memory" },
        { label: "Almost forgotten", minDays: 365, maxDays: Infinity, eyebrow: "Long forgotten" },
    ];

    const scored = notes
        .filter((n) => isEligible(n, meta))
        .map((n) => {
            const v = getLastViewed(n.id);
            const dsv = v ? daysSince(v) : daysSince(n.createdAt);
            return { n, dsv };
        })
        .filter((x) => x.dsv >= 90)
        .sort((a, b) => b.dsv - a.dsv);

    if (scored.length === 0) return [];

    const stories: Story[] = [];
    for (const b of buckets) {
        const items = scored.filter((x) => x.dsv >= b.minDays && x.dsv <= b.maxDays);
        if (items.length === 0) continue;
        const pool = items.slice(0, 9).map((x) => x.n);
        const relations: Record<string, NoteRelation> = {};
        pool.forEach((n) => {
            const dsv = items.find((x) => x.n.id === n.id)!.dsv;
            relations[n.id] = rel("💤", "Dormant Idea", `Not opened for ${fmtDays(dsv)} — give it a glance?`);
        });
        const oldest = items[0];
        stories.push({
            id: `neglected-${b.minDays}`,
            kind: "neglected",
            eyebrow: b.eyebrow,
            headline: items.length === 1
                ? `1 note hasn't been opened in ${fmtDays(oldest.dsv)}`
                : `${items.length} notes you haven't opened in ${fmtDays(b.minDays)}+`,
            narrative: items.length === 1
                ? `This note has been sitting quietly in your archive. A quick re-read might surprise you — past-you wrote it for a reason.`
                : `These ideas have drifted into the background of your archive. Even a 30-second skim can bring half-forgotten thinking back to the surface.`,
            stats: [
                { label: "Notes", value: String(items.length) },
                { label: "Oldest", value: fmtDays(oldest.dsv) + " ago" },
            ],
            notes: pool,
            relations,
            signals: [
                { label: "Threshold", value: `${b.minDays}+ days unopened` },
                { label: "Notes matched", value: String(items.length) },
                { label: "Most neglected", value: fmtDays(oldest.dsv) + " ago" },
            ],
            score: 45 + Math.min(items.length * 2, 20) + Math.min(b.minDays / 30, 16),
            hue: 7,
        });
    }
    return stories;
};

/* ------------------------------------------------------------------ */
/* Public story generation API                                          */
/* ------------------------------------------------------------------ */

export const generateStories = (notes: NoteIndex[]): Story[] => {
    if (!notes.length) return [];
    const all: Story[] = [
        ...anniversaryStories(notes),
        ...dormantRelevantStories(notes),
        ...forgottenGoldStories(notes),
        ...clusterStories(notes),
        ...growthAreaStories(notes),
        ...dormantProjectStories(notes),
        ...companionStories(notes),
        ...firstOfTopicStories(notes),
        ...milestoneStories(notes),
        ...neglectedStories(notes),
    ];

    const usedHero = new Set<string>();
    const ordered = all.sort((a, b) => b.score - a.score);
    const deduped: Story[] = [];
    for (const s of ordered) {
        const hero = s.notes[0]?.id;
        if (hero && usedHero.has(hero) && s.kind !== "milestone") continue;
        if (hero) usedHero.add(hero);
        deduped.push(s);
    }

    const result: Story[] = [];
    for (const s of deduped) result.push(...splitStory(s));
    return result;
};

const MAX_NOTES_PER_STORY = 3;

const splitStory = (s: Story): Story[] => {
    if (s.notes.length <= MAX_NOTES_PER_STORY) return [s];
    const chunks: NoteIndex[][] = [];
    for (let i = 0; i < s.notes.length; i += MAX_NOTES_PER_STORY) {
        chunks.push(s.notes.slice(i, i + MAX_NOTES_PER_STORY));
    }
    const total = chunks.length;
    return chunks.map((chunk, idx) => ({
        ...s,
        id: `${s.id}::p${idx + 1}`,
        notes: chunk,
        // First chunk keeps the original hue; each subsequent chunk steps by 1
        // (wrapping within 0–8) so split parts get visually distinct colours.
        hue: idx === 0 ? s.hue : (s.hue + idx) % 9,
        eyebrow: total > 1 ? `${s.eyebrow} · Part ${idx + 1} of ${total}` : s.eyebrow,
        headline: idx === 0
            ? s.headline
            : `${s.headline} — continued (${idx + 1}/${total})`,
        score: s.score - idx * 0.5,
    }));
};

/* ------------------------------------------------------------------ */
/* Browser storage — SSR-safe                                           */
/* ------------------------------------------------------------------ */

const SNAPSHOT_KEY = "ploopus-story-feed";

// All localStorage and window access is gated behind isBrowser so this
// module is safe to import in Next.js server components and API routes.
const isBrowser = typeof window !== "undefined";

const readJSON = <T,>(key: string, fb: T): T => {
    if (!isBrowser) return fb;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fb;
    } catch {
        return fb;
    }
};

const writeJSON = (key: string, v: unknown) => {
    if (!isBrowser) return;
    try {
        localStorage.setItem(key, JSON.stringify(v));
    } catch { /* ignore quota errors */ }
};

const dispatch = (event: string) => {
    if (isBrowser) window.dispatchEvent(new Event(event));
};

/* ------------------------------------------------------------------ */
/* Story-feed memoisation                                               */
/* ------------------------------------------------------------------ */

// WeakMap keyed on the notes array reference.
// Advantages over module-level variables:
//   - Automatically GC'd when the array is no longer referenced (no leak).
//   - Each unique notes array gets its own cached result, so multiple
//     component instances or hot-reload cycles never share stale state.
//   - Zero risk of cross-request pollution in SSR/multi-tenant contexts.
const _storyCache = new WeakMap<NoteIndex[], Story[]>();

const memoizedGenerateStories = (notes: NoteIndex[]): Story[] => {
    const cached = _storyCache.get(notes);
    if (cached) return cached;
    const result = generateStories(notes);
    _storyCache.set(notes, result);
    return result;
};

/* ------------------------------------------------------------------ */
/* Daily snapshot API                                                   */
/* ------------------------------------------------------------------ */

export interface StoryFeedSnapshot {
    date: string;
    storyIds: string[];
    read: string[];
    dismissed: string[];
}

const todayKey = () => new Date().toISOString().slice(0, 10);

export const getStoryFeedSnapshot = (): StoryFeedSnapshot | null => {
    const raw = readJSON<StoryFeedSnapshot | null>(SNAPSHOT_KEY, null);
    if (!raw) return null;
    // Normalise legacy snapshots that pre-date the `dismissed` field so
    // callers can always safely call .includes() / spread on it.
    return { ...raw, dismissed: raw.dismissed ?? [] };
};

export const ensureStoryFeed = (
    notes: NoteIndex[],
    limit = 14,
): { snapshot: StoryFeedSnapshot; stories: Story[] } => {
    // Use memoised generation to avoid O(n²) work on every call.
    const all = memoizedGenerateStories(notes);
    const byId = new Map(all.map((s) => [s.id, s]));
    const today = todayKey();
    const existing = getStoryFeedSnapshot();

    if (existing && existing.date === today) {
        const dismissedSet = new Set(existing.dismissed ?? []);

        // Keep only storyIds that still exist in the generated set.
        const valid = existing.storyIds.filter((id) => byId.has(id));

        // Fill up to limit with new stories, excluding already-known AND
        // dismissed ones so dismissed cards don't eat into the visible count.
        const known = new Set(existing.storyIds); // includes dismissed
        const additions = all
            .filter((s) => !known.has(s.id) && !dismissedSet.has(s.id))
            .slice(0, Math.max(0, limit - (valid.length - dismissedSet.size)))
            .map((s) => s.id);

        const merged = [...valid, ...additions];
        const normalised: StoryFeedSnapshot = {
            ...existing,
            storyIds: merged,
            dismissed: existing.dismissed ?? [],
        };
        if (merged.length !== existing.storyIds.length || additions.length > 0) {
            writeJSON(SNAPSHOT_KEY, normalised);
        }
        const stories = merged.map((id) => byId.get(id)).filter((s): s is Story => !!s);
        return { snapshot: normalised, stories };
    }

    // Fresh day — build a new snapshot.
    const picked = all.slice(0, limit);
    const snap: StoryFeedSnapshot = {
        date: today,
        storyIds: picked.map((s) => s.id),
        read: [],
        dismissed: [],
    };
    writeJSON(SNAPSHOT_KEY, snap);
    dispatch("ploopus-story-change");
    return { snapshot: snap, stories: picked };
};

export const markStoryRead = (id: string) => {
    const snap = getStoryFeedSnapshot();
    if (!snap || snap.read.includes(id)) return;
    writeJSON(SNAPSHOT_KEY, { ...snap, read: [...snap.read, id] });
    dispatch("ploopus-story-change");
};

export const unmarkStoryRead = (id: string) => {
    const snap = getStoryFeedSnapshot();
    if (!snap) return;
    writeJSON(SNAPSHOT_KEY, { ...snap, read: snap.read.filter((x) => x !== id) });
    dispatch("ploopus-story-change");
};

export const dismissStory = (id: string) => {
    const snap = getStoryFeedSnapshot();
    if (!snap) return;
    const dismissed = snap.dismissed ?? [];
    if (dismissed.includes(id)) return;
    writeJSON(SNAPSHOT_KEY, { ...snap, dismissed: [...dismissed, id] });
    dispatch("ploopus-story-change");
};

export const undismissStory = (id: string) => {
    const snap = getStoryFeedSnapshot();
    if (!snap) return;
    writeJSON(SNAPSHOT_KEY, {
        ...snap,
        dismissed: (snap.dismissed ?? []).filter((x) => x !== id),
    });
    dispatch("ploopus-story-change");
};

export { SNAPSHOT_KEY };