import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type {
    BranchCondition,
    PluginManifest,
    PluginRecord,
    PluginNotification,
    ReminderHit,
    WorkflowAction,
    WorkflowCondition,
    WorkflowDef,
} from "./types";
import { applyTemplate, matchOperator } from "./formula";

const INSTALLED_KEY = "elephant-plugins-installed";
const RECORDS_KEY = (pluginId: string) => `elephant-plugin-data:${pluginId}`;
const TRASH_KEY = (pluginId: string) => `elephant-plugin-trash:${pluginId}`;
const NOTIF_KEY = "elephant-plugin-notifications";
const EVT = "elephant-plugins-change";
const ERR_EVT = "elephant-plugins-error";

const isBrowser = typeof window !== "undefined";

// Stable references for SSR / empty results so useSyncExternalStore and
// memoized selectors never see a "new" array when nothing changed.
const EMPTY_PLUGINS: PluginManifest[] = [];
const EMPTY_RECORDS: PluginRecord[] = [];
const EMPTY_NOTIFICATIONS: PluginNotification[] = [];
const EMPTY_HITS: ReminderHit[] = [];

function emit() {
    if (!isBrowser) return;
    try {
        window.dispatchEvent(new Event(EVT));
    } catch { }
}

/** Surface a storage error (e.g. quota exceeded) so the UI can toast it. */
function emitError(message: string) {
    if (!isBrowser) return;
    try {
        window.dispatchEvent(new CustomEvent(ERR_EVT, { detail: { message } }));
    } catch { }
}

/** Subscribe to storage errors (quota exceeded, corrupted data, etc). */
export function onStorageError(cb: (message: string) => void): () => void {
    if (!isBrowser) return () => { };
    const handler = (e: Event) => cb((e as CustomEvent<{ message: string }>).detail?.message ?? "Storage error");
    window.addEventListener(ERR_EVT, handler);
    return () => window.removeEventListener(ERR_EVT, handler);
}

// Cached snapshot for useSyncExternalStore. Must return the SAME reference
// across calls unless the underlying data changed, or React will loop
// (error #185: "The result of getSnapshot should be cached…").
let cachedSnapshot: PluginManifest[] | null = null;
function getInstalledSnapshot(): PluginManifest[] {
    if (!isBrowser) return EMPTY_PLUGINS;
    if (cachedSnapshot === null) cachedSnapshot = getInstalledPlugins();
    return cachedSnapshot;
}
function getServerSnapshot(): PluginManifest[] {
    return EMPTY_PLUGINS;
}
function invalidateSnapshot() {
    cachedSnapshot = null;
}

function readJSON<T>(key: string, fallback: T): T {
    if (!isBrowser) return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writeJSON(key: string, value: unknown): boolean {
    if (!isBrowser) return false;
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (err) {
        const quota = err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22);
        emitError(quota ? "Storage is full — free up space by exporting and removing some plugin data." : "Couldn't save changes to local storage.");
        return false;
    }
}

/* ---------------------------- Plugins ---------------------------- */

export function getInstalledPlugins(): PluginManifest[] {
    return readJSON<PluginManifest[]>(INSTALLED_KEY, EMPTY_PLUGINS);
}

export function getPlugin(id: string): PluginManifest | undefined {
    return getInstalledPlugins().find((p) => p.id === id);
}

export function installPlugin(manifest: PluginManifest) {
    const list = getInstalledPlugins();
    if (list.find((p) => p.id === manifest.id)) {
        return updatePlugin(manifest);
    }
    writeJSON(INSTALLED_KEY, [...list, manifest]);
    invalidateSnapshot();
    emit();
}

export function updatePlugin(manifest: PluginManifest) {
    const list = getInstalledPlugins().map((p) => (p.id === manifest.id ? manifest : p));
    writeJSON(INSTALLED_KEY, list);
    invalidateSnapshot();
    emit();
}

export function uninstallPlugin(id: string, wipeData = true) {
    const list = getInstalledPlugins().filter((p) => p.id !== id);
    writeJSON(INSTALLED_KEY, list);
    if (wipeData) {
        localStorage.removeItem(RECORDS_KEY(id));
        localStorage.removeItem(TRASH_KEY(id));
    }
    invalidateSnapshot();
    emit();
}

