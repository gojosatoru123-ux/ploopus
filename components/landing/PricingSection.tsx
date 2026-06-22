'use client'
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Check } from "lucide-react";
import { PLANS, TIERS } from "@/lib/constants";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.25" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.18" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
    </svg>
);

const PricingSection = () => {
    const ref = useRef<HTMLElement>(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
    const spiralRotate = useTransform(scrollYProgress, [0, 1], [0, 55]);

    return (
        <section ref={ref} className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-12 bg-[hsl(var(--mint-bg))]">
            <motion.div style={{ rotate: spiralRotate }}>
                <SpiralSVG className="pointer-events-none absolute -right-16 top-8 h-36 w-36 text-[hsl(var(--green-badge))] sm:h-52 sm:w-52" />
            </motion.div>
            <motion.div style={{ rotate: useTransform(scrollYProgress, [0, 1], [0, -40]) }}>
                <SpiralSVG className="pointer-events-none absolute left-12 bottom-10 h-28 w-28 text-accent sm:h-36 sm:w-36" />
            </motion.div>

            <div className="relative mx-auto max-w-6xl">
                <motion.div
                    initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
                    whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center"
                >
                    <span className="inline-flex items-center rounded-full bg-accent/30 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-accent-foreground border border-accent/20 sm:px-4 sm:py-1.5 sm:text-xs">
                        PRICING
                    </span>
                    <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
                        Use Ploopus Free. <br /> Upgrade Only If You Need Sync.
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:mt-4 sm:text-base">
                        Your notes should never be trapped behind a paywall. Core note-taking is free forever. Upgrade only for cloud backup, sync, and advanced workspace features.
                    </p>
                </motion.div>

                <div className="mt-10 grid gap-6 sm:mt-14 md:grid-cols-3">
                    {TIERS.map((tier, index) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 60, rotateX: 10, filter: "blur(5px)" }}
                            whileInView={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, delay: index * 0.15, ease: [0.25, 0.4, 0.25, 1] }}
                            whileHover={{ y: -10, scale: 1.02 }}
                            className={`group relative rounded-3xl border p-6 transition-all duration-300 hover:shadow-2xl sm:p-8 ${tier.highlighted ? `${tier.cardBg} md:scale-[1.03]` : tier.cardBg
                                }`}
                        >
                            {tier.highlighted && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: 0.5, type: "spring" }}
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-4 py-1 text-xs font-semibold text-accent-foreground shadow-md"
                                >
                                    Best Value
                                </motion.div>
                            )}

                            <h3 className={`text-lg font-semibold ${tier.highlighted ? "text-white" : "text-foreground"}`}>
                                {tier.name}
                            </h3>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className={`text-4xl font-bold sm:text-5xl ${tier.highlighted ? "text-white" : "text-foreground"}`}>
                                    ${tier.plan.price}
                                </span>
                                <span className={`text-sm ${tier.highlighted ? "text-white/60" : "text-muted-foreground"}`}>
                                    {tier.period}
                                </span>
                            </div>
                            <p className={`mt-3 text-sm ${tier.highlighted ? "text-white/70" : "text-muted-foreground"}`}>
                                {tier.description}
                            </p>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={`mt-6 w-full rounded-full py-2.5 text-sm font-medium shadow-sm sm:py-3 ${tier.btnBg}`}
                            >
                                {tier.cta}
                            </motion.button>

                            <ul className="mt-6 space-y-2.5 sm:mt-8 sm:space-y-3">
                                {tier.features.map((feature, fi) => (
                                    <motion.li
                                        key={feature}
                                        initial={{ opacity: 0, x: -10 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: 0.5 + index * 0.1 + fi * 0.04 }}
                                        className="flex items-start gap-2"
                                    >
                                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tier.checkColor}`} />
                                        <span className={`text-xs sm:text-sm ${tier.highlighted ? "text-white/80" : "text-muted-foreground"}`}>
                                            {feature}
                                        </span>
                                    </motion.li>
                                ))}
                            </ul>
                        </motion.div>
                    ))}
                </div>
                <div className="mt-12 rounded-2xl border border-[hsl(var(--green-badge))]/15 bg-card p-6 text-center">
                    <p className="text-lg font-semibold text-foreground">
                        Your notes belong to you.
                    </p>

                    <p className="mt-2 text-sm text-muted-foreground">
                        No ads. No tracking. No data harvesting.
                        Core note-taking stays free forever.
                    </p>

                    <p className="mt-3 text-sm font-medium text-[hsl(var(--green-badge))]">
                        Pay only if you want cloud backup and sync.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default PricingSection;
