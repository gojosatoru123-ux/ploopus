'use client';
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock3 } from "lucide-react";
import FeedPage from "@/components/FeedPage";
import TimelinePage from "@/components/TimelinePage";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface Props {
    initialTab?: "feed" | "timeline";
}

const MemoryFeedPage = ({ initialTab = "feed" }: Props) => {
    const [tab, setTab] = useState<"feed" | "timeline">(initialTab);

    useEffect(() => {
        setTab(initialTab);
    }, [initialTab]);

    return (
        <div className="flex-1 h-full flex flex-col bg-background overflow-hidden">
            {/* Hub header with segmented tabs */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-6 py-4 border-b border-border"
            >
                <div className="shrink-0">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex gap-4 items-center">
                            <SidebarTrigger />
                            <h1 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-foreground">
                                {tab === "feed" ? "Today's Knowledge Feed" : "Your Knowledge Timeline"}
                            </h1>
                        </div>

                        <div className="relative inline-flex p-1 rounded-full bg-muted/70 backdrop-blur border border-border/60 shadow-sm">
                            {(["feed", "timeline"] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className={`relative z-10 px-4 sm:px-5 py-1.5 rounded-full text-sm font-medium capitalize transition-colors flex items-center gap-1.5 ${tab === t ? "text-background" : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {t === "feed" ? <Sparkles className="w-3.5 h-3.5" /> : <Clock3 className="w-3.5 h-3.5" />}
                                    {t === "feed" ? "Feed" : "Timeline"}
                                    {tab === t && (
                                        <motion.span
                                            layoutId="memhub-pill"
                                            className="absolute inset-0 rounded-full bg-foreground -z-10"
                                            transition={{ type: "spring", stiffness: 400, damping: 32 }}
                                        />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>

            <div className="flex-1 min-h-0">
                <AnimatePresence mode="wait">
                    {tab === "feed" ? (
                        <motion.div
                            key="feed"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="h-full overflow-y-auto scrollbar-thin"
                        >
                            <FeedPage />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="timeline"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="h-full"
                        >
                            <TimelinePage />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default MemoryFeedPage;