/* ---------------------------- Records ---------------------------- */

export function getRecords(pluginId: string, entityId?: string): PluginRecord[] {
    const all = readJSON<PluginRecord[]>(RECORDS_KEY(pluginId), EMPTY_RECORDS);
    return entityId ? all.filter((r) => r.entityId === entityId) : all;
}

export function upsertRecord(pluginId: string, record: PluginRecord) {
    const all = readJSON<PluginRecord[]>(RECORDS_KEY(pluginId), []);
    const idx = all.findIndex((r) => r.id === record.id);
    const now = new Date().toISOString();
    const isCreate = idx === -1;
    const prev = idx === -1 ? undefined : all[idx];
    if (idx === -1) {
        all.push({ ...record, createdAt: record.createdAt || now, updatedAt: now });
    } else {
        all[idx] = { ...all[idx], ...record, updatedAt: now };
    }
    writeJSON(RECORDS_KEY(pluginId), all);
    // Run workflows for this plugin/entity.
    try {
        runWorkflowsForChange(pluginId, all[idx === -1 ? all.length - 1 : idx], {
            isCreate,
            previous: prev,
        });
    } catch (err) {
        console.warn("workflow run failed", err);
    }
    emit();
}

/** Delete a single record. The record is kept in a per-plugin trash buffer
 *  so it can be restored via `restoreRecord` (powers "Undo" toasts). */
export function deleteRecord(pluginId: string, recordId: string) {
    const all = readJSON<PluginRecord[]>(RECORDS_KEY(pluginId), []);
    const record = all.find((r) => r.id === recordId);
    const remaining = all.filter((r) => r.id !== recordId);
    writeJSON(RECORDS_KEY(pluginId), remaining);
    if (record) {
        pushTrash(pluginId, [record]);
        try {
            runWorkflowsForDelete(pluginId, record);
        } catch (err) {
            console.warn("workflow run failed", err);
        }
    }
    emit();
}

/** Delete many records at once (bulk action bar). Also goes through trash. */
export function bulkDeleteRecords(pluginId: string, recordIds: string[]) {
    if (recordIds.length === 0) return;
    const ids = new Set(recordIds);
    const all = readJSON<PluginRecord[]>(RECORDS_KEY(pluginId), []);
    const toDelete = all.filter((r) => ids.has(r.id));
    const remaining = all.filter((r) => !ids.has(r.id));
    writeJSON(RECORDS_KEY(pluginId), remaining);
    pushTrash(pluginId, toDelete);
    for (const r of toDelete) {
        try {
            runWorkflowsForDelete(pluginId, r);
        } catch (err) {
            console.warn("workflow run failed", err);
        }
    }
    emit();
}

/** Apply the same partial data patch to many records (bulk status change, etc). */
export function bulkUpdateRecords(pluginId: string, recordIds: string[], patch: Record<string, unknown>) {
    if (recordIds.length === 0) return;
    const ids = new Set(recordIds);
    const all = readJSON<PluginRecord[]>(RECORDS_KEY(pluginId), []);
    const now = new Date().toISOString();
    const previousById = new Map(all.map((r) => [r.id, r]));
    const updated = all.map((r) =>
        ids.has(r.id) ? { ...r, data: { ...r.data, ...patch }, updatedAt: now } : r,
    );
    writeJSON(RECORDS_KEY(pluginId), updated);
    for (const r of updated) {
        if (!ids.has(r.id)) continue;
        try {
            runWorkflowsForChange(pluginId, r, { isCreate: false, previous: previousById.get(r.id) });
        } catch (err) {
            console.warn("workflow run failed", err);
        }
    }
    emit();
}

/* ---------------------------- Trash / undo ---------------------------- */

interface TrashEntry {
    record: PluginRecord;
    deletedAt: string;
}

function pushTrash(pluginId: string, records: PluginRecord[]) {
    if (records.length === 0) return;
    const trash = readJSON<TrashEntry[]>(TRASH_KEY(pluginId), []);
    const now = new Date().toISOString();
    const next = [...records.map((record) => ({ record, deletedAt: now })), ...trash].slice(0, 50);
    writeJSON(TRASH_KEY(pluginId), next);
}

