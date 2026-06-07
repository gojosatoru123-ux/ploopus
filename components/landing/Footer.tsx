import { FileText, Twitter, Github, Linkedin, ArrowRight, Heart, Sparkles, Mail, Youtube, Instagram } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";

const SpiralSVG = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="90" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 6" opacity="0.15" />
        <circle cx="100" cy="100" r="65" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.1" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" opacity="0.08" />
    </svg>
);

const footerLinks = [
    { label: "Documentation", href: "/docs" },
    { label: "About", href: "/about" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
];

const Footer = ({ signinwithgoogle }: { signinwithgoogle: () => {} }) => {
    const ref = useRef<HTMLElement>(null);

    return (
        <footer ref={ref} className="relative overflow-hidden bg-linear-to-b from-[hsl(var(--green-badge))] via-[hsl(var(--green-badge))] to-[hsl(var(--green-badge))]/90">
            {/* Top wave shape */}
            <div className="absolute -top-1 left-0 right-0">
                <svg viewBox="0 0 1440 80" fill="none" className="w-full" preserveAspectRatio="none">
                    <path
                        d="M0 80V40C240 0 480 20 720 40C960 60 1200 20 1440 0V80H0Z"
                        fill="hsl(var(--green-badge))"
                    />
                </svg>
            </div>

            {/* Decorative spirals */}
            <SpiralSVG className="pointer-events-none absolute -right-20 top-20 h-64 w-64 text-white" />
            <SpiralSVG className="pointer-events-none absolute left-10 bottom-20 h-48 w-48 text-white" />
            <SpiralSVG className="pointer-events-none absolute left-1/2 top-1/3 h-36 w-36 text-white" />

            {/* Floating orbs */}
            <motion.div
                animate={{ y: [0, -12, 0], x: [0, 5, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
                className="pointer-events-none absolute right-1/4 top-32 h-20 w-20 rounded-full bg-accent/10 blur-xl"
            />
            <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="pointer-events-none absolute left-1/3 bottom-40 h-16 w-16 rounded-full bg-white/5 blur-lg"
            />

            <div className="relative px-4 pt-16 pb-8 sm:px-6 sm:pt-20 lg:px-12">
                <motion.div className="mx-auto max-w-6xl">
                    {/* CTA Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
                        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8 }}
                        className="relative mb-16 overflow-hidden rounded-3xl border border-white sm:mb-20"
                    >
                        <div className="absolute inset-0 bg-linear-to-br from-white/15 via-accent/10 to-white/5 backdrop-blur-xl" />
                        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
                        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />

                        <div className="relative p-6 text-center sm:p-10 md:p-14">
                            <motion.div
                                initial={{ scale: 0 }}
                                whileInView={{ scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ type: "spring", delay: 0.2 }}
                                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 sm:h-14 sm:w-14"
                            >
                                <Sparkles className="h-6 w-6 text-accent sm:h-7 sm:w-7" />
                            </motion.div>

                            <h3 className="text-2xl font-bold text-white sm:text-3xl md:text-4xl lg:text-5xl">
                                Ready to Build Your Second Brain?
                            </h3>
                            <p className="mx-auto mt-3 max-w-lg text-xs text-white/50 sm:mt-4 sm:text-sm md:text-base">
                                Capture ideas, connect knowledge, study smarter, and manage projects in one local-first workspace that you fully own.
                            </p>

                            <motion.button
                                onClick={signinwithgoogle}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground shadow-lg transition-all duration-200 sm:py-3.5 my-4"
                            >
                                Build Your Knowledge System <ArrowRight className="h-4 w-4" />
                            </motion.button>

                            <p className="mt-3 text-[10px] text-white/50 sm:text-xs">
                                Instant setup · Private by design · Forever free plan
                            </p>
                        </div>
                    </motion.div>

                    {/* Brand and Info */}
                    <div className="grid gap-12 md:grid-cols-2 items-start mb-12">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-accent to-accent/70 shadow-lg">
                                    <FileText className="h-5 w-5 text-accent-foreground" />
                                </div>
                                <span className="text-lg font-bold text-white">Ploopus</span>
                            </div>
                            <p className="max-w-xs text-sm leading-relaxed text-white/40">
                                Ploopus is a local-first Knowledge OS for notes, mind maps, flashcards, study systems, and project planning. Your ideas stay on your device, forever under your control.
                            </p>

                            <div className="mt-6 space-y-2">
                                <div className="flex items-center gap-2 text-xs text-white/50">
                                    <Mail className="h-3.5 w-3.5" />
                                    <a href="mailto:cursorbits@gmail.com" className="hover:text-accent transition-colors">cursorbits@gmail.com</a>
                                </div>
                            </div>

                            <div className="mt-6 flex items-center gap-2">
                                {[
                                    { icon: Twitter, label: "X", url: 'https://x.com/CursorBits' },
                                    { icon: Youtube, label: "Youtube", url: 'https://www.youtube.com/@CursorBits' },
                                    { icon: Instagram, label: "Instagram", url: 'https://instagram.com/cursorbits' },
                                ].map(({ icon: Icon, label, url }, i) => (
                                    <motion.a
                                        key={label}
                                        href={url}
                                        aria-label={label}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.1 }}
                                        whileHover={{ scale: 1.15, y: -2 }}
                                        target="_blank"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-white/40 transition-all duration-300 hover:bg-accent hover:text-accent-foreground hover:shadow-lg"
                                    >
                                        <Icon className="h-4 w-4" />
                                    </motion.a>
                                ))}
                            </div>
                        </motion.div>

                        {/* Resources */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: 0.1 }}
                            className="md:text-right"
                        >
                            <h4 className="text-xs font-bold uppercase tracking-widest text-white/60 mb-4">Resources</h4>
                            <ul className="space-y-2">
                                {footerLinks.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-white/50 transition-colors duration-200 hover:text-accent"
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </motion.div>
                    </div>

                    {/* Bottom bar */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="mt-12 border-t border-white/8 pt-8 sm:mt-16"
                    >
                        <div className="flex flex-col items-center justify-center gap-2 text-xs text-white/50">
                            <div className="flex items-center gap-1.5">
                                <span>© 2026 Ploopus. Built for</span>
                                <Heart className="h-3 w-3 fill-destructive/60 text-destructive/60" />
                                <span>knowledge ownership</span>
                            </div>
                            <p className="text-white/40">Capture knowledge. Connect ideas. Own everything.</p>
                        </div>
                    </motion.div>
                </motion.div>
            </div>
        </footer>
    );
};

export default Footer;
