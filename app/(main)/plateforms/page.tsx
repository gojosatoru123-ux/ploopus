'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Bell, BellOff, Boxes, Check, ChevronRight, Clock,
    Download, Package, Search, Share2, Sparkles, Store, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import PluginRunner from "@/components/plugins/PluginRunner";
import PluginBuilder from "@/components/plugins/PluginBuilder";
import {
    buildShareLink,
    clearNotifications,
    exportPlugin,
    importPlugin,
    installPlugin,
    markAllNotificationsRead,
    markNotificationRead,
    onStorageError,
    searchAll,
    tryInstallFromHash,
    uninstallPlugin,
    useDueReminders,
    useInstalledPlugins,
    useNotifications,
} from "@/lib/plugins/registry";
import { BUILTIN_PLUGINS } from "@/lib/plugins/builtins";
import { toast } from "sonner";
import type { PluginManifest } from "@/lib/plugins/types";

const CATEGORIES = [
    "all", "work", "personal", "fitness", "finance",
    "research", "creative", "productivity",
] as const;

export default function PlatformPage() {
    const installed = useInstalledPlugins();
    const notifications = useNotifications();
    const reminders = useDueReminders();
    const [openId, setOpenId] = useState<string | null>(null);
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
    const [marketSearch, setMarketSearch] = useState("");
    const [globalQuery, setGlobalQuery] = useState("");
    const [globalOpen, setGlobalOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // Global keyboard shortcut: Ctrl/Cmd + K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setGlobalOpen((v) => !v);
            }
            if (e.key === "Escape") { setGlobalOpen(false); setNotifOpen(false); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    // Surface storage quota errors as toasts
    useEffect(() => onStorageError((msg) => toast.error(msg)), []);

    // Auto-install from #plugin= hash
    useEffect(() => {
        const m = tryInstallFromHash();
        if (m) { toast.success(`Installed "${m.name}" from share link`); setOpenId(m.id); }
    }, []);

    const open = installed.find((p) => p.id === openId);

    const filteredMarketplace = useMemo(() => {
        return BUILTIN_PLUGINS.filter((p) => {
            if (category !== "all" && p.category !== category) return false;
            if (marketSearch && !`${p.name} ${p.description} ${(p.tags ?? []).join(" ")}`
                .toLowerCase().includes(marketSearch.toLowerCase())) return false;
            return true;
        });
    }, [category, marketSearch]);

    const globalHits = useMemo(() => {
        if (!globalQuery.trim()) return [];
        return searchAll(globalQuery, 20);
    }, [globalQuery]);

    const handleImport = async (file: File) => {
        try {
            const text = await file.text();
            const payload = JSON.parse(text);
            const m = importPlugin(payload);
            toast.success(`Imported "${m.name}"`);
        } catch {
            toast.error("Could not import plugin file — is it a valid .plugin.json?");
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;
    const overdueReminders = reminders.filter((r) => r.overdue);

    // If a plugin is open, render the runner full-screen
    if (open) {
        return (
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="border-b bg-card/80 backdrop-blur-sm px-6 py-3 flex items-center gap-3 sticky top-0 z-10">
                    <Button variant="ghost" size="sm" onClick={() => setOpenId(null)} className="rounded-full">
                        <ArrowLeft className="w-4 h-4" /> All plugins
                    </Button>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-sm font-medium">{open.icon} {open.name}</span>
                </div>
                <PluginRunner plugin={open} />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />

            {/* Global search modal */}
            <AnimatePresence>
                {globalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
                        onClick={() => setGlobalOpen(false)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: -8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: -8 }}
                            transition={{ duration: 0.15 }}
                            className="w-full max-w-lg mx-4 bg-card rounded-2xl shadow-2xl border overflow-hidden"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-3 px-4 py-3 border-b">
                                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                                <input
                                    autoFocus
                                    value={globalQuery}
                                    onChange={(e) => setGlobalQuery(e.target.value)}
                                    placeholder="Search across all plugins…"
                                    className="flex-1 bg-transparent outline-none text-sm"
                                />
                                <kbd className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ESC</kbd>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {!globalQuery.trim() && (
                                    <div className="py-8 text-center text-xs text-muted-foreground">
                                        Start typing to search across all your plugin records…
                                    </div>
                                )}
                                {globalQuery.trim() && globalHits.length === 0 && (
                                    <div className="py-8 text-center text-xs text-muted-foreground">
                                        No results found for "<strong>{globalQuery}</strong>"
                                    </div>
                                )}
                                {globalHits.map((h) => (
                                    <button key={`${h.pluginId}:${h.recordId}`}
                                        onClick={() => { setOpenId(h.pluginId); setGlobalOpen(false); setGlobalQuery(""); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition text-left">
                                        <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                                            style={{ background: `${h.accent}22` }}>{h.pluginIcon}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium truncate">{h.title}</div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                {h.entityIcon} {h.entityName} in {h.pluginName}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Notification drawer */}
            <AnimatePresence>
                {notifOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-end"
                        onClick={() => setNotifOpen(false)}>
                        <motion.div
                            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 28, stiffness: 300 }}
                            className="h-full w-full max-w-sm bg-card border-l shadow-2xl overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}>
                            <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-card z-10">
                                <div className="flex items-center gap-2 font-semibold">
                                    <Bell className="w-4 h-4" /> Notifications
                                    {unreadCount > 0 && <Badge className="text-[10px] px-1.5">{unreadCount}</Badge>}
                                </div>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && (
                                        <button onClick={() => markAllNotificationsRead()} className="text-xs text-muted-foreground hover:text-foreground">
                                            Mark all read
                                        </button>
                                    )}
                                    {notifications.length > 0 && (
                                        <button onClick={() => clearNotifications()} className="text-xs text-muted-foreground hover:text-destructive">
                                            Clear all
                                        </button>
                                    )}
                                    <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Due reminders section */}
                            {reminders.length > 0 && (
                                <div className="border-b">
                                    <div className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                                        Reminders
                                    </div>
                                    {reminders.slice(0, 10).map((r) => (
                                        <button key={r.id} onClick={() => { setOpenId(r.pluginId); setNotifOpen(false); }}
                                            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/50 transition text-left">
                                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                                                style={{ background: `${r.accent}22` }}>{r.pluginIcon}</span>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm truncate">{r.label}</div>
                                                <div className={`text-xs ${r.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                                    {r.overdue ? "Overdue — " : "Due "}{new Date(r.due).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Workflow notifications */}
                            {notifications.length === 0 && reminders.length === 0 && (
                                <div className="py-16 text-center">
                                    <BellOff className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                                    <p className="text-sm text-muted-foreground">All caught up!</p>
                                </div>
                            )}
                            {notifications.slice(0, 50).map((n) => (
                                <button key={n.id}
                                    onClick={() => { markNotificationRead(n.id); if (n.pluginId) setOpenId(n.pluginId); setNotifOpen(false); }}
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

            {/* Uninstall confirmation dialog */}
            <Dialog open={!!uninstallTarget} onOpenChange={(o) => { if (!o) setUninstallTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Uninstall {uninstallTarget?.name}?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete the plugin and all its records. This cannot be undone.
                        Export first if you want to keep your data.
                    </p>
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setUninstallTarget(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => {
                            if (!uninstallTarget) return;
                            uninstallPlugin(uninstallTarget.id);
                            toast.success(`"${uninstallTarget.name}" uninstalled`);
                            setUninstallTarget(null);
                        }}>
                            Uninstall
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="max-w-6xl mx-auto p-5 sm:p-10 space-y-8">
                {/* Page header */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                            <Sparkles className="w-3 h-3" /> Extensible platform
                        </div>
                        <h1 className="text-4xl font-semibold tracking-tight">Plugins</h1>
                        <p className="text-muted-foreground max-w-xl mt-2 text-sm">
                            Turn your workspace into a CRM, research hub, or anything you imagine — no code required.
                        </p>
                    </div>

                    {/* Top-right actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Global search trigger */}
                        <button
                            onClick={() => setGlobalOpen(true)}
                            className="flex items-center gap-2 h-9 px-3 rounded-full border bg-card hover:bg-muted/50 transition text-sm text-muted-foreground">
                            <Search className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Search records…</span>
                            <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded hidden sm:inline">⌘K</kbd>
                        </button>

                        {/* Notifications bell */}
                        <Button variant="outline" size="icon" className="rounded-full relative" onClick={() => setNotifOpen(true)}>
                            <Bell className="w-4 h-4" />
                            {(unreadCount > 0 || overdueReminders.length > 0) && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold bg-destructive text-white flex items-center justify-center">
                                    {Math.min(99, unreadCount + overdueReminders.length)}
                                </span>
                            )}
                        </Button>

                        <Button variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
                            <Upload className="w-4 h-4" /> Import
                        </Button>
                        <PluginBuilder onCreated={(m) => setOpenId(m.id)} />
                    </div>
                </motion.div>

                {/* Due reminders strip (only when there are overdue items) */}
                {overdueReminders.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-destructive/30 bg-destructive/5 text-sm">
                        <Clock className="w-4 h-4 text-destructive shrink-0" />
                        <span className="flex-1">
                            <strong>{overdueReminders.length} overdue reminder{overdueReminders.length !== 1 ? "s" : ""}</strong>
                            {" — "}{overdueReminders.slice(0, 2).map((r) => r.label).join(", ")}
                            {overdueReminders.length > 2 && ` +${overdueReminders.length - 2} more`}
                        </span>
                        <Button size="sm" variant="outline" className="rounded-full h-7 text-xs shrink-0"
                            onClick={() => setNotifOpen(true)}>
                            View all
                        </Button>
                    </motion.div>
                )}

                <Tabs defaultValue="installed">
                    <TabsList className="rounded-full p-1 h-auto bg-muted/60">
                        <TabsTrigger value="installed" className="rounded-full px-4 py-1.5 text-sm gap-1.5">
                            <Package className="w-4 h-4" /> Installed
                            <Badge variant="secondary" className="ml-1">{installed.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="marketplace" className="rounded-full px-4 py-1.5 text-sm gap-1.5">
                            <Store className="w-4 h-4" /> Marketplace
                            <Badge variant="secondary" className="ml-1">{BUILTIN_PLUGINS.length}</Badge>
                        </TabsTrigger>
                    </TabsList>

                    {/* ---- Installed ---- */}
                    <TabsContent value="installed" className="mt-6">
                        {installed.length === 0 ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                <Card className="border-dashed">
                                    <CardContent className="py-20 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-muted mx-auto flex items-center justify-center mb-4">
                                            <Boxes className="w-7 h-7 text-muted-foreground/50" />
                                        </div>
                                        <h3 className="text-base font-medium mb-1">No plugins installed yet</h3>
                                        <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
                                            Build your own with the visual builder, or browse the Marketplace to install one instantly.
                                        </p>
                                        <div className="flex gap-2 justify-center flex-wrap">
                                            <PluginBuilder onCreated={(m) => setOpenId(m.id)} />
                                        </div>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {installed.map((p, i) => (
                                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                                        <PluginCard
                                            plugin={p}
                                            actionLabel="Open"
                                            onAction={() => setOpenId(p.id)}
                                            onExport={() => {
                                                const payload = exportPlugin(p.id);
                                                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                                                const url = URL.createObjectURL(blob);
                                                Object.assign(document.createElement("a"), { href: url, download: `${p.slug}.plugin.json` }).click();
                                                URL.revokeObjectURL(url);
                                                toast.success("Plugin exported");
                                            }}
                                            onShare={() => {
                                                const link = buildShareLink(p.id);
                                                if (link) { navigator.clipboard.writeText(link); toast.success("Share link copied to clipboard"); }
                                            }}
                                            onUninstall={p.builtin ? undefined : () => setUninstallTarget(p)}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* ---- Marketplace ---- */}
                    <TabsContent value="marketplace" className="mt-6 space-y-4">
                        <div className="flex flex-wrap gap-2 items-center">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    value={marketSearch}
                                    onChange={(e) => setMarketSearch(e.target.value)}
                                    placeholder="Search marketplace…"
                                    className="pl-8 max-w-xs rounded-full"
                                />
                                {marketSearch && (
                                    <button onClick={() => setMarketSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-1 flex-wrap">
                                {CATEGORIES.map((c) => (
                                    <button key={c} onClick={() => setCategory(c)}
                                        className={`px-3 py-1 text-xs rounded-full capitalize transition ${category === c ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70"}`}>
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredMarketplace.map((p, i) => {
                                const isInstalled = installed.some((x) => x.id === p.id);
                                return (
                                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                                        <PluginCard
                                            plugin={p}
                                            actionLabel={isInstalled ? "Installed" : "Install"}
                                            actionDisabled={isInstalled}
                                            actionIcon={isInstalled ? <Check className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                                            onAction={() => {
                                                if (isInstalled) return;
                                                installPlugin(p);
                                                toast.success(`"${p.name}" installed — open it from your library`);
                                            }}
                                        />
                                    </motion.div>
                                );
                            })}
                            {filteredMarketplace.length === 0 && (
                                <Card className="col-span-full border-dashed">
                                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                        No plugins match your search.
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

/* ---------- PluginCard ---------- */

function PluginCard({
    plugin, actionLabel, onAction, actionDisabled, actionIcon,
    onExport, onShare, onUninstall,
}: {
    plugin: PluginManifest;
    actionLabel: string;
    onAction: () => void;
    actionDisabled?: boolean;
    actionIcon?: React.ReactNode;
    onExport?: () => void;
    onShare?: () => void;
    onUninstall?: () => void;
}) {
    return (
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="h-full">
            <Card className="overflow-hidden h-full flex flex-col hover:shadow-md transition-shadow">
                <div className="h-1" style={{ background: plugin.accent }} />
                <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                        <div
                            className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: `${plugin.accent}22`, color: plugin.accent }}>
                            {plugin.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm truncate">{plugin.name}</CardTitle>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">v{plugin.version}</Badge>
                                {plugin.builtin && <Badge variant="secondary" className="text-[10px]">Official</Badge>}
                                {plugin.category && <Badge variant="outline" className="text-[10px] capitalize">{plugin.category}</Badge>}
                            </div>
                        </div>
                    </div>
                    <CardDescription className="line-clamp-2 text-xs mt-2">{plugin.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                    <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">{plugin.entities.length} table{plugin.entities.length !== 1 ? "s" : ""}</Badge>
                        <Badge variant="outline" className="text-[10px]">{plugin.views.length} views</Badge>
                        <Badge variant="outline" className="text-[10px]">{plugin.dashboards[0]?.widgets.length ?? 0} widgets</Badge>
                        {plugin.workflows?.length ? <Badge variant="outline" className="text-[10px]">{plugin.workflows.length} workflows</Badge> : null}
                    </div>
                    <div className="flex gap-2">
                        <Button className="flex-1 rounded-full h-8 text-xs gap-1.5" disabled={actionDisabled} onClick={onAction}
                            style={!actionDisabled && actionLabel !== "Installed" ? { background: plugin.accent, color: "white" } : undefined}>
                            {actionIcon}{actionLabel}
                        </Button>
                        {onShare && (
                            <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={onShare} title="Copy share link">
                                <Share2 className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        {onExport && (
                            <Button variant="outline" size="icon" className="rounded-full h-8 w-8" onClick={onExport} title="Export">
                                <Download className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        {onUninstall && (
                            <Button variant="outline" size="icon" className="rounded-full h-8 w-8 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                                onClick={onUninstall} title="Uninstall">
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}