/** Restore a record that was deleted via `deleteRecord` / `bulkDeleteRecords`. */
export function restoreRecord(pluginId: string, recordId: string): boolean {
    const trash = readJSON<TrashEntry[]>(TRASH_KEY(pluginId), []);
    const idx = trash.findIndex((t) => t.record.id === recordId);
    if (idx === -1) return false;
    const [entry] = trash.splice(idx, 1);
    writeJSON(TRASH_KEY(pluginId), trash);
    const all = readJSON<PluginRecord[]>(RECORDS_KEY(pluginId), []);
    if (!all.some((r) => r.id === entry.record.id)) {
        all.push(entry.record);
        writeJSON(RECORDS_KEY(pluginId), all);
    }
    emit();
    return true;
}

/** Restore multiple records (e.g. after a bulk delete). Returns count restored. */
export function restoreRecords(pluginId: string, recordIds: string[]): number {
    let count = 0;
    for (const id of recordIds) {
        if (restoreRecord(pluginId, id)) count++;
    }
    return count;
}

/* ---------------------------- Export / import / share ---------------------------- */

export function exportPlugin(pluginId: string, includeData = true) {
    const manifest = getPlugin(pluginId);
    if (!manifest) return null;
    const payload = {
        format: "elephant-plugin/v1",
        manifest,
        data: includeData ? getRecords(pluginId) : [],
        exportedAt: new Date().toISOString(),
    };
    return payload;
}

export function importPlugin(payload: unknown): PluginManifest {
    const p = payload as { manifest: PluginManifest; data?: PluginRecord[] };
    if (!p?.manifest?.id) throw new Error("Invalid plugin file");
    // Avoid collisions: if an installed plugin shares the id, give the import a new id.
    let manifest = { ...p.manifest, builtin: false };
    if (getInstalledPlugins().some((x) => x.id === manifest.id)) {
        manifest = { ...manifest, id: crypto.randomUUID(), name: `${manifest.name} (imported)` };
    }
    installPlugin(manifest);
    if (p.data?.length) {
        writeJSON(RECORDS_KEY(manifest.id), p.data.map((r) => ({ ...r })));
        emit();
    }
    return manifest;
}

/* ---------- Share / download / install from URL ---------- */

function b64encode(s: string): string {
    return btoa(unescape(encodeURIComponent(s)));
}
function b64decode(s: string): string {
    return decodeURIComponent(escape(atob(s)));
}

/** Encode a plugin (without records) into a shareable URL hash. */
export function buildShareLink(pluginId: string): string | null {
    if (!isBrowser) return null;
    const manifest = getPlugin(pluginId);
    if (!manifest) return null;
    const payload = { format: "elephant-plugin/v1", manifest, data: [] };
    const encoded = b64encode(JSON.stringify(payload));
    return `${window.location.origin}${window.location.pathname}#plugin=${encoded}`;
}

