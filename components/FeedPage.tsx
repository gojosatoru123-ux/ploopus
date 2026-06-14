'use client'
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Flame, Calendar, RotateCcw, Star, Inbox, Layers3, TrendingUp, Archive, Trophy } from "lucide-react";
import { useNotesContext } from "@/contexts/NotesContext";
import {
    ensureStoryFeed,
    markStoryRead,
    unmarkStoryRead,
    dismissStory,
    undismissStory,
    type Story,
    type StoryFeedSnapshot,
    type StoryKind,
} from "@/lib/feedStories";
import { computeStreak, useInsightsVersion } from "@/lib/knowledgeInsights";
import StoryCard from "./utility/StoryCard";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

const FILTERS: { key: "all" | StoryKind; label: string; icon: React.ElementType; description: string }[] = [
    { key: "all", label: "For you", icon: Sparkles, description: "Your personalized feed" },
    { key: "anniversary", label: "On this day", icon: Calendar, description: "Memories from the past" },
    { key: "dormant-relevant", label: "Resurfaced", icon: RotateCcw, description: "Content worth revisiting" },
    { key: "forgotten-gold", label: "Forgotten gold", icon: Star, description: "Hidden gems you saved" },
    { key: "neglected", label: "Not opened", icon: Inbox, description: "Items waiting for you" },
    { key: "cluster", label: "Patterns", icon: Layers3, description: "Thematic groupings" },
    { key: "growth-area", label: "Growing", icon: TrendingUp, description: "Topics you're building" },
    { key: "dormant-project", label: "Dormant", icon: Archive, description: "Paused initiatives" },
    { key: "milestone", label: "Milestones", icon: Trophy, description: "Achievements reached" },
];

const greet = () => {
    const h = new Date().getHours();
    if (h < 5) return "A quiet hour";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 22) return "Good evening";
    return "Late night thoughts";
};

// Null = not yet loaded (prevents empty-state flash before first useEffect fires).
type FeedResult = { stories: Story[]; snapshot: StoryFeedSnapshot } | null;

