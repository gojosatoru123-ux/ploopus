import { useState, useEffect, useCallback, useRef } from "react";
import {
    BranchCondition,
    PluginManifest,
    PluginNotification,
    PluginRecord,
    ReminderHit,
    WorkflowAction,
    WorkflowCondition,
    WorkflowDef,
} from "@/lib/plugins/types";
import { StorageEngine } from "@/lib/storage-engine";
import { applyTemplate, matchOperator } from "@/lib/plugins/formula";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrashEntry {
    record: PluginRecord;
    deletedAt: string;
}

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

const SEARCHABLE_TYPES = new Set([
    "text", "longtext", "email", "url", "select", "multiselect", "tags",
]);

// ─── Workflow helpers (pure — no storage access, take state as args) ──────────

function conditionsPass(
    record: PluginRecord,
    conditions: WorkflowCondition[] | undefined,
    logic: "all" | "any" | undefined,
): boolean {
    if (!conditions || conditions.length === 0) return true;
    const results = conditions.map((c) =>
        matchOperator(record.data[c.fieldKey], c.op, c.value)
    );
    return logic === "any" ? results.some(Boolean) : results.every(Boolean);
}

function defaultForFieldType(type: string | undefined): unknown {
    switch (type) {
        case "checkbox": return false;
        case "number": case "currency":
        case "rating": case "progress": return 0;
        case "tags": case "multiselect": return [];
        default: return "";
    }
}

function runActions(
    plugin: PluginManifest,
    wf: WorkflowDef,
    record: PluginRecord,
    onNotify: (n: Omit<PluginNotification, "id" | "createdAt" | "read">) => void,
    opts?: { deleted?: boolean },
): PluginRecord | null {
    const entity = plugin.entities.find((e) => e.id === record.entityId);
    const mutated = { ...record, data: { ...record.data } };
    let changed = false;

    function execActions(actions: WorkflowAction[]) {
        for (const action of actions) {
            switch (action.kind) {
                case "setField": {
                    if (!action.fieldKey) break;
                    mutated.data[action.fieldKey] =
                        typeof action.value === "string"
                            ? applyTemplate(action.value, mutated.data)
                            : action.value;
                    changed = true;
                    break;
                }
                case "increment": {
                    if (!action.fieldKey) break;
                    mutated.data[action.fieldKey] =
                        Number(mutated.data[action.fieldKey] ?? 0) + Number(action.value ?? 1);
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
                    onNotify({
                        pluginId: plugin.id,
                        title: applyTemplate(action.message || wf.name, mutated.data),
                        entityId: record.entityId,
                        recordId: opts?.deleted ? undefined : record.id,
                    });
                    break;
                }
                case "branch": {
                    const conditions = action.branchConditions ?? [];
                    const logic = action.branchConditionLogic ?? "all";
                    let passes: boolean;
                    if (conditions.length === 0) {
                        passes = true;
                    } else {
                        const results = conditions.map((c: BranchCondition) =>
                            matchOperator(mutated.data[c.fieldKey], c.op, c.value)
                        );
                        passes = logic === "any" ? results.some(Boolean) : results.every(Boolean);
                    }
                    if (passes) {
                        if (action.thenActions?.length) execActions(action.thenActions);
                    } else {
                        if (action.elseActions?.length) execActions(action.elseActions);
                    }
                    break;
                }
                default: break;
            }
        }
    }

    execActions(wf.actions);
    return changed && !opts?.deleted ? mutated : null;
}

