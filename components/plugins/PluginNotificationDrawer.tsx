'use client';
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, ChevronRight, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PluginNotification, ReminderHit } from "@/lib/plugins/types";

interface PluginNotificationDrawerProps {
    open: boolean;
    onClose: () => void;
    notifications: PluginNotification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onClearAll?: () => void;
    onPluginRoute?: (pluginId: string) => void;
    /** Optional reminders section — shown above notifications when provided (used by PluginRunner) */
    reminders?: ReminderHit[];
    onReminderClick?: (reminder: ReminderHit) => void;
}

/* ---------- PluginNotificationDrawer ---------- */

export default function PluginNotificationDrawer({
    open,
    onClose,
    notifications,
    onMarkRead,
    onMarkAllRead,
    onClearAll,
    onPluginRoute,
    reminders,
    onReminderClick,
}: PluginNotificationDrawerProps) {
    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-start justify-end"
                    onClick={onClose}>
                    <motion.div
                        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 28, stiffness: 300 }}
                        className="fixed top-3 right-0.5 sm:right-3 bottom-3 z-50 w-full max-w-100 flex flex-col overflow-y-scroll scrollbar-none [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                        style={{
                            background: "#FFFFFF",
                            borderRadius: "20px",
                            border: "0.5px solid #E2DDD8",
                            boxShadow: "0 12px 48px -8px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.05)",
                        }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10">
                            <div className="flex items-center gap-2 font-semibold">
                                <Bell className="w-4 h-4" /> Notifications
                                {unreadCount > 0 && <Badge className="text-[10px] px-1.5">{unreadCount}</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                                {unreadCount > 0 && (
                                    <button onClick={() => onMarkAllRead()} className="text-xs text-muted-foreground hover:text-foreground">
                                        Mark all read
                                    </button>
                                )}
                                {onClearAll && notifications.length > 0 && (
                                    <button onClick={() => onClearAll()} className="text-xs text-muted-foreground hover:text-destructive">
                                        Clear all
                                    </button>
                                )}
                                <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Due reminders */}
                        {reminders && reminders.length > 0 && (
                            <div className="border-b">
                                <div className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                                    Reminders
                                </div>
                                {reminders.slice(0, 10).map((r) => (
                                    <button key={r.id}
                                        onClick={() => { if (onReminderClick) onReminderClick(r); else if (r.pluginId && onPluginRoute) { onPluginRoute(r.pluginId); onClose(); } }}
                                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition text-left">
                                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                                            style={{ background: `${r.accent}22` }}>{r.pluginIcon}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm truncate">{r.label}</div>
                                            <div className={`text-xs ${r.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                                {r.overdue ? "Overdue — " : "Due "}{new Date(r.due).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Workflow notifications */}
                        {notifications.length === 0 && (
                            <div className="py-16 text-center">
                                <BellOff className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground">All caught up!</p>
                            </div>
                        )}
                        {notifications.slice(0, 50).map((n) => (
                            <button key={n.id}
                                onClick={() => { onMarkRead(n.id); if (n.pluginId && onPluginRoute) onPluginRoute(n.pluginId); onClose(); }}
                                className={`w-full flex items-start gap-3 px-5 py-3 hover:bg-muted/50 transition text-left ${n.read ? "opacity-50" : ""}`}>
                                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                                {n.read && <span className="w-1.5 h-1.5 shrink-0" />}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm">{n.title}</div>
                                    {n.body && <div className="text-xs text-muted-foreground mt-0.5">{n.body}</div>}
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                        {new Date(n.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}