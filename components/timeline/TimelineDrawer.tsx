'use client';
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight, Sparkles, GitBranch, BookOpen, Calendar } from "lucide-react";
import { NoteIndex } from "@/lib/types";
import type {
    KnowledgeCluster,
    IdeaEvolution,
    LearningJourney,
    Milestone,
    MemoryAnchor,
} from "@/lib/timelineInsights";

export type DrawerPayload =
    | { kind: "cluster"; cluster: KnowledgeCluster }
    | { kind: "milestone"; milestone: Milestone }
    | { kind: "anchor"; anchor: MemoryAnchor }
    | { kind: "evolution"; evolution: IdeaEvolution }
    | { kind: "journey"; journey: LearningJourney }
    | { kind: "date"; date: Date; noteIds: string[] }
    | { kind: "folder"; folderId: string; title: string; noteIds: string[] };

interface Props {
    payload: DrawerPayload | null;
    notes: NoteIndex[];
    onClose: () => void;
    onOpenNote: (id: string) => void;
}

const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });

// ── Per-kind header palette (richer, more saturated) ─────────────────────────
const kindPalette: Record<
    DrawerPayload["kind"],
    { chipBg: string; chipText: string; label: string }
> = {
    cluster: { chipBg: "#C8EAA8", chipText: "#1A4A04", label: "Knowledge Cluster" },
    milestone: { chipBg: "#FCDBA0", chipText: "#5A2E00", label: "Milestone" },
    anchor: { chipBg: "#F8C8DC", chipText: "#6A0F2E", label: "Memory Anchor" },
    evolution: { chipBg: "#C8C4F4", chipText: "#2A1E80", label: "Idea Evolution" },
    journey: { chipBg: "#A8E8D0", chipText: "#044030", label: "Learning Journey" },
    date: { chipBg: "#B0D8F8", chipText: "#083060", label: "Memory Stream" },
    folder: { chipBg: "#F8C8DC", chipText: "#6A0F2E", label: "Folder" },
};

// ── Note row icon colors (saturated, not pale) ────────────────────────────────
const noteColors = [
    { bg: "#C8EAA8", color: "#1A4A04" },
    { bg: "#C8C4F4", color: "#2A1E80" },
    { bg: "#B0D8F8", color: "#083060" },
    { bg: "#FCDBA0", color: "#5A2E00" },
    { bg: "#F8C8DC", color: "#6A0F2E" },
    { bg: "#A8E8D0", color: "#044030" },
];

// ── Stat card palettes ────────────────────────────────────────────────────────
const statPalettes = [
    { bg: "#C8EAA8", numColor: "#1A4A04", lblColor: "#2A6A08" },
    { bg: "#C8C4F4", numColor: "#2A1E80", lblColor: "#3A2EA8" },
    { bg: "#B0D8F8", numColor: "#083060", lblColor: "#1050A0" },
    { bg: "#FCDBA0", numColor: "#5A2E00", lblColor: "#804008" },
    { bg: "#A8E8D0", numColor: "#044030", lblColor: "#0A6040" },
];

// ── Tag pill palettes ─────────────────────────────────────────────────────────
const tagPalettes = [
    { bg: "#C8EAA8", color: "#1A4A04" },
    { bg: "#C8C4F4", color: "#2A1E80" },
    { bg: "#B0D8F8", color: "#083060" },
    { bg: "#FCDBA0", color: "#5A2E00" },
    { bg: "#F8C8DC", color: "#6A0F2E" },
];

