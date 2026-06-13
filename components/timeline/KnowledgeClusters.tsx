'use client';
import { motion } from "framer-motion";
import { Layers, ChevronRight, Tag } from "lucide-react";
import type { KnowledgeCluster } from "@/lib/timelineInsights";

interface Props {
    clusters: KnowledgeCluster[];
    onSelect: (cluster: KnowledgeCluster) => void;
}

const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });

const KnowledgeClusters = ({ clusters, onSelect }: Props) => {
    return (
        <div className="px-8 pt-2 pb-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                <Layers className="w-3.5 h-3.5" />
                Knowledge Clusters
            </div>
            {clusters.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-dashed border-violet-300/30 bg-violet-50/20 dark:bg-violet-500/5 px-4 py-3.5">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/20 grid place-items-center text-violet-500 dark:text-violet-400 mt-0.5">
                        <Tag className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="text-[12px] font-semibold text-violet-700 dark:text-violet-300">
                            Clusters form when tags are shared across notes
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            Tag two or more notes with the same label and a knowledge cluster will appear here, grouping related ideas across time.
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto scrollbar-thin [&::-webkit-scrollbar]:hidden [scrollbar-width:none] -mx-1 px-1 py-1">
                    {clusters.map((c, i) => (
                        <motion.button
                            key={c.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => onSelect(c)}
                            style={{ borderColor: `${c.accent}40` }}
                            className="group relative shrink-0 w-65 text-left rounded-2xl border bg-linear-to-br from-background/50 to-background p-4 hover:border-foreground/30 transition-all hover:-translate-y-0.5"
                        >
                            <div
                                className="absolute inset-0 rounded-2xl opacity-5 pointer-events-none"
                                style={{ backgroundColor: c.accent }}
                            />
                            <div className="absolute inset-0 rounded-2xl bg-background/70 backdrop-blur-sm -z-10" />
                            <div className="relative">
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    {fmt(c.start)} → {fmt(c.end)}
                                </div>
                                <div className="mt-1.5 text-[15px] font-semibold tracking-tight text-foreground">
                                    {c.title}
                                </div>
                                <div className="mt-1 text-[12px] text-muted-foreground line-clamp-2">
                                    {c.subtitle}
                                </div>
                                <div className="mt-3 flex items-center gap-3 text-[11px] text-foreground/70">
                                    <span className="font-semibold text-foreground">{c.noteCount}</span> notes
                                    {c.folderCount > 0 && (
                                        <>
                                            <span className="text-border">•</span>
                                            <span className="font-semibold text-foreground">{c.folderCount}</span> folders
                                        </>
                                    )}
                                    <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default KnowledgeClusters;