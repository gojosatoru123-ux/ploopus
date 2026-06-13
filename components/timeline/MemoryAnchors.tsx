'use client';
import { motion } from "framer-motion";
import { Heart, Clock } from "lucide-react";
import type { MemoryAnchor } from "@/lib/timelineInsights";

interface Props {
    anchors: MemoryAnchor[];
    onSelect: (anchor: MemoryAnchor) => void;
}

const MemoryAnchors = ({ anchors, onSelect }: Props) => {
    return (
        <div className="px-8 pb-3">
            {anchors.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl border border-dashed border-amber-300/30 bg-amber-50/20 dark:bg-amber-500/5 px-4 py-3.5">
                    <div className="shrink-0 w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/20 grid place-items-center text-amber-500 dark:text-amber-400 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                    </div>
                    <div>
                        <div className="text-[12px] font-semibold text-amber-700 dark:text-amber-300">
                            Memory Anchors appear after your first week
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            As you build your knowledge base, this section surfaces notes from past weeks and months — giving you a sense of how your thinking has evolved.
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {anchors.map((a, i) => (
                        <motion.button
                            key={a.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 + i * 0.05 }}
                            onClick={() => onSelect(a)}
                            className="group relative text-left rounded-2xl p-4 overflow-hidden border border-amber-400/20 bg-linear-to-br from-amber-50/60 via-rose-50/40 to-transparent dark:from-amber-500/10 dark:via-rose-500/5 hover:border-amber-400/40 transition-all"
                        >
                            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-amber-300/20 blur-2xl pointer-events-none" />
                            <div className="relative flex items-start gap-3">
                                <div className="shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-500/20 grid place-items-center text-amber-600 dark:text-amber-300">
                                    <Heart className="w-4 h-4" fill="currentColor" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-amber-600/80 dark:text-amber-300/80">
                                        Memory Anchor
                                    </div>
                                    <div className="mt-1 text-[14px] font-semibold tracking-tight text-foreground leading-snug">
                                        {a.title}
                                    </div>
                                    <div className="mt-1 text-[12px] text-muted-foreground line-clamp-2 leading-normal">
                                        {a.body}
                                    </div>
                                </div>
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MemoryAnchors;