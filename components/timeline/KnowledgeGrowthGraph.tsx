'use client';
import { useMemo } from "react";
import type { GrowthPoint } from "@/lib/timelineInsights";
import { TrendingUp } from "lucide-react";

interface Props {
    points: GrowthPoint[];
}

const W = 720;
const H = 64;
const PAD = 6;

const KnowledgeGrowthGraph = ({ points }: Props) => {
    const { areaPath, linePath, total } = useMemo(() => {
        if (points.length < 2) return { areaPath: "", linePath: "", total: 0 };
        const maxC = Math.max(1, ...points.map((p) => p.count));
        const xStep = (W - PAD * 2) / (points.length - 1);
        const yFor = (v: number) => H - PAD - (v / maxC) * (H - PAD * 2);
        const coords = points.map((p, i) => [PAD + i * xStep, yFor(p.count)] as const);
        const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
        const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD} L${coords[0][0].toFixed(1)},${H - PAD} Z`;
        return {
            areaPath: area,
            linePath: line,
            total: points[points.length - 1].count,
        };
    }, [points]);

    if (points.length < 2) return null;

    return (
        <div className="px-8 pt-4 pb-2">
            <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm px-5 py-3.5 flex items-center gap-5">
                <div className="hidden sm:flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Knowledge Growth
                </div>
                <svg
                    viewBox={`0 0 ${W} ${H}`}
                    preserveAspectRatio="none"
                    className="flex-1 h-12"
                    aria-label="Knowledge growth over time"
                >
                    <defs>
                        <linearGradient id="kg-area" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#kg-area)" />
                    <path
                        d={linePath}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.85"
                    />
                </svg>
                <div className="hidden sm:flex items-center gap-5 text-[11px] text-muted-foreground shrink-0">
                    <div className="flex flex-col items-end">
                        <span className="text-foreground font-semibold text-sm leading-none">{total}</span>
                        <span className="mt-0.5">total notes</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeGrowthGraph;