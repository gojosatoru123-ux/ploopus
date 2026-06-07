'use client'
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Smartphone, Monitor, Tablet, HardDrive, Share2, Cpu, LockIcon } from "lucide-react";
import SyncDashboardMockup from "./mockups/SyncDashboardMockup";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.25" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.18" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
    </svg>
);

const GoLiveSection = () => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const mockupY = useTransform(scrollYProgress, [0, 1], [80, -40]);
    const textY = useTransform(scrollYProgress, [0, 1], [40, -20]);
    const spiralRotate = useTransform(scrollYProgress, [0, 1], [0, -60]);

    return (
        <section ref={ref} className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-12 bg-[hsl(var(--warm-bg))]">
            <motion.div style={{ rotate: spiralRotate }}>
                <SpiralSVG className="pointer-events-none absolute right-10 -top-8 h-32 w-32 text-accent sm:h-44 sm:w-44" />
            </motion.div>
            <motion.div style={{ rotate: useTransform(scrollYProgress, [0, 1], [0, 40]) }}>
                <SpiralSVG className="pointer-events-none absolute -left-12 bottom-10 h-36 w-36 text-[hsl(var(--green-badge))] sm:h-52 sm:w-52" />
            </motion.div>

            <div className="relative mx-auto grid max-w-6xl items-center gap-8 sm:gap-12 md:grid-cols-2">
                <motion.div style={{ y: textY }}>
                    <motion.div
                        initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
                        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="text-center md:text-left"
                    >
                        <span className="inline-flex items-center rounded-full bg-accent/30 px-3 py-1 text-xs font-semibold text-accent-foreground">
                            Local-First Architecture
                        </span>
                        <h3 className="mt-4 text-2xl font-bold text-foreground sm:text-4xl md:text-5xl">
                            Built For Ownership,<br />Not Dependence.
                        </h3>
                        <p className="mt-4 mx-auto max-w-sm text-sm text-muted-foreground leading-relaxed sm:text-base md:mx-0">
                            Every note, flashcard, mind map, and project lives on your device first. No waiting for cloud servers. No internet dependency. No losing access when a service goes down.
                        </p>

                        <div className="mt-6 flex items-center justify-center gap-3 sm:mt-8 sm:gap-4 md:justify-start">
                            {[
                                { icon: HardDrive, label: "Local First" },
                                { icon: Cpu, label: "Secure" },
                                { icon: Share2, label: "Export Anytime" },
                            ].map((item, i) => (
                                <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                                    whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.4 + i * 0.12, type: "spring", stiffness: 200 }}
                                    whileHover={{ scale: 1.1, y: -4 }}
                                    className="flex flex-col items-center gap-1 rounded-2xl bg-card p-3 border border-border/50 transition-all duration-200 hover:shadow-lg hover:border-accent/30 sm:gap-1.5 sm:p-4"
                                >
                                    <item.icon className="h-5 w-5 text-accent-foreground sm:h-6 sm:w-6" />
                                    <span className="text-[10px] text-muted-foreground sm:text-xs">{item.label}</span>
                                </motion.div>
                            ))}
                        </div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.6 }}
                            className="mt-8 rounded-2xl border border-[hsl(var(--green-badge))]/15 bg-card p-4"
                        >
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">
                                    Storage Health
                                </span>

                                <span className="font-semibold text-[hsl(var(--green-badge))]">
                                    100% Local
                                </span>
                            </div>

                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        Server Access
                                    </span>
                                    <span className="text-[hsl(var(--green-badge))]">
                                        Blocked
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        Advertising Access
                                    </span>
                                    <span className="text-[hsl(var(--green-badge))]">
                                        Blocked
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        Data Ownership
                                    </span>
                                    <span className="text-[hsl(var(--green-badge))]">
                                        Yours
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                </motion.div>

                <motion.div style={{ y: mockupY }}>
                    <motion.div
                        initial={{ opacity: 0, x: 80, rotateY: -10 }}
                        whileInView={{ opacity: 1, x: 0, rotateY: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                    >
                        <div className="relative mx-auto max-w-sm md:max-w-none">
                            <div className="absolute -inset-3 rounded-3xl bg-linear-to-br from-accent/30 via-[hsl(var(--green-light))]/40 to-[hsl(var(--yellow-light))] blur-lg opacity-70" />
                            <div className="relative">
                                <SyncDashboardMockup />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default GoLiveSection;