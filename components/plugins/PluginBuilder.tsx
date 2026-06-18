'use client';
import { useState } from "react";
import { ChevronDown, ChevronUp, GitBranch, Plus, Sparkles, Trash2, Wand2, Workflow, Database, Palette, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { installPlugin } from "@/lib/plugins/registry";
import type {
    BranchCondition, EntityDef, FieldDef, FieldType, FilterOp,
    PluginManifest, ViewDef, WidgetDef, WorkflowDef, WorkflowAction,
} from "@/lib/plugins/types";
import { toast } from "sonner";

/* ---------- Shared filter operator labels ---------- */

const OP_LABELS: Record<FilterOp, string> = {
    eq: "equals", neq: "not equals", gt: ">", gte: "≥",
    lt: "<", lte: "≤", contains: "contains", notContains: "doesn't contain",
    isEmpty: "is empty", isNotEmpty: "is not empty",
};

const MAX_BRANCH_DEPTH = 4;

/* ---------- Field type groups ---------- */

const FIELD_TYPE_GROUPS: { label: string; items: { value: FieldType; label: string; hint: string }[] }[] = [
    {
        label: "Basic",
        items: [
            { value: "text", label: "Text", hint: "Short single-line text" },
            { value: "longtext", label: "Long text", hint: "Multi-line notes" },
            { value: "number", label: "Number", hint: "Plain number" },
            { value: "checkbox", label: "Checkbox", hint: "True / false toggle" },
            { value: "date", label: "Date", hint: "Calendar date" },
        ],
    },
    {
        label: "Choices",
        items: [
            { value: "select", label: "Single select", hint: "Pick one option (enables boards)" },
            { value: "multiselect", label: "Multi select", hint: "Pick many options" },
            { value: "tags", label: "Tags", hint: "Free-form chips" },
        ],
    },
    {
        label: "Rich",
        items: [
            { value: "rating", label: "Rating", hint: "Star rating (1–N)" },
            { value: "progress", label: "Progress", hint: "0–100 slider" },
            { value: "currency", label: "Currency", hint: "Money amount" },
            { value: "url", label: "Link", hint: "Web URL" },
            { value: "email", label: "Email", hint: "Email address" },
            { value: "color", label: "Color", hint: "Color swatch" },
            { value: "formula", label: "Formula", hint: "Computed read-only value" },
        ],
    },
    {
        label: "Connections",
        items: [
            { value: "relation", label: "Link to another object", hint: "Pick a record from another table" },
        ],
    },
];

const ACCENTS = [
    "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b",
    "#ef4444", "#ec4899", "#6366f1", "#14b8a6",
    "#f97316", "#84cc16",
];

const EMOJI = [
    "✨", "📦", "💼", "🔬", "📚", "💪", "💰", "🎯", "📅", "🗂️",
    "🧠", "🛠️", "🧑", "🎨", "🚀", "🌱", "☕", "🎵", "📓", "🌍",
    "🏆", "💡", "📊", "🔑", "🎬", "🍎", "🧘", "✅", "🔥", "🐛",
];

/* ---------- Templates ---------- */

type Template = { id: string; name: string; icon: string; blurb: string; build: () => EntityDef[] };

const TEMPLATES: Template[] = [
    { id: "blank", name: "Blank", icon: "✨", blurb: "Start from scratch", build: () => [blankEntity()] },
    { id: "tasks", name: "Tasks", icon: "✅", blurb: "Title, status, due date — kanban-ready", build: () => [taskEntity()] },
    { id: "tracker", name: "Habit tracker", icon: "🔥", blurb: "Daily check-ins with streaks", build: () => [habitEntity()] },
    { id: "crm", name: "Mini CRM", icon: "🧑", blurb: "Contacts + deals in one place", build: () => [contactEntity(), dealEntity()] },
    { id: "library", name: "Library", icon: "📚", blurb: "Catalog items with ratings & tags", build: () => [libraryEntity()] },
    { id: "journal", name: "Journal", icon: "📓", blurb: "Dated entries with mood & tags", build: () => [journalEntity()] },
    { id: "inventory", name: "Inventory", icon: "📦", blurb: "Track stock with quantity & value formulas", build: () => [inventoryEntity()] },
    { id: "ideas", name: "Idea board", icon: "💡", blurb: "Capture, rate, and prioritize ideas", build: () => [ideaEntity()] },
];

interface Props { onCreated?: (m: PluginManifest) => void }

export default function PluginBuilder({ onCreated }: Props) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState("identity");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [icon, setIcon] = useState("✨");
    const [customEmoji, setCustomEmoji] = useState("");
    const [accent, setAccent] = useState("#8b5cf6");
    const [category, setCategory] = useState<PluginManifest["category"]>("productivity");
    const [entities, setEntities] = useState<EntityDef[]>([blankEntity()]);
    const [workflows, setWorkflows] = useState<WorkflowDef[]>([]);
    const [activeTemplate, setActiveTemplate] = useState("blank");

    function reset() {
        setName(""); setDescription(""); setIcon("✨"); setCustomEmoji(""); setAccent("#8b5cf6");
        setCategory("productivity"); setEntities([blankEntity()]); setWorkflows([]);
        setActiveTemplate("blank"); setTab("identity");
    }

    function applyTemplate(t: Template) {
        setActiveTemplate(t.id);
        setIcon(t.icon);
        setEntities(t.build());
        if (t.name !== "Blank" && !name) setName(t.name);
    }

    function save() {
        if (!name.trim()) { toast.error("Give your plugin a name"); setTab("identity"); return; }
        if (entities.some((e) => !e.name.trim() || e.fields.length === 0)) {
            toast.error("Each object needs a name and at least one field"); setTab("data"); return;
        }

        const autoViews = entities.flatMap<ViewDef>((e) => {
            const list: ViewDef[] = [
                { id: crypto.randomUUID(), name: "Grid", entityId: e.id, kind: "grid" },
                { id: crypto.randomUUID(), name: "Table", entityId: e.id, kind: "table" },
                { id: crypto.randomUUID(), name: "List", entityId: e.id, kind: "list" },
            ];
            if (e.statusField) list.push({ id: crypto.randomUUID(), name: "Board", entityId: e.id, kind: "kanban", groupBy: e.statusField });
            if (e.fields.some((f) => f.type === "date")) list.push({ id: crypto.randomUUID(), name: "Calendar", entityId: e.id, kind: "calendar" });
            list.push({ id: crypto.randomUUID(), name: "Gallery", entityId: e.id, kind: "gallery" });
            list.push({ id: crypto.randomUUID(), name: "Timeline", entityId: e.id, kind: "timeline" });
            return list;
        });

        const autoWidgets = entities.flatMap<WidgetDef>((e) => {
            const ws: WidgetDef[] = [
                { id: crypto.randomUUID(), title: `Total ${e.plural}`, kind: "kpi", entityId: e.id, accent, comparePeriodDays: 7 },
            ];
            if (e.statusField) {
                ws.push({ id: crypto.randomUUID(), title: `${e.plural} by status`, kind: "chart", chartKind: "pie", entityId: e.id, fieldKey: e.statusField, accent });
                ws.push({ id: crypto.randomUUID(), title: `${e.plural} pipeline`, kind: "byStatus", entityId: e.id, fieldKey: e.statusField, accent });
            }
            const dateF = e.fields.find((f) => f.type === "date");
            if (dateF) ws.push({ id: crypto.randomUUID(), title: `Upcoming ${e.plural}`, kind: "upcoming", entityId: e.id, fieldKey: dateF.key });
            const numF = e.fields.find((f) => f.type === "number" || f.type === "currency");
            if (numF) ws.push({ id: crypto.randomUUID(), title: `Total ${numF.label}`, kind: "sum", entityId: e.id, fieldKey: numF.key, accent });
            ws.push({ id: crypto.randomUUID(), title: `Recent ${e.plural}`, kind: "recent", entityId: e.id });
            return ws;
        });

        const finalIcon = customEmoji.trim() || icon;

        // Enrich each entity: if it has a statusField, generate a `statuses` array
        // from that field's options so the kanban always shows all columns.
        const enrichedEntities = entities.map((e) => {
            if (!e.statusField) return e;
            const sf = e.fields.find((f) => f.key === e.statusField);
            if (!sf?.options?.length) return e;
            const PALETTE = ["slate", "sky", "amber", "emerald", "violet", "rose", "orange", "indigo"];
            const statuses = sf.options.map((opt, i) => ({
                id: opt,
                label: opt.charAt(0).toUpperCase() + opt.slice(1).replace(/-/g, " "),
                color: PALETTE[i % PALETTE.length],
            }));
            return { ...e, statuses };
        });

        const manifest: PluginManifest = {
            id: crypto.randomUUID(),
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            name: name.trim(),
            version: "1.0.0",
            description: description.trim() || `${name.trim()} — custom plugin`,
            icon: finalIcon,
            accent,
            category,
            entities: enrichedEntities,
            views: autoViews,
            dashboards: [{ id: crypto.randomUUID(), name: "Overview", widgets: autoWidgets }],
            workflows,
        };
        installPlugin(manifest);
        toast.success(`${manifest.name} installed`);
        setOpen(false);
        reset();
        onCreated?.(manifest);
    }

    const totalFields = entities.reduce((s, e) => s + e.fields.length, 0);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="rounded-full shadow-sm">
                    <Sparkles className="w-4 h-4" /> Build a plugin
                </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-3xl! max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-0 gap-0 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
                {/* Dialog header strip */}
                <div className="p-4 sm:p-6 pb-4 sm:pb-5 border-b" style={{ background: `linear-gradient(135deg, ${accent}1f, transparent 70%)` }}>
                    <DialogHeader className="space-y-1">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            <Wand2 className="w-3 h-3" /> Plugin Studio
                        </div>
                        <DialogTitle className="text-2xl tracking-tight">{name || "Build something amazing"}</DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Pick a template, shape your data, add automations. Views, charts and dashboards are generated automatically.
                        </p>
                    </DialogHeader>
                </div>

                <div className="p-1 sm:p-6">
                    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
                        <TabsList className="rounded-full p-1 h-auto bg-muted/60">
                            <TabsTrigger value="identity" className="rounded-full sm:px-4 py-1.5 text-xs sm:gap-1.5">
                                <Palette className="w-3.5 h-3.5" /> Identity
                            </TabsTrigger>
                            <TabsTrigger value="data" className="rounded-full sm:px-4 py-1.5 text-xs sm:gap-1.5">
                                <Database className="w-3.5 h-3.5" /> Data <Badge variant="secondary" className="sm:ml-1 text-[10px]">{totalFields}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="workflows" className="rounded-full sm:px-4 py-1.5 text-xs sm:gap-1.5">
                                <Workflow className="w-3.5 h-3.5" /> Workflow
                                {workflows.length > 0 && <Badge variant="secondary" className="sm:ml-1 text-[10px]">{workflows.length}</Badge>}
                            </TabsTrigger>
                        </TabsList>

                        {/* ---- Identity ---- */}
                        <TabsContent value="identity" className="space-y-6 mt-0">
                            <section className="space-y-3">
                                <Label className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Start from a template</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {TEMPLATES.map((t) => (
                                        <button key={t.id} type="button" onClick={() => applyTemplate(t)}
                                            className={`text-left p-3 rounded-2xl border transition ${activeTemplate === t.id
                                                ? "border-foreground/40 bg-foreground/5 shadow-sm"
                                                : "border-border/60 hover:border-foreground/20 hover:bg-muted/40"}`}>
                                            <div className="text-xl mb-1">{t.icon}</div>
                                            <div className="text-xs font-medium">{t.name}</div>
                                            <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{t.blurb}</div>
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Plugin name *</Label>
                                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My amazing plugin" className="rounded-xl" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Category</Label>
                                    <Select value={category} onValueChange={(v) => setCategory(v as PluginManifest["category"])}>
                                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {(["productivity", "personal", "work", "creative", "fitness", "finance", "research"] as const).map((c) => (
                                                <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label className="text-xs">Description</Label>
                                    <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)}
                                        placeholder="One-line pitch for what this plugin does…" className="rounded-xl resize-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Accent color</Label>
                                    <div className="flex gap-2 flex-wrap items-center">
                                        {ACCENTS.map((c) => (
                                            <button key={c} type="button" onClick={() => setAccent(c)} style={{ background: c }} aria-label={c}
                                                className={`w-6 h-6 rounded-full transition ${accent === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : "hover:scale-110"}`} />
                                        ))}
                                        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)}
                                            className="w-6 h-6 rounded-full border cursor-pointer" title="Custom color" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Icon</Label>
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap gap-1">
                                            {EMOJI.map((e) => (
                                                <button key={e} type="button" onClick={() => { setIcon(e); setCustomEmoji(""); }}
                                                    className={`w-8 h-8 rounded-lg text-base transition ${(customEmoji || icon) === e ? "bg-foreground/10 ring-1 ring-foreground/20" : "hover:bg-muted"}`}>
                                                    {e}
                                                </button>
                                            ))}
                                        </div>
                                        <Input
                                            value={customEmoji}
                                            onChange={(e) => setCustomEmoji(e.target.value)}
                                            placeholder="Or type any emoji / text…"
                                            className="rounded-lg h-8 text-xs w-52"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ---- Data ---- */}
                        <TabsContent value="data" className="space-y-3 mt-0">
                            {entities.map((e, idx) => (
                                <EntityEditor key={e.id} entity={e} accent={accent} allEntities={entities}
                                    onChange={(next) => setEntities((arr) => arr.map((x, i) => i === idx ? next : x))}
                                    onRemove={entities.length > 1 ? () => setEntities((arr) => arr.filter((_, i) => i !== idx)) : undefined}
                                />
                            ))}
                            <Button variant="outline" className="rounded-full" onClick={() => setEntities([...entities, blankEntity()])}>
                                <Plus className="w-4 h-4" /> Add another object
                            </Button>
                        </TabsContent>

                        {/* ---- Workflows ---- */}
                        <TabsContent value="workflows" className="space-y-3 mt-0">
                            <p className="text-xs text-muted-foreground">
                                Automations react to data changes — set fields, stamp dates, send notifications, and more.
                            </p>
                            {workflows.length === 0 && (
                                <Card className="border-dashed bg-muted/20">
                                    <CardContent className="py-8 text-center space-y-2">
                                        <Workflow className="w-6 h-6 mx-auto text-muted-foreground/50" />
                                        <p className="text-sm text-muted-foreground">No workflows yet — totally optional.</p>
                                    </CardContent>
                                </Card>
                            )}
                            {workflows.map((wf, i) => (
                                <WorkflowEditor key={wf.id} workflow={wf} entities={entities}
                                    onChange={(next) => setWorkflows((a) => a.map((x, j) => j === i ? next : x))}
                                    onRemove={() => setWorkflows((a) => a.filter((_, j) => j !== i))}
                                />
                            ))}
                            <Button variant="outline" size="sm" className="rounded-full"
                                onClick={() => setWorkflows([...workflows, {
                                    id: crypto.randomUUID(), name: "New workflow",
                                    entityId: entities[0]?.id ?? "", trigger: "onCreate",
                                    actions: [{ id: crypto.randomUUID(), kind: "stampDate", fieldKey: entities[0]?.fields.find((f) => f.type === "date")?.key }],
                                    enabled: true,
                                }])}>
                                <Plus className="w-4 h-4" /> Add workflow
                            </Button>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t bg-muted/20">
                    <div className="text-xs text-muted-foreground">
                        {entities.length} object{entities.length !== 1 ? "s" : ""} · {totalFields} field{totalFields !== 1 ? "s" : ""} · {workflows.length} workflow{workflows.length !== 1 ? "s" : ""}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button onClick={save} className="rounded-full px-5" style={{ background: accent, color: "white" }}>
                            <Sparkles className="w-4 h-4" /> Install plugin
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/* ---------- Entity editor ---------- */

function EntityEditor({ entity, onChange, onRemove, accent, allEntities }: {
    entity: EntityDef; onChange: (e: EntityDef) => void;
    onRemove?: () => void; accent: string; allEntities: EntityDef[];
}) {
    const [collapsed, setCollapsed] = useState(false);
    const set = <K extends keyof EntityDef>(k: K, v: EntityDef[K]) => onChange({ ...entity, [k]: v });

    const addField = () => {
        const id = crypto.randomUUID();
        set("fields", [...entity.fields, { id, key: `field_${entity.fields.length + 1}`, label: "New field", type: "text" }]);
    };

    const updateField = (id: string, patch: Partial<FieldDef>) => {
        const updated = entity.fields.map((f) => f.id === id ? { ...f, ...patch } : f);
        // If the statusField's key was renamed, follow it
        if (patch.key !== undefined && entity.statusField) {
            const oldKey = entity.fields.find((f) => f.id === id)?.key;
            if (oldKey === entity.statusField) {
                onChange({ ...entity, fields: updated, statusField: patch.key });
                return;
            }
        }
        set("fields", updated);
    };

    const removeField = (id: string) => {
        const removed = entity.fields.find((f) => f.id === id);
        const nextFields = entity.fields.filter((f) => f.id !== id);
        // Clear statusField if the removed field was it
        if (removed && removed.key === entity.statusField) {
            onChange({ ...entity, fields: nextFields, statusField: undefined });
        } else {
            set("fields", nextFields);
        }
    };

    const moveField = (id: string, dir: -1 | 1) => {
        const idx = entity.fields.findIndex((f) => f.id === id);
        if (idx < 0) return;
        const next = [...entity.fields];
        const target = idx + dir;
        if (target < 0 || target >= next.length) return;
        [next[idx], next[target]] = [next[target], next[idx]];
        set("fields", next);
    };

    const selectFields = entity.fields.filter((f) => f.type === "select" || f.type === "multiselect");

    return (
        <Card className="overflow-hidden border-border/60">
            <div className="h-0.5" style={{ background: accent }} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4 cursor-pointer" onClick={() => setCollapsed((c) => !c)}>
                <CardTitle className="text-sm flex items-center gap-2 font-medium">
                    <span className="text-base leading-none">{entity.icon}</span>
                    <span>{entity.plural || entity.name || "New object"}</span>
                    <Badge variant="outline" className="text-[10px]">{entity.fields.length} fields</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                    {onRemove && (
                        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
                            className="text-[11px] text-muted-foreground hover:text-destructive">Remove</button>
                    )}
                    {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                </div>
            </CardHeader>

            {!collapsed && (
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Singular name</Label>
                            <Input value={entity.name} onChange={(e) => set("name", e.target.value)} placeholder="Task" className="rounded-lg" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Plural name</Label>
                            <Input value={entity.plural} onChange={(e) => set("plural", e.target.value)} placeholder="Tasks" className="rounded-lg" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Title field</Label>
                            <Select value={entity.titleField} onValueChange={(v) => set("titleField", v)}>
                                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {entity.fields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {selectFields.length > 0 && (
                        <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Status field <span className="opacity-60">(unlocks kanban board)</span></Label>
                            <Select value={entity.statusField ?? "__none"} onValueChange={(v) => set("statusField", v === "__none" ? undefined : v)}>
                                <SelectTrigger className="rounded-lg"><SelectValue placeholder="None" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__none">None</SelectItem>
                                    {selectFields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Fields</Label>
                        <div className="space-y-2">
                            {entity.fields.map((f, idx) => (
                                <FieldRow key={f.id} field={f} index={idx} total={entity.fields.length}
                                    allEntities={allEntities}
                                    onChange={(patch) => updateField(f.id, patch)}
                                    onRemove={() => removeField(f.id)}
                                    onMove={(dir) => moveField(f.id, dir)}
                                />
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" className="rounded-full" onClick={addField}>
                            <Plus className="w-4 h-4" /> Add field
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

/* ---------- Field row ---------- */

function FieldRow({ field, index, total, allEntities, onChange, onRemove, onMove }: {
    field: FieldDef; index: number; total: number;
    allEntities: EntityDef[];
    onChange: (patch: Partial<FieldDef>) => void;
    onRemove: () => void;
    onMove: (dir: -1 | 1) => void;
}) {
    const needsOptions = field.type === "select" || field.type === "multiselect" || field.type === "tags";
    const needsRelation = field.type === "relation";
    const needsFormula = field.type === "formula";
    const needsMax = field.type === "rating";

    // Local raw text state so commas can be typed without being eaten on every keystroke
    const [optionsRaw, setOptionsRaw] = useState<string | null>(null);
    const displayOptions = optionsRaw ?? (field.options ?? []).join(", ");

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => onMove(-1)} disabled={index === 0} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20">
                        <ChevronUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20">
                        <ChevronDown className="w-3 h-3" />
                    </button>
                </div>
                <Input
                    value={field.label}
                    onChange={(e) => onChange({
                        label: e.target.value,
                        key: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_") || field.key,
                    })}
                    placeholder="Field label"
                    className="rounded-lg flex-1 min-w-28 h-8 text-sm"
                />
                <Select value={field.type} onValueChange={(v) => {
                    const newType = v as FieldType;
                    const keepOptions = (field.type === "select" || field.type === "multiselect" || field.type === "tags") &&
                        (newType === "select" || newType === "multiselect" || newType === "tags");
                    onChange({ type: newType, options: keepOptions ? field.options : undefined, formula: undefined });
                }}>
                    <SelectTrigger className="rounded-lg w-full sm:w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {FIELD_TYPE_GROUPS.map((g) => (
                            <div key={g.label}>
                                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{g.label}</div>
                                {g.items.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        <span className="font-medium">{t.label}</span>
                                    </SelectItem>
                                ))}
                            </div>
                        ))}
                    </SelectContent>
                </Select>
                <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Sub-options */}
            {needsOptions && (
                <div className="ml-8">
                    <Input
                        value={displayOptions}
                        onChange={(e) => setOptionsRaw(e.target.value)}
                        onBlur={() => {
                            const parsed = (optionsRaw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                            onChange({ options: parsed });
                            setOptionsRaw(null);
                        }}
                        placeholder="Comma-separated options · e.g. Todo, Doing, Done"
                        className="rounded-lg h-7 text-xs"
                    />
                </div>
            )}
            {needsRelation && (
                <div className="ml-8">
                    <Select value={field.relationEntityId ?? ""} onValueChange={(v) => onChange({ relationEntityId: v })}>
                        <SelectTrigger className="rounded-lg h-7 text-xs"><SelectValue placeholder="Links to table…" /></SelectTrigger>
                        <SelectContent>
                            {allEntities.map((e) => <SelectItem key={e.id} value={e.id}>{e.plural}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {needsFormula && (
                <div className="ml-8 space-y-1">
                    <Input
                        value={field.formula ?? ""}
                        onChange={(e) => onChange({ formula: e.target.value })}
                        placeholder="e.g. {{price}} * {{qty}} or IF({{done}}, 1, 0)"
                        className="rounded-lg h-7 text-xs font-mono"
                    />
                    <div className="flex gap-2">
                        <Input value={field.prefix ?? ""} onChange={(e) => onChange({ prefix: e.target.value })} placeholder="Prefix ($)" className="rounded-lg h-7 text-xs w-24" />
                        <Input value={field.suffix ?? ""} onChange={(e) => onChange({ suffix: e.target.value })} placeholder="Suffix (kg)" className="rounded-lg h-7 text-xs w-24" />
                    </div>
                </div>
            )}
            {needsMax && (
                <div className="ml-8">
                    <Input type="number" min={2} max={10}
                        value={field.max ?? 5}
                        onChange={(e) => onChange({ max: Math.max(2, Math.min(10, Number(e.target.value))) })}
                        className="rounded-lg h-7 text-xs w-20"
                    />
                    <span className="text-[10px] text-muted-foreground ml-2">max stars</span>
                </div>
            )}
        </div>
    );
}

/* ---------- Workflow editor ---------- */

function WorkflowEditor({ workflow, entities, onChange, onRemove }: {
    workflow: WorkflowDef; entities: EntityDef[];
    onChange: (next: WorkflowDef) => void; onRemove: () => void;
}) {
    const entity = entities.find((e) => e.id === workflow.entityId) ?? entities[0];
    const fields = entity?.fields ?? [];
    const set = <K extends keyof WorkflowDef>(k: K, v: WorkflowDef[K]) => onChange({ ...workflow, [k]: v });

    return (
        <Card className="overflow-hidden border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <Input value={workflow.name} onChange={(e) => set("name", e.target.value)}
                    className="h-7 rounded-lg max-w-xs text-sm font-medium" />
                <button onClick={onRemove} className="text-xs text-muted-foreground hover:text-destructive">Remove</button>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Object</Label>
                        <Select value={workflow.entityId} onValueChange={(v) => set("entityId", v)}>
                            <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.plural}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Trigger</Label>
                        <Select value={workflow.trigger} onValueChange={(v) => set("trigger", v as WorkflowDef["trigger"])}>
                            <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="onCreate">Record is created</SelectItem>
                                <SelectItem value="onUpdate">Record is updated</SelectItem>
                                <SelectItem value="onDelete">Record is deleted</SelectItem>
                                <SelectItem value="onFieldEquals">Field equals value</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">State</Label>
                        <Select value={workflow.enabled === false ? "off" : "on"} onValueChange={(v) => set("enabled", v === "on")}>
                            <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="on">Active</SelectItem>
                                <SelectItem value="off">Disabled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {workflow.trigger === "onFieldEquals" && (
                    <div className="grid grid-cols-2 gap-2">
                        <Select value={workflow.whenField ?? ""} onValueChange={(v) => set("whenField", v)}>
                            <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue placeholder="Field" /></SelectTrigger>
                            <SelectContent>{fields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                        </Select>
                        {(() => {
                            const wf = fields.find((f) => f.key === workflow.whenField);
                            if (wf?.type === "select") {
                                return (
                                    <Select value={workflow.whenValue ?? ""} onValueChange={(v) => set("whenValue", v)}>
                                        <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue placeholder="Value" /></SelectTrigger>
                                        <SelectContent>{(wf.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                    </Select>
                                );
                            }
                            return (
                                <Input value={workflow.whenValue ?? ""} onChange={(e) => set("whenValue", e.target.value)}
                                    placeholder="equals…" className="rounded-lg h-8 text-xs" />
                            );
                        })()}
                    </div>
                )}

                <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Then do</Label>
                    <ActionList
                        actions={workflow.actions}
                        fields={fields}
                        entities={entities}
                        onChange={(actions) => set("actions", actions)}
                        depth={0}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

/* ─────────────────────────────────────────────────────────────────────────
   Recursive action tree — ActionList → ActionRow → SimpleActionRow
                                                   └─ BranchActionRow
                                                        ├─ ActionList (thenActions)
                                                        └─ ActionList (elseActions)
───────────────────────────────────────────────────────────────────────── */

function makeBlankAction(fields: FieldDef[]): WorkflowAction {
    return { id: crypto.randomUUID(), kind: "setField", fieldKey: fields[0]?.key };
}

function makeBranchAction(fields: FieldDef[]): WorkflowAction {
    return {
        id: crypto.randomUUID(),
        kind: "branch",
        branchConditions: [{
            id: crypto.randomUUID(),
            fieldKey: fields[0]?.key ?? "",
            op: "eq",
            value: "",
        }],
        branchConditionLogic: "all",
        thenActions: [makeBlankAction(fields)],
        elseActions: [],
    };
}

function ActionList({ actions, fields, entities, onChange, depth }: {
    actions: WorkflowAction[];
    fields: FieldDef[];
    entities: EntityDef[];
    onChange: (actions: WorkflowAction[]) => void;
    depth: number;
}) {
    const update = (id: string, next: WorkflowAction) =>
        onChange(actions.map((a) => a.id === id ? next : a));
    const remove = (id: string) =>
        onChange(actions.filter((a) => a.id !== id));

    return (
        <div className="space-y-2">
            {actions.map((a) => (
                <ActionRow
                    key={a.id}
                    action={a}
                    fields={fields}
                    entities={entities}
                    depth={depth}
                    onChange={(next) => update(a.id, next)}
                    onRemove={() => remove(a.id)}
                />
            ))}
            <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-full h-7 text-xs"
                    onClick={() => onChange([...actions, makeBlankAction(fields)])}>
                    <Plus className="w-3 h-3" /> Add action
                </Button>
                {depth < MAX_BRANCH_DEPTH && (
                    <Button variant="ghost" size="sm"
                        className="rounded-full h-7 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        onClick={() => onChange([...actions, makeBranchAction(fields)])}>
                        <GitBranch className="w-3 h-3" /> Add branch
                    </Button>
                )}
            </div>
        </div>
    );
}

function ActionRow({ action, fields, entities, depth, onChange, onRemove }: {
    action: WorkflowAction;
    fields: FieldDef[];
    entities: EntityDef[];
    depth: number;
    onChange: (a: WorkflowAction) => void;
    onRemove: () => void;
}) {
    if (action.kind === "branch") {
        return (
            <BranchActionRow
                action={action}
                fields={fields}
                entities={entities}
                depth={depth}
                onChange={onChange}
                onRemove={onRemove}
            />
        );
    }
    return <SimpleActionRow action={action} fields={fields} onChange={onChange} onRemove={onRemove} />;
}

function SimpleActionRow({ action, fields, onChange, onRemove }: {
    action: WorkflowAction;
    fields: FieldDef[];
    onChange: (a: WorkflowAction) => void;
    onRemove: () => void;
}) {
    const selectFields = fields.filter((f) => f.type === "select");
    const up = (patch: Partial<WorkflowAction>) => onChange({ ...action, ...patch });

    return (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
            <Select value={action.kind} onValueChange={(v) => up({ kind: v as WorkflowAction["kind"] })}>
                <SelectTrigger className="rounded-md h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="setField">Set field</SelectItem>
                    <SelectItem value="increment">Increment</SelectItem>
                    <SelectItem value="stampDate">Stamp date</SelectItem>
                    <SelectItem value="clearField">Clear field</SelectItem>
                    <SelectItem value="copyField">Copy field</SelectItem>
                    <SelectItem value="notify">Send notification</SelectItem>
                </SelectContent>
            </Select>

            {action.kind !== "notify" && (
                <Select value={action.fieldKey ?? ""} onValueChange={(v) => up({ fieldKey: v })}>
                    <SelectTrigger className="rounded-md h-7 text-xs w-32"><SelectValue placeholder="Field" /></SelectTrigger>
                    <SelectContent>{fields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
            )}

            {action.kind === "stampDate" && <span className="text-xs text-muted-foreground italic">→ today</span>}
            {action.kind === "clearField" && <span className="text-xs text-muted-foreground italic">→ clears value</span>}

            {action.kind === "copyField" && (
                <Select value={action.sourceFieldKey ?? ""} onValueChange={(v) => up({ sourceFieldKey: v })}>
                    <SelectTrigger className="rounded-md h-7 text-xs w-32"><SelectValue placeholder="From field" /></SelectTrigger>
                    <SelectContent>{fields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
            )}

            {action.kind === "setField" && (() => {
                const sf = selectFields.find((f) => f.key === action.fieldKey);
                return sf ? (
                    <Select value={String(action.value ?? "")} onValueChange={(v) => up({ value: v })}>
                        <SelectTrigger className="rounded-md h-7 text-xs w-28"><SelectValue placeholder="Value" /></SelectTrigger>
                        <SelectContent>{(sf.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                ) : (
                    <Input value={String(action.value ?? "")} onChange={(e) => up({ value: e.target.value })}
                        placeholder="Value" className="rounded-md h-7 text-xs w-28" />
                );
            })()}

            {action.kind === "increment" && (
                <Input type="number" value={String(action.value ?? 1)}
                    onChange={(e) => up({ value: Number(e.target.value) })}
                    placeholder="Amount" className="rounded-md h-7 text-xs w-20" />
            )}

            {action.kind === "notify" && (
                <Input value={String(action.message ?? "")} onChange={(e) => up({ message: e.target.value })}
                    placeholder="Message — supports {{field}}" className="rounded-md h-7 text-xs flex-1 min-w-40" />
            )}

            <button onClick={onRemove} className="p-1.5 ml-auto text-muted-foreground hover:text-destructive rounded-md hover:bg-muted">
                <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

function BranchActionRow({ action, fields, entities, depth, onChange, onRemove }: {
    action: WorkflowAction;
    fields: FieldDef[];
    entities: EntityDef[];
    depth: number;
    onChange: (a: WorkflowAction) => void;
    onRemove: () => void;
}) {
    const up = (patch: Partial<WorkflowAction>) => onChange({ ...action, ...patch });
    const conditions = action.branchConditions ?? [];
    const logic = action.branchConditionLogic ?? "all";

    const updateCond = (id: string, patch: Partial<BranchCondition>) =>
        up({ branchConditions: conditions.map((c) => c.id === id ? { ...c, ...patch } : c) });
    const addCond = () =>
        up({ branchConditions: [...conditions, { id: crypto.randomUUID(), fieldKey: fields[0]?.key ?? "", op: "eq" as FilterOp, value: "" }] });
    const removeCond = (id: string) =>
        up({ branchConditions: conditions.filter((c) => c.id !== id) });

    const noValueOps = new Set<FilterOp>(["isEmpty", "isNotEmpty"]);
    const allOps: FilterOp[] = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "notContains", "isEmpty", "isNotEmpty"];

    return (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 overflow-hidden">
            {/* ── IF header ── */}
            <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-100/60 dark:bg-amber-900/30 border-b border-amber-200/50">
                <span className="text-[11px] font-bold text-amber-700 bg-amber-200 dark:bg-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-md shrink-0 mt-0.5 tracking-wide">
                    IF
                </span>
                <div className="flex-1 space-y-1.5 min-w-0">
                    {conditions.map((c, idx) => {
                        const fieldDef = fields.find((f) => f.key === c.fieldKey);
                        const isSelect = fieldDef?.type === "select" || fieldDef?.type === "multiselect";
                        return (
                            <div key={c.id} className="flex flex-wrap items-center gap-1.5">
                                {idx > 0 && (
                                    <span className="text-[10px] font-bold text-amber-600 uppercase w-8 text-center shrink-0">
                                        {logic}
                                    </span>
                                )}
                                <Select value={c.fieldKey} onValueChange={(v) => updateCond(c.id, { fieldKey: v, value: "" })}>
                                    <SelectTrigger className="h-6 text-xs rounded-md w-full sm:w-28 flex-1 sm:flex-none min-w-20"><SelectValue placeholder="Field" /></SelectTrigger>
                                    <SelectContent>{fields.map((f) => <SelectItem key={f.id} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
                                </Select>
                                <Select value={c.op} onValueChange={(v) => updateCond(c.id, { op: v as FilterOp })}>
                                    <SelectTrigger className="h-6 text-xs rounded-md w-full sm:w-32 flex-1 sm:flex-none min-w-20"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {allOps.map((op) => <SelectItem key={op} value={op}>{OP_LABELS[op]}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {!noValueOps.has(c.op) && (
                                    isSelect && fieldDef?.options ? (
                                        <Select value={c.value ?? ""} onValueChange={(v) => updateCond(c.id, { value: v })}>
                                            <SelectTrigger className="h-6 text-xs rounded-md w-full sm:w-24 flex-1 sm:flex-none min-w-20"><SelectValue placeholder="Value" /></SelectTrigger>
                                            <SelectContent>{fieldDef.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                                        </Select>
                                    ) : (
                                        <Input value={c.value ?? ""} onChange={(e) => updateCond(c.id, { value: e.target.value })}
                                            placeholder="Value" className="h-6 text-xs rounded-md w-full sm:w-24 flex-1 sm:flex-none min-w-20" />
                                    )
                                )}
                                {conditions.length > 1 && (
                                    <button onClick={() => removeCond(c.id)}
                                        className="text-muted-foreground hover:text-destructive">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    <div className="flex items-center gap-2">
                        <button onClick={addCond} className="text-[11px] text-amber-600 hover:underline flex items-center gap-1">
                            <Plus className="w-3 h-3" /> condition
                        </button>
                        {conditions.length > 1 && (
                            <Select value={logic} onValueChange={(v) => up({ branchConditionLogic: v as "all" | "any" })}>
                                <SelectTrigger className="h-5 text-[10px] rounded w-16 px-1.5"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">ALL (AND)</SelectItem>
                                    <SelectItem value="any">ANY (OR)</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>
                <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive rounded shrink-0 mt-0.5">
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* ── THEN ── */}
            <div className="px-3 py-2.5 border-b border-amber-200/30">
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-0.5 h-3.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Then</span>
                </div>
                <div className="ml-3">
                    <ActionList
                        actions={action.thenActions ?? []}
                        fields={fields}
                        entities={entities}
                        onChange={(acts) => up({ thenActions: acts })}
                        depth={depth + 1}
                    />
                </div>
            </div>

            {/* ── ELSE ── */}
            <div className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-0.5 h-3.5 rounded-full bg-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Else</span>
                    <span className="text-[10px] text-muted-foreground">(optional)</span>
                </div>
                <div className="ml-3">
                    <ActionList
                        actions={action.elseActions ?? []}
                        fields={fields}
                        entities={entities}
                        onChange={(acts) => up({ elseActions: acts })}
                        depth={depth + 1}
                    />
                </div>
            </div>
        </div>
    );
}

/* ---------- Template factories ---------- */

function blankEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Item", plural: "Items", icon: "📦", color: "#8b5cf6", titleField: "title",
        fields: [{ id: crypto.randomUUID(), key: "title", label: "Title", type: "text", required: true }],
    };
}

function taskEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Task", plural: "Tasks", icon: "✅", color: "#0ea5e9", titleField: "title", statusField: "status",
        fields: [
            { id: crypto.randomUUID(), key: "title", label: "Title", type: "text", required: true },
            { id: crypto.randomUUID(), key: "status", label: "Status", type: "select", options: ["Todo", "Doing", "Done"] },
            { id: crypto.randomUUID(), key: "due", label: "Due date", type: "date" },
            { id: crypto.randomUUID(), key: "priority", label: "Priority", type: "rating", max: 3 },
            { id: crypto.randomUUID(), key: "notes", label: "Notes", type: "longtext" },
        ],
    };
}

function habitEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Check-in", plural: "Check-ins", icon: "🔥", color: "#f59e0b", titleField: "title",
        fields: [
            { id: crypto.randomUUID(), key: "title", label: "Habit", type: "text", required: true },
            { id: crypto.randomUUID(), key: "date", label: "Date", type: "date" },
            { id: crypto.randomUUID(), key: "progress", label: "Progress", type: "progress" },
            { id: crypto.randomUUID(), key: "mood", label: "Mood", type: "rating" },
            { id: crypto.randomUUID(), key: "notes", label: "Notes", type: "longtext" },
        ],
    };
}

function contactEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Contact", plural: "Contacts", icon: "🧑", color: "#6366f1", titleField: "name",
        fields: [
            { id: crypto.randomUUID(), key: "name", label: "Name", type: "text", required: true },
            { id: crypto.randomUUID(), key: "email", label: "Email", type: "email" },
            { id: crypto.randomUUID(), key: "company", label: "Company", type: "text" },
            { id: crypto.randomUUID(), key: "tags", label: "Tags", type: "tags" },
            { id: crypto.randomUUID(), key: "notes", label: "Notes", type: "longtext" },
        ],
    };
}

function dealEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Deal", plural: "Deals", icon: "💼", color: "#10b981", titleField: "title", statusField: "stage",
        fields: [
            { id: crypto.randomUUID(), key: "title", label: "Title", type: "text", required: true },
            { id: crypto.randomUUID(), key: "stage", label: "Stage", type: "select", options: ["Lead", "Qualified", "Proposal", "Won", "Lost"] },
            { id: crypto.randomUUID(), key: "amount", label: "Amount", type: "currency" },
            { id: crypto.randomUUID(), key: "close", label: "Close date", type: "date" },
        ],
    };
}

function libraryEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Item", plural: "Items", icon: "📚", color: "#ec4899", titleField: "title",
        fields: [
            { id: crypto.randomUUID(), key: "title", label: "Title", type: "text", required: true },
            { id: crypto.randomUUID(), key: "author", label: "Author / Creator", type: "text" },
            { id: crypto.randomUUID(), key: "status", label: "Status", type: "select", options: ["To read", "Reading", "Done"] },
            { id: crypto.randomUUID(), key: "rating", label: "Rating", type: "rating" },
            { id: crypto.randomUUID(), key: "tags", label: "Tags", type: "tags" },
            { id: crypto.randomUUID(), key: "notes", label: "Notes", type: "longtext" },
        ],
    };
}

function journalEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Entry", plural: "Entries", icon: "📓", color: "#14b8a6", titleField: "title",
        fields: [
            { id: crypto.randomUUID(), key: "title", label: "Title", type: "text", required: true },
            { id: crypto.randomUUID(), key: "date", label: "Date", type: "date" },
            { id: crypto.randomUUID(), key: "mood", label: "Mood", type: "rating" },
            { id: crypto.randomUUID(), key: "tags", label: "Tags", type: "tags" },
            { id: crypto.randomUUID(), key: "body", label: "Body", type: "longtext" },
        ],
    };
}

function inventoryEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Item", plural: "Items", icon: "📦", color: "#f97316", titleField: "name",
        fields: [
            { id: crypto.randomUUID(), key: "name", label: "Name", type: "text", required: true },
            { id: crypto.randomUUID(), key: "qty", label: "Quantity", type: "number" },
            { id: crypto.randomUUID(), key: "unit_price", label: "Unit price", type: "currency" },
            { id: crypto.randomUUID(), key: "total_value", label: "Total value", type: "formula", formula: "{{qty}} * {{unit_price}}", prefix: "$" },
            { id: crypto.randomUUID(), key: "location", label: "Location", type: "text" },
            { id: crypto.randomUUID(), key: "tags", label: "Tags", type: "tags" },
        ],
    };
}

function ideaEntity(): EntityDef {
    return {
        id: crypto.randomUUID(), name: "Idea", plural: "Ideas", icon: "💡", color: "#84cc16", titleField: "title", statusField: "stage",
        fields: [
            { id: crypto.randomUUID(), key: "title", label: "Title", type: "text", required: true },
            { id: crypto.randomUUID(), key: "stage", label: "Stage", type: "select", options: ["Raw", "Refined", "Validated", "Shipped", "Killed"] },
            { id: crypto.randomUUID(), key: "impact", label: "Impact", type: "rating", max: 5 },
            { id: crypto.randomUUID(), key: "effort", label: "Effort", type: "rating", max: 5 },
            { id: crypto.randomUUID(), key: "score", label: "Score", type: "formula", formula: "{{impact}} * 2 - {{effort}}" },
            { id: crypto.randomUUID(), key: "tags", label: "Tags", type: "tags" },
            { id: crypto.randomUUID(), key: "notes", label: "Notes", type: "longtext" },
        ],
    };
}