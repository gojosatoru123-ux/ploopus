'use client'
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

const stats = [
    { value: "38+", label: "Knowledge Blocks", color: "border-[hsl(var(--green-badge))] bg-[hsl(var(--green-light))]" },
    { value: "5", label: "Core Workflows", color: "border-accent bg-[hsl(var(--yellow-light))]" },
    { value: "100%", label: "Ownership", color: "border-[hsl(var(--green-badge))] bg-[hsl(var(--mint-bg))]" },
];

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.25" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.18" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
    </svg>
);

const SocialStatsSection = () => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const spiralRotate = useTransform(scrollYProgress, [0, 1], [0, 70]);

    return (
        <section ref={ref} className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-12">
            <motion.div style={{ rotate: spiralRotate }}>
                <SpiralSVG className="pointer-events-none absolute left-1/3 -top-10 h-36 w-36 text-accent" />
            </motion.div>
            <motion.div style={{ rotate: useTransform(scrollYProgress, [0, 1], [0, -50]) }}>
                <SpiralSVG className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 text-[hsl(var(--green-badge))]" />
            </motion.div>

            <div className="relative mx-auto max-w-6xl">
                <div className="grid items-center gap-8 sm:gap-12 md:grid-cols-2">
                    <motion.div
                        initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-center md:text-left"
                    >
                        <span className="inline-flex items-center rounded-full bg-[hsl(var(--green-badge))]/15 px-3 py-1 text-xs font-medium text-[hsl(var(--green-badge))] border border-[hsl(var(--green-badge))]/20">
                            KNOWLEDGE SYSTEM
                        </span>
                        <h3 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl md:text-4xl">Everything You Need To Build A Second Brain</h3>
                        <p className="mt-3 mx-auto max-w-sm text-sm text-muted-foreground sm:text-base md:mx-0">
                            Capture ideas, connect knowledge, study smarter, and manage projects in one local-first workspace. Notes, mind maps, flashcards, calendars, and powerful knowledge tools work together seamlessly.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        className="flex items-center justify-center gap-4 sm:gap-8"
                    >
                        {stats.map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, scale: 0, rotate: -20 }}
                                whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 150 }}
                                whileHover={{ scale: 1.15, rotate: 5, y: -8 }}
                                className="text-center"
                            >
                                <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-lg font-bold mx-auto transition-all duration-300 hover:shadow-xl sm:h-24 sm:w-24 sm:text-2xl ${stat.color}`}>
                                    {stat.value}
                                </div>
                                <p className="mt-2 text-[10px] font-bold text-muted-foreground uppercase tracking-tight sm:mt-3 sm:text-xs">{stat.label}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default SocialStatsSection;