// ── Timeline step palettes: dot color + card bg/border/label ─────────────────
const evolutionSteps = [
    { dot: "#6C5FE6", cardBg: "#EEECFD", cardBorder: "#C0BAF0", labelColor: "#3A2EA8", linkBg: "#E0DCFC", stepLabel: "Stage" },
    { dot: "#2878D0", cardBg: "#E8F2FC", cardBorder: "#A8CCF0", labelColor: "#1050A0", linkBg: "#D4E8F8", stepLabel: "Stage" },
    { dot: "#0E9068", cardBg: "#E2F5EE", cardBorder: "#90D8BC", labelColor: "#0A6040", linkBg: "#C8EEE0", stepLabel: "Stage" },
    { dot: "#C84820", cardBg: "#FCF0EB", cardBorder: "#F0B090", labelColor: "#8A2C10", linkBg: "#F8E0D0", stepLabel: "Stage" },
    { dot: "#C04070", cardBg: "#FCE8F0", cardBorder: "#F0A8C4", labelColor: "#8A1840", linkBg: "#F8D4E4", stepLabel: "Stage" },
    { dot: "#A87010", cardBg: "#FDF5E0", cardBorder: "#F0D080", labelColor: "#7A5000", linkBg: "#F8EAC0", stepLabel: "Stage" },
];

const journeySteps = [
    { dot: "#0E9068", cardBg: "#E2F5EE", cardBorder: "#90D8BC", labelColor: "#0A6040", linkBg: "#C8EEE0", stepLabel: "Phase" },
    { dot: "#2878D0", cardBg: "#E8F2FC", cardBorder: "#A8CCF0", labelColor: "#1050A0", linkBg: "#D4E8F8", stepLabel: "Phase" },
    { dot: "#6C5FE6", cardBg: "#EEECFD", cardBorder: "#C0BAF0", labelColor: "#3A2EA8", linkBg: "#E0DCFC", stepLabel: "Phase" },
    { dot: "#C04070", cardBg: "#FCE8F0", cardBorder: "#F0A8C4", labelColor: "#8A1840", linkBg: "#F8D4E4", stepLabel: "Phase" },
    { dot: "#C84820", cardBg: "#FCF0EB", cardBorder: "#F0B090", labelColor: "#8A2C10", linkBg: "#F8E0D0", stepLabel: "Phase" },
    { dot: "#A87010", cardBg: "#FDF5E0", cardBorder: "#F0D080", labelColor: "#7A5000", linkBg: "#F8EAC0", stepLabel: "Phase" },
];

// ─── Section label ────────────────────────────────────────────────────────────

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7470] mb-2.5">{title}</p>
        {children}
    </div>
);

// ─── Note row ─────────────────────────────────────────────────────────────────

