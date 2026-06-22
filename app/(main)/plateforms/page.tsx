'use client';
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, BarChart2, Bell, BellOff, Boxes, Check, ChevronRight, Clock,
    Crown, Download, GitBranch, LayoutGrid, Link as LinkIcon, Loader2, Lock, Package, Search, Share2, Sparkles, Store, TableIcon, Upload, X,
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
import { authClient } from "@/lib/auth-client";

const CATEGORIES = ["all", "work", "personal", "fitness", "finance", "research", "creative", "productivity",] as const;

/* ---------- Plan limits ---------- */

type Plan = "free" | "pro" | "creator";

function getPlan(session: any): Plan {
    const name = (session?.subscription?.planName ?? "free").toLowerCase();
    if (name === "creator") return "creator";
    if (name === "pro") return "pro";
    return "free";
}

const MARKETPLACE_LIMIT: Record<Plan, number> = { free: 3, pro: 10, creator: Infinity };
const INSTALLED_LIMIT: Record<Plan, number> = { free: 3, pro: 10, creator: Infinity };

const PLAN_LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", creator: "Creator" };
const UPGRADE_LABEL: Record<Plan, string> = {
    free: "Upgrade to Pro for 10 plugins, or Creator for unlimited.",
    pro: "Upgrade to Creator for unlimited plugins.",
    creator: "",
};

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
    const { data: session } = authClient.useSession();

    const router = useRouter();
    const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
    const [marketSearch, setMarketSearch] = useState("");
    const [notifOpen, setNotifOpen] = useState(false);
    const [uninstallTarget, setUninstallTarget] = useState<PluginManifest | null>(null);
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [urlInput, setUrlInput] = useState("");
    const [urlInstalling, setUrlInstalling] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    /* ---- plan / limits ---- */
    const plan = getPlan(session);
    const mktLimit = MARKETPLACE_LIMIT[plan];   // how many marketplace plugins are accessible
    const instLimit = INSTALLED_LIMIT[plan];     // max installed plugins
    const atInstLimit = installed.length >= instLimit;

    const handlePluginRoute = (id: string) => {
        router.push(`/plateforms/${id}`)
    }

    const hashInstallRan = useRef(false);
    useEffect(() => {
        if (!isInitialized || hashInstallRan.current) return;
        hashInstallRan.current = true;
        // Gate hash-based share-link installs against the plan limit.
        // atInstLimit can't be used here (stale closure on first render),
        // so read installed.length directly against instLimit.
        if (installed.length >= instLimit) {
            toast.error(`You've reached the ${PLAN_LABEL[plan]} plan limit of ${instLimit} installed plugins. ${UPGRADE_LABEL[plan]}`);
            // Clear the hash so the user isn't stuck with an unresolvable link
            window.history.replaceState(null, "", window.location.pathname + window.location.search);
            return;
        }
        const m = tryInstallFromHash();
        if (m) { toast.success(`Installed "${m.name}" from share link`); handlePluginRoute(m.id); }
    }, [isInitialized, tryInstallFromHash]);

    /* Split accessible vs locked BEFORE filtering so category/search
       can never promote a locked plugin into the accessible tier.        */
    const { accessibleMarket, lockedMarket } = useMemo(() => {
        const filterFn = (p: PluginManifest) => {
            if (category !== "all" && p.category !== category) return false;
            if (marketSearch && !`${p.name} ${p.description} ${(p.tags ?? []).join(" ")}`
                .toLowerCase().includes(marketSearch.toLowerCase())) return false;
            return true;
        };

        const accessiblePool = mktLimit === Infinity ? BUILTIN_PLUGINS : BUILTIN_PLUGINS.slice(0, mktLimit);
        const lockedPool = mktLimit === Infinity ? [] : BUILTIN_PLUGINS.slice(mktLimit);

        return {
            accessibleMarket: accessiblePool.filter(filterFn),
            lockedMarket: lockedPool.filter(filterFn),
        };
    }, [category, marketSearch, mktLimit]);

    const handleImport = async (file: File) => {
        if (atInstLimit) {
            toast.error(`You've reached the ${PLAN_LABEL[plan]} plan limit of ${instLimit} installed plugins. ${UPGRADE_LABEL[plan]}`);
            return;
        }
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
        if (atInstLimit) {
            toast.error(`You've reached the ${PLAN_LABEL[plan]} plan limit of ${instLimit} installed plugins. ${UPGRADE_LABEL[plan]}`);
            return;
        }
        setUrlInstalling(true);
        const m = await installFromUrl(url);
        setUrlInstalling(false);
        if (m) {
            toast.success(`Installed "${m.name}" from URL`);
            setUrlDialogOpen(false);
            setUrlInput("");
            handlePluginRoute(m.id);
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <input ref={fileRef} type="file" accept="application/json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />

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
                    {atInstLimit && (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                            <Crown className="w-3 h-3 shrink-0" />
                            {PLAN_LABEL[plan]} limit reached — {UPGRADE_LABEL[plan]}
                        </p>
                    )}
                    <div className="flex gap-2 justify-end">
                        <Button variant="ghost" onClick={() => setUrlDialogOpen(false)} disabled={urlInstalling}>
                            Cancel
                        </Button>
                        <Button onClick={handleInstallFromUrl} disabled={urlInstalling || !urlInput.trim() || atInstLimit}>
                            {urlInstalling ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Installing…</>
                            ) : "Install"}
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
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="icon" className="rounded-full relative" onClick={() => setNotifOpen(true)}>
                            <Bell className="w-4 h-4" />
                            {unreadCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold bg-destructive text-white flex items-center justify-center">
                                    {Math.min(99, unreadCount)}
                                </span>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                                if (atInstLimit) {
                                    toast.error(`You've reached the ${PLAN_LABEL[plan]} plan limit of ${instLimit} installed plugins. ${UPGRADE_LABEL[plan]}`);
                                    return;
                                }
                                fileRef.current?.click();
                            }}
                        >
                            <Upload className="w-4 h-4" /> Import
                        </Button>
                        <Button
                            variant="outline"
                            className="rounded-full"
                            onClick={() => {
                                if (atInstLimit) {
                                    toast.error(`You've reached the ${PLAN_LABEL[plan]} plan limit of ${instLimit} installed plugins. ${UPGRADE_LABEL[plan]}`);
                                    return;
                                }
                                clearInstallError();
                                setUrlInput("");
                                setUrlDialogOpen(true);
                            }}
                        >
                            <LinkIcon className="w-4 h-4" /> Install from URL
                        </Button>
                        <div className="relative">
                            <PluginBuilder onCreated={(m) => handlePluginRoute(m.id)} />
                            {atInstLimit && (
                                <div
                                    className="absolute inset-0 rounded-md cursor-not-allowed group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toast.error(`You've reached the ${PLAN_LABEL[plan]} limit of ${instLimit} installed plugins. ${UPGRADE_LABEL[plan]}`);
                                    }}
                                >
                                    <span className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground border text-[11px] px-2.5 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                        <Crown className="w-3 h-3 inline mr-1 text-amber-500" />
                                        {PLAN_LABEL[plan]} limit reached — upgrade
                                    </span>
                                </div>
                            )}
                        </div>
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
                        {/* Plan usage banner */}
                        {instLimit !== Infinity && (
                            <div className={`flex items-center gap-3 mb-5 px-4 py-3 rounded-2xl border text-sm ${atInstLimit
                                ? "border-destructive/30 bg-destructive/5 text-destructive"
                                : "border-border bg-muted/40 text-muted-foreground"
                                }`}>
                                <Crown className={`w-4 h-4 shrink-0 ${atInstLimit ? "text-destructive" : "text-amber-500"}`} />
                                <span className="flex-1">
                                    <strong>{installed.length} / {instLimit}</strong> plugins used on the {PLAN_LABEL[plan]} plan.
                                    {atInstLimit && <> {UPGRADE_LABEL[plan]}</>}
                                </span>
                                {atInstLimit && (
                                    <Badge className="shrink-0 bg-amber-400/20 text-amber-600 border border-amber-400/30 gap-1">
                                        <Sparkles className="w-3 h-3" /> Upgrade
                                    </Badge>
                                )}
                            </div>
                        )}

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
                            {/* Accessible plugins */}
                            {accessibleMarket.map((p, i) => {
                                const isInstalled = installed.some((x) => x.id === p.id);
                                const installBlocked = !isInstalled && atInstLimit;
                                return (
                                    <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                                        <PluginCard
                                            plugin={p}
                                            actionLabel={isInstalled ? "Installed" : installBlocked ? "Limit reached" : "Install"}
                                            actionDisabled={isInstalled || installBlocked}
                                            actionIcon={isInstalled ? <Check className="w-4 h-4" /> : installBlocked ? <Lock className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                                            onAction={() => {
                                                if (isInstalled || installBlocked) return;
                                                installPlugin(p);
                                                toast.success(`"${p.name}" installed — open it from your library`);
                                            }}
                                            installLimitHint={installBlocked ? UPGRADE_LABEL[plan] : undefined}
                                        />
                                    </motion.div>
                                );
                            })}

                            {/* Locked plugins (beyond plan's marketplace limit) */}
                            {lockedMarket.map((p, i) => (
                                <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (accessibleMarket.length + i) * 0.03 }}>
                                    <PluginCard
                                        plugin={p}
                                        locked
                                        lockedPlan={plan}
                                        actionLabel="Upgrade to unlock"
                                        actionDisabled
                                        actionIcon={<Crown className="w-4 h-4 text-amber-400" />}
                                        onAction={() => { }}
                                    />
                                </motion.div>
                            ))}

                            {accessibleMarket.length === 0 && lockedMarket.length === 0 && (
                                <Card className="col-span-full border-dashed">
                                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                        No plugins match your search.
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Upgrade nudge banner when locked plugins exist */}
                        {lockedMarket.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-amber-400/30 bg-amber-400/5">
                                <Crown className="w-5 h-5 text-amber-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">
                                        {lockedMarket.length} more plugin{lockedMarket.length !== 1 ? "s" : ""} available on a higher plan
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{UPGRADE_LABEL[plan]}</p>
                                </div>
                                <Badge className="shrink-0 bg-amber-400/20 text-amber-600 border border-amber-400/30 gap-1 cursor-pointer hover:bg-amber-400/30 transition">
                                    <Sparkles className="w-3 h-3" /> Upgrade
                                </Badge>
                            </motion.div>
                        )}
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
    locked, lockedPlan, installLimitHint,
}: {
    plugin: PluginManifest;
    actionLabel: string;
    onAction: () => void;
    actionDisabled?: boolean;
    actionIcon?: React.ReactNode;
    onExport?: () => void;
    onShare?: () => void;
    onUninstall?: () => void;
    locked?: boolean;
    lockedPlan?: Plan;
    installLimitHint?: string;
}) {
    const upgradeNeeded = lockedPlan === "free" ? "Pro or Creator" : "Creator";

    // Derive a pastel bg from the accent color or fall back to a default
    const cardBg = locked ? "#E5E7EB" : `${plugin.accent}33`;

    return (
        <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="h-full">
            <div
                className="relative h-full flex flex-col gap-3 rounded-[20px] p-5 overflow-hidden"
                style={{ background: cardBg }}
            >
                {/* Top row: badge + lock */}
                <div className="flex items-start justify-between">
                    <div className="flex gap-1.5 flex-wrap">
                        {plugin.builtin && (
                            <span className="text-[11px] font-medium bg-white/60 text-neutral-600 rounded-full px-2.5 py-0.5">
                                Official
                            </span>
                        )}
                        {plugin.category && (
                            <span className="text-[11px] font-medium bg-white/60 text-neutral-600 rounded-full px-2.5 py-0.5 capitalize">
                                {plugin.category}
                            </span>
                        )}
                        <span className="text-[11px] font-medium bg-white/60 text-neutral-600 rounded-full px-2.5 py-0.5">
                            v{plugin.version}
                        </span>
                    </div>
                    {locked && (
                        <span className="flex items-center gap-1 bg-amber-400/20 text-amber-700 border border-amber-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                            <Crown className="w-3 h-3" />
                            {upgradeNeeded}
                        </span>
                    )}
                </div>

                {/* Large icon floating top-right */}
                <div
                    className="absolute top-10 right-4 text-5xl leading-none pointer-events-none select-none"
                    aria-hidden="true"
                >
                    {locked ? "🔒" : plugin.icon}
                </div>

                {/* Title + description */}
                <div className="pr-16">
                    <p className="text-[20px] font-semibold text-neutral-900 leading-snug">{plugin.name}</p>
                    <p className="text-xs text-neutral-500 mt-1 leading-relaxed line-clamp-2">{plugin.description}</p>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-2 text-xs text-neutral-500 flex-wrap">
                    <span className="flex items-center gap-1">
                        <TableIcon className="w-3.5 h-3.5" />
                        {plugin.entities.length} table{plugin.entities.length !== 1 ? "s" : ""}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-neutral-400" />
                    <span className="flex items-center gap-1">
                        <LayoutGrid className="w-3.5 h-3.5" />
                        {plugin.views.length} views
                    </span>
                    {plugin.dashboards[0]?.widgets.length ? (
                        <>
                            <span className="w-1 h-1 rounded-full bg-neutral-400" />
                            <span className="flex items-center gap-1">
                                <BarChart2 className="w-3.5 h-3.5" />
                                {plugin.dashboards[0].widgets.length} widgets
                            </span>
                        </>
                    ) : null}
                    {plugin.workflows?.length ? (
                        <>
                            <span className="w-1 h-1 rounded-full bg-neutral-400" />
                            <span className="flex items-center gap-1">
                                <GitBranch className="w-3.5 h-3.5" />
                                {plugin.workflows.length} workflows
                            </span>
                        </>
                    ) : null}
                </div>

                {/* Install limit hint */}
                {installLimitHint && (
                    <p className="text-[10px] text-amber-700 flex items-center gap-1">
                        <Crown className="w-3 h-3 shrink-0" /> {installLimitHint}
                    </p>
                )}

                {/* Bottom row: meta + actions */}
                <div className="flex items-center justify-between mt-auto pt-1">
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={onAction}
                            disabled={actionDisabled}
                            className={`rounded-full flex items-center gap-2 px-4 py-1.5 text-xs font-medium transition-colors
                                ${actionDisabled
                                    ? "bg-black/10 text-black/40 cursor-not-allowed"
                                    : "bg-neutral-900 text-white hover:bg-neutral-700"
                                }`}
                        >
                            {actionIcon}{actionLabel}
                        </button>
                        {onShare && (
                            <button onClick={onShare} title="Share"
                                className="w-8 h-8 rounded-full border border-black/15 bg-white/50 flex items-center justify-center hover:bg-white/80 text-neutral-500">
                                <Share2 className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {onExport && (
                            <button onClick={onExport} title="Export"
                                className="w-8 h-8 rounded-full border border-black/15 bg-white/50 flex items-center justify-center hover:bg-white/80 text-neutral-500">
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        )}
                        {onUninstall && (
                            <button onClick={onUninstall} title="Uninstall"
                                className="w-8 h-8 rounded-full border border-black/15 bg-white/50 flex items-center justify-center hover:text-red-500 text-neutral-500">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}