'use client'
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Heading, List, FileText } from "lucide-react";
import MindMapKanbanMockup from "./mockups/MindMapKanbanMockup";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.25" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.18" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
    </svg>
);

const FeaturesSection = () => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const mockupY = useTransform(scrollYProgress, [0, 1], [60, -60]);
    const textY = useTransform(scrollYProgress, [0, 1], [30, -30]);
    const spiralRotate = useTransform(scrollYProgress, [0, 1], [0, 45]);
    const spiralScale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1.1, 0.9]);

    return (
        <section ref={ref} className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-12 bg-[hsl(var(--mint-bg))]">
            <motion.div style={{ rotate: spiralRotate, scale: spiralScale }}>
                <SpiralSVG className="pointer-events-none absolute -right-16 top-10 h-36 w-36 text-[hsl(var(--green-badge))] sm:h-56 sm:w-56" />
            </motion.div>
            <motion.div style={{ rotate: useTransform(scrollYProgress, [0, 1], [0, -30]) }}>
                <SpiralSVG className="pointer-events-none absolute left-8 bottom-0 h-28 w-28 text-accent sm:h-40 sm:w-40" />
            </motion.div>

            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity }} className="pointer-events-none absolute right-12 top-20 h-3 w-3 rounded-full bg-accent/40 sm:right-20" />

            <div className="relative mx-auto max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
                    className="text-center"
                >
                    <span className="inline-flex items-center rounded-full bg-[hsl(var(--green-badge))]/15 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--green-badge))] border border-[hsl(var(--green-badge))]/20 sm:px-4 sm:py-1.5 sm:text-xs">
                        BUILD YOUR KNOWLEDGE SYSTEM
                    </span>
                    <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
                        From Quick Notes<br />to Deep Knowledge
                    </h2>
                </motion.div>

                <div className="mt-10 grid items-start gap-8 sm:mt-16 sm:gap-12 md:grid-cols-2">
                    <motion.div style={{ y: mockupY }}>
                        <motion.div
                            initial={{ opacity: 0, x: -60, rotateY: 10 }}
                            whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                        >
                            <div className="relative">
                                <div className="absolute -inset-3 rounded-3xl bg-linear-to-br from-[hsl(var(--green-light))] via-accent/20 to-[hsl(var(--yellow-light))] blur-lg opacity-70" />
                                <div className="relative">
                                    <MindMapKanbanMockup />
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>

                    <motion.div style={{ y: textY }}>
                        <motion.div
                            initial={{ opacity: 0, x: 60 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8, delay: 0.15 }}
                        >
                            <span className="inline-flex items-center rounded-full bg-accent/30 px-3 py-1 text-xs font-semibold text-accent-foreground">
                                Capture & Organize
                            </span>
                            <h3 className="mt-4 text-2xl font-bold text-foreground sm:text-4xl">
                                More Than<br />Just Notes
                            </h3>
                            <p className="mt-3 text-sm text-muted-foreground leading-relaxed sm:text-base">
                                Capture ideas, connect concepts, build mind maps, study with flashcards, manage projects, and organize everything in one local-first workspace.
                            </p>

                            <div className="mt-6 space-y-3 sm:mt-8 sm:space-y-4">
                                {[
                                    {
                                        icon: FileText,
                                        label: "38+ Powerful Blocks",
                                        desc: "Notes, databases, charts, equations, embeds and more",
                                        bg: "bg-accent/20"
                                    },
                                    {
                                        icon: List,
                                        label: "Mind Maps & Flashcards",
                                        desc: "Turn information into understanding and retention",
                                        bg: "bg-[hsl(var(--green-badge))]/15"
                                    },
                                    {
                                        icon: Heading,
                                        label: "Projects & Knowledge",
                                        desc: "Kanban boards, calendars, graphs and structured workflows",
                                        bg: "bg-[hsl(var(--peach-bg))]"
                                    },
                                ].map((item, i) => (
                                    <motion.div
                                        key={item.label}
                                        initial={{ opacity: 0, x: 30, filter: "blur(5px)" }}
                                        whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.3 + i * 0.12, duration: 0.6 }}
                                        whileHover={{ x: 6, scale: 1.02 }}
                                        className="flex items-center gap-3 rounded-2xl bg-card p-3 border border-border/50 transition-all duration-300 hover:shadow-md hover:border-[hsl(var(--green-badge))]/20"
                                    >
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${item.bg}`}>
                                            <item.icon className="h-4 w-4 text-foreground sm:h-5 sm:w-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-semibold text-foreground sm:text-sm">{item.label}</h4>
                                            <p className="text-[10px] text-muted-foreground sm:text-xs">{item.desc}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                            <motion.div
                                initial={{ opacity: 0 }}
                                whileInView={{ opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.7 }}
                                className="mt-8 rounded-2xl border border-[hsl(var(--green-badge))]/15 bg-card p-4"
                            >
                                <p className="text-sm font-medium text-foreground">
                                    Notes → Mind Maps → Flashcards → Study Mode
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    Transform information into long-term knowledge without switching apps.
                                </p>
                            </motion.div>
                        </motion.div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;
