'use client';
import { useMemo, useRef, useState, useEffect, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Clock3, ChevronLeft, ChevronRight, Sparkles, Folder as FolderIcon,
  MoreHorizontal, Trophy, Flag, Star, Layers3, ChevronUp, HelpCircle,
  Search, Brain, Flame, Cake, type LucideIcon
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotesContext } from "@/contexts/NotesContext";

import {
  computeMilestones, computeClusters, computeGrowth,
  computeMemoryAnchors, computeJourneys, computeIdeaEvolutions,
  type Milestone,
} from "@/lib/timelineInsights";
import KnowledgeGrowthGraph from "@/components/timeline/KnowledgeGrowthGraph";
import KnowledgeClusters from "@/components/timeline/KnowledgeClusters";
import MemoryAnchors from "@/components/timeline/MemoryAnchors";
import JourneyOverlays from "@/components/timeline/JourneyOverlays";
import TimelineDrawer, { type DrawerPayload } from "@/components/timeline/TimelineDrawer";

type Zoom = "day" | "week" | "month";

interface ColorTheme {
  bg: string;
  border: string; // Tailored high-contrast dark border accent matching the core theme
  text: string;
  icon: LucideIcon;
}

interface TimelineBar {
  note: any;
  start: number;
  end: number;
  idx: number;
  theme: ColorTheme;
  lane: number;
}

const DAY_MS = 1000 * 60 * 60 * 24;
const startOfDay = (d: Date) => {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
};
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const daysBetween = (a: Date, b: Date) =>
  Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Upgraded themes with specific deep high-contrast structural border rules
const COLOR_THEMES: ColorTheme[] = [
  { bg: "bg-[#FFB067]", border: "border-[#E6954D]", text: "text-[#8C5A2D]", icon: Cake },
  { bg: "bg-[#38B6FF]", border: "border-[#219FE8]", text: "text-[#145D8A]", icon: Search },
  { bg: "bg-[#5CE65C]", border: "border-[#45CD45]", text: "text-[#2A7D2A]", icon: Brain },
  { bg: "bg-[#FFDE59]", border: "border-[#E6C53F]", text: "text-[#8A7525]", icon: Trophy },
  { bg: "bg-[#4ade80]", border: "border-[#2ec666]", text: "text-[#1C763D]", icon: Flag },
  { bg: "bg-[#FF66C4]", border: "border-[#E64DAB]", text: "text-[#8A2D67]", icon: Flame },
];

const assignDynamicLanes = (items: { start: number; end: number }[]) => {
  const lanes: number[] = [];
  return items.map((item) => {
    let laneIndex = lanes.findIndex((endDay) => endDay <= item.start);
    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push(item.end);
    } else {
      lanes[laneIndex] = item.end;
    }
    return laneIndex;
  });
};

const clusterMilestonesByDay = (milestoneList: (Milestone & { day: number })[]) => {
  const dayGroups: Record<number, typeof milestoneList> = {};
  milestoneList.forEach((m) => {
    if (!dayGroups[m.day]) dayGroups[m.day] = [];
    dayGroups[m.day].push(m);
  });
  return milestoneList.map((m) => {
    const group = dayGroups[m.day];
    const indexInGroup = group.findIndex((item) => item.id === m.id);
    return { ...m, totalInDay: group.length, indexInDay: indexInGroup };
  });
};

/**
 * Premium Circular Satin Glass Medal Bead
 */