/** Try to install a plugin from a `#plugin=` hash in the current URL. */
export function tryInstallFromHash(): PluginManifest | null {
    if (!isBrowser) return null;
    const m = window.location.hash.match(/[#&]plugin=([^&]+)/);
    if (!m) return null;
    try {
        const payload = JSON.parse(b64decode(decodeURIComponent(m[1])));
        const installed = importPlugin(payload);
        // Clear hash so refresh doesn't reinstall.
        history.replaceState(null, "", window.location.pathname + window.location.search);
        return installed;
    } catch {
        return null;
    }
}

/** Fetch and install a plugin from a remote URL returning JSON. */
export async function installFromUrl(url: string): Promise<PluginManifest> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
    const payload = await res.json();
    return importPlugin(payload);
}

/** Duplicate a plugin under a new id (forking). */
export function duplicatePlugin(pluginId: string): PluginManifest | null {
    const p = getPlugin(pluginId);
    if (!p) return null;
    const clone: PluginManifest = {
        ...p,
        id: crypto.randomUUID(),
        name: `${p.name} copy`,
        builtin: false,
    };
    installPlugin(clone);
    return clone;
}

/* ---------- Workflow runtime ---------- */

function conditionsPass(record: PluginRecord, conditions: WorkflowCondition[] | undefined, logic: "all" | "any" | undefined): boolean {
    if (!conditions || conditions.length === 0) return true;
    const results = conditions.map((c) => matchOperator(record.data[c.fieldKey], c.op, c.value));
    return logic === "any" ? results.some(Boolean) : results.every(Boolean);
}

function runWorkflowsForChange(
    pluginId: string,
    record: PluginRecord,
    ctx: { isCreate: boolean; previous?: PluginRecord },
) {
    const plugin = getPlugin(pluginId);
    if (!plugin?.workflows?.length) return;
    for (const wf of plugin.workflows) {
        if (wf.enabled === false) continue;
        if (wf.entityId !== record.entityId) continue;
        let fires = false;
        if (wf.trigger === "onCreate" && ctx.isCreate) {
            fires = conditionsPass(record, wf.conditions, wf.conditionLogic);
        } else if (wf.trigger === "onUpdate" && !ctx.isCreate) {
            fires = conditionsPass(record, wf.conditions, wf.conditionLogic);
        } else if (wf.trigger === "onFieldEquals" && wf.whenField) {
            const cur = record.data[wf.whenField];
            const prev = ctx.previous?.data[wf.whenField];
            if (String(cur) === String(wf.whenValue) && String(prev) !== String(cur)) {
                fires = conditionsPass(record, wf.conditions, wf.conditionLogic);
            }
        }
        if (!fires) continue;
        runActions(plugin, wf, record);
    }
}

function runWorkflowsForDelete(pluginId: string, record: PluginRecord) {
    const plugin = getPlugin(pluginId);
    if (!plugin?.workflows?.length) return;
    for (const wf of plugin.workflows) {
        if (wf.enabled === false) continue;
        if (wf.entityId !== record.entityId) continue;
        if (wf.trigger !== "onDelete") continue;
        if (!conditionsPass(record, wf.conditions, wf.conditionLogic)) continue;
        runActions(plugin, wf, record, { deleted: true });
    }
}

function defaultForFieldType(type: string | undefined): unknown {
    switch (type) {
        case "checkbox": return false;
        case "number":
        case "currency":
        case "rating":
        case "progress": return 0;
        case "tags":
        case "multiselect": return [];
        default: return "";
    }
}

function runActions(plugin: PluginManifest, wf: WorkflowDef, record: PluginRecord, opts?: { deleted?: boolean }) {
    const entity = plugin.entities.find((e) => e.id === record.entityId);
    const mutated = { ...record, data: { ...record.data } };
    let changed = false;

    // Recursive executor — processes a flat or nested list of actions.
    // Captured in a closure so that `mutated` and `changed` are always
    // the same mutable references regardless of call depth.
    function execActions(actions: WorkflowAction[]) {
        for (const action of actions) {
            switch (action.kind) {
                case "setField": {
                    if (!action.fieldKey) break;
                    const value =
                        typeof action.value === "string"
                            ? applyTemplate(action.value, mutated.data)
                            : action.value;
                    mutated.data[action.fieldKey] = value;
                    changed = true;
                    break;
                }
                case "increment": {
                    if (!action.fieldKey) break;
                    const cur = Number(mutated.data[action.fieldKey] ?? 0);
                    mutated.data[action.fieldKey] = cur + Number(action.value ?? 1);
                    changed = true;
                    break;
                }
                case "stampDate": {
                    if (!action.fieldKey) break;
                    mutated.data[action.fieldKey] = new Date().toISOString().slice(0, 10);
                    changed = true;
                    break;
                }
                case "clearField": {
                    if (!action.fieldKey) break;
                    const field = entity?.fields.find((f) => f.key === action.fieldKey);
                    mutated.data[action.fieldKey] = defaultForFieldType(field?.type);
                    changed = true;
                    break;
                }
                case "copyField": {
                    if (!action.fieldKey || !action.sourceFieldKey) break;
                    mutated.data[action.fieldKey] = mutated.data[action.sourceFieldKey];
                    changed = true;
                    break;
                }
                case "notify": {
                    addNotification({
                        pluginId: plugin.id,
                        title: applyTemplate(action.message || wf.name, mutated.data),
                        entityId: record.entityId,
                        recordId: opts?.deleted ? undefined : record.id,
                    });
                    break;
                }
                case "branch": {
                    // Evaluate every condition against the current (possibly already
                    // mutated) record data so that earlier actions in the same workflow
                    // can influence which branch fires.
                    const conditions = action.branchConditions ?? [];
                    const logic = action.branchConditionLogic ?? "all";

                    let passes: boolean;
                    if (conditions.length === 0) {
                        // A branch with no conditions always takes the THEN path —
                        // useful as a "group" container for a set of actions.
                        passes = true;
                    } else {
                        const results = conditions.map((c: BranchCondition) =>
                            matchOperator(mutated.data[c.fieldKey], c.op, c.value),
                        );
                        passes = logic === "any"
                            ? results.some(Boolean)
                            : results.every(Boolean);
                    }

                    if (passes) {
                        if (action.thenActions && action.thenActions.length > 0) {
                            execActions(action.thenActions);
                        }
                    } else {
                        if (action.elseActions && action.elseActions.length > 0) {
                            execActions(action.elseActions);
                        }
                    }
                    break;
                }
                // Future-proof: unknown action kinds are silently ignored.
                default: break;
            }
        }
    }

    execActions(wf.actions);

    if (changed && !opts?.deleted) {
        const all = readJSON<PluginRecord[]>(RECORDS_KEY(plugin.id), []);
        const idx = all.findIndex((r) => r.id === mutated.id);
        if (idx !== -1) {
            all[idx] = mutated;
            writeJSON(RECORDS_KEY(plugin.id), all);
        }
    }
}

/* ---------------------------- Subscriptions ---------------------------- */

function subscribe(cb: () => void) {
    if (!isBrowser) return () => { };
    const wrapped = () => {
        invalidateSnapshot();
        cb();
    };
    window.addEventListener(EVT, wrapped);
    window.addEventListener("storage", wrapped);
    return () => {
        window.removeEventListener(EVT, wrapped);
        window.removeEventListener("storage", wrapped);
    };
}

export function useInstalledPlugins(): PluginManifest[] {
    return useSyncExternalStore(subscribe, getInstalledSnapshot, getServerSnapshot);
}

export function useRecords(pluginId: string, entityId?: string) {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const cb = () => setVersion((v) => v + 1);
        window.addEventListener(EVT, cb);
        window.addEventListener("storage", cb);
        return () => {
            window.removeEventListener(EVT, cb);
            window.removeEventListener("storage", cb);
        };
    }, []);
    return useMemo(() => getRecords(pluginId, entityId), [pluginId, entityId, version]);
}

