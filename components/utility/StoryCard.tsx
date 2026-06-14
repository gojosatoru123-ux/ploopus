'use client';
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
    ArrowUpRight,
    Sparkles,
    Layers,
    Cake,
    TrendingUp,
    Gem,
    Hourglass,
    Trophy,
    Link2,
    Compass,
    Check,
    X,
    Info,
    RotateCcw,
    Tag,
    EyeOff
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { Story, StoryKind } from "@/lib/feedStories";

interface Props {
    story: Story;
    read?: boolean;
    dismissed?: boolean;
    onMarkRead: (id: string) => void;
    onDismiss: (id: string) => void;
    onUnread?: (id: string) => void;
    onUndismiss?: (id: string) => void;
}
const PALETTES = [
    // 0 — tangerine orange
    {
        cardBg: "#FFF3EB",
        cardBorder: "rgba(230,100,30,0.14)",
        accent: "#F06030",
        accentBg: "#FFDDD0",   // icon bubble
        accentText: "#7A2A0A",
        eyebrow: "#B04218",
        statBg: "rgba(240,96,48,0.09)",
        statText: "#7A2A0A",
        linkColor: "#B04218",
        noteBorder: "rgba(230,100,30,0.18)",
        shadow: "0 1px 3px rgba(220,90,20,0.10), 0 4px 20px -4px rgba(220,90,20,0.14)",
        hoverShadow: "0 2px 6px rgba(220,90,20,0.12), 0 12px 40px -6px rgba(220,90,20,0.22)",
        divider: "rgba(230,100,30,0.10)",
    },
    // 1 — pacific blue
    {
        cardBg: "#EEF7FF",
        cardBorder: "rgba(0,110,220,0.12)",
        accent: "#0175D0",
        accentBg: "#BFE0FF",
        accentText: "#003D80",
        eyebrow: "#0058A8",
        statBg: "rgba(1,117,208,0.09)",
        statText: "#003D80",
        linkColor: "#0058A8",
        noteBorder: "rgba(0,110,220,0.16)",
        shadow: "0 1px 3px rgba(0,100,200,0.09), 0 4px 20px -4px rgba(0,100,200,0.13)",
        hoverShadow: "0 2px 6px rgba(0,100,200,0.11), 0 12px 40px -6px rgba(0,100,200,0.20)",
        divider: "rgba(0,110,220,0.09)",
    },
    // 2 — rose blush
    {
        cardBg: "#FFF0F4",
        cardBorder: "rgba(210,45,85,0.13)",
        accent: "#D42060",
        accentBg: "#FFC8D8",
        accentText: "#820038",
        eyebrow: "#9C1044",
        statBg: "rgba(212,32,96,0.09)",
        statText: "#820038",
        linkColor: "#9C1044",
        noteBorder: "rgba(210,45,85,0.17)",
        shadow: "0 1px 3px rgba(200,40,80,0.09), 0 4px 20px -4px rgba(200,40,80,0.13)",
        hoverShadow: "0 2px 6px rgba(200,40,80,0.11), 0 12px 40px -6px rgba(200,40,80,0.20)",
        divider: "rgba(210,45,85,0.09)",
    },
    // 3 — honey amber
    {
        cardBg: "#FFFAEC",
        cardBorder: "rgba(190,130,0,0.16)",
        accent: "#C98F00",
        accentBg: "#FEEEA0",
        accentText: "#6B4C00",
        eyebrow: "#8A6200",
        statBg: "rgba(201,143,0,0.09)",
        statText: "#6B4C00",
        linkColor: "#8A6200",
        noteBorder: "rgba(190,130,0,0.20)",
        shadow: "0 1px 3px rgba(180,120,0,0.11), 0 4px 20px -4px rgba(180,120,0,0.16)",
        hoverShadow: "0 2px 6px rgba(180,120,0,0.13), 0 12px 40px -6px rgba(180,120,0,0.24)",
        divider: "rgba(190,130,0,0.10)",
    },
    // 4 — soft violet
    {
        cardBg: "#F4F0FF",
        cardBorder: "rgba(100,55,215,0.14)",
        accent: "#6E32E8",
        accentBg: "#DDD0FF",
        accentText: "#330C9C",
        eyebrow: "#4A1CB8",
        statBg: "rgba(110,50,232,0.09)",
        statText: "#330C9C",
        linkColor: "#4A1CB8",
        noteBorder: "rgba(100,55,215,0.18)",
        shadow: "0 1px 3px rgba(90,45,200,0.09), 0 4px 20px -4px rgba(90,45,200,0.13)",
        hoverShadow: "0 2px 6px rgba(90,45,200,0.11), 0 12px 40px -6px rgba(90,45,200,0.20)",
        divider: "rgba(100,55,215,0.09)",
    },
    // 5 — lemon yellow
    {
        cardBg: "#FEFDE8",
        cardBorder: "rgba(150,120,0,0.16)",
        accent: "#B89500",
        accentBg: "#FDF5A0",
        accentText: "#5E4C00",
        eyebrow: "#7A6200",
        statBg: "rgba(184,149,0,0.09)",
        statText: "#5E4C00",
        linkColor: "#7A6200",
        noteBorder: "rgba(150,120,0,0.20)",
        shadow: "0 1px 3px rgba(150,120,0,0.10), 0 4px 20px -4px rgba(150,120,0,0.15)",
        hoverShadow: "0 2px 6px rgba(150,120,0,0.12), 0 12px 40px -6px rgba(150,120,0,0.22)",
        divider: "rgba(150,120,0,0.10)",
    },
    // 6 — spearmint teal
    {
        cardBg: "#EEFDF9",
        cardBorder: "rgba(0,140,110,0.13)",
        accent: "#0A9070",
        accentBg: "#A0F0DC",
        accentText: "#004D3C",
        eyebrow: "#07704E",
        statBg: "rgba(10,144,112,0.09)",
        statText: "#004D3C",
        linkColor: "#07704E",
        noteBorder: "rgba(0,140,110,0.17)",
        shadow: "0 1px 3px rgba(0,130,100,0.09), 0 4px 20px -4px rgba(0,130,100,0.13)",
        hoverShadow: "0 2px 6px rgba(0,130,100,0.11), 0 12px 40px -6px rgba(0,130,100,0.20)",
        divider: "rgba(0,140,110,0.09)",
    },
    // 7 — ember deep-orange
    {
        cardBg: "#FFF5EE",
        cardBorder: "rgba(215,75,15,0.15)",
        accent: "#E05510",
        accentBg: "#FFD4B8",
        accentText: "#6C2100",
        eyebrow: "#923010",
        statBg: "rgba(224,85,16,0.09)",
        statText: "#6C2100",
        linkColor: "#923010",
        noteBorder: "rgba(215,75,15,0.19)",
        shadow: "0 1px 3px rgba(210,70,10,0.11), 0 4px 20px -4px rgba(210,70,10,0.16)",
        hoverShadow: "0 2px 6px rgba(210,70,10,0.13), 0 12px 40px -6px rgba(210,70,10,0.25)",
        divider: "rgba(215,75,15,0.10)",
    },
    // 8 — midnight indigo
    {
        cardBg: "#EFF0FF",
        cardBorder: "rgba(65,70,200,0.13)",
        accent: "#4448E0",
        accentBg: "#C8CAFF",
        accentText: "#181A80",
        eyebrow: "#2E30B0",
        statBg: "rgba(68,72,224,0.09)",
        statText: "#181A80",
        linkColor: "#2E30B0",
        noteBorder: "rgba(65,70,200,0.17)",
        shadow: "0 1px 3px rgba(60,65,190,0.09), 0 4px 20px -4px rgba(60,65,190,0.13)",
        hoverShadow: "0 2px 6px rgba(60,65,190,0.11), 0 12px 40px -6px rgba(60,65,190,0.20)",
        divider: "rgba(65,70,200,0.09)",
    },
    // 9 — saffron
    {
        cardBg: "#FFF6F0",
        cardBorder: "rgba(235,95,0,0.14)",
        accent: "#E86200",
        accentBg: "#FFD8B8",
        accentText: "#642500",
        eyebrow: "#8C3800",
        statBg: "rgba(232,98,0,0.09)",
        statText: "#642500",
        linkColor: "#8C3800",
        noteBorder: "rgba(235,95,0,0.18)",
        shadow: "0 1px 3px rgba(220,85,0,0.11), 0 4px 20px -4px rgba(220,85,0,0.16)",
        hoverShadow: "0 2px 6px rgba(220,85,0,0.13), 0 12px 40px -6px rgba(220,85,0,0.25)",
        divider: "rgba(235,95,0,0.10)",
    },
] as const;