function runWorkflowsForChange(
    plugin: PluginManifest,
    record: PluginRecord,
    ctx: { isCreate: boolean; previous?: PluginRecord },
    onNotify: (n: Omit<PluginNotification, "id" | "createdAt" | "read">) => void,
): PluginRecord {
    let current = record;
    if (!plugin.workflows?.length) return current;

    for (const wf of plugin.workflows) {
        if (wf.enabled === false || wf.entityId !== record.entityId) continue;
        let fires = false;
        if (wf.trigger === "onCreate" && ctx.isCreate) {
            fires = conditionsPass(current, wf.conditions, wf.conditionLogic);
        } else if (wf.trigger === "onUpdate" && !ctx.isCreate) {
            fires = conditionsPass(current, wf.conditions, wf.conditionLogic);
        } else if (wf.trigger === "onFieldEquals" && wf.whenField) {
            const cur = current.data[wf.whenField];
            const prev = ctx.previous?.data[wf.whenField];
            if (String(cur) === String(wf.whenValue) && String(prev) !== String(cur)) {
                fires = conditionsPass(current, wf.conditions, wf.conditionLogic);
            }
        }
        if (!fires) continue;
        const result = runActions(plugin, wf, current, onNotify);
        if (result) current = result;
    }
    return current;
}

