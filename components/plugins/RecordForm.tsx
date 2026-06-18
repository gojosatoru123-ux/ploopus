'use client';
import React, { useMemo, useState } from "react";
import { Star, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { EntityDef, FieldDef, PluginManifest, PluginRecord } from "@/lib/plugins/types";
import { evalFormula } from "@/lib/plugins/formula";
import { getRecords } from "@/lib/plugins/registry";

interface Props {
    entity: EntityDef;
    plugin?: PluginManifest;
    initial?: PluginRecord;
    onSubmit: (data: Record<string, unknown>) => void;
    onCancel: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+([/?#][^\s]*)?$/i;

function isEmptyValue(v: unknown): boolean {
    if (v === undefined || v === null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
}

function validateField(f: FieldDef, value: unknown): string | null {
    if (f.required && f.type !== "checkbox" && isEmptyValue(value)) {
        return `${f.label} is required`;
    }
    if (isEmptyValue(value)) return null;
    if (f.type === "email" && !EMAIL_RE.test(String(value))) {
        return "Enter a valid email address";
    }
    if (f.type === "url" && !URL_RE.test(String(value))) {
        return "Enter a valid URL";
    }
    if (f.type === "number" || f.type === "currency") {
        const n = Number(value);
        if (!Number.isFinite(n)) return "Enter a valid number";
        if (f.min !== undefined && n < f.min) return `Must be at least ${f.min.toLocaleString()}`;
        if (f.max !== undefined && n > f.max) return `Must be at most ${f.max.toLocaleString()}`;
    }
    return null;
}

export default function RecordForm({ entity, plugin, initial, onSubmit, onCancel }: Props) {
    const [data, setData] = useState<Record<string, unknown>>(initial?.data ?? {});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const set = (k: string, v: unknown) => {
        setData((d) => ({ ...d, [k]: v }));
        if (errors[k]) setErrors((e) => { const next = { ...e }; delete next[k]; return next; });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const nextErrors: Record<string, string> = {};
        for (const f of entity.fields) {
            if (f.type === "formula") continue;
            const err = validateField(f, data[f.key]);
            if (err) nextErrors[f.key] = err;
        }
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            return;
        }
        onSubmit(data);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {entity.fields.map((f) => {
                const error = errors[f.key];
                return (
                    <div key={f.id} className="space-y-1.5">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                            {f.label}
                            {f.required && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {f.type === "longtext" ? (
                            <Textarea
                                value={(data[f.key] as string) ?? ""}
                                onChange={(e) => set(f.key, e.target.value)}
                                rows={4}
                                aria-invalid={!!error}
                                className={error ? "border-destructive focus-visible:ring-destructive/30" : undefined}
                            />
                        ) : f.type === "select" ? (
                            <Select
                                value={(data[f.key] as string) ?? ""}
                                onValueChange={(v) => set(f.key, v === "__clear__" ? "" : v)}
                            >
                                <SelectTrigger aria-invalid={!!error} className={error ? "border-destructive" : undefined}>
                                    <SelectValue placeholder="Choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {!f.required && (
                                        <SelectItem value="__clear__">
                                            <span className="text-muted-foreground italic">— None —</span>
                                        </SelectItem>
                                    )}
                                    {(f.options ?? []).map((o) => (
                                        <SelectItem key={o} value={o}>
                                            {o}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : f.type === "multiselect" ? (
                            <MultiSelectInput
                                options={f.options ?? []}
                                value={(data[f.key] as string[]) ?? []}
                                onChange={(v) => set(f.key, v)}
                                error={!!error}
                            />
                        ) : f.type === "checkbox" ? (
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    checked={!!data[f.key]}
                                    onCheckedChange={(v) => set(f.key, !!v)}
                                />
                                <span className="text-sm">{f.label}</span>
                            </div>
                        ) : f.type === "rating" ? (
                            <div className="flex items-center gap-1">
                                {Array.from({ length: f.max ?? 5 }).map((_, i) => {
                                    const v = i + 1;
                                    const active = Number(data[f.key] ?? 0) >= v;
                                    return (
                                        <button
                                            key={v}
                                            type="button"
                                            onClick={() => set(f.key, v === Number(data[f.key] ?? 0) ? 0 : v)}
                                            className="p-0.5"
                                        >
                                            <Star
                                                className={`w-5 h-5 ${active ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        ) : f.type === "progress" ? (
                            <div className="space-y-1">
                                <input
                                    type="range"
                                    min={0}
                                    max={100}
                                    value={Number(data[f.key] ?? 0)}
                                    onChange={(e) => set(f.key, Number(e.target.value))}
                                    className="w-full accent-primary"
                                />
                                <div className="text-xs text-muted-foreground tabular-nums">{Number(data[f.key] ?? 0)}%</div>
                            </div>
                        ) : f.type === "tags" ? (
                            <TagsInput value={(data[f.key] as string[]) ?? []} onChange={(v) => set(f.key, v)} />
                        ) : f.type === "color" ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={/^#[0-9a-fA-F]{6}$/.test((data[f.key] as string) ?? "") ? (data[f.key] as string) : "#8b5cf6"}
                                    onChange={(e) => set(f.key, e.target.value)}
                                    className="h-9 w-12 rounded border bg-background shrink-0 cursor-pointer"
                                />
                                <Input
                                    value={(data[f.key] as string) ?? ""}
                                    onChange={(e) => set(f.key, e.target.value)}
                                    placeholder="#8b5cf6"
                                    className="flex-1"
                                />
                            </div>
                        ) : f.type === "formula" ? (
                            <div className="px-3 py-2 rounded-md bg-muted text-sm tabular-nums">
                                {f.formula ? formatFormula(evalFormula(f.formula, data), f) : "—"}
                            </div>
                        ) : f.type === "relation" ? (
                            <RelationInput
                                field={f}
                                plugin={plugin}
                                value={(data[f.key] as string) ?? ""}
                                onChange={(v) => set(f.key, v)}
                                error={!!error}
                            />
                        ) : (
                            <Input
                                type={
                                    f.type === "number" || f.type === "currency"
                                        ? "number"
                                        : f.type === "date"
                                            ? "date"
                                            : f.type === "email"
                                                ? "email"
                                                : f.type === "url"
                                                    ? "url"
                                                    : "text"
                                }
                                min={f.type === "number" || f.type === "currency" ? f.min : undefined}
                                max={f.type === "number" || f.type === "currency" ? f.max : undefined}
                                value={(data[f.key] as string | number | undefined) ?? ""}
                                onChange={(e) =>
                                    set(
                                        f.key,
                                        f.type === "number" || f.type === "currency"
                                            ? e.target.value === ""
                                                ? ""
                                                : Number(e.target.value)
                                            : e.target.value,
                                    )
                                }
                                aria-invalid={!!error}
                                className={error ? "border-destructive focus-visible:ring-destructive/30" : undefined}
                            />
                        )}
                        {error ? (
                            <p className="text-xs text-destructive">{error}</p>
                        ) : f.help ? (
                            <p className="text-xs text-muted-foreground">{f.help}</p>
                        ) : null}
                    </div>
                );
            })}
            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit">Save</Button>
            </div>
        </form>
    );
}

function formatFormula(n: number, f: { prefix?: string; suffix?: string }) {
    if (!Number.isFinite(n)) return "—";
    return `${f.prefix ?? ""}${n.toLocaleString()}${f.suffix ?? ""}`;
}

/* ---------- Multi-select ---------- */

function MultiSelectInput({ options, value, onChange, error }: {
    options: string[];
    value: string[];
    onChange: (v: string[]) => void;
    error?: boolean;
}) {
    const toggle = (o: string) => {
        if (value.includes(o)) onChange(value.filter((x) => x !== o));
        else onChange([...value, o]);
    };
    if (options.length === 0) {
        return <div className="text-xs text-muted-foreground italic px-2 py-1.5 rounded-md bg-muted/40">No options configured for this field.</div>;
    }
    return (
        <div className={`flex flex-wrap gap-1.5 px-2 py-1.5 border rounded-md bg-background min-h-9 ${error ? "border-destructive" : ""}`}>
            {options.map((o) => {
                const active = value.includes(o);
                return (
                    <button
                        key={o}
                        type="button"
                        onClick={() => toggle(o)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition ${active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
                            }`}
                    >
                        {o}
                    </button>
                );
            })}
        </div>
    );
}

/* ---------- Relation (with search for large tables) ---------- */

function RelationInput({ field, plugin, value, onChange, error }: {
    field: FieldDef;
    plugin?: PluginManifest;
    value: string;
    onChange: (v: string) => void;
    error?: boolean;
}) {
    const [query, setQuery] = useState("");
    const target = plugin?.entities.find((e) => e.id === field.relationEntityId);

    const options = useMemo(() => {
        if (!plugin || !target) return [];
        return getRecords(plugin.id, target.id);
    }, [plugin, target]);

    if (!plugin || !target) {
        return (
            <div className="text-xs text-muted-foreground italic px-2 py-1.5 rounded-md bg-muted/40">
                No linked table configured.
            </div>
        );
    }

    const filtered = query.trim()
        ? options.filter((r) => String(r.data[target.titleField] ?? "").toLowerCase().includes(query.trim().toLowerCase()))
        : options;

    const showSearch = options.length > 8;

    return (
        <div className="space-y-1.5">
            {showSearch && (
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Search ${target.plural.toLowerCase()}…`}
                        className="pl-8 h-8 text-xs"
                    />
                </div>
            )}
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger aria-invalid={!!error} className={error ? "border-destructive" : undefined}>
                    <SelectValue placeholder={`Choose a ${target.name.toLowerCase()}…`} />
                </SelectTrigger>
                <SelectContent>
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                            {options.length === 0
                                ? `No ${target.plural.toLowerCase()} yet — create one first.`
                                : `No ${target.plural.toLowerCase()} match "${query}".`}
                        </div>
                    ) : (
                        filtered.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                                {String(r.data[target.titleField] ?? "Untitled")}
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}

function TagsInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
    const [input, setInput] = useState("");
    const containerRef = React.useRef<HTMLDivElement>(null);
    const add = () => {
        const t = input.trim();
        if (!t) return;
        if (!value.includes(t)) onChange([...value, t]);
        setInput("");
    };
    return (
        <div ref={containerRef} className="flex flex-wrap items-center gap-1 px-2 py-1.5 border rounded-md bg-background min-h-9">
            {value.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="opacity-60 hover:opacity-100">
                        <X className="w-3 h-3" />
                    </button>
                </Badge>
            ))}
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        add();
                    } else if (e.key === "Backspace" && !input && value.length) {
                        onChange(value.slice(0, -1));
                    }
                }}
                onBlur={(e) => {
                    // Don't add a tag if focus is moving to a button inside the same container
                    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
                    add();
                }}
                placeholder="Add tag…"
                className="flex-1 min-w-20 bg-transparent outline-none text-sm py-1"
            />
        </div>
    );
}