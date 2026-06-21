'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, Bell, BellOff, Boxes, Check, ChevronRight, Clock,
    Download, Link as LinkIcon, Loader2, Package, Search, Share2, Sparkles, Store, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import PluginBuilder from "@/components/plugins/PluginBuilder";
import PluginNotificationDrawer from "@/components/plugins/PluginNotificationDrawer";
import { BUILTIN_PLUGINS } from "@/lib/plugins/builtins";
import { toast } from "sonner";
import type { PluginManifest } from "@/lib/plugins/types";
import { usePluginContext } from "@/contexts/PluginsContext";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";

const CATEGORIES = ["all", "work", "personal", "fitness", "finance", "research", "creative", "productivity",] as const;

export default function PlatformPage() {
    const {
        pluginIndexes: installed,
        notifications,
        installPlugin,
        uninstallPlugin,
        exportPlugin,
        importPlugin,
        buildShareLink,
        tryInstallFromHash,
        installFromUrl,
        installError,
        clearInstallError,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        isInitialized,
    } = usePluginContext();

    const router = useRouter();
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
    const [marketSearch, setMarketSearch] = useState("");
    const [notifOpen, setNotifOpen] = useState(false);
    const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [urlInstalling, setUrlInstalling] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handlePluginRoute = (id: string) => {
        router.push(`/plateforms/${id}`)
    }

    // Surface storage quota errors as toasts
    // useEffect(() => onStorageError((msg) => toast.error(msg)), []);

    // Auto-install from #plugin= hash — must wait until storage has finished
    // loading (isInitialized), otherwise the install can race the initial
    // OPFS load: if storage finishes loading *after* the hash-install runs,
    // its plain setPluginIndexes(indexes) overwrite would silently wipe out
    // the just-installed plugin. Gating on isInitialized guarantees the
    // install always happens last.
    const hashInstallRan = useRef(false);
    useEffect(() => {
        if (!isInitialized || hashInstallRan.current) return;
        hashInstallRan.current = true;
        const m = tryInstallFromHash();
        if (m) { toast.success(`Installed "${m.name}" from share link`); handlePluginRoute(m.id); }
    }, [isInitialized, tryInstallFromHash]);

    const filteredMarketplace = useMemo(() => {
        return BUILTIN_PLUGINS.filter((p) => {
            if (category !== "all" && p.category !== category) return false;
            if (marketSearch && !`${p.name} ${p.description} ${(p.tags ?? []).join(" ")}`
                .toLowerCase().includes(marketSearch.toLowerCase())) return false;
            return true;
        });
    }, [category, marketSearch]);

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

    const handleInstallFromUrl = async () => {
        const url = urlInput.trim();
        if (!url) return;
        setUrlInstalling(true);
        const m = await installFromUrl(url);
        setUrlInstalling(false);
        if (m) {
            toast.success(`Installed "${m.name}" from URL`);
            setUrlDialogOpen(false);
            setUrlInput("");
            handlePluginRoute(m.id);
        }
        // On failure, installError is set by the hook and rendered in the dialog below.
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />

            {/* Notification drawer */}
            <PluginNotificationDrawer
                open={notifOpen}
                onClose={() => setNotifOpen(false)}
                notifications={notifications}
                onMarkRead={markNotificationRead}
                onMarkAllRead={markAllNotificationsRead}
                onClearAll={clearNotifications}
                onPluginRoute={handlePluginRoute}
            />



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

            {/* Install from URL dialog */}
            <Dialog
                open={urlDialogOpen}
                onOpenChange={(open) => {
                    setUrlDialogOpen(open);
                    if (!open) { setUrlInput(""); clearInstallError(); }
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Install from URL</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Paste a share link (<code>...#plugin=...</code>) or a direct link to a
                        plugin's JSON file. Share links install instantly — no network request needed.
                    </p>
                    <Input
                        autoFocus
                        value={urlInput}
                        onChange={(e) => { setUrlInput(e.target.value); if (installError) clearInstallError(); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && !urlInstalling) handleInstallFromUrl(); }}
                        placeholder="Paste a share link or plugin JSON URL"
                        disabled={urlInstalling}
                    />
                    {installError && (
                        <p className="text-xs text-destructive">{installError}</p>
                    )}
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setUrlDialogOpen(false)} disabled={urlInstalling}>
                            Cancel
                        </Button>
                        <Button onClick={handleInstallFromUrl} disabled={urlInstalling || !urlInput.trim()}>
                            {urlInstalling ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Installing…
                                </>
                            ) : (
                                "Install"
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="max-w-7xl mx-auto p-2 sm:p-8 space-y-8">
                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-between flex-wrap border-b border-border pb-4 pt-2">
                    <div className="flex items-center gap-4">
                        <SidebarTrigger />
                        <div>
                            <h1 className="text-3xl font-semibold tracking-tight">Plugins</h1>
                            <p className="text-muted-foreground text-sm">
                                Turn your workspace into anything you imagine — no code required.
                            </p>
                        </div>
                    </div>
                    {/* Top-right actions */}
                    <div className="flex items-center gap-2 flex-wrap">

                        {/* Notifications bell */}
                        <Button variant="outline" size="icon" className="rounded-full relative" onClick={() => setNotifOpen(true)}>
                            <Bell className="w-4 h-4" />
                            {(unreadCount > 0) && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold bg-destructive text-white flex items-center justify-center">
                                    {Math.min(99, unreadCount)}
                                </span>
                            )}
                        </Button>

                        <Button variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()}>
                            <Upload className="w-4 h-4" /> Import
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => { clearInstallError(); setUrlInput(""); setUrlDialogOpen(true); }}
                        >
                            <LinkIcon className="w-4 h-4" /> Install from URL
                        </Button>
                        <PluginBuilder onCreated={(m) => handlePluginRoute(m.id)} />
                    </div>
                </motion.div>

                <Tabs defaultValue="installed">
                    <TabsList className="rounded-full p-1 h-auto bg-muted/60">
                        <TabsTrigger value="installed" className="rounded-full sm:px-4 py-1.5 text-sm sm:gap-1.5">
                            <Package className="w-4 h-4" /> <span className="hidden sm:inline">Installed</span>
                            <Badge variant="secondary" className="sm:ml-1">{installed.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="marketplace" className="rounded-full px-4 py-1.5 text-sm gap-1.5">
                            <Store className="w-4 h-4" /> <span className="hidden sm:inline">Marketplace</span>
                            <Badge variant="secondary" className="sm:ml-1">{BUILTIN_PLUGINS.length}</Badge>
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
                                            <PluginBuilder onCreated={(m) => handlePluginRoute(m.id)} />
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
                                            onAction={() => handlePluginRoute(p.id)}
                                            onExport={async () => {
                                                const payload = await exportPlugin(p.id);
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