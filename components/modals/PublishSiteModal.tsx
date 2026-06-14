'use client'

import { Note } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { CloudUploadIcon, Sparkles, X } from "lucide-react";

interface PublishSiteModalProps {
    isOpen: boolean;
    onClose: () => void;
    note: Note
}
const PublishSiteModal = ({ isOpen, onClose, note }: PublishSiteModalProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-background/60 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 320, damping: 28 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-xl max-h-[90vh] bg-card border border-border/50 rounded-[28px] shadow-2xl shadow-black/10 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-[14px] bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/15">
                                        <CloudUploadIcon className="w-4.5 h-4.5 text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-[15px] font-semibold tracking-tight">Publish site</h2>
                                        <p className="text-[11px] text-muted-foreground">Your data remains with you</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Mode Switch */}
                            <div className="px-6 pt-4 shrink-0">
                                <div className="inline-flex p-1 bg-muted/60 rounded-xl">
                                    
                                </div>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin min-h-0">
                                <AnimatePresence mode="wait">
                                    
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
export default PublishSiteModal