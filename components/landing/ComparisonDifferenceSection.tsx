'use client'
import { motion } from "framer-motion";
import { Check, Zap, Lock, Wifi, Cpu, Network, Download, Layers } from "lucide-react";
import Link from "next/link";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.25" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.18" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.12" />
    </svg>
);

interface Feature {
    label: string;
    ploopus: string;
    notion: string;
    obsidian: string;
}

const ComparisonDifferenceSection = ({ signinwithgoogle }: { signinwithgoogle: () => {} }) => {
    const features: Feature[] = [
        {
            label: "Mind Maps",
            ploopus: "Built-in",
            notion: "Not available",
            obsidian: "Plugin required",
        },
        {
            label: "Flashcards",
            ploopus: "Built-in study system",
            notion: "Templates needed",
            obsidian: "Plugin required",
        },
        {
            label: "Study Mode",
            ploopus: "Included",
            notion: "Not available",
            obsidian: "Plugin required",
        },
        {
            label: "Knowledge Graph",
            ploopus: "Built-in",
            notion: "Limited",
            obsidian: "Available",
        },
        {
            label: "Offline Access",
            ploopus: "Fully offline",
            notion: "Limited",
            obsidian: "Fully offline",
        },
        {
            label: "Data Ownership",
            ploopus: "100% yours",
            notion: "Cloud-based",
            obsidian: "Local-first",
        },
        {
            label: "Exports",
            ploopus: "PDF, HTML, MD, TXT",
            notion: "Limited",
            obsidian: "PDF, MD",
        },
        {
            label: "Templates",
            ploopus: "Ready-to-use",
            notion: "Community templates",
            obsidian: "Manual setup",
        },
    ];

    const advantages = [
        {
            icon: Cpu,
            title: "Powerful & Lightweight",
            description: "All the power of Notion, none of the bloat. No subscription needed. No accounts to manage. Just you and your notes.",
            highlight: "ploopus-advantage",
        },
        {
            icon: Lock,
            title: "Your Data, Your Control",
            description: "Unlike cloud services, Ploopus keeps everything on your device. Your notes never leave your computer unless you decide to export or sync.",
            highlight: "privacy-advantage",
        },
        {
            icon: Layers,
            title: "Smart Flashcards & Study Mode",
            description: "Turn any note block into a flashcard instantly. Organize your active recall into custom study decks featuring built-in spaced repetition to master concepts faster.",
            highlight: "flashcard-advantage",
        },
        {
            icon: Zap,
            title: "Speed Without Compromise",
            description: "Obsidian is fast, but Ploopus adds visual richness without the lag. 50+ block types, drag-and-drop layouts, and it all responds instantly.",
            highlight: "speed-advantage",
        },
        {
            icon: Network,
            title: "Knowledge Graph Built-In",
            description: "Automatically visualize connections between your notes. See how your ideas relate, discover patterns, and build a true knowledge network.",
            highlight: "graph-advantage",
        },
        {
            icon: Download,
            title: "Free Export Anywhere",
            description: "Export to PDF or HTML anytime. No paywalls, no premium locks. Your notes are truly yours—take them wherever you want.",
            highlight: "export-advantage",
        },
        {
            icon: Wifi,
            title: "Works Everywhere",
            description: "Airplane mode? WiFi down? Doesn't matter. Ploopus works perfectly offline. Sync when you want, not when the internet permits.",
            highlight: "offline-advantage",
        },
    ];

    return (
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 sm:py-24 lg:px-12 bg-background">
            <SpiralSVG className="pointer-events-none absolute -left-20 top-8 h-40 w-40 text-[hsl(var(--green-badge))]/40 sm:h-56 sm:w-56" />
            <SpiralSVG className="pointer-events-none absolute -right-16 bottom-16 h-48 w-48 text-accent/30 sm:h-64 sm:w-64" />

            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5, repeat: Infinity }} className="pointer-events-none absolute left-1/4 top-1/3 h-2 w-2 rounded-full bg-[hsl(var(--green-badge))]/30" />

            <div className="relative mx-auto max-w-6xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="text-center mb-12 sm:mb-16"
                >
                    <span className="inline-flex items-center rounded-full bg-[hsl(var(--green-badge))]/15 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-[hsl(var(--green-badge))] border border-[hsl(var(--green-badge))]/20 sm:px-4 sm:py-1.5 sm:text-xs">
                        WHY PEOPLE SWITCH
                    </span>
                    <h2 className="mt-4 text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
                        One Workspace For<br />Thinking, Learning & Creating
                    </h2>
                    <p className="mt-4 max-w-2xl mx-auto text-sm text-muted-foreground sm:text-base">
                        We didn't try to be everything to everyone. Ploopus is purpose-built for writers, thinkers, and creators who need speed and control.
                    </p>
                </motion.div>

                {/* Advantages Grid */}
                <div className="grid md:grid-cols-3 gap-6 sm:gap-8 mb-12 sm:mb-16">
                    {advantages.map((item, i) => (
                        <motion.div
                            key={item.title}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                            className="group relative rounded-2xl border border-border/50 bg-card p-6 sm:p-8 hover:border-[hsl(var(--green-badge))]/30 transition-all duration-300 hover:shadow-md"
                        >
                            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-[hsl(var(--green-light))] to-[hsl(var(--yellow-light))]/50 mb-4`}>
                                <item.icon className="h-6 w-6 text-foreground" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
                                {item.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {item.description}
                            </p>
                            <div className="absolute -inset-0.5 rounded-2xl bg-linear-to-r from-[hsl(var(--green-light))] to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300 -z-10" />
                        </motion.div>
                    ))}
                </div>

                {/* Comparison Table */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    className="mt-12 sm:mt-16"
                >
                    <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-8 text-center">
                        Why People Choose Ploopus
                    </h3>

                    <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50 bg-muted/30">
                                    <th className="px-4 py-4 sm:px-6 text-left font-semibold text-foreground">Feature</th>
                                    <th className="px-4 py-4 sm:px-6 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-semibold text-[hsl(var(--green-badge))]">Ploopus</span>
                                        </div>
                                    </th>
                                    <th className="px-4 py-4 sm:px-6 text-center font-semibold text-foreground">Notion</th>
                                    <th className="px-4 py-4 sm:px-6 text-center font-semibold text-foreground">Obsidian</th>
                                </tr>
                            </thead>
                            <tbody>
                                {features.map((feature, i) => (
                                    <tr key={feature.label} className={`border-b border-border/30 ${i % 2 === 0 ? 'bg-muted/10' : ''} hover:bg-muted/20 transition-colors`}>
                                        <td className="px-4 py-4 sm:px-6 font-medium text-foreground">
                                            {feature.label}
                                        </td>
                                        <td className="px-4 py-4 sm:px-6 text-center">
                                            <div className="flex items-center justify-center">
                                                <Check className="h-5 w-5 text-[hsl(var(--green-badge))]" />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{feature.ploopus}</p>
                                        </td>
                                        <td className="px-4 py-4 sm:px-6 text-center text-sm text-muted-foreground">
                                            {feature.notion}
                                        </td>
                                        <td className="px-4 py-4 sm:px-6 text-center text-sm text-muted-foreground">
                                            {feature.obsidian}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="mt-12 sm:mt-16 text-center"
                >
                    <p className="text-muted-foreground mb-6 text-sm sm:text-base">
                        Build a knowledge system that grows with you.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button onClick={signinwithgoogle} className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[hsl(var(--green-badge))] px-6 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95">
                            Build Your Second Brain
                        </button>
                        <Link href='/docs' className="inline-flex items-center justify-center rounded-full border border-[hsl(var(--green-badge))]/30 px-6 py-3 text-sm font-medium text-foreground hover:bg-muted transition-all duration-200">
                            Explore Features
                        </Link>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default ComparisonDifferenceSection;