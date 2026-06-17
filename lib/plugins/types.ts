export type FieldType =
    | "text"
    | "longtext"
    | "number"
    | "currency"
    | "date"
    | "select"
    | "multiselect"
    | "checkbox"
    | "url"
    | "email"
    | "rating"
    | "progress"
    | "tags"
    | "relation"
    | "formula"
    | "color";

export interface FieldDef {
    id: string;
    key: string;
    label: string;
    type: FieldType;
    options?: string[];
    required?: boolean;
    help?: string;
    /** For relation fields: target entity id (within same plugin). */
    relationEntityId?: string;
    /** For formula fields: expression like "{{price}} * {{qty}}". */
    formula?: string;
    /** For rating fields: max stars (default 5). For number/currency: upper bound (used for validation). */
    max?: number;
    /** For number/currency fields: lower bound (used for validation). */
    min?: number;
    /** For number/currency fields: prefix/suffix. */
    prefix?: string;
    suffix?: string;
}

export interface StatusDef {
    id: string;
    label: string;
    color: string; // tailwind hue token e.g. "emerald"
}

export interface EntityDef {
    id: string;
    name: string; // singular
    plural: string;
    icon: string; // emoji
    color: string; // hex or token
    titleField: string; // field key used as record title
    fields: FieldDef[];
    statuses?: StatusDef[];
    statusField?: string; // field key (must be select) acting as status
}

export type ViewKind =
    | "table"
    | "kanban"
    | "grid"
    | "list"
    | "calendar"
    | "gallery"
    | "timeline"
    | "feed";

export interface ViewDef {
    id: string;
    name: string;
    entityId: string;
    kind: ViewKind;
    visibleFields?: string[]; // field keys
    groupBy?: string; // field key for kanban
}

export type WidgetKind =
    | "count"
    | "recent"
    | "byStatus"
    | "sum"
    | "upcoming"
    | "chart"
    | "kpi"
    | "progress"
    | "streak"
    | "goal"
    | "table";

export interface WidgetDef {
    id: string;
    title: string;
    kind: WidgetKind;
    entityId: string;
    fieldKey?: string; // for sum / upcoming(date) / byStatus
    accent?: string; // hex
    /** Chart sub-kind. */
    chartKind?: "bar" | "line" | "pie" | "area";
    /** Goal target (for goal/progress widgets). */
    target?: number;
    /** KPI: optional comparison window in days. */
    comparePeriodDays?: number;
    /** Streak: field key for the date used. */
    dateField?: string;
}

export interface DashboardDef {
    id: string;
    name: string;
    widgets: WidgetDef[];
}

/* -------- Filters / search (used by views at runtime, not persisted to manifest) -------- */

export type FilterOp =
    | "eq"
    | "neq"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "notContains"
    | "isEmpty"
    | "isNotEmpty";

export interface FieldFilter {
    id: string;
    fieldKey: string;
    op: FilterOp;
    value?: string;
}

/* -------- Workflows / automations -------- */

export type TriggerKind =
    | "onCreate"
    | "onUpdate"
    | "onFieldEquals"
    | "onDelete";

export type ActionKind =
    | "setField"
    | "increment"
    | "stampDate"
    | "clearField"
    | "copyField"
    | "notify"
    | "branch";

export interface WorkflowCondition {
    id: string;
    fieldKey: string;
    op: FilterOp;
    value?: string;
}

/**
 * A single condition used inside a branch action.
 * Identical shape to WorkflowCondition — kept as a separate
 * named type so callers can distinguish the two contexts.
 */
export interface BranchCondition {
    id: string;
    fieldKey: string;
    op: FilterOp;
    value?: string;
}

export interface WorkflowAction {
    id: string;
    kind: ActionKind;
    /** target entity (defaults to trigger's entity) */
    entityId?: string;
    fieldKey?: string;
    /** literal value or template string with {{field}} substitution */
    value?: string | number | boolean;
    /** for copyField: source field to read from */
    sourceFieldKey?: string;
    /** for notify: message template (supports {{field}}) */
    message?: string;
    /* ---- branch-specific ---- */
    /** conditions evaluated when kind === "branch" */
    branchConditions?: BranchCondition[];
    /** "all" = AND logic (default), "any" = OR logic */
    branchConditionLogic?: "all" | "any";
    /** actions to run when branch condition is TRUE */
    thenActions?: WorkflowAction[];
    /** actions to run when branch condition is FALSE (optional) */
    elseActions?: WorkflowAction[];
    /** optional human-readable label shown in the workflow tree */
    branchLabel?: string;
}

export interface WorkflowDef {
    id: string;
    name: string;
    entityId: string;
    trigger: TriggerKind;
    /** legacy single-condition form, kept for backward compatibility */
    whenField?: string;
    whenValue?: string;
    /** richer multi-condition form */
    conditions?: WorkflowCondition[];
    conditionLogic?: "all" | "any";
    actions: WorkflowAction[];
    enabled?: boolean;
}

/* -------- Pages (mini-apps) -------- */

export interface PageBlock {
    id: string;
    kind: "widget" | "view" | "markdown";
    widgetId?: string;
    viewId?: string;
    markdown?: string;
    span?: 1 | 2 | 3; // grid span out of 3
}

export interface PageDef {
    id: string;
    name: string;
    icon?: string;
    blocks: PageBlock[];
}

export interface FeedCardDef {
    id: string;
    entityId: string;
    title: string;
    reason: string; // template string with {{field}}
    when: "recent" | "overdue" | "upcoming" | "all";
    dateField?: string;
}

export interface ReminderDef {
    id: string;
    entityId: string;
    label: string;
    dateField: string;
    leadDays?: number;
}

/* -------- Notifications -------- */

export interface PluginNotification {
    id: string;
    pluginId: string;
    title: string;
    body?: string;
    entityId?: string;
    recordId?: string;
    createdAt: string;
    read?: boolean;
}

/** A computed reminder that is due/overdue, surfaced in the notification center. */
export interface ReminderHit {
    id: string;
    pluginId: string;
    pluginName: string;
    pluginIcon: string;
    accent: string;
    entityId: string;
    recordId: string;
    label: string;
    due: string; // ISO date
    overdue: boolean;
}

export interface PluginManifest {
    id: string;
    slug: string;
    name: string;
    version: string;
    description: string;
    icon: string; // emoji
    accent: string; // hex color
    author?: string;
    entities: EntityDef[];
    views: ViewDef[];
    dashboards: DashboardDef[];
    feedCards?: FeedCardDef[];
    reminders?: ReminderDef[];
    builtin?: boolean;
    workflows?: WorkflowDef[];
    pages?: PageDef[];
    category?: "productivity" | "personal" | "work" | "creative" | "fitness" | "finance" | "research";
    tags?: string[];
}

export interface PluginRecord {
    id: string;
    entityId: string;
    data: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}