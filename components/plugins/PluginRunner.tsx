'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart,
    ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
    ArrowUpDown, Bell, BellOff, Check, CheckSquare, ChevronDown,
    ChevronUp, Copy, Download, Filter, Pencil, Plus, RotateCcw,
    Search, Share2, SlidersHorizontal, Square, Trash, Trash2, TrendingDown,
    TrendingUp, Workflow, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import RecordForm from "./RecordForm";
import { usePluginContext } from "@/contexts/PluginsContext";
import { matchOperator } from "@/lib/plugins/formula";
import type {
    EntityDef, FieldDef, FieldFilter, FilterOp, PageBlock, PageDef,
    PluginManifest, PluginRecord, ViewDef, WidgetDef, WorkflowDef,
} from "@/lib/plugins/types";
import type { BranchCondition, WorkflowAction } from "@/lib/plugins/types";

/* ---------- helpers ---------- */

function fmt(v: unknown): string {
    if (v === undefined || v === null || v === "") return "—";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "number") return v.toLocaleString();
    if (typeof v === "boolean") return v ? "Yes" : "No";
    return String(v);
}

function renderCell(field: FieldDef | undefined, value: unknown, plugin: PluginManifest, getRecordsForEntity: (entityId: string) => PluginRecord[]): string {
    if (!field) return fmt(value);
    if (field.type === "relation") {
        if (!value) return "—";
        const target = plugin.entities.find((e) => e.id === field.relationEntityId);
        if (!target) return "—";
        // const rec = getRecords(plugin.id, target.id).find((r) => r.id === value);
        const rec = getRecordsForEntity(target.id).find((r) => r.id === value);
        return rec ? String(rec.data[target.titleField] ?? "Untitled") : "—";
    }
    return fmt(value);
}

function downloadJSON(name: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
}

function applyFilters(records: PluginRecord[], filters: FieldFilter[]): PluginRecord[] {
    if (!filters.length) return records;
    return records.filter((r) =>
        filters.every((f) => matchOperator(r.data[f.fieldKey], f.op, f.value)),
    );
}

function applySearch(records: PluginRecord[], q: string, entity: EntityDef): PluginRecord[] {
    if (!q.trim()) return records;
    const lower = q.toLowerCase();
    return records.filter((r) =>
        entity.fields.some((f) => {
            const v = r.data[f.key];
            if (Array.isArray(v)) return v.some((x) => String(x).toLowerCase().includes(lower));
            return String(v ?? "").toLowerCase().includes(lower);
        }),
    );
}

function applySort(records: PluginRecord[], key: string, dir: "asc" | "desc"): PluginRecord[] {
    return [...records].sort((a, b) => {
        const x = a.data[key] ?? "", y = b.data[key] ?? "";
        const nx = Number(x), ny = Number(y);
        const num = Number.isFinite(nx) && Number.isFinite(ny);
        let cmp = num ? nx - ny : String(x).localeCompare(String(y));
        return dir === "asc" ? cmp : -cmp;
    });
}

const OP_LABELS: Record<FilterOp, string> = {
    eq: "equals", neq: "not equals", gt: "greater than", gte: "≥",
    lt: "less than", lte: "≤", contains: "contains", notContains: "doesn't contain",
    isEmpty: "is empty", isNotEmpty: "is not empty",
};

/* ---------- PluginRunner root ---------- */

export default function PluginRunner({ plugin }: { plugin: PluginManifest }) {
    const {
        records,
        notifications: allNotifications,
        upsertRecord,
        deleteRecord,
        bulkDeleteRecords,
        bulkUpdateRecords,
        restoreRecords,
        markAllNotificationsRead,
        duplicatePlugin,
        exportPlugin,
        buildShareLink,
        uninstallPlugin,
        loadPluginRecords,
        getRecordsForEntity,
    } = usePluginContext();

    // Load this plugin's records when it mounts
    useEffect(() => {
        loadPluginRecords(plugin.id);
    }, [plugin.id]);

    const firstEntity = plugin.entities[0];
    const [tab, setTab] = useState<string>(
        plugin.pages?.[0]
            ? `page:${plugin.pages[0].id}`
            : plugin.dashboards[0]
                ? "dashboard"
                : firstEntity
                    ? `entity:${firstEntity.id}`
                    : "dashboard",
    );
    const notifications = allNotifications.filter(n => n.pluginId === plugin.id);
    const unread = notifications.filter((n) => !n.read).length;
    const [notifOpen, setNotifOpen] = useState(false);

    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative overflow-hidden rounded-3xl border bg-card p-5 sm:p-8"
                >
                    <div
                        aria-hidden
                        className="absolute inset-0 opacity-40 pointer-events-none"
                        style={{
                            background: `radial-gradient(circle at 0% 0%, ${plugin.accent}33, transparent 60%),
                                         radial-gradient(circle at 100% 100%, ${plugin.accent}22, transparent 55%)`,
                        }}
                    />
                    <div className="relative flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-xl ring-1 ring-black/5 shrink-0"
                                style={{ background: `linear-gradient(135deg, ${plugin.accent}, ${plugin.accent}cc)`, color: "white" }}
                            >
                                {plugin.icon}
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">{plugin.name}</h1>
                                <p className="text-muted-foreground text-sm max-w-xl mt-0.5">{plugin.description}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            {/* Notifications bell */}
                            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="rounded-full relative">
                                        <Bell className="w-4 h-4" />
                                        {unread > 0 && (
                                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold bg-destructive text-white flex items-center justify-center">
                                                {unread > 9 ? "9+" : unread}
                                            </span>
                                        )}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                                    <DropdownMenuLabel className="flex items-center justify-between">
                                        Notifications
                                        {unread > 0 && (
                                            <button onClick={() => markAllNotificationsRead(plugin.id)} className="text-xs text-muted-foreground hover:text-foreground">
                                                Mark all read
                                            </button>
                                        )}
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {notifications.length === 0 && (
                                        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                                            <BellOff className="w-6 h-6 mx-auto mb-2 opacity-30" />
                                            No notifications yet
                                        </div>
                                    )}
                                    {notifications.slice(0, 20).map((n) => (
                                        <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 py-2">
                                            <span className={`text-xs font-medium ${n.read ? "text-muted-foreground" : ""}`}>{n.title}</span>
                                            <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button variant="outline" size="sm" className="rounded-full"
                                onClick={() => { const l = buildShareLink(plugin.id); if (l) { navigator.clipboard.writeText(l); toast.success("Share link copied"); } }}>
                                <Share2 className="w-4 h-4" /> Share
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-full"
                                onClick={() => { const c = duplicatePlugin(plugin.id); if (c) toast.success(`Forked as "${c.name}"`); }}>
                                <Copy className="w-4 h-4" /> Fork
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-full"
                                onClick={() => downloadJSON(`${plugin.slug}.plugin.json`, exportPlugin(plugin.id))}>
                                <Download className="w-4 h-4" /> Export
                            </Button>
                            {!plugin.builtin && (
                                <Button variant="ghost" size="sm" className="rounded-full text-destructive hover:text-destructive"
                                    onClick={() => { if (confirm(`Uninstall ${plugin.name}? Records will be deleted.`)) uninstallPlugin(plugin.id); }}>
                                    <Trash className="w-4 h-4" /> Uninstall
                                </Button>
                            )}
                        </div>
                    </div>
                </motion.div>

                <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                    <TabsList className="flex flex-nowrap justify-start items-center w-full h-auto rounded-full bg-muted/60 p-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden content-box">                        <span className="w-1 shrink-0" />
                        {plugin.pages?.map((p) => (
                            <TabsTrigger key={p.id} value={`page:${p.id}`} className="rounded-full px-4 text-sm">
                                {p.icon ?? "🪟"} {p.name}
                            </TabsTrigger>
                        ))}
                        {plugin.dashboards.map((d) => (
                            <TabsTrigger key={d.id} value="dashboard" className="rounded-full px-4 text-sm">{d.name}</TabsTrigger>
                        ))}
                        {plugin.entities.map((e) => (
                            <TabsTrigger key={e.id} value={`entity:${e.id}`} className="rounded-full px-4 text-sm">
                                {e.icon} {e.plural}
                            </TabsTrigger>
                        ))}
                        {plugin.workflows && plugin.workflows.length > 0 && (
                            <TabsTrigger value="workflows" className="rounded-full px-4 text-sm">
                                <Workflow className="w-3.5 h-3.5 mr-1" /> Workflows
                            </TabsTrigger>
                        )}
                        <span className="w-1 shrink-0" />
                    </TabsList>

                    {plugin.pages?.map((p) => (
                        <TabsContent key={p.id} value={`page:${p.id}`}>
                            <PagePanel plugin={plugin} page={p} />
                        </TabsContent>
                    ))}

                    {plugin.dashboards[0] && (
                        <TabsContent value="dashboard">
                            <DashboardPanel plugin={plugin} />
                        </TabsContent>
                    )}

                    {plugin.entities.map((e) => (
                        <TabsContent key={e.id} value={`entity:${e.id}`}>
                            <EntityPanel plugin={plugin} entity={e} />
                        </TabsContent>
                    ))}

                    {plugin.workflows && plugin.workflows.length > 0 && (
                        <TabsContent value="workflows"><WorkflowsPanel plugin={plugin} /></TabsContent>
                    )}
                </Tabs>
            </div>
        </div>
    );
}

/* ---------- Dashboard ---------- */

function DashboardPanel({ plugin }: { plugin: PluginManifest }) {
    const dashboard = plugin.dashboards[0];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboard.widgets.map((w, i) => (
                <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Widget plugin={plugin} widget={w} />
                </motion.div>
            ))}
        </div>
    );
}

