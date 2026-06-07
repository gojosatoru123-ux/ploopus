'use client'
import { Star, Heart, Cloud, Sparkles, ShieldCheck, Zap } from "lucide-react";
import { motion } from "framer-motion";
import NoteDashboardMockup from "./mockups/NoteDashboardMockup";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.3" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.2" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.15" />
    </svg>
);

const HeroSection = ({ signinwithgoogle }: { signinwithgoogle: () => {} }) => {
    return (
        <section className="relative overflow-hidden px-4 pb-8 pt-12 text-center sm:px-6 sm:pt-20 lg:px-12">
            <SpiralSVG className="pointer-events-none absolute -left-24 -top-10 h-40 w-40 text-[hsl(var(--green-badge))] sm:h-64 sm:w-64" />
            <SpiralSVG className="pointer-events-none absolute -right-20 top-20 h-48 w-48 text-accent sm:h-80 sm:w-80" />
            <SpiralSVG className="pointer-events-none absolute left-1/3 bottom-0 h-32 w-32 text-[hsl(var(--green-badge))] sm:h-48 sm:w-48" />
            <SpiralSVG className="pointer-events-none absolute right-1/4 -top-8 h-20 w-20 text-destructive opacity-40 sm:h-32 sm:w-32" />

            <div className="pointer-events-none absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 h-75 w-75 rounded-full bg-linear-to-br from-[hsl(var(--yellow-light))] via-[hsl(var(--green-light))]/60 to-[hsl(var(--peach-bg))] blur-3xl opacity-70 sm:h-150 sm:w-150" />

            <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity }} className="pointer-events-none absolute left-8 top-32 h-3 w-3 rounded-full bg-[hsl(var(--green-badge))]/30 sm:left-16 sm:h-4 sm:w-4" />
            <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 3, repeat: Infinity, delay: 1 }} className="pointer-events-none absolute right-8 top-16 h-2 w-2 rounded-full bg-accent/50 sm:right-24 sm:h-3 sm:w-3" />

            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mb-4 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--green-light))] px-3 py-1.5 border border-[hsl(var(--green-badge))]/20 sm:mb-6 sm:px-4 sm:py-2"
            >
                <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--green-badge))] sm:h-4 sm:w-4" />
                <span className="text-xs font-medium text-[hsl(var(--green-badge))] sm:text-sm">Your Second Brain. Stored On Your Device.</span>
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="relative mx-auto max-w-3xl text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-7xl"
            >
                Your Ideas Deserve the{" "}
                <span className="relative inline-block">
                    <span className="relative z-10">Second Brain</span>
                    <motion.span
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        className="absolute -bottom-1 left-0 right-0 h-3 origin-left rounded-sm bg-accent/40 -rotate-1 sm:h-4"
                    />
                </span>
            </motion.h1>
            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="relative mx-auto mt-4 max-w-lg text-sm text-muted-foreground sm:mt-6 sm:text-lg"
            >
                Capture ideas, connect knowledge, study smarter, and manage projects in one beautiful workspace. Notes, mind maps, flashcards, calendars, and knowledge tools — all stored locally on your device.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="relative mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row"
            >
                <button onClick={signinwithgoogle} className="cursor-pointer inline-flex w-full items-center justify-center rounded-full bg-[hsl(var(--green-badge))] px-6 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 sm:w-auto">
                    Build Your Knowledge System
                </button>
            </motion.div>

            {/* Dashboard mockup */}
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="relative mx-auto mt-10 max-w-5xl sm:mt-16"
            >
                <div className="absolute -inset-4 rounded-3xl bg-linear-to-br from-[hsl(var(--green-light))] via-[hsl(var(--yellow-light))] to-[hsl(var(--peach-bg))] blur-xl opacity-80" />
                <div className="relative">
                    <NoteDashboardMockup />
                </div>

                {/* Floating badges - hidden on small screens */}
                <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -right-2 top-4 hidden rounded-2xl bg-[hsl(var(--yellow-light))] p-2 shadow-lg border border-accent/20 sm:block sm:p-3 md:-right-16 md:top-8 hover:scale-105 transition-transform duration-200"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-foreground sm:text-2xl">50+</span>
                        <span className="text-[10px] text-muted-foreground sm:text-xs">Dynamic<br />Blocks</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-xs font-bold text-[hsl(var(--green-badge))] sm:text-sm">
                        <Zap className="h-3 w-3" /> Think Faster
                    </div>
                </motion.div>

                <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                    className="absolute -left-2 top-1/4 hidden items-center gap-0.5 rounded-full bg-[hsl(var(--green-light))] px-2 py-1.5 shadow-lg border border-[hsl(var(--green-badge))]/20 sm:flex sm:px-3 md:-left-12"
                >
                    {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-[hsl(var(--yellow-tag))] text-[hsl(var(--yellow-tag)) ] sm:h-3.5 sm:w-3.5" />
                    ))}
                    <span className="ml-1 text-[10px] font-semibold text-foreground sm:text-xs">Professional Grade</span>
                </motion.div>

                <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                    className="absolute -right-1 bottom-4 hidden items-center gap-1.5 rounded-full bg-[hsl(var(--peach-bg))] px-2 py-1 shadow-lg border border-destructive/10 sm:flex sm:px-3 sm:py-1.5 md:-right-12 md:bottom-8 hover:scale-105 transition-transform duration-200"
                >
                    <ShieldCheck className="h-3 w-3 text-destructive sm:h-3.5 sm:w-3.5" />
                    <span className="text-xs font-semibold sm:text-sm">You Own Everything</span>
                </motion.div>
            </motion.div>

            {/* Trusted by */}
            <div className="relative mt-12 sm:mt-20">
                <p className="mb-6 text-xs text-muted-foreground sm:mb-8 sm:text-sm">Built for students, creators, researchers, founders, and lifelong learners</p>
                <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
                    {[
                        "Notes",
                        "Mind Maps",
                        "Flashcards",
                        "Study Mode",
                        "Knowledge Graph",
                        "Projects",
                        "Offline",
                        "Local-First"
                    ].map(
                        (brand) => (
                            <motion.span
                                key={brand}
                                whileHover={{ scale: 1.1, color: "hsl(var(--foreground))" }}
                                className="text-xs font-bold tracking-wide text-foreground/25 transition-all duration-300 cursor-default sm:text-sm"
                            >
                                {brand}
                            </motion.span>
                        )
                    )}
                </div>
            </div>
        </section>
    );
};

export default HeroSection;