const FeedPage = () => {
    const { noteIndexes: notes } = useNotesContext();
    const version = useInsightsVersion();
    const [filter, setFilter] = useState<"all" | StoryKind>("all");

    // notesRef holds the previous notes array reference. We only swap it to
    // the new array when the content has actually changed (different length or
    // a different note id found). This gives the WeakMap cache in feedStories
    // a stable key to hit even when the context re-creates the array reference.
    const notesRef = useRef<typeof notes>(notes);
    const stableNotes = useMemo(() => {
        const prev = notesRef.current;
        const changed =
            prev.length !== notes.length ||
            notes.some((n, i) => n.id !== prev[i]?.id);
        if (changed) notesRef.current = notes;
        return notesRef.current;
    }, [notes]);

    // Start as null so we can distinguish "loading" from "genuinely empty".
    // ensureStoryFeed touches localStorage + dispatches window events, so it
    // must only run in the browser — useEffect guarantees that.
    const [feedResult, setFeedResult] = useState<FeedResult>(null);

    useEffect(() => {
        const res = ensureStoryFeed(stableNotes);
        setFeedResult({ stories: res.stories, snapshot: res.snapshot });
        // version bumps on ploopus-story-change, ploopus-meta-change, etc.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stableNotes, version]);

    const isReady = feedResult !== null;
    const stories = feedResult?.stories ?? [];
    const snapshot = feedResult?.snapshot ?? null;

    // Keep filter in bounds: if the active filter has no stories after a
    // refresh, fall back to "all" so the user isn't stuck on an empty list.
    useEffect(() => {
        if (!isReady || filter === "all") return;
        const count = stories.filter((s) => s.kind === filter).length;
        if (count === 0) setFilter("all");
    }, [stories, filter, isReady]);

    const readSet = useMemo(() => new Set(snapshot?.read ?? []), [snapshot]);
    const dismissedSet = useMemo(() => new Set(snapshot?.dismissed ?? []), [snapshot]);
    const streak = useMemo(() => computeStreak(stableNotes), [stableNotes]);

    const filtered = filter === "all" ? stories : stories.filter((s) => s.kind === filter);
    const fresh = filtered.filter((s) => !readSet.has(s.id) && !dismissedSet.has(s.id));
    const seen = filtered.filter((s) => readSet.has(s.id) && !dismissedSet.has(s.id));
    const dismissed = filtered.filter((s) => dismissedSet.has(s.id));

    const today = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
    });

    // ── Loading skeleton ──────────────────────────────────────────────────────
    // Shown only on the very first render before useEffect fires (~one frame).
    // Keeps the layout stable and avoids the EmptyState flash.
    if (!isReady) {
        return (
            <div className="flex-1 h-full bg-background overflow-y-auto scrollbar-thin">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                    <div className="mb-8 sm:mb-10 animate-pulse">
                        <div className="h-3 w-32 bg-muted rounded mb-4" />
                        <div className="h-10 w-3/4 bg-muted rounded mb-3" />
                        <div className="h-7 w-1/2 bg-muted/60 rounded" />
                    </div>
                    <div className="flex flex-col gap-5">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="h-40 rounded-2xl bg-muted/50 animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Loaded ────────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 h-full bg-background overflow-y-auto scrollbar-thin">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

                {/* Hero header */}
                <motion.header
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-8 sm:mb-10"
                >
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span>{today}</span>
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.05]">
                        {greet()}.
                        <span className="block text-foreground/55 font-normal mt-1 sm:mt-2 text-2xl sm:text-3xl">
                            Here's what your knowledge is whispering today.
                        </span>
                    </h1>

                    <div className="mt-6 flex items-center gap-4 flex-wrap">
                        <Stat big={String(stories.length)} label="stories surfaced" />
                        <Stat big={String(stableNotes.length)} label="notes in your archive" />
                        {streak >= 2 && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-accent/20 text-accent-foreground border border-accent/40">
                                <Flame className="w-3.5 h-3.5" /> {streak}-day streak
                            </span>
                        )}
                    </div>
                </motion.header>

                {/* Filter chips */}
                {stories.length > 0 && (
                    <div className="-mx-4 sm:mx-0 mb-8 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        <div className="flex gap-1.5 px-4 sm:px-0 min-w-max p-1 bg-muted/40 rounded-full border border-border/50 backdrop-blur w-fit">
                            <TooltipProvider delayDuration={200}>
                                {FILTERS.map((f) => {
                                    const active = filter === f.key;
                                    const Icon = f.icon;
                                    const count = f.key === "all"
                                        ? stories.length
                                        : stories.filter((s) => s.kind === f.key).length;
                                    if (f.key !== "all" && count === 0) return null;
                                    return (
                                        <Tooltip key={f.key}>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() => setFilter(f.key)}
                                                    className={`relative px-5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${active
                                                            ? "text-background"
                                                            : "text-muted-foreground hover:text-foreground"
                                                        }`}
                                                >
                                                    {active && (
                                                        <motion.span
                                                            layoutId="feed-filter-pill"
                                                            className="absolute inset-0 rounded-full bg-foreground -z-10"
                                                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                                        />
                                                    )}
                                                    <Icon className="w-3.5 h-3.5" />
                                                    <span>{f.label}</span>
                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${active
                                                            ? "bg-background/20 text-background"
                                                            : "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {count}
                                                    </span>
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs">
                                                {f.description}
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </TooltipProvider>
                        </div>
                    </div>
                )}

                {/* Stories */}
                {stories.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="flex flex-col gap-5">
                        <AnimatePresence initial={false} mode="popLayout">
                            {fresh.map((s) => (
                                <StoryCard
                                    key={s.id}
                                    story={s}
                                    onMarkRead={markStoryRead}
                                    onDismiss={dismissStory}
                                    onUndismiss={undismissStory}
                                />
                            ))}
                        </AnimatePresence>

                        {seen.length > 0 && (
                            <div className="mt-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                                        Already revisited
                                    </h2>
                                    <div className="flex-1 h-px bg-border/60" />
                                </div>
                                <div className="flex flex-col gap-5">
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {seen.map((s) => (
                                            <StoryCard
                                                key={s.id}
                                                story={s}
                                                read
                                                onMarkRead={markStoryRead}
                                                onDismiss={dismissStory}
                                                onUnread={unmarkStoryRead}
                                                onUndismiss={undismissStory}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {dismissed.length > 0 && (
                            <div className="mt-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                                        Not interested today
                                    </h2>
                                    <div className="flex-1 h-px bg-border/60" />
                                </div>
                                <div className="flex flex-col gap-5">
                                    <AnimatePresence initial={false} mode="popLayout">
                                        {dismissed.map((s) => (
                                            <StoryCard
                                                key={s.id}
                                                story={s}
                                                dismissed
                                                onMarkRead={markStoryRead}
                                                onDismiss={dismissStory}
                                                onUnread={unmarkStoryRead}
                                                onUndismiss={undismissStory}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </div>
                            </div>
                        )}

                        {/* End-of-feed message */}
                        {fresh.length === 0 && (seen.length > 0 || dismissed.length > 0) && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-center py-10 text-sm text-foreground/55"
                            >
                                You've handled every story for today. A fresh feed arrives tomorrow.
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const Stat = ({ big, label }: { big: string; label: string }) => (
    <div className="inline-flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-foreground">{big}</span>
        <span className="text-sm text-foreground/55">{label}</span>
    </div>
);

const EmptyState = () => (
    <div className="text-center py-20 px-6">
        <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-muted/70 mb-4">
            <Sparkles className="w-6 h-6 text-foreground/60" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
            Your feed is gathering its first thoughts
        </h2>
        <p className="text-sm text-foreground/60 max-w-sm mx-auto">
            Write a few notes, add tags, and come back — the app will start surfacing
            patterns, anniversaries, and forgotten ideas worth revisiting.
        </p>
    </div>
);

export default FeedPage;