const NoteRow = ({
    note,
    index = 0,
    onOpen,
}: {
    note: NoteIndex;
    index?: number;
    onOpen: (id: string) => void;
}) => {
    const c = noteColors[index % noteColors.length];
    return (
        <button
            onClick={() => onOpen(note.id)}
            className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border border-[#E4DED8] bg-[#FAFAF8] hover:bg-white hover:border-[#C8C0B8] active:scale-[0.99] transition-all duration-150 mb-1.5"
        >
            <div
                className="w-7.5 h-7.5 rounded-[9px] flex items-center justify-center shrink-0"
                style={{ background: c.bg }}
            >
                <svg className="w-3.5 h-3.5" style={{ color: c.color }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[#1A1A1A] truncate leading-tight">{note.title || "Untitled"}</p>
                <p className="text-[11px] text-[#9A9490] mt-0.5">
                    {new Date(note.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-[#B8B0A8] shrink-0" />
        </button>
    );
};

// ─── Stat card ────────────────────────────────────────────────────────────────

const Stat = ({
    label, value, bg, numColor, lblColor,
}: {
    label: string; value: number; bg: string; numColor: string; lblColor: string;
}) => (
    <div className="rounded-2xl px-3 py-3 text-center" style={{ background: bg }}>
        <p className="text-[22px] font-semibold tracking-tight leading-none" style={{ color: numColor }}>{value}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] mt-1.5" style={{ color: lblColor }}>{label}</p>
    </div>
);

// ─── Tag pill ─────────────────────────────────────────────────────────────────

const TagPill = ({ label, bg, color }: { label: string; bg: string; color: string }) => (
    <span className="inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>
        {label}
    </span>
);

// ─── TimelineStep — card layout, line properly centred ───────────────────────
//
// Architecture:
//   [38px dot-column]  [flex-1 card]
//
// The parent <ol> has no left border. Instead we draw the connecting line as
// a pseudo-element on the *wrapper* element, positioned at x=18px (centre of
// the 38px column). top/bottom are clamped so the line runs dot-centre to
// dot-centre, not edge to edge.

type StepPalette = typeof evolutionSteps[number];

const TimelineStep = ({
    index,
    total,
    date,
    label,
    linkText,
    linkId,
    palette,
    onOpen,
}: {
    index: number;
    total: number;
    date: string;
    label: string;
    linkText?: string;
    linkId?: string;
    palette: StepPalette;
    onOpen?: (id: string) => void;
}) => {
    const isLast = index === total - 1;

    return (
        <li
            className="relative flex items-start gap-3.5"
            style={{ marginBottom: isLast ? 0 : 10 }}
        >
            {/* Connecting line — runs from bottom of this dot to top of next */}
            {!isLast && (
                <span
                    aria-hidden
                    style={{
                        position: "absolute",
                        left: 18,           // centre of the 38px dot column (38/2 - 1px lineWidth/2 ≈ 18)
                        top: 26,            // just below the dot centre (dot is at top:12, height:14 → centre≈19, bottom≈26)
                        bottom: -10,        // reaches into the gap before next item
                        width: 2,
                        background: `linear-gradient(to bottom, ${palette.dot}60, ${palette.dot}18)`,
                        borderRadius: 2,
                    }}
                />
            )}

            {/* Dot column — fixed width keeps the line anchor stable */}
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    width: 38,
                    flexShrink: 0,
                    display: "flex",
                    justifyContent: "center",
                    paddingTop: 12,        // vertically aligns dot with card title row
                }}
            >
                <div
                    style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: palette.dot,
                        border: "2.5px solid #fff",
                        boxShadow: `0 0 0 2px ${palette.dot}`,
                        flexShrink: 0,
                    }}
                />
            </div>

            {/* Step card */}
            <div
                className="flex-1 rounded-[14px] px-3.5 py-3 transition-transform duration-150 hover:translate-x-0.5"
                style={{
                    background: palette.cardBg,
                    border: `0.5px solid ${palette.cardBorder}`,
                }}
            >
                {/* Step number badge */}
                <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
                    style={{ color: palette.labelColor, opacity: 0.7 }}
                >
                    {palette.stepLabel} {index + 1}
                </p>

                {/* Label */}
                <p className="text-[13px] font-semibold text-[#1A1A1A] leading-snug mb-1">
                    {label}
                </p>

                {/* Date */}
                <p className="text-[11px] text-[#9A9490] mb-2">{date}</p>

                {/* Note link button */}
                {linkText && linkId && onOpen && (
                    <button
                        onClick={() => onOpen(linkId)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-75"
                        style={{
                            background: palette.linkBg,
                            color: palette.labelColor,
                            border: `0.5px solid ${palette.cardBorder}`,
                        }}
                    >
                        <ArrowRight className="w-3 h-3" />
                        {linkText}
                    </button>
                )}
            </div>
        </li>
    );
};

// ─── Header ───────────────────────────────────────────────────────────────────

const DrawerHeader = ({ payload, onClose }: { payload: DrawerPayload; onClose: () => void }) => {
    const p = kindPalette[payload.kind];

    const { title, subtitle } = (() => {
        switch (payload.kind) {
            case "cluster": return { title: payload.cluster.title, subtitle: payload.cluster.subtitle };
            case "milestone": return { title: payload.milestone.title, subtitle: fmt(payload.milestone.date) };
            case "anchor": return { title: payload.anchor.title, subtitle: fmt(payload.anchor.date) };
            case "evolution": return { title: `#${payload.evolution.rootTitle}`, subtitle: `${payload.evolution.steps.length} stages` };
            case "journey": return { title: payload.journey.topic, subtitle: `${payload.journey.noteIds.length} notes · started ${fmt(payload.journey.start)}` };
            case "date": return { title: fmt(payload.date), subtitle: `${payload.noteIds.length} note${payload.noteIds.length === 1 ? "" : "s"} on this day` };
            case "folder": return { title: payload.title, subtitle: `${payload.noteIds.length} note${payload.noteIds.length === 1 ? "" : "s"} in this folder` };
        }
    })();

    return (
        <div className="shrink-0 flex items-start justify-between gap-4 px-5 pt-5 pb-4 border-b border-[#EAE6E1]">
            <div>
                <span
                    className="inline-block text-[10px] font-bold uppercase tracking-[0.13em] px-2.5 py-1 rounded-full mb-2"
                    style={{ background: p.chipBg, color: p.chipText }}
                >
                    {p.label}
                </span>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#1A1A1A] leading-tight">{title}</h2>
                <p className="mt-1 text-[11px] text-[#9A9490]">{subtitle}</p>
            </div>
            <button
                onClick={onClose}
                aria-label="Close"
                className="mt-1 w-7 h-7 rounded-full bg-[#EEEAE4] hover:bg-[#E4DED8] flex items-center justify-center text-[#706860] shrink-0 transition-colors border-0"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
};

// ─── Body panels ──────────────────────────────────────────────────────────────

const DrawerBody = ({
    payload,
    notes,
    onOpen,
}: {
    payload: DrawerPayload;
    notes: NoteIndex[];
    onOpen: (id: string) => void;
}) => {
    const byId = new Map(notes.map((n) => [n.id, n]));

    /* cluster */
    if (payload.kind === "cluster") {
        const items = payload.cluster.noteIds.map((id) => byId.get(id)).filter(Boolean) as NoteIndex[];
        const themes = [...new Set(items.flatMap((n) => n.tags.map((t) => t.label)))];
        return (
            <>
                <div className="grid grid-cols-3 gap-2">
                    <Stat label="Notes" value={payload.cluster.noteCount}    {...statPalettes[0]} />
                    <Stat label="Themes" value={themes.length}                 {...statPalettes[1]} />
                    <Stat label="Folders" value={payload.cluster.folderCount}   {...statPalettes[2]} />
                </div>
                {themes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                        {themes.slice(0, 8).map((t, i) => (
                            <TagPill key={t} label={t} {...tagPalettes[i % tagPalettes.length]} />
                        ))}
                    </div>
                )}
                <Section title="Connected Notes">
                    {items.slice(0, 30).map((n, i) => <NoteRow key={n.id} note={n} index={i} onOpen={onOpen} />)}
                </Section>
            </>
        );
    }

    /* milestone */
    if (payload.kind === "milestone") {
        const n = payload.milestone.noteId ? byId.get(payload.milestone.noteId) : undefined;
        return (
            <>
                <div className="rounded-2xl p-4" style={{ background: "#FCDBA0", border: "0.5px solid #F0B840" }}>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: "#5A2E00" }}>
                        <Sparkles className="w-3.5 h-3.5" /> Achievement unlocked
                    </div>
                    <p className="text-[13px] leading-relaxed" style={{ color: "#3A1800" }}>{payload.milestone.detail}</p>
                </div>
                {n && (
                    <Section title="The note that marked it">
                        <NoteRow note={n} index={0} onOpen={onOpen} />
                    </Section>
                )}
            </>
        );
    }

    /* anchor */
    if (payload.kind === "anchor") {
        const n = payload.anchor.noteId ? byId.get(payload.anchor.noteId) : undefined;
        return (
            <>
                <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "#F8C8DC", border: "0.5px solid #E890B8" }}>
                    <span aria-hidden className="absolute top-1 left-3 text-[56px] leading-none select-none font-serif" style={{ color: "#C0406A", opacity: 0.30 }}>"</span>
                    <p className="relative text-[14px] italic leading-relaxed pl-2" style={{ color: "#4A0A20" }}>{payload.anchor.body}</p>
                </div>
                {n && (
                    <Section title="Revisit">
                        <NoteRow note={n} index={0} onOpen={onOpen} />
                    </Section>
                )}
            </>
        );
    }

    /* evolution */
    if (payload.kind === "evolution") {
        const steps = payload.evolution.steps;
        return (
            <>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7A7470] mb-4">
                    <GitBranch className="w-3.5 h-3.5" /> How this idea evolved
                </div>
                <ol className="relative list-none p-0 m-0">
                    {steps.map((s, i) => {
                        const n = byId.get(s.noteId);
                        return (
                            <TimelineStep
                                key={i}
                                index={i}
                                total={steps.length}
                                date={fmt(s.date)}
                                label={s.label}
                                linkText={n?.title || "Untitled"}
                                linkId={s.noteId}
                                palette={evolutionSteps[i % evolutionSteps.length]}
                                onOpen={onOpen}
                            />
                        );
                    })}
                </ol>
            </>
        );
    }

    /* journey */
    if (payload.kind === "journey") {
        const items = payload.journey.noteIds.map((id) => byId.get(id)).filter(Boolean) as NoteIndex[];
        const steps = payload.journey.steps;
        return (
            <>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7A7470] mb-3">
                    <BookOpen className="w-3.5 h-3.5" /> A long-term learning path
                </div>
                <Section title="Path Stages">
                    <ol className="relative list-none p-0 m-0 mt-1">
                        {steps.map((s, i) => (
                            <TimelineStep
                                key={i}
                                index={i}
                                total={steps.length}
                                date={fmt(s.date)}
                                label={s.label}
                                palette={journeySteps[i % journeySteps.length]}
                            />
                        ))}
                    </ol>
                </Section>
                <Section title="All notes in this journey">
                    {items.map((n, i) => <NoteRow key={n.id} note={n} index={i} onOpen={onOpen} />)}
                </Section>
            </>
        );
    }

    /* date */
    if (payload.kind === "date") {
        const items = payload.noteIds.map((id) => byId.get(id)).filter(Boolean) as NoteIndex[];
        return (
            <>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7A7470] mb-1">
                    <Calendar className="w-3.5 h-3.5" /> {fmt(payload.date)}
                </div>
                <Section title="Captured on this day">
                    {items.length === 0 ? (
                        <p className="text-[12px] text-[#9A9490] italic px-1">A quiet day — no notes captured.</p>
                    ) : (
                        items.map((n, i) => <NoteRow key={n.id} note={n} index={i} onOpen={onOpen} />)
                    )}
                </Section>
            </>
        );
    }

    /* folder */
    if (payload.kind === "folder") {
        const items = payload.noteIds.map((id) => byId.get(id)).filter(Boolean) as NoteIndex[];
        return (
            <>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7A7470] mb-1">
                    <BookOpen className="w-3.5 h-3.5" /> {payload.title}
                </div>
                <Section title="Notes in this folder">
                    {items.length === 0 ? (
                        <p className="text-[12px] text-[#9A9490] italic px-1">This folder is empty.</p>
                    ) : (
                        items.map((n, i) => <NoteRow key={n.id} note={n} index={i} onOpen={onOpen} />)
                    )}
                </Section>
            </>
        );
    }
};

// ─── Root ─────────────────────────────────────────────────────────────────────

const TimelineDrawer = ({ payload, notes, onClose, onOpenNote }: Props) => (
    <AnimatePresence>
        {payload && (
            <>
                <motion.div
                    key="backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={onClose}
                    className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[2px]"
                />
                <motion.aside
                    key="drawer"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.9 }}
                    className="fixed top-3 right-0.5 sm:right-3 bottom-3 z-50 w-full max-w-100 flex flex-col overflow-hidden"
                    style={{
                        background: "#FFFFFF",
                        borderRadius: "20px",
                        border: "0.5px solid #E2DDD8",
                        boxShadow: "0 12px 48px -8px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.05)",
                    }}
                >
                    <DrawerHeader payload={payload} onClose={onClose} />
                    <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-[#E2DDD8] [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                        <DrawerBody payload={payload} notes={notes} onOpen={onOpenNote} />
                    </div>
                </motion.aside>
            </>
        )}
    </AnimatePresence>
);

export default TimelineDrawer;