/* ---------------------------- Notifications ---------------------------- */

export function getNotifications(pluginId?: string): PluginNotification[] {
    const all = readJSON<PluginNotification[]>(NOTIF_KEY, EMPTY_NOTIFICATIONS);
    return pluginId ? all.filter((n) => n.pluginId === pluginId) : all;
}

export function addNotification(n: { pluginId: string; title: string; body?: string; entityId?: string; recordId?: string }) {
    const all = readJSON<PluginNotification[]>(NOTIF_KEY, []);
    const next: PluginNotification = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        read: false,
        ...n,
    };
    writeJSON(NOTIF_KEY, [next, ...all].slice(0, 200));
    emit();
}

export function markNotificationRead(id: string, read = true) {
    const all = readJSON<PluginNotification[]>(NOTIF_KEY, []);
    writeJSON(NOTIF_KEY, all.map((n) => (n.id === id ? { ...n, read } : n)));
    emit();
}

export function markAllNotificationsRead(pluginId?: string) {
    const all = readJSON<PluginNotification[]>(NOTIF_KEY, []);
    writeJSON(NOTIF_KEY, all.map((n) => (!pluginId || n.pluginId === pluginId ? { ...n, read: true } : n)));
    emit();
}

export function clearNotifications(pluginId?: string) {
    const all = readJSON<PluginNotification[]>(NOTIF_KEY, []);
    writeJSON(NOTIF_KEY, pluginId ? all.filter((n) => n.pluginId !== pluginId) : []);
    emit();
}

