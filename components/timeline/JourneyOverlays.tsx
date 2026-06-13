'use client';
import { useState } from "react";
import { BookOpen, ChevronDown, GitBranch, Compass } from "lucide-react";
import type { IdeaEvolution, LearningJourney } from "@/lib/timelineInsights";

interface Props {
    journeys: LearningJourney[];
    evolutions: IdeaEvolution[];
    onOpenJourney: (j: LearningJourney) => void;
    onOpenEvolution: (e: IdeaEvolution) => void;
}

const JourneyOverlays = ({ journeys, evolutions, onOpenJourney, onOpenEvolution }: Props) => {
    const [open, setOpen] = useState(false);
    const total = journeys.length + evolutions.length;

    return (
        <div className="px-8 pb-3">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
            >
                <GitBranch className="w-3.5 h-3.5" />
                Learning Journeys & Idea Evolution
                <span className="ml-1 text-foreground/60 normal-case tracking-normal">({total})</span>
                <ChevronDown className={`ml-auto w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
                total === 0 ? (
                    <div className="mt-2 flex items-start gap-3 rounded-2xl border border-dashed border-emerald-300/30 bg-emerald-50/20 dark:bg-emerald-500/5 px-4 py-3.5">
                        <div className="shrink-0 w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-500/20 grid place-items-center text-emerald-500 dark:text-emerald-400 mt-0.5">
                            <Compass className="w-3.5 h-3.5" />
                        </div>
                        <div>
                            <div className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
                                Journeys emerge from patterns in your notes
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                                Tag multiple notes with study or research labels, or use consistent title prefixes like <span className="font-mono text-foreground/70">Project: ...</span> to let idea evolution chains surface here.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                        {journeys.map((j) => (
                            <button
                                key={j.id}
                                onClick={() => onOpenJourney(j)}
                                className="text-left rounded-xl border border-emerald-400/20 bg-emerald-50/30 dark:bg-emerald-500/5 hover:border-emerald-400/50 px-3.5 py-2.5 transition-all"
                            >
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                    <BookOpen className="w-3 h-3" /> Learning Journey
                                </div>
                                <div className="text-[13px] font-semibold text-foreground mt-0.5">{j.topic}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {j.noteIds.length} notes · {j.steps.length} stages
                                </div>
                            </button>
                        ))}
                        {evolutions.map((e) => (
                            <button
                                key={e.id}
                                onClick={() => onOpenEvolution(e)}
                                className="text-left rounded-xl border border-violet-400/20 bg-violet-50/30 dark:bg-violet-500/5 hover:border-violet-400/50 px-3.5 py-2.5 transition-all"
                            >
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-violet-700 dark:text-violet-300">
                                    <GitBranch className="w-3 h-3" /> Idea Evolution
                                </div>
                                <div className="text-[13px] font-semibold text-foreground mt-0.5">{e.rootTitle}</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {e.steps.length} connected logs
                                </div>
                            </button>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};

export default JourneyOverlays;