type Palette = typeof PALETTES[number];

const ICONS: Record<StoryKind, React.ElementType> = {
    "dormant-relevant": Compass,
    cluster: Layers,
    anniversary: Cake,
    "growth-area": TrendingUp,
    "forgotten-gold": Gem,
    "dormant-project": Hourglass,
    milestone: Trophy,
    companion: Link2,
    "first-of-topic": Sparkles,
    neglected: EyeOff,
};

// ── Small helpers ──────────────────────────────────────────────────────────────

const previewText = (n: { tags?: { label: string }[] }) =>
    n.tags && n.tags.length > 0
        ? `Tagged with: ${n.tags.map((t) => t.label).join(", ")}`
        : "";

/** Tinted stat pill using palette accent */
const StatPill = ({ value, label, pal }: { value: string | number; label: string; pal: Palette }) => (
    <span
        className="inline-flex items-baseline gap-1.5 rounded-full px-3 py-1.25 text-[11px] leading-none"
        style={{ background: pal.statBg, color: pal.statText }}
    >
        <strong className="font-semibold text-[#1A1520]">{value}</strong>
        <span>{label}</span>
    </span>
);

/** Tag's own-color badge */
const TopicBadge = ({ label, color }: { label: string; color: string }) => (
    <span
        className="inline-flex items-center gap-1 rounded-full px-3 py-1.25 text-[11px] font-medium leading-none"
        style={{ background: `${color}1A`, border: `1px solid ${color}38`, color }}
    >
        #{label}
    </span>
);