function runWorkflowsForDelete(
    plugin: PluginManifest,
    record: PluginRecord,
    onNotify: (n: Omit<PluginNotification, "id" | "createdAt" | "read">) => void,
) {
    if (!plugin.workflows?.length) return;
    for (const wf of plugin.workflows) {
        if (wf.enabled === false || wf.entityId !== record.entityId) continue;
        if (wf.trigger !== "onDelete") continue;
        if (!conditionsPass(record, wf.conditions, wf.conditionLogic)) continue;
        runActions(plugin, wf, record, onNotify, { deleted: true });
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function b64encode(s: string): string { return btoa(unescape(encodeURIComponent(s))); }
function b64decode(s: string): string { return decodeURIComponent(escape(atob(s))); }

// Extracts and decodes a `#plugin=<base64>` share payload from any string
// (a full URL, a bare hash, or just the encoded chunk itself). Returns null
// if the string doesn't contain a share payload at all, so callers can fall
// back to treating it as a plain fetchable URL.
function decodeSharePayload(input: string): unknown | null {
    const m = input.match(/[#&]plugin=([^&]+)/);
    const encoded = m ? m[1] : input.trim();
    if (!encoded) return null;
    try {
        return JSON.parse(b64decode(decodeURIComponent(encoded)));
    } catch {
        return null;
    }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export const usePlugin = () => {
    const [pluginIndexes, setPluginIndexes] = useState<PluginManifest[]>([]);
    const [notifications, setNotifications] = useState<PluginNotification[]>([]);
    const [records, setRecords] = useState<PluginRecord[]>([]);
    const [trash, setTrash] = useState<TrashEntry[]>([]);
    const [activePluginId, setActivePluginId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isRecordsLoading, setIsRecordsLoading] = useState(false);
    const [installError, setInstallError] = useState<string | null>(null);

    // Refs keep latest values accessible inside async functions and callbacks
    // without causing stale closures or re-creating dependent useCallbacks.
    const recordsRef = useRef<PluginRecord[]>([]);
    const pluginIndexesRef = useRef<PluginManifest[]>([]);

    useEffect(() => { recordsRef.current = records; }, [records]);
    useEffect(() => { pluginIndexesRef.current = pluginIndexes; }, [pluginIndexes]);

    // ─── 1. Initial load ────────────────────────────────────────────────────────

    const loadDataFromOPFS = useCallback(async () => {
        try {
            const [indexes, notifs] = await Promise.all([
                StorageEngine.loadPluginIndexes(),
                StorageEngine.loadPluginNotificationsFile(),
            ]);
            // Merge rather than overwrite: if a plugin was installed in-memory
            // before this load resolved (e.g. a #plugin= hash install racing
            // the initial fetch), keep it instead of silently dropping it.
            setPluginIndexes((prev) => {
                if (prev.length === 0) return indexes;
                const byId = new Map(indexes.map((p) => [p.id, p]));
                const extras = prev.filter((p) => !byId.has(p.id));
                return [...indexes, ...extras];
            });
            setNotifications(notifs);
            setIsInitialized(true);
        } catch (err) {
            console.error("[usePlugin] Failed to load from OPFS:", err);
        }
    }, []);

    useEffect(() => {
        loadDataFromOPFS();
        const handleRestore = () => loadDataFromOPFS();
        window.addEventListener("opfs-data-restored", handleRestore);
        return () => window.removeEventListener("opfs-data-restored", handleRestore);
    }, [loadDataFromOPFS]);

    // ─── 2. Auto-save ───────────────────────────────────────────────────────────

    useEffect(() => {
        if (isInitialized) StorageEngine.savePluginIndexesDebounced(pluginIndexes);
    }, [pluginIndexes, isInitialized]);

    useEffect(() => {
        if (isInitialized) StorageEngine.savePluginNotificationsDebounced(notifications);
    }, [notifications, isInitialized]);

    useEffect(() => {
        if (isInitialized && activePluginId) {
            StorageEngine.savePluginDataDebounced(activePluginId, records);
        }
    }, [records, isInitialized, activePluginId]);

    // ─── 3. Notification helper ──────────────────────────────────────────────────
    //
    // Always called OUTSIDE state updater functions — never inside setRecords —
    // so it fires exactly once even in React StrictMode.

    const _addNotificationRaw = useCallback(
        (n: Omit<PluginNotification, "id" | "createdAt" | "read">) => {
            const notif: PluginNotification = {
                ...n,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                read: false,
            };
            setNotifications((prev) => [notif, ...prev].slice(0, 200));
        },
        [],
    );

    // ─── 4. Per-plugin record loading ───────────────────────────────────────────

    const loadPluginRecords = useCallback(async (pluginId: string) => {
        setIsRecordsLoading(true);
        setActivePluginId(pluginId);
        try {
            const data = await StorageEngine.loadPluginData(pluginId);
            setRecords(data);
            setTrash([]);
        } catch (err) {
            console.error(`[usePlugin] Failed to load records for ${pluginId}:`, err);
            setRecords([]);
        } finally {
            setIsRecordsLoading(false);
        }
    }, []);

    // ─── 5. Plugin manifest actions ─────────────────────────────────────────────

    const installPlugin = useCallback((manifest: PluginManifest) => {
        setPluginIndexes((prev) => {
            if (prev.some((p) => p.id === manifest.id)) {
                return prev.map((p) => (p.id === manifest.id ? manifest : p));
            }
            return [manifest, ...prev];
        });
    }, []);

    const updatePlugin = useCallback((manifest: PluginManifest) => {
        setPluginIndexes((prev) =>
            prev.map((p) => (p.id === manifest.id ? manifest : p))
        );
    }, []);

    const uninstallPlugin = useCallback((pluginId: string, wipeData = true) => {
        setPluginIndexes((prev) => prev.filter((p) => p.id !== pluginId));
        if (activePluginId === pluginId) {
            setRecords([]);
            setTrash([]);
            setActivePluginId(null);
        }
        if (wipeData) StorageEngine.deletePluginFile(pluginId);
    }, [activePluginId]);

    const getPlugin = useCallback(
        (pluginId: string): PluginManifest | undefined =>
            pluginIndexesRef.current.find((p) => p.id === pluginId),
        [],
    );

    const getRecentPlugins = useCallback(
        (limit = 5): PluginManifest[] => pluginIndexes.slice(0, limit),
        [pluginIndexes],
    );

    const duplicatePlugin = useCallback(
        (pluginId: string): PluginManifest | null => {
            const p = pluginIndexesRef.current.find((x) => x.id === pluginId);
            if (!p) return null;
            const clone: PluginManifest = {
                ...p,
                id: crypto.randomUUID(),
                name: `${p.name} copy`,
                builtin: false,
            };
            installPlugin(clone);
            return clone;
        },
        [installPlugin],
    );

    // ─── 6. Record actions ──────────────────────────────────────────────────────
    //
    // All workflow side-effects (notifications) are computed using recordsRef
    // BEFORE any setRecords call, never inside a state updater function.
    // This prevents React StrictMode from double-firing notifications.

    const upsertRecord = useCallback(
        (record: PluginRecord) => {
            const plugin = pluginIndexesRef.current.find((p) => p.id === activePluginId);
            const now = new Date().toISOString();

            const prev = recordsRef.current;
            const idx = prev.findIndex((r) => r.id === record.id);
            const isCreate = idx === -1;
            const previous = isCreate ? undefined : prev[idx];

            const merged: PluginRecord = isCreate
                ? { ...record, createdAt: record.createdAt || now, updatedAt: now }
                : { ...prev[idx], ...record, updatedAt: now };

            // Workflows + notifications fire exactly once here, outside the setter
            const final = plugin
                ? runWorkflowsForChange(plugin, merged, { isCreate, previous }, _addNotificationRaw)
                : merged;

            setRecords((rs) =>
                isCreate
                    ? [final, ...rs]
                    : rs.map((r) => (r.id === final.id ? final : r))
            );
        },
        [activePluginId, _addNotificationRaw],
    );

    const deleteRecord = useCallback(
        (recordId: string) => {
            const plugin = pluginIndexesRef.current.find((p) => p.id === activePluginId);
            const now = new Date().toISOString();

            const record = recordsRef.current.find((r) => r.id === recordId);
            if (record) {
                setTrash((t) => [{ record, deletedAt: now }, ...t].slice(0, 50));
                if (plugin) runWorkflowsForDelete(plugin, record, _addNotificationRaw);
            }
            setRecords((prev) => prev.filter((r) => r.id !== recordId));
        },
        [activePluginId, _addNotificationRaw],
    );

    const bulkDeleteRecords = useCallback(
        (recordIds: string[]) => {
            if (!recordIds.length) return;
            const plugin = pluginIndexesRef.current.find((p) => p.id === activePluginId);
            const ids = new Set(recordIds);
            const now = new Date().toISOString();

            const toDelete = recordsRef.current.filter((r) => ids.has(r.id));
            setTrash((t) =>
                [...toDelete.map((record) => ({ record, deletedAt: now })), ...t].slice(0, 50)
            );
            if (plugin) {
                for (const r of toDelete) runWorkflowsForDelete(plugin, r, _addNotificationRaw);
            }
            setRecords((prev) => prev.filter((r) => !ids.has(r.id)));
        },
        [activePluginId, _addNotificationRaw],
    );

    const bulkUpdateRecords = useCallback(
        (recordIds: string[], patch: Record<string, unknown>) => {
            if (!recordIds.length) return;
            const plugin = pluginIndexesRef.current.find((p) => p.id === activePluginId);
            const ids = new Set(recordIds);
            const now = new Date().toISOString();

            const prev = recordsRef.current;
            const next = prev.map((r) => {
                if (!ids.has(r.id)) return r;
                const updated = { ...r, data: { ...r.data, ...patch }, updatedAt: now };
                return plugin
                    ? runWorkflowsForChange(plugin, updated, { isCreate: false, previous: r }, _addNotificationRaw)
                    : updated;
            });
            setRecords(next);
        },
        [activePluginId, _addNotificationRaw],
    );

    const getRecordsForEntity = useCallback(
        (entityId: string): PluginRecord[] =>
            records.filter((r) => r.entityId === entityId),
        [records],
    );

    // ─── 7. Trash / undo ────────────────────────────────────────────────────────

    const restoreRecord = useCallback((recordId: string): boolean => {
        const entry = trash.find((t) => t.record.id === recordId);
        if (!entry) return false;
        setTrash((prev) => prev.filter((t) => t.record.id !== recordId));
        setRecords((prev) =>
            prev.some((r) => r.id === entry.record.id) ? prev : [entry.record, ...prev]
        );
        return true;
    }, [trash]);

    const restoreRecords = useCallback((recordIds: string[]): number => {
        const toRestore = trash.filter((t) => recordIds.includes(t.record.id));
        setTrash((prev) => prev.filter((t) => !recordIds.includes(t.record.id)));
        setRecords((prev) => {
            const existing = new Set(prev.map((r) => r.id));
            const additions = toRestore
                .map((t) => t.record)
                .filter((r) => !existing.has(r.id));
            return [...additions, ...prev];
        });
        return toRestore.length;
    }, [trash]);

    // ─── 8. Notification actions ─────────────────────────────────────────────────

    const addNotification = useCallback(
        (n: Omit<PluginNotification, "id" | "createdAt" | "read">) => {
            _addNotificationRaw(n);
        },
        [_addNotificationRaw],
    );

    const markNotificationRead = useCallback((id: string, read = true) => {
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, read } : n))
        );
    }, []);

    const markAllNotificationsRead = useCallback((pluginId?: string) => {
        setNotifications((prev) =>
            prev.map((n) => (!pluginId || n.pluginId === pluginId ? { ...n, read: true } : n))
        );
    }, []);

    const clearNotifications = useCallback((pluginId?: string) => {
        setNotifications((prev) =>
            pluginId ? prev.filter((n) => n.pluginId !== pluginId) : []
        );
    }, []);

    const getNotificationsForPlugin = useCallback(
        (pluginId: string): PluginNotification[] =>
            notifications.filter((n) => n.pluginId === pluginId),
        [notifications],
    );

    // ─── 9. Export / import / share ─────────────────────────────────────────────

    const exportPlugin = useCallback(
        async (pluginId: string, includeData = true) => {
            const manifest = pluginIndexesRef.current.find((p) => p.id === pluginId);
            if (!manifest) return null;

            let data: PluginRecord[] = [];
            if (includeData) {
                // Use in-memory records if this plugin is active,
                // otherwise read from OPFS so export is never empty
                data = activePluginId === pluginId
                    ? recordsRef.current
                    : await StorageEngine.loadPluginData(pluginId);
            }

            return {
                format: "elephant-plugin/v1",
                manifest,
                data,
                exportedAt: new Date().toISOString(),
            };
        },
        [activePluginId],
    );

    // importPlugin reads from pluginIndexesRef instead of closing over
    // pluginIndexes state — so it always sees the latest list even after
    // an await gap (fixes stale closure when called from installFromUrl).
    const importPlugin = useCallback(
        (payload: unknown): PluginManifest => {
            const p = payload as { manifest: PluginManifest; data?: PluginRecord[] };
            if (!p?.manifest?.id) throw new Error("Invalid plugin file");

            let manifest = { ...p.manifest, builtin: false };

            // Always reads latest — never stale after an await
            if (pluginIndexesRef.current.some((x) => x.id === manifest.id)) {
                manifest = { ...manifest, id: crypto.randomUUID(), name: `${manifest.name} (imported)` };
            }
            installPlugin(manifest);

            if (p.data?.length) {
                StorageEngine.savePluginDataDebounced(manifest.id, p.data.map((r) => ({ ...r })));
            }
            return manifest;
        },
        [installPlugin], // no longer depends on pluginIndexes state
    );

    const buildShareLink = useCallback(
        (pluginId: string): string | null => {
            if (typeof window === "undefined") return null;
            const manifest = pluginIndexesRef.current.find((p) => p.id === pluginId);
            if (!manifest) return null;
            const payload = { format: "elephant-plugin/v1", manifest, data: [] };
            const encoded = b64encode(JSON.stringify(payload));
            return `${window.location.origin}${window.location.pathname}#plugin=${encoded}`;
        },
        [],
    );

    const tryInstallFromHash = useCallback((): PluginManifest | null => {
        if (typeof window === "undefined") return null;
        if (!/[#&]plugin=/.test(window.location.hash)) return null;
        const payload = decodeSharePayload(window.location.hash);
        if (!payload) return null;
        try {
            const installed = importPlugin(payload);
            history.replaceState(null, "", window.location.pathname + window.location.search);
            return installed;
        } catch {
            return null;
        }
    }, [importPlugin]);

    const installFromUrl = useCallback(
        async (url: string): Promise<PluginManifest | null> => {
            setInstallError(null);
            const trimmed = url.trim();

            // Case 1: a share link (this app's own #plugin=<base64> format, or
            // even just the bare encoded payload pasted on its own). No network
            // request needed — decode and install directly.
            if (/[#&]plugin=/.test(trimmed) || /^[A-Za-z0-9+/_-]+=*$/.test(trimmed)) {
                const payload = decodeSharePayload(trimmed);
                if (payload) {
                    try {
                        return importPlugin(payload);
                    } catch (err) {
                        const message = err instanceof Error ? err.message : "Could not install plugin from share link.";
                        setInstallError(message);
                        return null;
                    }
                }
                // If it had a #plugin= marker but failed to decode, don't silently
                // fall through to fetch — it's clearly meant to be a share link.
                if (/[#&]plugin=/.test(trimmed)) {
                    setInstallError("This share link looks corrupted or incomplete — try copying it again.");
                    return null;
                }
            }

            // Case 2: a plain URL expected to return plugin JSON directly.
            try {
                let res: Response;
                try {
                    res = await fetch(trimmed);
                } catch {
                    throw new Error("Could not reach the URL — check your connection or the URL.");
                }

                if (!res.ok) {
                    throw new Error(`Server returned ${res.status} ${res.statusText}`);
                }

                let json: unknown;
                try {
                    json = await res.json();
                } catch {
                    throw new Error("URL did not return valid JSON.");
                }

                if (!json || typeof json !== "object" || Array.isArray(json)) {
                    throw new Error("Invalid plugin format — expected a JSON object.");
                }

                // Accept both a bare PluginManifest and a { manifest, data } envelope
                const payload = (json as Record<string, unknown>).manifest
                    ? json
                    : { manifest: json, data: [] };

                // importPlugin now reads pluginIndexesRef internally so
                // the stale closure after await is no longer an issue
                return importPlugin(payload);
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error installing plugin.";
                console.error("[usePlugin] installFromUrl failed:", message);
                setInstallError(message);
                return null;
            }
        },
        [importPlugin],
    );

    const clearInstallError = useCallback(() => setInstallError(null), []);

    // ─── 10. Reminders ───────────────────────────────────────────────────────────

    const getDueReminders = useCallback((): ReminderHit[] => {
        if (!activePluginId) return [];
        const plugin = pluginIndexesRef.current.find((p) => p.id === activePluginId);
        if (!plugin?.reminders?.length) return [];

        const now = Date.now();
        const hits: ReminderHit[] = [];

        for (const rem of plugin.reminders) {
            const entity = plugin.entities.find((e) => e.id === rem.entityId);
            if (!entity) continue;
            for (const r of records.filter((r) => r.entityId === rem.entityId)) {
                const raw = r.data[rem.dateField];
                if (!raw) continue;
                const t = new Date(raw as string).getTime();
                if (Number.isNaN(t)) continue;
                const leadMs = (rem.leadDays ?? 0) * 86400000;
                if (t - leadMs > now) continue;
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
        return hits.sort((a, b) => +new Date(a.due) - +new Date(b.due));
    }, [activePluginId, records]);

    // ─────────────────────────────────────────────────────────────────────────────

    return {
        // State
        isInitialized,
        isRecordsLoading,
        activePluginId,
        pluginIndexes,
        notifications,
        records,
        trash,
        installError,
        // Plugin manifest
        installPlugin,
        updatePlugin,
        uninstallPlugin,
        getPlugin,
        getRecentPlugins,
        duplicatePlugin,
        // Records
        loadPluginRecords,
        upsertRecord,
        deleteRecord,
        bulkDeleteRecords,
        bulkUpdateRecords,
        getRecordsForEntity,
        // Trash
        restoreRecord,
        restoreRecords,
        // Notifications
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        getNotificationsForPlugin,
        // Export / import / share
        exportPlugin,
        importPlugin,
        buildShareLink,
        tryInstallFromHash,
        installFromUrl,
        clearInstallError,
        //  reminders
        getDueReminders,
    };
};