const AppleCircularBadge = ({ iconType }: { iconType: string }) => {
  const Icon =
    iconType === "folder" ? FolderIcon
      : iconType === "first-note" ? Flag
        : iconType === "first-tag" ? Star
          : Trophy;

  let accentRing = "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200";
  if (iconType === "first-note") accentRing = "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400";
  if (iconType === "folder") accentRing = "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400";
  if (iconType === "first-tag") accentRing = "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400";

  return (
    <div className="w-8 h-8 rounded-full bg-white/80 dark:bg-neutral-900/80 border border-neutral-200/70 dark:border-neutral-800/70 shadow-[0_3px_8px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)] backdrop-blur-md flex items-center justify-center transition-all duration-200 hover:scale-105 hover:bg-white dark:hover:bg-neutral-900 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] group">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shadow-xs ${accentRing}`}>
        <Icon className="w-3 h-3 stroke-[2.5]" />
      </div>
    </div>
  );
};

const TimelinePage = () => {
  const router = useRouter();
  const { noteIndexes: notes, folders } = useNotesContext();
  const [zoom, setZoom] = useState<Zoom>("week");

  const scrollerRef = useRef<HTMLDivElement>(null);
  const sidebarGridRef = useRef<HTMLDivElement>(null);

  const DAY_W = zoom === "day" ? 140 : zoom === "week" ? 84 : 48;
  const ROW_H = 68;
  const BAR_H = 42;
  const HEADER_H = 76;
  const MILESTONE_TRACK_H = 48;

  const today = useMemo(() => startOfDay(new Date()), []);
  const [insightsOpen, setInsightsOpen] = useState(false);

  const { rangeStart, totalDays } = useMemo(() => {
    if (notes.length === 0) {
      const start = addDays(today, -14);
      return { rangeStart: start, totalDays: 42 };
    }
    const times = notes.map((n) => new Date(n.createdAt).getTime());
    const earliest = startOfDay(new Date(Math.min(...times)));
    const latestRaw = new Date(Math.max(...times, ...notes.map((n) => new Date(n.updatedAt).getTime())));
    const latest = startOfDay(latestRaw);
    const start = addDays(earliest, -7);
    const end = addDays(latest > today ? latest : today, 21);
    return { rangeStart: start, totalDays: daysBetween(start, end) + 1 };
  }, [notes, today]);

  const bars = useMemo<TimelineBar[]>(() => {
    const sortedNotes = [...notes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const list = sortedNotes.map((n, idx) => {
      const created = startOfDay(new Date(n.createdAt));
      const updated = startOfDay(new Date(n.updatedAt));
      const start = Math.max(0, daysBetween(rangeStart, created));
      let end = Math.max(start + 1, daysBetween(rangeStart, updated) + 1);

      const minimalSpan = zoom === "month" ? 3.5 : zoom === "week" ? 1.5 : 1;
      if (end - start < minimalSpan) {
        end = start + minimalSpan;
      }

      const theme = COLOR_THEMES[idx % COLOR_THEMES.length];
      return { note: n, start, end, idx, theme };
    });

    const lanes = assignDynamicLanes(list);
    return list.map((item, i) => ({ ...item, lane: lanes[i] }));
  }, [notes, rangeStart, zoom]);

  const totalLanesCount = useMemo(() => {
    return Math.max(1, bars.reduce((max, b) => Math.max(max, b.lane + 1), 0));
  }, [bars]);

  const richMilestones = useMemo(() => computeMilestones(notes, folders), [notes, folders]);
  const clusteredMilestones = useMemo(() => {
    const rawMilestones = richMilestones
      .map((m) => ({ ...m, day: daysBetween(rangeStart, startOfDay(m.date)) }))
      .filter((m) => m.day >= 0 && m.day < totalDays);
    return clusterMilestonesByDay(rawMilestones);
  }, [richMilestones, rangeStart, totalDays]);

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollX(e.currentTarget.scrollLeft);
    if (sidebarGridRef.current) {
      sidebarGridRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const clusters = useMemo(() => computeClusters(notes, folders), [notes, folders]);
  const growth = useMemo(() => computeGrowth(notes), [notes]);
  const anchors = useMemo(() => computeMemoryAnchors(notes), [notes]);
  const journeys = useMemo(() => computeJourneys(notes), [notes]);
  const evolutions = useMemo(() => computeIdeaEvolutions(notes), [notes]);

  const [drawer, setDrawer] = useState<DrawerPayload | null>(null);

  const openNote = (id: string) => {
    setDrawer(null);
    router.push(`/note/ideas/${id}`);
  };

  const openDay = (day: number) => {
    const date = addDays(rangeStart, day);
    const ids = notes
      .filter((n) => daysBetween(rangeStart, startOfDay(new Date(n.createdAt))) === day)
      .map((n) => n.id);
    setDrawer({ kind: "date", date, noteIds: ids });
  };

  const todayOffset = daysBetween(rangeStart, today);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = Math.max(0, todayOffset * DAY_W - el.clientWidth / 3);
    el.scrollTo({ left: target });
  }, [zoom, todayOffset, DAY_W]);

  const [scrollX, setScrollX] = useState(0);

  const focusedDay = Math.floor((scrollX + (scrollerRef.current?.clientWidth ?? 0) / 2) / DAY_W);
  const focusedDate = addDays(rangeStart, Math.max(0, Math.min(totalDays - 1, focusedDay)));

  const scrollBy = (deltaDays: number) => {
    scrollerRef.current?.scrollBy({ left: deltaDays * DAY_W, behavior: "smooth" });
  };

  const monthBands = useMemo(() => {
    const bands: { start: number; length: number; label: string }[] = [];
    let cursor = 0;
    while (cursor < totalDays) {
      const d = addDays(rangeStart, cursor);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const len = Math.min(daysBetween(d, monthEnd), totalDays - cursor);
      bands.push({
        start: cursor,
        length: len,
        label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
      });
      cursor += len;
    }
    return bands;
  }, [rangeStart, totalDays]);

  const totalWidth = totalDays * DAY_W;

  const orderedSidebarBars = useMemo<(TimelineBar | null)[]>(() => {
    const arr = Array.from({ length: totalLanesCount }, () => null as TimelineBar | null);
    bars.forEach((bar) => {
      arr[bar.lane] = bar;
    });
    return arr;
  }, [bars, totalLanesCount]);

  return (
    <div className="flex-1 h-full flex flex-col bg-linear-to-b from-background via-background to-muted/30 subpixel-antialiased overflow-y-auto">

      {/* Control Navigation Header */}
      <div className="shrink-0 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="px-2 sm:px-8 pt-2 sm:pt-4 pb-5">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div className="flex gap-3 items-center">
              <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
                {focusedDate.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </h1>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-7 h-7 grid place-items-center rounded-full border border-border bg-card/80 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shadow-sm"
                    aria-label="All milestones"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-75 sm:w-90 p-0 overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 shadow-2xl bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl"
                >
                  <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/30">
                    <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-neutral-400 dark:text-neutral-500">
                      All Milestones
                    </div>
                    <div className="text-base font-semibold tracking-tight text-neutral-800 dark:text-neutral-200 mt-0.5">
                      {richMilestones.length} achievements earned
                    </div>
                  </div>
                  <div className="max-h-95 overflow-y-auto no-scrollbar divide-y divide-neutral-100 dark:divide-neutral-900">
                    {richMilestones.length === 0 && (
                      <div className="px-4 py-8 text-xs text-muted-foreground text-center">
                        Milestones appear as you build your collection.
                      </div>
                    )}
                    {richMilestones.map((m) => {
                      return (
                        <button
                          key={m.id}
                          onClick={() => setDrawer({ kind: "milestone", milestone: m as Milestone })}
                          className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                        >
                          <AppleCircularBadge iconType={m.icon} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                              {m.title}
                            </div>
                            <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 mt-0.5">
                              {m.date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center  gap-1 sm:gap-3">
              <div className="inline-flex rounded-full border border-border p-1 bg-card/80 shadow-sm">
                {(["day", "week", "month"] as Zoom[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    className={`px-1.5 sm:px-3.5 py-1 rounded-full text-xs font-medium capitalize transition-all ${zoom === z
                      ? "bg-foreground text-background shadow"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {z}
                  </button>
                ))}
              </div>

              <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-1 py-1 shadow-sm">
                <button
                  onClick={() => scrollBy(-14)}
                  className="w-7 h-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    scrollerRef.current?.scrollTo({
                      left: Math.max(0, todayOffset * DAY_W - (scrollerRef.current?.clientWidth ?? 0) / 3),
                      behavior: "smooth",
                    })
                  }
                  className="px-3 h-7 rounded-full text-xs font-medium text-foreground hover:bg-muted"
                >
                  Today
                </button>
                <button
                  onClick={() => scrollBy(14)}
                  className="w-7 h-7 grid place-items-center rounded-full hover:bg-muted text-muted-foreground"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {notes.length === 0 ? (
        <div className="flex-1 grid place-items-center text-muted-foreground">
          <div className="text-center">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-accent" />
            Your timeline will appear the moment you create your first note.
          </div>
        </div>
      ) : (
        <TooltipProvider delayDuration={100}>
          <div className="flex flex-col min-h-0 flex-1">
            {/* Insights Stream Graphs */}
            <div className="border-b border-border/40 bg-background/60">
              <KnowledgeGrowthGraph points={growth} />
              <div className="px-8 pb-3 pt-1 flex items-center justify-between gap-3">
                <button
                  onClick={() => setInsightsOpen((v) => !v)}
                  className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Layers3 className="w-3.5 h-3.5" />
                  Insights & Memories
                  <span className="text-foreground/50 normal-case tracking-normal">
                    ({clusters.length + anchors.length + journeys.length + evolutions.length})
                  </span>
                  <ChevronUp className={`w-3.5 h-3.5 transition-transform ${insightsOpen ? "" : "rotate-180"}`} />
                </button>
              </div>
              {insightsOpen && (
                <div className="pb-2">
                  <KnowledgeClusters
                    clusters={clusters}
                    onSelect={(c) => setDrawer({ kind: "cluster", cluster: c })}
                  />
                  <MemoryAnchors
                    anchors={anchors}
                    onSelect={(a) => setDrawer({ kind: "anchor", anchor: a })}
                  />
                  <JourneyOverlays
                    journeys={journeys}
                    evolutions={evolutions}
                    onOpenJourney={(j) => setDrawer({ kind: "journey", journey: j })}
                    onOpenEvolution={(e) => setDrawer({ kind: "evolution", evolution: e })}
                  />
                </div>
              )}
            </div>

            {/* Main Scroller Matrix Canvas */}
            <div className="flex min-h-[60vh] bg-transparent">

              {/* FIXED LEFT SIDEBAR */}
              <div className="hidden md:flex w-65 shrink-0 border-r border-r-neutral-200/50 dark:border-r-neutral-800/50 bg-neutral-50/40 dark:bg-neutral-900/10 backdrop-blur-md flex-col z-20 self-stretch">
                <div className="border-b border-border/40 flex items-center justify-between px-6 bg-transparent sticky top-0" style={{ height: HEADER_H + MILESTONE_TRACK_H }}>
                  <span className="font-semibold text-[13px] text-neutral-400 uppercase tracking-wider">Activity List</span>
                  <span className="text-[11px] bg-neutral-200/60 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold px-2 py-0.5 rounded-full">{bars.length}</span>
                </div>

                <div ref={sidebarGridRef} className="flex-1 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800/30 no-scrollbar pb-10">
                  {orderedSidebarBars.map((correspondingBar, idx) => {
                    return (
                      <div key={`side-row-${idx}`} style={{ height: ROW_H }} className="flex items-center gap-3 px-6 bg-transparent">
                        {correspondingBar ? (
                          <>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${correspondingBar.theme.bg} bg-opacity-20`}>
                              {(() => {
                                const BarIcon = correspondingBar.theme.icon;
                                return <BarIcon className={`w-4 h-4 ${correspondingBar.theme.bg.replace('bg-', 'text-')}`} />;
                              })()}
                            </div>
                            <span className="text-[13px] font-medium text-neutral-800 dark:text-neutral-200 truncate">
                              {correspondingBar.note.title || "Untitled Note"}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-mono opacity-10 select-none">// BLANK SPACE</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MAIN TIMELINE SCROLLER AREA */}
              <div
                ref={scrollerRef}
                onScroll={handleGridScroll}
                className="flex-1 overflow-auto no-scrollbar relative touch-pan-x selection:bg-transparent"
              >
                <div className="relative" style={{ width: totalWidth, minHeight: HEADER_H + MILESTONE_TRACK_H + totalLanesCount * ROW_H + 60 }}>

                  {/* TIMELINE GRID LINES */}
                  <div className="absolute inset-0 pointer-events-none z-0">
                    {Array.from({ length: totalDays + 1 }).map((_, i) => {
                      const d = addDays(rangeStart, i);
                      return (
                        <div
                          key={`line-${i}`}
                          className={`absolute top-0 bottom-0 ${d.getDate() === 1 ? "border-l border-neutral-300 dark:border-neutral-700" : "border-l border-neutral-200/40 dark:border-neutral-800/30"
                            }`}
                          style={{ left: i * DAY_W }}
                        />
                      );
                    })}
                    {Array.from({ length: totalLanesCount }).map((_, i) => (
                      <div
                        key={`lane-border-${i}`}
                        className="absolute left-0 right-0 border-b border-neutral-100 dark:border-neutral-800/40"
                        style={{ top: HEADER_H + MILESTONE_TRACK_H + (i + 1) * ROW_H }}
                      />
                    ))}
                  </div>

                  {/* CURRENT DAY VERTICAL TRACKING LINE */}
                  {todayOffset >= 0 && todayOffset < totalDays && (
                    <div
                      className="absolute top-0 bottom-0 z-10 pointer-events-none border-l-[1.5px] border-red-500/30 dark:border-red-500/20"
                      style={{ left: todayOffset * DAY_W + DAY_W / 2 }}
                    />
                  )}

                  {/* CALENDAR HEADER */}
                  <div
                    className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40"
                    style={{ height: HEADER_H }}
                  >
                    {/* Month Rows */}
                    <div className="relative h-8 border-b border-border/10">
                      {monthBands.map((b) => (
                        <div
                          key={b.start}
                          className="absolute top-0 h-8 flex items-center px-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
                          style={{ left: b.start * DAY_W, width: b.length * DAY_W }}
                        >
                          <span className="truncate">{b.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Day Date Boxes */}
                    <div className="relative h-11">
                      {Array.from({ length: totalDays }).map((_, i) => {
                        const d = addDays(rangeStart, i);
                        const isToday = i === todayOffset;
                        if (zoom === "month" && d.getDate() !== 1 && d.getDate() !== 15) return null;

                        return (
                          <button
                            key={`date-box-${i}`}
                            onClick={() => openDay(i)}
                            className={`absolute top-0 bottom-0 flex flex-col items-center justify-center text-[10px] transition-colors ${isToday ? "text-primary font-semibold" : "text-neutral-400"
                              }`}
                            style={{ left: i * DAY_W, width: DAY_W }}
                          >
                            <span className="text-[9px] font-bold opacity-40 tracking-wider uppercase">{WEEKDAY[d.getDay()]}</span>
                            <span className={`text-[12px] mt-0.5 font-semibold w-5 h-5 flex items-center justify-center rounded-full transition-transform ${isToday ? "bg-neutral-900 text-white dark:bg-white dark:text-black font-bold scale-105 shadow-xs" : "text-neutral-800 dark:text-neutral-200"}`}>
                              {d.getDate()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SHADCN-TOOLTIP POWERED SIDE-BY-SIDE MILESTONE SHELF */}
                  <div className="relative border-b border-neutral-100 dark:border-neutral-800/30 bg-neutral-50/10 dark:bg-neutral-900/5 flex items-center" style={{ height: MILESTONE_TRACK_H }}>
                    {clusteredMilestones.map((m) => {
                      const segmentWidth = DAY_W / (m.totalInDay + 1);
                      const leftOffset = (m.indexInDay + 1) * segmentWidth;

                      return (
                        <div
                          key={m.id}
                          className="absolute -translate-x-1/2 z-20 hover:z-30"
                          style={{ left: m.day * DAY_W + leftOffset }}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => setDrawer({ kind: "milestone", milestone: m as Milestone })}
                                className="focus:outline-none"
                              >
                                <AppleCircularBadge iconType={m.icon} />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="bg-neutral-900/90 text-white dark:bg-white dark:text-neutral-900 px-3 py-1.5 rounded-xl border-none font-medium text-[12px] tracking-tight backdrop-blur-md shadow-xl"
                            >
                              {m.title}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>

                  {/* GANTT PILLS ACTIVITY LAYER */}
                  <div className="relative pb-10 z-20">
                    {bars.map((bar) => {
                      const left = bar.start * DAY_W;
                      const computedWidth = (bar.end - bar.start) * DAY_W;
                      const width = Math.max(computedWidth - 8, zoom === "month" ? 100 : 60);
                      const top = bar.lane * ROW_H + (ROW_H - BAR_H) / 2;
                      const BarIcon = bar.theme.icon;

                      return (
                        <motion.button
                          key={`bar-pill-${bar.note.id}`}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          onClick={() => router.push(`/note/ideas/${bar.note.id}`)}
                          // Added explicit high-contrast theme border rule styles down below
                          className={`absolute ${bar.theme.bg} ${bar.theme.border} rounded-2xl flex items-center px-4 transition-all active:scale-[0.99] text-left border-2 shadow-[0_3px_10px_rgba(0,0,0,0.03)] group`}
                          style={{
                            left: Math.max(4, left),
                            top,
                            width,
                            height: BAR_H
                          }}
                        >
                          <BarIcon className={`w-4 h-4 shrink-0 ${bar.theme.text} opacity-95 group-hover:scale-105 transition-transform`} />
                          {width > 80 && (
                            <span className={`text-[13px] font-semibold truncate tracking-wide ${bar.theme.text} ml-2 drop-shadow-xs`}>
                              {bar.note.title || "Untitled Note"}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Folder Extensions */}
                  {(() => {
                    const activeFolders = folders
                      .map((f, fi) => {
                        const folderNotes = notes.filter((n) => n.folderId === f.id);
                        if (folderNotes.length === 0) return null;
                        const startDay = Math.max(0, daysBetween(rangeStart, startOfDay(new Date(f.createdAt))));
                        const endTime = Math.max(...folderNotes.map((n) => new Date(n.updatedAt).getTime()));
                        const endDay = daysBetween(rangeStart, startOfDay(new Date(endTime))) + 1;
                        const theme = COLOR_THEMES[fi % COLOR_THEMES.length];
                        return { f, startDay, endDay, theme };
                      })
                      .filter(Boolean) as { f: (typeof folders)[0]; startDay: number; endDay: number; theme: ColorTheme }[];

                    if (activeFolders.length === 0) return null;

                    const ROW = 28;
                    return (
                      <div
                        className="absolute left-0 right-0 border-t border-border/20"
                        style={{ top: HEADER_H + MILESTONE_TRACK_H + totalLanesCount * ROW_H + 20, height: activeFolders.length * ROW + 12 }}
                      >
                        {activeFolders.map(({ f, startDay, endDay, theme }, i) => {
                          const left = startDay * DAY_W;
                          const width = Math.max((endDay - startDay) * DAY_W, DAY_W * 2);
                          const folderNoteIds = notes.filter((n) => n.folderId === f.id).map((n) => n.id);
                          return (
                            <button
                              key={f.id}
                              onClick={() => setDrawer({ kind: "folder", folderId: f.id, title: f.name, noteIds: folderNoteIds })}
                              className={`absolute flex items-center gap-1.5 px-2.5 rounded-lg ${theme.bg} border ${theme.border} shadow-sm cursor-pointer hover:brightness-95 active:scale-[0.98] transition-all`}
                              style={{ left, width, top: 6 + i * ROW, height: ROW - 6 }}
                              title={`Open folder: ${f.name}`}
                            >
                              <FolderIcon className={`w-3 h-3 shrink-0 ${theme.text}`} />
                              <span className={`text-[11px] font-semibold truncate ${theme.text}`}>{f.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}

                </div>
              </div>

            </div>
          </div>
        </TooltipProvider>
      )}

      <TimelineDrawer
        payload={drawer}
        notes={notes}
        onClose={() => setDrawer(null)}
        onOpenNote={openNote}
      />
    </div>
  );
};

export default TimelinePage;