/** Relation chip inside note tile */
const RelationChip = ({ emoji, label }: { emoji: string; label: string }) => (
    <div className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2.5 py-1 mb-2.5"
        style={{ background: "rgba(120,90,190,0.09)", color: "#6A5FA0" }}>
        <span>{emoji}</span><span>{label}</span>
    </div>
);

/** Hero note tile */
const HeroNote = ({
    note, relation, pal, onClick, href,
}: {
    note: { id: string; title?: string; tags?: { id: string; label: string; color: string }[] };
    relation?: { emoji: string; label: string; reason?: string };
    pal: Palette; onClick: () => void; href: string;
}) => (
    <Link href={href} onClick={onClick}
        className="group/note block text-left rounded-2xl p-4 transition-all duration-200"
        style={{ background: "rgba(255,255,255,0.82)", border: `1px solid ${pal.noteBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "#fff"; el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.08)"; el.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.82)"; el.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)"; el.style.transform = "none"; }}
    >
        {relation && <RelationChip emoji={relation.emoji} label={relation.label} />}
        <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="text-[13px] font-semibold leading-snug text-[#1A1520] line-clamp-2 flex-1">
                {note.title || "Untitled"}
            </h3>
            <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: pal.accent }} />
        </div>
        {relation?.reason && <p className="text-[11px] italic mb-2" style={{ color: "#8A84A0" }}>{relation.reason}</p>}
        {previewText(note) && <p className="text-[11px] line-clamp-2 mb-2" style={{ color: "#8A84A0" }}>{previewText(note)}</p>}
        {note.tags && note.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
                {note.tags.slice(0, 4).map((t) => (
                    <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-md font-medium"
                        style={{ background: `${t.color}18`, color: t.color }}>
                        {t.label}
                    </span>
                ))}
            </div>
        )}
    </Link>
);

/** Compact support note tile */
const SupportNote = ({
    note, relation, pal, onClick, href,
}: {
    note: { id: string; title?: string };
    relation?: { emoji: string; label: string; reason?: string };
    pal: Palette; onClick: () => void; href: string;
}) => (
    <Link href={href} onClick={onClick}
        className="block text-left rounded-xl px-3.5 py-3 transition-all duration-200 flex-1"
        style={{ background: "rgba(255,255,255,0.65)", border: `1px solid ${pal.noteBorder}`, boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
        onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "#fff"; el.style.transform = "translateY(-1px)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,0.65)"; el.style.transform = "none"; }}
    >
        {relation && (
            <div className="flex items-center gap-1 text-[10px] font-semibold mb-1.5" style={{ color: "#6A5FA0" }}>
                <span>{relation.emoji}</span><span>{relation.label}</span>
            </div>
        )}
        <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-medium text-[#1A1520] truncate">{note.title || "Untitled"}</span>
            <ArrowUpRight className="w-3 h-3 shrink-0" style={{ color: pal.accent }} />
        </div>
        {relation?.reason && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "#8A84A0" }}>{relation.reason}</p>}
    </Link>
);

/** Subtle pill action button */
const PillBtn = ({
    onClick, title, children, pal, variant = "ghost",
    className = "",
}: {
    onClick: () => void; title?: string; children: React.ReactNode;
    pal: Palette; variant?: "ghost" | "solid"; className?: string;
}) => {
    const base: React.CSSProperties = variant === "solid"
        ? { background: pal.accentBg, color: pal.accentText, border: `1px solid ${pal.noteBorder}` }
        : { background: "rgba(255,255,255,0.70)", color: "#5A5478", border: `1px solid ${pal.noteBorder}` };

    return (
        <button onClick={onClick} title={title}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-150 ${className}`}
            style={{ ...base, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = "#fff"; el.style.color = "#1A1520"; el.style.transform = "scale(1.03)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; Object.assign(el.style, base); el.style.transform = "none"; }}
        >
            {children}
        </button>
    );
};

// ── Why This? Dialog ───────────────────────────────────────────────────────────
// Inspired by the Tracky notification popup:
//   • Large centered icon in accent bubble
//   • Bold short title + subtitle body
//   • Two CTA buttons full-width at the bottom
//   • White card, very clean, generous breathing room
const WhyThisDialog = ({
    open, onClose, story, pal,
}: {
    open: boolean; onClose: () => void; story: Story; pal: Palette;
}) => {
    const Icon = ICONS[story.kind];

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent
                className="w-[calc(100vw-32px)] max-w-100 p-0 gap-0 border-0 overflow-hidden rounded-[28px]"
                style={{
                    background: "#FFFFFF",
                    boxShadow: "0 0 0 1px rgba(0,0,0,0.07), 0 8px 16px -4px rgba(0,0,0,0.10), 0 32px 64px -12px rgba(0,0,0,0.18)",
                }}
            >
                <DialogTitle></DialogTitle>
                {/* ── Top: big icon + text ── */}
                <div className="flex flex-col items-center text-center px-7 pt-9 pb-7">
                    {/* Large icon bubble */}
                    <div
                        className="w-18 h-18 rounded-[22px] flex items-center justify-center mb-5 shrink-0"
                        style={{
                            background: pal.accentBg,
                            boxShadow: `0 4px 16px -4px ${pal.accent}40, inset 0 1px 0 rgba(255,255,255,0.55)`,
                        }}
                    >
                        <Icon className="w-8 h-8" style={{ color: pal.accentText }} />
                    </div>

                    {/* Kind label */}
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-2"
                        style={{ color: pal.eyebrow }}>
                        {story.eyebrow}
                    </p>

                    {/* Bold title */}
                    <h2 className="text-[20px] font-bold tracking-[-0.022em] text-[#111118] leading-[1.2] mb-2.5">
                        Why this surfaced
                    </h2>

                    {/* Narrative / reason */}
                    <p className="text-[14px] leading-[1.55]" style={{ color: "#5A5878" }}>
                        {story.narrative}
                    </p>

                    {/* ── Activity signals ── */}
                    {story.signals.length > 0 && (
                        <div className="mt-5 w-full grid grid-cols-2 gap-2 text-left">
                            {story.signals.map((s, i) => (
                                <div key={i} className="rounded-2xl px-3.5 py-3"
                                    style={{ background: pal.statBg, border: `1px solid ${pal.noteBorder}` }}>
                                    <p className="text-[9.5px] font-bold uppercase tracking-widest mb-1.5"
                                        style={{ color: pal.eyebrow }}>{s.label}</p>
                                    <p className="text-[16px] font-bold text-[#111118] leading-none">{s.value}</p>
                                    {s.detail && (
                                        <p className="text-[10.5px] mt-1 leading-tight" style={{ color: "#8A84A0" }}>{s.detail}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Tags ── */}
                    {story.involvedTags && story.involvedTags.length > 0 && (
                        <div className="mt-4 w-full">
                            <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-2.5 text-left"
                                style={{ color: "#A09BB0" }}>Tags in this story</p>
                            <div className="flex flex-wrap gap-1.5">
                                {story.involvedTags.map((t) => (
                                    <Badge key={t.label} variant="outline"
                                        className="rounded-full px-2.5 py-1 text-[11px] font-medium border gap-1"
                                        style={{ background: `${t.color}12`, borderColor: `${t.color}35`, color: t.color }}>
                                        <Tag className="w-2.5 h-2.5" />
                                        #{t.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ── Main StoryCard ─────────────────────────────────────────────────────────────

const StoryCard = ({
    story, read, dismissed,
    onMarkRead, onDismiss, onUnread, onUndismiss,
}: Props) => {
    const pal = PALETTES[story.hue % PALETTES.length];
    const Icon = ICONS[story.kind];
    const hero = story.notes[0];
    const supporting = story.notes.slice(1, 3);
    const heroRelation = hero ? story.relations[hero.id] : undefined;
    const [showWhy, setShowWhy] = useState(false);

    return (
        <>
            <motion.article
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{
                    opacity: dismissed ? 0.48 : 1,
                    y: 0,
                    filter: dismissed ? "saturate(0.28) brightness(1.06)" : "none",
                }}
                exit={{ opacity: 0, scale: 0.97, y: -6 }}
                transition={{ type: "spring", stiffness: 280, damping: 32 }}
                className="relative overflow-hidden rounded-[24px] w-full"
                style={{
                    background: pal.cardBg,
                    border: `1px solid ${pal.accent}`,
                    boxShadow: pal.shadow,
                    opacity: read && !dismissed ? 0.86 : undefined,
                    transition: "box-shadow 0.22s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = pal.hoverShadow; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = pal.shadow; }}
            >

                <div className="relative px-5 sm:px-6 py-5 sm:py-6 pl-7 sm:pl-8 flex flex-col gap-4">

                    {/* ── Header ── */}
                    <div className="flex items-center gap-3">
                        {/* Icon bubble */}
                        <div
                            className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"
                            style={{
                                background: pal.accentBg,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.60), 0 1px 4px ${pal.cardBorder}`,
                            }}
                        >
                            <Icon className="w-4.5 h-4.5" style={{ color: pal.accentText }} />
                        </div>

                        {/* Byline */}
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] leading-none mb-1"
                                style={{ color: pal.eyebrow }}>
                                {story.eyebrow}
                            </p>
                            <p className="text-[11px]" style={{ color: "#A09BB0" }}>
                                Surfaced for you ·{" "}
                                {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                        </div>

                        {/* Read / dismissed badge */}
                        {(read || dismissed) && (
                            <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1.25 rounded-full shrink-0 leading-none"
                                style={
                                    dismissed
                                        ? { background: "rgba(90,84,120,0.09)", color: "#8A84A0" }
                                        : { background: "rgba(16,185,80,0.10)", color: "#0F7A38" }
                                }
                            >
                                {dismissed
                                    ? <><X className="w-3 h-3" /> Dismissed</>
                                    : <><Check className="w-3 h-3" /> Revisited</>}
                            </span>
                        )}
                    </div>

                    {/* ── Headline ── */}
                    {hero ? (
                        <Link
                            href={`/note/ideas/${hero.id}`}
                            onClick={() => onMarkRead(story.id)}
                            className="block text-[19px] sm:text-[21px] font-bold leading-[1.22] tracking-[-0.025em] text-[#111118] hover:underline underline-offset-4"
                            style={{ textDecorationColor: `${pal.accent}55` }}
                        >
                            {story.headline}
                        </Link>
                    ) : (
                        <h2 className="text-[19px] sm:text-[21px] font-bold leading-[1.22] tracking-[-0.025em] text-[#111118]">
                            {story.headline}
                        </h2>
                    )}

                    {/* ── Narrative ── */}
                    <p className="text-[13.5px] sm:text-[14px] leading-[1.6]" style={{ color: "#6B6580" }}>
                        {story.narrative}
                    </p>

                    {/* ── Stats ── */}
                    {story.stats && story.stats.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {story.stats.map((s) => (
                                <StatPill key={s.label} value={s.value} label={s.label} pal={pal} />
                            ))}
                            {story.topic && (
                                <TopicBadge label={story.topic.label} color={story.topic.color} />
                            )}
                        </div>
                    )}

                    {/* ── Note tiles ── */}
                    {hero && (
                        <div className={`grid gap-2.5 ${supporting.length > 0 ? "grid-cols-1 sm:grid-cols-[1.4fr_1fr]" : "grid-cols-1"}`}>
                            <HeroNote
                                note={hero} relation={heroRelation} pal={pal}
                                href={`/note/ideas/${hero.id}`}
                                onClick={() => onMarkRead(story.id)}
                            />
                            {supporting.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {supporting.map((n) => (
                                        <SupportNote key={n.id} note={n}
                                            relation={story.relations[n.id]} pal={pal}
                                            href={`/note/ideas/${n.id}`}
                                            onClick={() => onMarkRead(story.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Divider ── */}
                    <div className="h-px" style={{ background: pal.divider }} />

                    {/* ── Footer ── */}
                    <div className="flex items-center justify-between gap-3 flex-wrap -mt-1">
                        {/* Left */}
                        <div className="flex items-center gap-2">
                            {hero && (
                                <Link
                                    href={`/note/ideas/${hero.id}`}
                                    onClick={() => onMarkRead(story.id)}
                                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold transition-all duration-150 hover:gap-2.5"
                                    style={{ color: pal.linkColor }}
                                >
                                    Revisit now
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </Link>
                            )}
                            <span className="w-px h-3.5 rounded-full" style={{ background: pal.divider }} />
                            <PillBtn
                                onClick={() => setShowWhy(true)}
                                className="text-[11px] px-3 py-1.5"
                                pal={pal}
                            >
                                <Info className="w-3.5 h-3.5" />
                                Why this?
                            </PillBtn>
                        </div>

                        {/* Right */}
                        <div className="flex items-center gap-1.5">
                            {dismissed ? (
                                <PillBtn onClick={() => onUndismiss?.(story.id)} className="text-[11px] px-3 py-1.5" pal={pal}>
                                    <RotateCcw className="w-3.5 h-3.5" /> Undo
                                </PillBtn>
                            ) : read ? (
                                <PillBtn onClick={() => onUnread?.(story.id)} className="text-[11px] px-3 py-1.5" pal={pal}>
                                    <RotateCcw className="w-3.5 h-3.5" /> Mark unread
                                </PillBtn>
                            ) : (
                                <>
                                    <PillBtn onClick={() => onMarkRead(story.id)} title="Mark revisited" className="w-8 h-8" pal={pal}>
                                        <Check className="w-4 h-4" />
                                    </PillBtn>
                                    <PillBtn onClick={() => onDismiss(story.id)} title="Not interested" className="w-8 h-8" pal={pal}>
                                        <X className="w-4 h-4" />
                                    </PillBtn>
                                </>
                            )}
                        </div>
                    </div>

                </div>
            </motion.article>

            <WhyThisDialog
                open={showWhy}
                onClose={() => setShowWhy(false)}
                story={story}
                pal={pal}
            />
        </>
    );
};

export default StoryCard;