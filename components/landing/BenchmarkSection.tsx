'use client'
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { GitBranch, Shield, Zap } from "lucide-react";
import PrivacyDashboardMockup from "./mockups/PrivacyDashboardMockup";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.25" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.18" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
    </svg>
);

const stats = [
    { icon: Zap, value: "100%", desc: "Your data stays on your device — always available offline", color: "bg-accent/25 text-accent-foreground" },
    { icon: GitBranch, value: "50+", desc: "Block types: mind maps, kanban boards, databases, and more", color: "bg-[hsl(var(--green-badge))]/15 text-[hsl(var(--green-badge))]" },
    { icon: Shield, value: "0", desc: "Zero server access to your unencrypted notes — ever", color: "bg-[hsl(var(--peach-bg))] text-foreground" },
];

const BenchmarkSection = () => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const mockupY = useTransform(scrollYProgress, [0, 1], [70, -50]);
    const mockupRotate = useTransform(scrollYProgress, [0, 0.5, 1], [-3, 0, 3]);
    const textY = useTransform(scrollYProgress, [0, 1], [40, -20]);
    const spiralRotate = useTransform(scrollYProgress, [0, 1], [0, 50]);

    return (
        <section ref={ref} className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-12 bg-[hsl(var(--peach-bg))]">
            <motion.div style={{ rotate: spiralRotate }}>
                <SpiralSVG className="pointer-events-none absolute -left-20 bottom-10 h-40 w-40 text-accent sm:h-60 sm:w-60" />
            </motion.div>
            <motion.div style={{ rotate: useTransform(scrollYProgress, [0, 1], [0, -35]) }}>
                <SpiralSVG className="pointer-events-none absolute right-1/4 top-0 h-24 w-24 text-[hsl(var(--green-badge))] sm:h-32 sm:w-32" />
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
                        <h2 className="text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
                            Achieving Superior<br />Privacy Standards
                        </h2>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, x: -20 }}
                            whileInView={{ opacity: 1, scale: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.3, type: "spring" }}
                            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--green-badge))] px-3 py-1.5 transition-transform duration-200 hover:scale-105 sm:mt-6 sm:px-4 sm:py-2"
                        >
                            <Shield className="h-3 w-3 text-white sm:h-3.5 sm:w-3.5" />
                            <span className="text-[10px] text-white font-medium sm:text-xs">Ploopus ranks No.1 in local-first privacy</span>
                        </motion.div>

                        <div className="mt-8 space-y-4 sm:mt-10 sm:space-y-6">
                            {stats.map((stat, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -40, filter: "blur(5px)" }}
                                    whileInView={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.6, delay: 0.2 + i * 0.15 }}
                                    whileHover={{ x: 8 }}
                                    className="flex items-center gap-3 sm:gap-4 group"
                                >
                                    <motion.div
                                        whileHover={{ scale: 1.2, rotate: 10 }}
                                        className={`flex h-10 w-10 items-center justify-center rounded-2xl sm:h-12 sm:w-12 ${stat.color} transition-all duration-200`}
                                    >
                                        <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                                    </motion.div>
                                    <div>
                                        <div className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</div>
                                        <div className="text-xs text-muted-foreground sm:text-sm">{stat.desc}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </motion.div>

                <motion.div style={{ y: mockupY, rotate: mockupRotate }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8, rotateY: 15 }}
                        whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.9, ease: [0.25, 0.4, 0.25, 1] }}
                        className="flex justify-center"
                    >
                        <div className="relative w-full max-w-xs sm:max-w-sm">
                            <div className="absolute -inset-4 rounded-3xl bg-linear-to-br from-[hsl(var(--peach-bg))] via-accent/20 to-[hsl(var(--green-light))] blur-xl opacity-80" />
                            <div className="relative">
                                <PrivacyDashboardMockup />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
};

export default BenchmarkSection;