function Widget({ plugin, widget }: { plugin: PluginManifest; widget: WidgetDef }) {
    const { getRecordsForEntity } = usePluginContext();
    const records = getRecordsForEntity(widget.entityId);
    const entity = plugin.entities.find((e) => e.id === widget.entityId);
    const accent = widget.accent ?? plugin.accent;

    let body: React.ReactNode = null;

    if (widget.kind === "count") {
        body = <div className="text-5xl font-semibold tabular-nums tracking-tight">{records.length}</div>;

    } else if (widget.kind === "sum") {
        const total = records.reduce((s, r) => s + (Number(r.data[widget.fieldKey ?? ""]) || 0), 0);
        const field = entity?.fields.find((f) => f.key === widget.fieldKey);
        body = (
            <div className="text-5xl font-semibold tabular-nums tracking-tight">
                {field?.prefix ?? ""}{total.toLocaleString()}{field?.suffix ?? ""}
            </div>
        );

    } else if (widget.kind === "byStatus" && entity) {
        const key = widget.fieldKey ?? entity.statusField ?? "";
        const groups: Record<string, number> = {};
        records.forEach((r) => { const v = (r.data[key] as string) || "—"; groups[v] = (groups[v] ?? 0) + 1; });
        const max = Math.max(1, ...Object.values(groups));
        body = (
            <div className="space-y-2.5">
                {Object.entries(groups).map(([k, v], i) => (
                    <div key={k}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{k}</span>
                            <span className="text-muted-foreground tabular-nums">{v}</span>
                        </div>
                        <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }} animate={{ width: `${(v / max) * 100}%` }}
                                transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                                className="h-full rounded-full" style={{ background: shade(accent, i) }}
                            />
                        </div>
                    </div>
                ))}
                {Object.keys(groups).length === 0 && <p className="text-xs text-muted-foreground">No data yet.</p>}
            </div>
        );

    } else if (widget.kind === "upcoming" && entity) {
        const key = widget.fieldKey ?? "";
        const now = Date.now();
        const list = records
            .filter((r) => r.data[key])
            .map((r) => ({ r, t: new Date(r.data[key] as string).getTime() }))
            .filter((x) => !Number.isNaN(x.t))
            .sort((a, b) => a.t - b.t)
            .slice(0, 5);
        body = (
            <ul className="space-y-2 text-sm">
                {list.length === 0 && <li className="text-xs text-muted-foreground">Nothing upcoming.</li>}
                {list.map(({ r, t }) => {
                    const overdue = t < now;
                    return (
                        <li key={r.id} className="flex justify-between gap-2">
                            <span className="truncate">{String(r.data[entity.titleField] ?? "Untitled")}</span>
                            <span className={`text-xs tabular-nums shrink-0 ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                                {overdue ? "Overdue" : new Date(t).toLocaleDateString()}
                            </span>
                        </li>
                    );
                })}
            </ul>
        );

    } else if (widget.kind === "recent" && entity) {
        const list = [...records].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5);
        body = (
            <ul className="space-y-2 text-sm">
                {list.length === 0 && <li className="text-xs text-muted-foreground">No records yet.</li>}
                {list.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2">
                        <span className="truncate">{String(r.data[entity.titleField] ?? "Untitled")}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{new Date(r.updatedAt).toLocaleDateString()}</span>
                    </li>
                ))}
            </ul>
        );

    } else if (widget.kind === "chart" && entity) {
        body = <ChartBody widget={widget} records={records} accent={accent} />;

    } else if (widget.kind === "kpi" && entity) {
        const total = widget.fieldKey
            ? records.reduce((s, r) => s + (Number(r.data[widget.fieldKey!]) || 0), 0)
            : records.length;
        const period = widget.comparePeriodDays ?? 7;
        const cutoff = Date.now() - period * 86400000;
        const recent = records.filter((r) => +new Date(r.updatedAt) >= cutoff).length;
        const spark = buildSparkline(records, period);
        body = (
            <div className="space-y-2">
                <div className="text-5xl font-semibold tabular-nums tracking-tight">{total.toLocaleString()}</div>
                <div className="flex items-center justify-between gap-3">
                    <div className={`flex items-center gap-1 text-xs font-medium ${recent > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {recent > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        +{recent} <span className="text-muted-foreground font-normal">last {period}d</span>
                    </div>
                    <div className="h-10 w-24"><Sparkline data={spark} color={accent} /></div>
                </div>
            </div>
        );

    } else if (widget.kind === "progress" && entity) {
        const total = widget.fieldKey
            ? records.reduce((s, r) => s + (Number(r.data[widget.fieldKey!]) || 0), 0)
            : records.length;
        const target = widget.target ?? 100;
        const pct = Math.min(100, Math.round((total / Math.max(1, target)) * 100));
        body = <RingProgress value={pct} label={`${total.toLocaleString()} / ${target.toLocaleString()}`} color={accent} />;

    } else if (widget.kind === "streak" && entity) {
        const dateKey = widget.dateField ?? widget.fieldKey ?? "";
        const days = new Set(
            records
                .map((r) => (r.data[dateKey] as string) || r.createdAt.slice(0, 10))
                .filter(Boolean)
                .map((d) => new Date(d).toISOString().slice(0, 10)),
        );
        let streak = 0;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (let i = 0; i < 365; i++) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            if (days.has(d.toISOString().slice(0, 10))) streak++;
            else if (i > 0) break;
        }
        body = (
            <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-semibold tabular-nums tracking-tight">{streak}</span>
                    <span className="text-sm text-muted-foreground">day streak 🔥</span>
                </div>
                <HeatStrip days={days} accent={accent} />
            </div>
        );

    } else if (widget.kind === "goal" && entity) {
        const total = widget.fieldKey
            ? records.reduce((s, r) => s + (Number(r.data[widget.fieldKey!]) || 0), 0)
            : records.length;
        const target = widget.target ?? 10;
        const remaining = Math.max(0, target - total);
        const pct = Math.min(100, Math.round((total / Math.max(1, target)) * 100));
        body = (
            <div className="space-y-2">
                <div className="text-3xl font-semibold tabular-nums">{remaining} to go</div>
                <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full" style={{ background: accent }}
                    />
                </div>
                <div className="text-xs text-muted-foreground">{total} / {target} ({pct}%)</div>
            </div>
        );

    } else if (widget.kind === "table" && entity) {
        const cols = entity.fields.slice(0, 3);
        const list = [...records].slice(0, 5);
        body = (
            <div className="text-sm">
                {list.length === 0 ? <p className="text-xs text-muted-foreground">No records yet.</p> : (
                    <table className="w-full">
                        <tbody>
                            {list.map((r) => (
                                <tr key={r.id} className="border-t first:border-t-0">
                                    {cols.map((f) => <td key={f.id} className="py-1.5 pr-2 truncate text-xs">{fmt(r.data[f.key])}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        );
    }

    return (
        <Card className="overflow-hidden border-border/60 hover:shadow-md transition-shadow relative h-full">
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
            />
            <CardHeader className="pb-2">
                <CardTitle className="text-[11px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
                    {widget.title}
                </CardTitle>
            </CardHeader>
            <CardContent>{body}</CardContent>
        </Card>
    );
}

/* ---------- Entity panel ---------- */

type SortState = { key: string; dir: "asc" | "desc" } | null;

function EntityPanel({ plugin, entity }: { plugin: PluginManifest; entity: EntityDef }) {
    const { getRecordsForEntity, upsertRecord, deleteRecord, bulkDeleteRecords,
        bulkUpdateRecords, restoreRecords } = usePluginContext();
    const allRecords = getRecordsForEntity(entity.id);
    const views = plugin.views.filter((v) => v.entityId === entity.id);
    const [activeView, setActiveView] = useState<ViewDef | undefined>(views[0]);
    const [editing, setEditing] = useState<PluginRecord | null>(null);
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState("");
    const [filters, setFilters] = useState<FieldFilter[]>([]);
    const [sort, setSort] = useState<SortState>(null);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(false);

    // Column visibility for table view
    const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());

    const records = useMemo(() => {
        let r = applyFilters(allRecords, filters);
        r = applySearch(r, search, entity);
        if (sort) r = applySort(r, sort.key, sort.dir);
        return r;
    }, [allRecords, filters, search, sort, entity]);

    const toggleSelect = (id: string) =>
        setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const selectAll = () => setSelected(new Set(records.map((r) => r.id)));
    const clearSel = () => setSelected(new Set());
    const allSelected = selected.size > 0 && records.every((r) => selected.has(r.id));

    const handleSubmit = (data: Record<string, unknown>) => {
        const id = editing?.id ?? crypto.randomUUID();
        upsertRecord({
            id, entityId: entity.id, data,
            createdAt: editing?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        toast.success(editing ? `${entity.name} updated` : `${entity.name} created`);
        setEditing(null);
        setCreating(false);
    };

    const handleDelete = useCallback((id: string) => {
        deleteRecord(id);
        toast(`${entity.name} deleted`, {
            action: { label: "Undo", onClick: () => { restoreRecords([id]); toast.success("Restored"); } },
        });
    }, [plugin.id, entity.name]);

    const handleBulkDelete = useCallback(() => {
        const ids = [...selected];
        bulkDeleteRecords(ids);
        clearSel();
        toast(`${ids.length} ${entity.plural.toLowerCase()} deleted`, {
            action: {
                label: "Undo", onClick: () => {
                    // restoreRecords(plugin.id, ids);
                    restoreRecords(ids);
                    toast.success(`${ids.length} restored`);
                },
            },
        });
    }, [selected, plugin.id, entity]);

    const statusField = entity.fields.find((f) => f.key === entity.statusField);
    const handleBulkStatus = (status: string) => {
        bulkUpdateRecords([...selected], { [entity.statusField!]: status });
        toast.success(`${selected.size} ${entity.plural.toLowerCase()} updated`);
        clearSel();
    };

    const viewProps = { plugin, entity, records, onEdit: setEditing, onDelete: handleDelete, accent: plugin.accent, selected, onToggleSelect: toggleSelect };

    return (
        <div className="space-y-3">
            {/* Toolbar — row 1: view switcher + New button */}
            <div className="flex items-center gap-2">
                {/* View switcher — scrollable on mobile */}
                <div className="flex gap-0.5 p-0.5 rounded-xl bg-muted/40 border border-border/50 overflow-x-auto max-w-full [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                    {views.map((v) => (
                        <button key={v.id} onClick={() => setActiveView(v)}
                            className={`px-2.5 sm:px-3 py-1.5 text-xs rounded-lg font-medium transition whitespace-nowrap shrink-0 ${activeView?.id === v.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                            {v.name}
                        </button>
                    ))}
                </div>
                <div className="flex-1" />
                <Button size="sm" style={{ background: plugin.accent, color: "white" }} onClick={() => setCreating(true)}>
                    <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New </span>{entity.name}
                </Button>
            </div>

            {/* Toolbar — row 2: search + filter + sort + columns */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative flex-1 min-w-36">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Search ${entity.plural.toLowerCase()}…`}
                        className="pl-8 h-8 text-xs"
                    />
                    {search && (
                        <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filter toggle */}
                <Button variant={filters.length > 0 ? "secondary" : "outline"} size="sm" className="h-8 text-xs gap-1.5 shrink-0"
                    onClick={() => setShowFilters((v) => !v)}>
                    <Filter className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{filters.length > 0 ? `${filters.length} filter${filters.length !== 1 ? "s" : ""}` : "Filter"}</span>
                    {filters.length > 0 && <span className="sm:hidden">{filters.length}</span>}
                </Button>

                {/* Sort menu */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant={sort ? "secondary" : "outline"} size="sm" className="h-8 text-xs gap-1.5 shrink-0">
                            <ArrowUpDown className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{sort ? `${entity.fields.find((f) => f.key === sort.key)?.label ?? sort.key} ${sort.dir === "asc" ? "↑" : "↓"}` : "Sort"}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {entity.fields.map((f) => (
                            <DropdownMenuItem key={f.id} onClick={() =>
                                setSort((s) => s?.key === f.key && s.dir === "asc" ? { key: f.key, dir: "desc" } : { key: f.key, dir: "asc" })
                            } className="flex justify-between gap-4">
                                {f.label}
                                {sort?.key === f.key && <span className="text-muted-foreground">{sort.dir === "asc" ? "↑" : "↓"}</span>}
                            </DropdownMenuItem>
                        ))}
                        {sort && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => setSort(null)}>Clear sort</DropdownMenuItem></>}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Column visibility (table view) */}
                {activeView?.kind === "table" && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 shrink-0">
                                <SlidersHorizontal className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Columns</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {entity.fields.map((f) => (
                                <DropdownMenuItem key={f.id} className="gap-2"
                                    onClick={() => setHiddenCols((h) => { const n = new Set(h); n.has(f.key) ? n.delete(f.key) : n.add(f.key); return n; })}>
                                    {hiddenCols.has(f.key) ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5 text-primary" />}
                                    {f.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* Filter editor */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <FilterBar entity={entity} filters={filters} onChange={setFilters} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bulk action bar */}
            <AnimatePresence>
                {selected.size > 0 && (
                    <motion.div initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -8, opacity: 0 }}
                        className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm">
                        <Check className="w-4 h-4 shrink-0" />
                        <span className="font-medium">{selected.size} selected</span>
                        <div className="flex-1" />
                        <div className="flex flex-wrap items-center gap-2">
                            {statusField?.options && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="secondary" className="h-7 text-xs">Change status</Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        {statusField.options.map((o) => (
                                            <DropdownMenuItem key={o} onClick={() => handleBulkStatus(o)}>{o}</DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            <Button size="sm" variant="secondary" className="h-7 text-xs gap-1" onClick={handleBulkDelete}>
                                <Trash2 className="w-3 h-3" /> Delete {selected.size}
                            </Button>
                            <button onClick={clearSel} className="opacity-70 hover:opacity-100">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Results count */}
            {(search || filters.length > 0) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{records.length} of {allRecords.length} {entity.plural.toLowerCase()}</span>
                    {(search || filters.length > 0) && (
                        <button onClick={() => { setSearch(""); setFilters([]); }} className="flex items-center gap-1 hover:text-foreground">
                            <RotateCcw className="w-3 h-3" /> Clear
                        </button>
                    )}
                </div>
            )}

            {/* Kanban always renders (columns must show even when empty or filtered) */}
            {activeView?.kind === "kanban" ? (
                <KanbanView {...viewProps} view={activeView} getRecordsForEntity={getRecordsForEntity} />
            ) : records.length === 0 ? (
                <Card>
                    <CardContent className="py-14 text-center">
                        <div className="text-4xl mb-3">{entity.icon}</div>
                        {allRecords.length === 0 ? (
                            <>
                                <p className="text-sm font-medium mb-1">No {entity.plural.toLowerCase()} yet</p>
                                <p className="text-xs text-muted-foreground mb-4">Click "New {entity.name}" to get started.</p>
                                <Button size="sm" style={{ background: plugin.accent, color: "white" }} onClick={() => setCreating(true)}>
                                    <Plus className="w-4 h-4" /> New {entity.name}
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-medium mb-1">No results</p>
                                <p className="text-xs text-muted-foreground">Try different search terms or filters.</p>
                            </>
                        )}
                    </CardContent>
                </Card>
            ) : activeView?.kind === "table" ? (
                <TableView {...viewProps} allSelected={allSelected} onSelectAll={allSelected ? clearSel : selectAll} hiddenCols={hiddenCols} />
            ) : activeView?.kind === "grid" ? (
                <GridView {...viewProps} />
            ) : activeView?.kind === "calendar" ? (
                <CalendarView entity={entity} view={activeView} records={records} onEdit={setEditing} accent={plugin.accent} />
            ) : activeView?.kind === "gallery" ? (
                <GalleryView plugin={plugin} entity={entity} records={records} onEdit={setEditing} accent={plugin.accent} />
            ) : activeView?.kind === "timeline" ? (
                <TimelineView plugin={plugin} entity={entity} view={activeView} records={records} onEdit={setEditing} accent={plugin.accent} />
            ) : activeView?.kind === "feed" ? (
                <FeedView entity={entity} records={records} onEdit={setEditing} accent={plugin.accent} />
            ) : (
                <ListView {...viewProps} />
            )}

            {/* Record form dialog */}
            <Dialog open={creating || !!editing} onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing ? `Edit ${entity.name}` : `New ${entity.name}`}</DialogTitle>
                    </DialogHeader>
                    <RecordForm
                        entity={entity} plugin={plugin}
                        initial={editing ?? undefined}
                        onSubmit={handleSubmit}
                        onCancel={() => { setEditing(null); setCreating(false); }}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ---------- Filter bar ---------- */

function FilterBar({ entity, filters, onChange }: {
    entity: EntityDef;
    filters: FieldFilter[];
    onChange: (f: FieldFilter[]) => void;
}) {
    const add = () => onChange([...filters, { id: crypto.randomUUID(), fieldKey: entity.fields[0]?.key ?? "", op: "contains" }]);
    const update = (id: string, patch: Partial<FieldFilter>) =>
        onChange(filters.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    const remove = (id: string) => onChange(filters.filter((f) => f.id !== id));

    const opsForField = (key: string): FilterOp[] => {
        const f = entity.fields.find((x) => x.key === key);
        if (!f) return ["eq", "neq", "contains", "isEmpty", "isNotEmpty"];
        if (f.type === "number" || f.type === "currency" || f.type === "rating" || f.type === "progress")
            return ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"];
        if (f.type === "date")
            return ["eq", "neq", "gt", "gte", "lt", "lte", "isEmpty", "isNotEmpty"];
        if (f.type === "checkbox")
            return ["eq"];
        return ["eq", "neq", "contains", "notContains", "isEmpty", "isNotEmpty"];
    };

    const noValueOps = new Set<FilterOp>(["isEmpty", "isNotEmpty"]);

    return (
        <Card className="p-3 space-y-2 border-dashed">
            {filters.map((flt) => {
                const fieldDef = entity.fields.find((f) => f.key === flt.fieldKey);
                const isSelect = fieldDef?.type === "select" || fieldDef?.type === "multiselect";
                const noVal = noValueOps.has(flt.op);
                return (
                    <div key={flt.id} className="flex flex-wrap items-center gap-2">
                        <Select value={flt.fieldKey} onValueChange={(v) => update(flt.id, { fieldKey: v, op: "contains", value: "" })}>
                            <SelectTrigger className="h-7 text-xs w-full sm:w-36 flex-1 sm:flex-none min-w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {entity.fields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={flt.op} onValueChange={(v) => update(flt.id, { op: v as FilterOp })}>
                            <SelectTrigger className="h-7 text-xs w-full sm:w-36 flex-1 sm:flex-none min-w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {opsForField(flt.fieldKey).map((op) => (
                                    <SelectItem key={op} value={op}>{OP_LABELS[op]}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {!noVal && (
                            isSelect && fieldDef?.options ? (
                                <Select value={flt.value ?? ""} onValueChange={(v) => update(flt.id, { value: v })}>
                                    <SelectTrigger className="h-7 text-xs w-full sm:w-32 flex-1 sm:flex-none min-w-24"><SelectValue placeholder="Value" /></SelectTrigger>
                                    <SelectContent>
                                        {fieldDef.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={flt.value ?? ""}
                                    onChange={(e) => update(flt.id, { value: e.target.value })}
                                    placeholder="Value"
                                    className="h-7 text-xs w-full sm:w-32 flex-1 sm:flex-none min-w-24"
                                />
                            )
                        )}
                        <button onClick={() => remove(flt.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            })}
            <button onClick={add} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add filter
            </button>
        </Card>
    );
}

/* ---------- Table view ---------- */

function TableView({ plugin, entity, records, onEdit, onDelete, selected, onToggleSelect, allSelected, onSelectAll, hiddenCols }: {
    plugin: PluginManifest; entity: EntityDef; records: PluginRecord[];
    onEdit: (r: PluginRecord) => void; onDelete: (id: string) => void;
    selected: Set<string>; onToggleSelect: (id: string) => void;
    allSelected: boolean; onSelectAll: () => void;
    hiddenCols: Set<string>;
}) {
    const cols = entity.fields.filter((f) => !hiddenCols.has(f.key)).slice(0, 8);
    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                        <tr>
                            <th className="px-3 py-2.5 w-10">
                                <button onClick={onSelectAll} className="text-muted-foreground hover:text-foreground">
                                    {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                </button>
                            </th>
                            {cols.map((f) => (
                                <th key={f.id} className="text-left font-medium text-[11px] uppercase tracking-wide text-muted-foreground px-3 py-2.5 whitespace-nowrap">
                                    {f.label}
                                </th>
                            ))}
                            <th className="w-16" />
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((r) => {
                            const isSelected = selected.has(r.id);
                            return (
                                <tr key={r.id} className={`border-t transition ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
                                    <td className="px-3 py-2.5">
                                        <button onClick={() => onToggleSelect(r.id)} className="text-muted-foreground hover:text-foreground">
                                            {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                                        </button>
                                    </td>
                                    {cols.map((f) => (
                                        <td key={f.id} className="px-3 py-2.5 max-w-50">
                                            <CellRenderer field={f} value={r.data[f.key]} plugin={plugin} />
                                        </td>
                                    ))}
                                    <td className="px-2 py-2.5 text-right whitespace-nowrap">
                                        <button onClick={() => onEdit(r)} className="p-1.5 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => onDelete(r.id)} className="p-1.5 hover:bg-muted rounded text-destructive opacity-60 hover:opacity-100">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

/** Rich inline cell renderer for table view. */
function CellRenderer({ field, value, plugin }: { field: FieldDef; value: unknown; plugin: PluginManifest }) {
    const { getRecordsForEntity } = usePluginContext()
    if (value === undefined || value === null || value === "") return <span className="text-muted-foreground/40">—</span>;
    if (field.type === "checkbox") return value ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-muted-foreground/40" />;
    if (field.type === "rating") {
        return (
            <div className="flex gap-0.5">
                {Array.from({ length: field.max ?? 5 }).map((_, i) => (
                    <span key={i} className={`text-xs ${i < Number(value) ? "text-amber-400" : "text-muted-foreground/30"}`}>★</span>
                ))}
            </div>
        );
    }
    if (field.type === "progress") {
        const pct = Number(value) ?? 0;
        return (
            <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden min-w-15">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
            </div>
        );
    }
    if (field.type === "color") {
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-sm border" style={{ background: String(value) }} />
                <span className="text-xs text-muted-foreground">{String(value)}</span>
            </div>
        );
    }
    if (field.type === "tags" || field.type === "multiselect") {
        const arr: string[] = Array.isArray(value)
            ? (value as unknown[]).map(String)
            : String(value).split(",").map((s) => s.trim());
        return (
            <div className="flex flex-wrap gap-1">
                {arr.filter(Boolean).map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                ))}
            </div>
        );
    }
    if (field.type === "select") {
        return <Badge variant="outline" className="text-[10px] px-1.5 py-0">{String(value)}</Badge>;
    }
    if (field.type === "url") {
        return <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary text-xs underline truncate block max-w-40">{String(value)}</a>;
    }
    if (field.type === "email") {
        return <a href={`mailto:${value}`} className="text-primary text-xs underline">{String(value)}</a>;
    }
    if (field.type === "relation") {
        return <span className="text-xs">{renderCell(field, value, plugin, getRecordsForEntity)}</span>;
    }
    if (field.type === "currency") {
        const n = Number(value);
        return <span className="text-xs tabular-nums">{field.prefix ?? ""}{Number.isFinite(n) ? n.toLocaleString() : "—"}{field.suffix ?? ""}</span>;
    }
    const text = fmt(value);
    return <span className="text-xs truncate block max-w-45" title={text}>{text}</span>;
}

/* ---------- List view ---------- */

function ListView({ plugin, entity, records, onEdit, onDelete, selected, onToggleSelect, accent }: {
    plugin: PluginManifest; entity: EntityDef; records: PluginRecord[];
    onEdit: (r: PluginRecord) => void; onDelete: (id: string) => void;
    selected: Set<string>; onToggleSelect: (id: string) => void; accent: string;
}) {
    const { getRecordsForEntity } = usePluginContext()
    return (
        <div className="space-y-2">
            {records.map((r) => {
                const isSelected = selected.has(r.id);
                return (
                    <Card key={r.id} className={`p-3.5 flex flex-row items-center gap-3 hover:shadow-sm transition cursor-pointer group ${isSelected ? "ring-1 ring-primary" : ""}`}
                        onClick={() => onEdit(r)}>
                        <button onClick={(e) => { e.stopPropagation(); onToggleSelect(r.id); }} className="text-muted-foreground hover:text-foreground shrink-0">
                            {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                        </button>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: `${accent}22` }}>
                            {entity.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{String(r.data[entity.titleField] ?? "Untitled")}</div>
                            <div className="text-xs text-muted-foreground truncate">
                                {entity.fields.slice(1, 4).filter((f) => r.data[f.key]).map((f) => `${f.label}: ${renderCell(f, r.data[f.key], plugin, getRecordsForEntity)}`).join(" · ")}
                            </div>
                        </div>
                        {(() => { const sf = entity.statusField; return sf && r.data[sf] ? <Badge variant="outline" className="text-[10px] shrink-0">{String(r.data[sf])}</Badge> : null; })()}
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 pointer-coarse:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => onEdit(r)} className="p-1.5 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => onDelete(r.id)} className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

/* ---------- Grid view ---------- */

function GridView({ plugin, entity, records, onEdit, onDelete, accent, selected, onToggleSelect }: {
    plugin: PluginManifest; entity: EntityDef; records: PluginRecord[];
    onEdit: (r: PluginRecord) => void; onDelete: (id: string) => void;
    accent: string; selected: Set<string>; onToggleSelect: (id: string) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {records.map((r) => {
                const isSelected = selected.has(r.id);
                return (
                    <Card key={r.id} className={`overflow-hidden group cursor-pointer hover:shadow-md transition ${isSelected ? "ring-1 ring-primary" : ""}`} onClick={() => onEdit(r)}>
                        <div className="h-1" style={{ background: accent }} />
                        <div className="p-4 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                                <span className="font-medium text-sm truncate flex-1">{String(r.data[entity.titleField] ?? "Untitled")}</span>
                                <button onClick={(e) => { e.stopPropagation(); onToggleSelect(r.id); }} className="text-muted-foreground hover:text-foreground shrink-0">
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 opacity-0 group-hover:opacity-100" />}
                                </button>
                            </div>
                            {entity.fields.slice(1, 4).map((f) => {
                                const v = r.data[f.key];
                                if (!v && v !== 0 && v !== false) return null;
                                return (
                                    <div key={f.id} className="flex justify-between gap-2 text-xs">
                                        <span className="text-muted-foreground shrink-0">{f.label}</span>
                                        <span className="truncate text-right"><CellRenderer field={f} value={v} plugin={plugin} /></span>
                                    </div>
                                );
                            })}
                            <div className="flex justify-end gap-1 pt-1 opacity-0 group-hover:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => onEdit(r)} className="p-1.5 hover:bg-muted rounded"><Pencil className="w-3.5 h-3.5" /></button>
                                <button onClick={() => onDelete(r.id)} className="p-1.5 hover:bg-muted rounded text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

/* ---------- Kanban view with drag-and-drop ---------- */

function KanbanView({ entity, view, records, plugin, onEdit, accent, getRecordsForEntity }: {
    entity: EntityDef; view: ViewDef; records: PluginRecord[];
    plugin: PluginManifest; onEdit: (r: PluginRecord) => void; accent: string;
    getRecordsForEntity: (entityId: string) => PluginRecord[];
}) {
    const groupKey = view.groupBy ?? entity.statusField ?? "";

    // Derive full column list from the field definition (options or statuses),
    // so every column is always visible even when no records exist for that status.
    const groupField = entity.fields.find((f) => f.key === groupKey);
    const statuses: string[] =
        entity.statuses?.map((s) => s.id) ??
        groupField?.options ??
        Array.from(new Set(records.map((r) => (r.data[groupKey] as string) || ""))).filter(Boolean);

    const [dragOver, setDragOver] = useState<string | null>(null);
    const { upsertRecord } = usePluginContext();
    const moveTo = (id: string, status: string) => {
        const all = getRecordsForEntity(entity.id);
        const r = all.find((x) => x.id === id);
        if (r) upsertRecord({ ...r, data: { ...r.data, [groupKey]: status } });
    };

    return (
        <div className="overflow-x-auto pb-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
            <div className="flex gap-3 min-w-max">
                {statuses.map((s) => {
                    const inCol = records.filter((r) => (r.data[groupKey] ?? "") === s);
                    const statusDef = entity.statuses?.find((x) => x.id === s);
                    const isOver = dragOver === s;
                    return (
                        <div key={s}
                            className={`w-72 shrink-0 rounded-2xl p-3 space-y-2 transition ${isOver ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/30"}`}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(s); }}
                            onDragLeave={() => setDragOver(null)}
                            onDrop={(e) => {
                                setDragOver(null);
                                const id = e.dataTransfer.getData("text/plain");
                                if (id) moveTo(id, s);
                            }}>
                            <div className="flex items-center justify-between px-1 py-1">
                                <div className="flex items-center gap-1.5">
                                    {statusDef ? (
                                        <span className={`w-2 h-2 rounded-full bg-${statusDef.color}-500`} />
                                    ) : (
                                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                                    )}
                                    <span className="text-xs font-semibold uppercase tracking-wide">{statusDef?.label ?? s}</span>
                                </div>
                                <Badge variant="secondary" className="text-xs">{inCol.length}</Badge>
                            </div>
                            {inCol.map((r) => (
                                <div key={r.id} draggable
                                    onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                                    onClick={() => onEdit(r)}
                                    className="bg-card border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition group/card">
                                    <div className="font-medium text-sm">{String(r.data[entity.titleField] ?? "Untitled")}</div>
                                    {entity.fields.slice(1, 3).filter((f) => f.key !== groupKey && r.data[f.key]).map((f) => (
                                        <div key={f.id} className="text-xs text-muted-foreground mt-0.5">
                                            {f.type === "date"
                                                ? new Date(r.data[f.key] as string).toLocaleDateString()
                                                : f.type === "rating"
                                                    ? "★".repeat(Number(r.data[f.key]))
                                                    : renderCell(f, r.data[f.key], plugin, getRecordsForEntity)}
                                        </div>
                                    ))}
                                </div>
                            ))}
                            {inCol.length === 0 && (
                                <div className="border-2 border-dashed border-border/40 rounded-xl h-16 flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground/50">Drop here</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ---------- Calendar view ---------- */

function pickDateField(entity: EntityDef, view: ViewDef): string | undefined {
    if (view.groupBy) return view.groupBy;
    return entity.fields.find((x) => x.type === "date")?.key;
}

function CalendarView({ entity, view, records, onEdit, accent }: {
    entity: EntityDef; view: ViewDef; records: PluginRecord[];
    onEdit: (r: PluginRecord) => void; accent: string;
}) {
    const key = pickDateField(entity, view);
    const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
    const start = new Date(month);
    const days: Date[] = [];
    const leading = start.getDay();
    for (let i = 0; i < leading; i++) { const d = new Date(start); d.setDate(d.getDate() - (leading - i)); days.push(d); }
    while (days.length < 42) { const last = days[days.length - 1] ?? start; const d = new Date(last); d.setDate(d.getDate() + 1); days.push(d); }
    const todayStr = new Date().toISOString().slice(0, 10);
    const byDay: Record<string, PluginRecord[]> = {};
    records.forEach((r) => {
        const v = key ? (r.data[key] as string) : null;
        if (!v) return;
        const k = new Date(v).toISOString().slice(0, 10);
        (byDay[k] ??= []).push(r);
    });
    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="font-semibold">{month.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
                <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() - 1); setMonth(d); }}>‹</Button>
                    <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setMonth(d); }}>Today</Button>
                    <Button variant="outline" size="sm" onClick={() => { const d = new Date(month); d.setMonth(d.getMonth() + 1); setMonth(d); }}>›</Button>
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {days.map((d) => {
                    const k = d.toISOString().slice(0, 10);
                    const inMonth = d.getMonth() === month.getMonth();
                    const isToday = k === todayStr;
                    const list = byDay[k] ?? [];
                    return (
                        <div key={k} className={`min-h-20 rounded-lg border p-1 text-xs ${inMonth ? "bg-card" : "bg-muted/20 opacity-50"} ${isToday ? "ring-1 ring-primary" : ""}`}>
                            <div className={`text-[10px] font-medium mb-0.5 ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d.getDate()}</div>
                            <div className="space-y-0.5">
                                {list.slice(0, 3).map((r) => (
                                    <button key={r.id} onClick={() => onEdit(r)} className="w-full text-left rounded px-1 py-0.5 truncate text-white text-[10px]"
                                        style={{ background: accent }}>
                                        {String(r.data[entity.titleField] ?? "Untitled")}
                                    </button>
                                ))}
                                {list.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{list.length - 3} more</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

/* ---------- Gallery view ---------- */

function GalleryView({ plugin, entity, records, onEdit, accent }: {
    plugin: PluginManifest; entity: EntityDef; records: PluginRecord[]; onEdit: (r: PluginRecord) => void; accent: string;
}) {
    const { getRecordsForEntity } = usePluginContext()
    const subtitleField = entity.fields.slice(1, 2)[0];
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {records.map((r) => (
                <button key={r.id} onClick={() => onEdit(r)}
                    className="group rounded-2xl overflow-hidden border bg-card text-left hover:shadow-lg transition-all hover:-translate-y-0.5">
                    <div className="aspect-video flex items-center justify-center text-4xl"
                        style={{ background: `linear-gradient(135deg, ${accent}33, ${accent}11)` }}>
                        {entity.icon}
                    </div>
                    <div className="p-3">
                        <div className="font-medium text-sm truncate">{String(r.data[entity.titleField] ?? "Untitled")}</div>
                        {subtitleField && (
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {renderCell(subtitleField, r.data[subtitleField.key], plugin, getRecordsForEntity)}
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}

/* ---------- Timeline view ---------- */

function TimelineView({ plugin, entity, view, records, onEdit, accent }: {
    plugin: PluginManifest; entity: EntityDef; view: ViewDef; records: PluginRecord[]; onEdit: (r: PluginRecord) => void; accent: string;
}) {
    const { getRecordsForEntity } = usePluginContext()
    const key = pickDateField(entity, view);
    const sorted = [...records]
        .map((r) => ({ r, t: key ? new Date(r.data[key] as string).getTime() : +new Date(r.createdAt) }))
        .filter((x) => !Number.isNaN(x.t))
        .sort((a, b) => b.t - a.t);
    return (
        <div className="relative pl-8">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
                {sorted.map(({ r, t }, i) => (
                    <motion.div key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                        className="relative">
                        <div className="absolute -left-5.5 top-3 w-3 h-3 rounded-full ring-2 ring-background" style={{ background: accent }} />
                        <button onClick={() => onEdit(r)} className="block w-full text-left">
                            <Card className="p-3.5 hover:shadow-sm transition">
                                <div className="text-xs text-muted-foreground">{new Date(t).toLocaleString()}</div>
                                <div className="font-medium text-sm mt-0.5">{String(r.data[entity.titleField] ?? "Untitled")}</div>
                                {entity.fields.slice(1, 3).filter((f) => r.data[f.key] != null && r.data[f.key] !== "").map((f) => (
                                    <div key={f.id} className="text-xs text-muted-foreground mt-0.5">
                                        {f.label}: {renderCell(f, r.data[f.key], plugin, getRecordsForEntity)}
                                    </div>
                                ))}
                            </Card>
                        </button>
                    </motion.div>
                ))}
                {sorted.length === 0 && <p className="text-xs text-muted-foreground">No dated records.</p>}
            </div>
        </div>
    );
}

/* ---------- Feed view ---------- */

function FeedView({ entity, records, onEdit, accent }: {
    entity: EntityDef; records: PluginRecord[]; onEdit: (r: PluginRecord) => void; accent: string;
}) {
    const sorted = [...records].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    const longtextField = entity.fields.find((f) => f.type === "longtext");
    const tagsField = entity.fields.find((f) => f.type === "tags");
    return (
        <div className="space-y-3 max-w-2xl">
            {sorted.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                    <Card className="p-5 hover:shadow-md transition cursor-pointer" onClick={() => onEdit(r)}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm" style={{ background: `${accent}22` }}>{entity.icon}</span>
                            <span className="font-medium text-foreground/70">{entity.name}</span>
                            <span>·</span>
                            <span>{new Date(r.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                        </div>
                        <div className="font-semibold text-base">{String(r.data[entity.titleField] ?? "Untitled")}</div>
                        {longtextField && r.data[longtextField.key] != null && r.data[longtextField.key] !== "" && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mt-1.5">
                                {String(r.data[longtextField.key] ?? "")}
                            </p>
                        )}
                        {tagsField && Array.isArray(r.data[tagsField.key]) && (r.data[tagsField.key] as string[]).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {(r.data[tagsField.key] as string[]).map((t) => (
                                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                                ))}
                            </div>
                        )}
                    </Card>
                </motion.div>
            ))}
        </div>
    );
}

/* ---------- Page panel ---------- */

function PagePanel({ plugin, page }: { plugin: PluginManifest; page: PageDef }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-2 border-red-500">
            {page.blocks.map((block) => {
                const span = block.span === 3 ? "md:col-span-3" : block.span === 2 ? "md:col-span-2" : "md:col-span-1";
                return (
                    <div key={block.id} className={span}>
                        <PageBlockRender plugin={plugin} block={block} />
                    </div>
                );
            })}
        </div>
    );
}

function PageBlockRender({ plugin, block }: { plugin: PluginManifest; block: PageBlock }) {
    if (block.kind === "widget" && block.widgetId) {
        const widget = plugin.dashboards.flatMap((d) => d.widgets).find((w) => w.id === block.widgetId);
        return widget ? <Widget plugin={plugin} widget={widget} /> : null;
    }
    if (block.kind === "view" && block.viewId) {
        const view = plugin.views.find((v) => v.id === block.viewId);
        const entity = view && plugin.entities.find((e) => e.id === view.entityId);
        if (!view || !entity) return null;
        return (
            <Card className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">{view.name}</div>
                <EmbeddedView plugin={plugin} entity={entity} />
            </Card>
        );
    }
    if (block.kind === "markdown") {
        return (
            <Card className="p-5">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{block.markdown}</div>
            </Card>
        );
    }
    return null;
}

function EmbeddedView({ plugin, entity }: { plugin: PluginManifest; entity: EntityDef }) {
    const { getRecordsForEntity } = usePluginContext();
    const records = getRecordsForEntity(entity.id);
    const sf = entity.statusField;
    return (
        <div className="text-sm space-y-1">
            {records.slice(0, 5).map((r) => (
                <div key={r.id} className="flex justify-between gap-2 py-1.5 border-b last:border-b-0">
                    <span className="truncate">{String(r.data[entity.titleField] ?? "Untitled")}</span>
                    {sf && r.data[sf] != null && r.data[sf] !== "" && (
                        <Badge variant="outline" className="text-[10px] shrink-0">{String(r.data[sf])}</Badge>
                    )}
                </div>
            ))}
            {records.length === 0 && <p className="text-xs text-muted-foreground">No records yet.</p>}
        </div>
    );
}

/* ---------- Workflows panel ---------- */

function WorkflowsPanel({ plugin }: { plugin: PluginManifest }) {
    if (!plugin.workflows?.length) return (
        <div className="py-12 text-center text-sm text-muted-foreground">No workflows configured.</div>
    );
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                These automations run whenever your data changes. Branches evaluate conditions at runtime against the current record state.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plugin.workflows.map((wf) => {
                    const entity = plugin.entities.find((e) => e.id === wf.entityId);
                    return (
                        <Card key={wf.id} className="overflow-hidden">
                            <div className="h-0.5" style={{ background: wf.enabled === false ? "hsl(var(--muted))" : plugin.accent }} />
                            <div className="p-4 space-y-3">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="font-medium text-sm">{wf.name}</div>
                                    <Badge variant={wf.enabled === false ? "outline" : "secondary"} className="text-[10px] shrink-0">
                                        {wf.enabled === false ? "Off" : "Active"}
                                    </Badge>
                                </div>

                                {/* Trigger pill */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                                        When
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        <strong className="text-foreground font-medium">{entity?.name ?? "record"}</strong>{" "}
                                        {triggerLabel(wf)}
                                    </span>
                                </div>

                                {/* Recursive action tree */}
                                <ActionTreeDisplay actions={wf.actions} entity={entity} depth={0} />
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}

/** Recursively renders a list of WorkflowActions as an indented tree. */
function ActionTreeDisplay({ actions, entity, depth }: {
    actions: WorkflowAction[];
    entity: EntityDef | undefined;
    depth: number;
}) {
    if (!actions.length) {
        return <p className="text-[10px] text-muted-foreground/50 italic ml-1">no actions</p>;
    }
    return (
        <div className={depth > 0 ? "ml-3 pl-2.5 border-l-2 border-dashed border-muted-foreground/20 space-y-1.5" : "space-y-1.5"}>
            {actions.map((a) => (
                <ActionTreeNode key={a.id} action={a} entity={entity} depth={depth} />
            ))}
        </div>
    );
}

function ActionTreeNode({ action, entity, depth }: {
    action: WorkflowAction;
    entity: EntityDef | undefined;
    depth: number;
}) {
    if (action.kind === "branch") {
        const conditions = action.branchConditions ?? [];
        const logic = action.branchConditionLogic ?? "all";

        const condText = conditions.length === 0
            ? "always"
            : conditions
                .map((c: BranchCondition) => {
                    const field = entity?.fields.find((f) => f.key === c.fieldKey);
                    const fieldLabel = field?.label ?? c.fieldKey;
                    const opLabel = OP_LABELS[c.op] ?? c.op;
                    const valPart = ["isEmpty", "isNotEmpty"].includes(c.op) ? "" : ` "${c.value ?? ""}"`;
                    return `${fieldLabel} ${opLabel}${valPart}`;
                })
                .join(logic === "any" ? "  OR  " : "  AND  ");

        const hasThen = (action.thenActions?.length ?? 0) > 0;
        const hasElse = (action.elseActions?.length ?? 0) > 0;

        return (
            <div className="rounded-lg border border-amber-200/70 bg-amber-50/30 dark:bg-amber-950/10 overflow-hidden">
                {/* IF row */}
                <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-100/60 dark:bg-amber-900/20 border-b border-amber-200/40">
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-200 dark:bg-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded shrink-0 mt-0.5 tracking-wide">
                        IF
                    </span>
                    <span className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">{condText}</span>
                </div>

                <div className="p-2 space-y-2">
                    {/* THEN branch */}
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <div className="w-0.5 h-3 bg-emerald-500 rounded-full" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Then</span>
                        </div>
                        {hasThen
                            ? <ActionTreeDisplay actions={action.thenActions!} entity={entity} depth={depth + 1} />
                            : <p className="text-[10px] text-muted-foreground/50 italic ml-3">nothing</p>
                        }
                    </div>

                    {/* ELSE branch — only rendered when it has actions */}
                    {hasElse && (
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <div className="w-0.5 h-3 bg-slate-400 rounded-full" />
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Else</span>
                            </div>
                            <ActionTreeDisplay actions={action.elseActions!} entity={entity} depth={depth + 1} />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* Plain action */
    return (
        <div className="flex items-start gap-2 text-xs">
            <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0 mt-0.5">→</span>
            <span className="text-muted-foreground leading-snug">{actionLabel(action)}</span>
        </div>
    );
}

function triggerLabel(wf: WorkflowDef): string {
    switch (wf.trigger) {
        case "onCreate": return "is created";
        case "onUpdate": return "is updated";
        case "onDelete": return "is deleted";
        case "onFieldEquals": return `'s "${wf.whenField ?? "field"}" becomes "${wf.whenValue ?? ""}"`;
        default: return "";
    }
}

function actionLabel(a: { kind: string; fieldKey?: string; value?: unknown; sourceFieldKey?: string; message?: string }): string {
    switch (a.kind) {
        case "setField": return `Set "${a.fieldKey}" = ${a.value != null ? `"${a.value}"` : "(empty)"}`;
        case "increment": return `Increment "${a.fieldKey}" by ${a.value ?? 1}`;
        case "stampDate": return `Stamp "${a.fieldKey}" with today's date`;
        case "clearField": return `Clear "${a.fieldKey}"`;
        case "copyField": return `Copy "${a.sourceFieldKey}" → "${a.fieldKey}"`;
        case "notify": return `Notify: "${a.message ?? ""}"`;
        case "branch": return "Branch (IF / THEN / ELSE)";
        default: return String(a.kind);
    }
}

/* ---------- Charts ---------- */

function ChartBody({ widget, records, accent }: { widget: WidgetDef; records: PluginRecord[]; accent: string }) {
    const key = widget.fieldKey ?? "";
    const groups: Record<string, number> = {};
    records.forEach((r) => { const k = String(r.data[key] ?? "—"); groups[k] = (groups[k] ?? 0) + 1; });
    const data = Object.entries(groups).map(([name, value]) => ({ name, value }));
    if (data.length === 0) return <p className="text-xs text-muted-foreground py-4">No data yet.</p>;
    const gradId = `g-${widget.id}`;

    if (widget.chartKind === "pie") {
        return (
            <div className="flex items-center gap-4">
                <div className="w-28 h-28 shrink-0">
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={data} dataKey="value" nameKey="name" innerRadius={28} outerRadius={48} paddingAngle={3} stroke="hsl(var(--background))" strokeWidth={2}>
                                {data.map((_, i) => <Cell key={i} fill={shade(accent, i)} />)}
                            </Pie>
                            <RTooltip contentStyle={tooltipStyle} cursor={false} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <ul className="text-xs space-y-1 flex-1 min-w-0">
                    {data.map((d, i) => (
                        <li key={d.name} className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: shade(accent, i) }} />
                            <span className="truncate">{d.name}</span>
                            <span className="text-muted-foreground tabular-nums ml-auto">{d.value}</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }
    if (widget.chartKind === "area" || widget.chartKind === "line") {
        return (
            <div className="h-28 -mx-2">
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                                <stop offset="100%" stopColor={accent} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" hide />
                        <YAxis hide />
                        <RTooltip contentStyle={tooltipStyle} cursor={{ stroke: accent, strokeOpacity: 0.2 }} />
                        <Area type="monotone" dataKey="value" stroke={accent} strokeWidth={2} fill={`url(#${gradId})`} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }
    return (
        <div className="h-28 -mx-2">
            <ResponsiveContainer>
                <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={accent} stopOpacity={1} />
                            <stop offset="100%" stopColor={accent} stopOpacity={0.4} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <RTooltip contentStyle={tooltipStyle} cursor={{ fill: `${accent}11` }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={`url(#${gradId})`} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

const tooltipStyle: React.CSSProperties = {
    background: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 10,
    fontSize: 12,
    padding: "6px 10px",
    boxShadow: "0 6px 20px -8px rgba(0,0,0,0.2)",
};

function buildSparkline(records: PluginRecord[], days: number) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Array.from({ length: days }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - (days - 1 - i));
        const key = d.toISOString().slice(0, 10);
        return { name: key, value: records.filter((r) => r.updatedAt.slice(0, 10) === key).length };
    });
}

function Sparkline({ data, color }: { data: { name: string; value: number }[]; color: string }) {
    const id = useMemo(() => `s-${Math.random().toString(36).slice(2, 8)}`, []);
    return (
        <ResponsiveContainer>
            <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${id})`} isAnimationActive={false} />
            </AreaChart>
        </ResponsiveContainer>
    );
}

function RingProgress({ value, label, color }: { value: number; label: string; color: string }) {
    const r = 32, c = 2 * Math.PI * r;
    const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
    return (
        <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
                <svg viewBox="0 0 80 80" className="-rotate-90">
                    <circle cx="40" cy="40" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <motion.circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 0.8, ease: "easeOut" }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">{value}%</div>
            </div>
            <div>
                <div className="font-medium text-sm tabular-nums">{label}</div>
                <div className="text-xs text-muted-foreground">Toward goal</div>
            </div>
        </div>
    );
}

function HeatStrip({ days, accent }: { days: Set<string>; accent: string }) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cells = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - (29 - i));
        const key = d.toISOString().slice(0, 10);
        return { key, on: days.has(key) };
    });
    return (
        <div className="flex gap-1">
            {cells.map((c) => (
                <div key={c.key} title={c.key} className="flex-1 h-5 rounded transition-transform hover:scale-110"
                    style={{ background: c.on ? accent : "hsl(var(--muted))", boxShadow: c.on ? `0 0 0 1px ${accent}33` : undefined }} />
            ))}
        </div>
    );
}

function shade(hex: string, i: number): string {
    const ops = [1, 0.72, 0.52, 0.38, 0.82, 0.60];
    const a = ops[i % ops.length];
    return `${hex}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
}