export function useNotifications(pluginId?: string): PluginNotification[] {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const cb = () => setVersion((v) => v + 1);
        window.addEventListener(EVT, cb);
        window.addEventListener("storage", cb);
        return () => {
            window.removeEventListener(EVT, cb);
            window.removeEventListener("storage", cb);
        };
    }, []);
    return useMemo(() => getNotifications(pluginId), [pluginId, version]);
}

/* ---------------------------- Reminders ---------------------------- */

/** Compute due/overdue reminders across all installed plugins. */
export function getDueReminders(): ReminderHit[] {
    if (!isBrowser) return EMPTY_HITS;
    const now = Date.now();
    const hits: ReminderHit[] = [];
    for (const plugin of getInstalledPlugins()) {
        if (!plugin.reminders?.length) continue;
        for (const rem of plugin.reminders) {
            const entity = plugin.entities.find((e) => e.id === rem.entityId);
            if (!entity) continue;
            const records = getRecords(plugin.id, rem.entityId);
            for (const r of records) {
                const raw = r.data[rem.dateField];
                if (!raw) continue;
                const t = new Date(raw as string).getTime();
                if (Number.isNaN(t)) continue;
                const leadMs = (rem.leadDays ?? 0) * 86400000;
                if (t - leadMs > now) continue; // not due yet
                hits.push({
                    id: `${plugin.id}:${rem.id}:${r.id}`,
                    pluginId: plugin.id,
                    pluginName: plugin.name,
                    pluginIcon: plugin.icon,
                    accent: plugin.accent,
                    entityId: entity.id,
                    recordId: r.id,
                    label: applyTemplate(rem.label, r.data),
                    due: raw as string,
                    overdue: t < now,
                });
            }
        }
    }
    return hits.sort((a, b) => +new Date(a.due) - +new Date(b.due));
}

/** Live-updating list of due/overdue reminders across all installed plugins. */
export function useDueReminders(): ReminderHit[] {
    const [version, setVersion] = useState(0);
    useEffect(() => {
        const cb = () => setVersion((v) => v + 1);
        window.addEventListener(EVT, cb);
        window.addEventListener("storage", cb);
        // Reminders become "due" purely with the passage of time too.
        const interval = setInterval(cb, 60_000);
        return () => {
            window.removeEventListener(EVT, cb);
            window.removeEventListener("storage", cb);
            clearInterval(interval);
        };
    }, []);
    return useMemo(() => getDueReminders(), [version]);
}

/* ---------------------------- Global search ---------------------------- */

export interface SearchHit {
    pluginId: string;
    pluginName: string;
    pluginIcon: string;
    accent: string;
    entityId: string;
    entityName: string;
    entityIcon: string;
    recordId: string;
    title: string;
    snippet: string;
}

const SEARCHABLE_TYPES = new Set(["text", "longtext", "email", "url", "select", "multiselect", "tags"]);

/** Search titles and text-like fields across every installed plugin. */
export function searchAll(query: string, limit = 30): SearchHit[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const plugin of getInstalledPlugins()) {
        for (const entity of plugin.entities) {
            const records = getRecords(plugin.id, entity.id);
            for (const r of records) {
                const title = String(r.data[entity.titleField] ?? "Untitled");
                const text = entity.fields
                    .filter((f) => SEARCHABLE_TYPES.has(f.type))
                    .map((f) => {
                        const v = r.data[f.key];
                        return Array.isArray(v) ? v.join(" ") : String(v ?? "");
                    })
                    .join(" ");
                const haystack = `${title} ${text}`.toLowerCase();
                if (!haystack.includes(q)) continue;
                hits.push({
                    pluginId: plugin.id,
                    pluginName: plugin.name,
                    pluginIcon: plugin.icon,
                    accent: plugin.accent,
                    entityId: entity.id,
                    entityName: entity.name,
                    entityIcon: entity.icon,
                    recordId: r.id,
                    title,
                    snippet: text.slice(0, 100),
                });
                if (hits.length >= limit) return hits;
            }
        }
    }
    return hits;
}