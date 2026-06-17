import type { PluginManifest } from "./types";

export const FREELANCER_CRM: PluginManifest = {
    id: "builtin-freelancer-crm",
    slug: "freelancer-crm",
    name: "Freelancer CRM",
    version: "1.0.0",
    description:
        "Track clients, projects, and revenue. Adds follow-up reminders and a client activity feed.",
    icon: "💼",
    accent: "#f59e0b",
    author: "Elephant",
    builtin: true,
    entities: [
        {
            id: "client",
            name: "Client",
            plural: "Clients",
            icon: "🧑",
            color: "#f59e0b",
            titleField: "name",
            statusField: "stage",
            statuses: [
                { id: "lead", label: "Lead", color: "slate" },
                { id: "active", label: "Active", color: "emerald" },
                { id: "paused", label: "Paused", color: "amber" },
                { id: "won", label: "Won", color: "violet" },
            ],
            fields: [
                { id: "f1", key: "name", label: "Name", type: "text", required: true },
                { id: "f2", key: "company", label: "Company", type: "text" },
                { id: "f3", key: "email", label: "Email", type: "email" },
                { id: "f4", key: "stage", label: "Stage", type: "select", options: ["lead", "active", "paused", "won"] },
                { id: "f5", key: "rate", label: "Hourly rate", type: "currency" },
                { id: "f6", key: "nextFollowup", label: "Next follow-up", type: "date" },
                { id: "f7", key: "notes", label: "Notes", type: "longtext" },
            ],
        },
        {
            id: "project",
            name: "Project",
            plural: "Projects",
            icon: "📦",
            color: "#0ea5e9",
            titleField: "title",
            statusField: "status",
            statuses: [
                { id: "planning", label: "Planning", color: "slate" },
                { id: "in-progress", label: "In progress", color: "sky" },
                { id: "review", label: "Review", color: "amber" },
                { id: "done", label: "Done", color: "emerald" },
            ],
            fields: [
                { id: "p1", key: "title", label: "Title", type: "text", required: true },
                { id: "p2", key: "client", label: "Client", type: "text" },
                { id: "p3", key: "status", label: "Status", type: "select", options: ["planning", "in-progress", "review", "done"] },
                { id: "p4", key: "budget", label: "Budget", type: "currency" },
                { id: "p5", key: "due", label: "Due date", type: "date" },
            ],
        },
    ],
    views: [
        { id: "v1", name: "Clients table", entityId: "client", kind: "table" },
        { id: "v2", name: "Pipeline", entityId: "client", kind: "kanban", groupBy: "stage" },
        { id: "v3", name: "Projects board", entityId: "project", kind: "kanban", groupBy: "status" },
        { id: "v4", name: "Projects list", entityId: "project", kind: "list" },
    ],
    dashboards: [
        {
            id: "d1",
            name: "Overview",
            widgets: [
                { id: "w1", title: "Total clients", kind: "count", entityId: "client", accent: "#f59e0b" },
                { id: "w2", title: "Active projects", kind: "count", entityId: "project", accent: "#0ea5e9" },
                { id: "w3", title: "Pipeline by stage", kind: "byStatus", entityId: "client", fieldKey: "stage" },
                { id: "w4", title: "Total budget", kind: "sum", entityId: "project", fieldKey: "budget", accent: "#10b981" },
                { id: "w5", title: "Upcoming follow-ups", kind: "upcoming", entityId: "client", fieldKey: "nextFollowup" },
                { id: "w6", title: "Recent clients", kind: "recent", entityId: "client" },
            ],
        },
    ],
    feedCards: [
        { id: "fc1", entityId: "client", title: "Follow up with {{name}}", reason: "Scheduled follow-up is due", when: "overdue", dateField: "nextFollowup" },
        { id: "fc2", entityId: "project", title: "{{title}} is due soon", reason: "Project deadline approaching", when: "upcoming", dateField: "due" },
    ],
    reminders: [
        { id: "r1", entityId: "client", label: "Follow up with {{name}}", dateField: "nextFollowup", leadDays: 1 },
    ],
};

export const RESEARCH_WORKSPACE: PluginManifest = {
    id: "builtin-research-workspace",
    slug: "research-workspace",
    name: "Research Workspace",
    version: "1.0.0",
    description: "Manage research papers, sources, and evidence with a study dashboard.",
    icon: "🔬",
    accent: "#8b5cf6",
    author: "Elephant",
    builtin: true,
    entities: [
        {
            id: "paper",
            name: "Paper",
            plural: "Papers",
            icon: "📄",
            color: "#8b5cf6",
            titleField: "title",
            statusField: "status",
            statuses: [
                { id: "to-read", label: "To read", color: "slate" },
                { id: "reading", label: "Reading", color: "sky" },
                { id: "annotated", label: "Annotated", color: "amber" },
                { id: "cited", label: "Cited", color: "emerald" },
            ],
            fields: [
                { id: "p1", key: "title", label: "Title", type: "text", required: true },
                { id: "p2", key: "authors", label: "Authors", type: "text" },
                { id: "p3", key: "year", label: "Year", type: "number" },
                { id: "p4", key: "status", label: "Status", type: "select", options: ["to-read", "reading", "annotated", "cited"] },
                { id: "p5", key: "url", label: "URL", type: "url" },
                { id: "p6", key: "summary", label: "Summary", type: "longtext" },
            ],
        },
        {
            id: "evidence",
            name: "Evidence",
            plural: "Evidence",
            icon: "🧪",
            color: "#10b981",
            titleField: "claim",
            fields: [
                { id: "e1", key: "claim", label: "Claim", type: "text", required: true },
                { id: "e2", key: "source", label: "Source", type: "text" },
                { id: "e3", key: "strength", label: "Strength", type: "select", options: ["weak", "moderate", "strong"] },
                { id: "e4", key: "notes", label: "Notes", type: "longtext" },
            ],
        },
    ],
    views: [
        { id: "rv1", name: "Reading list", entityId: "paper", kind: "kanban", groupBy: "status" },
        { id: "rv2", name: "Papers table", entityId: "paper", kind: "table" },
        { id: "rv3", name: "Evidence grid", entityId: "evidence", kind: "grid" },
    ],
    dashboards: [
        {
            id: "rd1",
            name: "Study dashboard",
            widgets: [
                { id: "rw1", title: "Papers tracked", kind: "count", entityId: "paper", accent: "#8b5cf6" },
                { id: "rw2", title: "Evidence collected", kind: "count", entityId: "evidence", accent: "#10b981" },
                { id: "rw3", title: "Reading pipeline", kind: "byStatus", entityId: "paper", fieldKey: "status" },
                { id: "rw4", title: "Recently added", kind: "recent", entityId: "paper" },
            ],
        },
    ],
    feedCards: [
        { id: "rfc1", entityId: "paper", title: "Revisit {{title}}", reason: "Annotated paper worth re-reading", when: "recent" },
    ],
};

/* -------- New rich plugins -------- */

export const HABIT_TRACKER: PluginManifest = {
    id: "builtin-habit-tracker",
    slug: "habit-tracker",
    name: "Habit Tracker",
    version: "1.0.0",
    description: "Build daily habits, log streaks, and stay consistent with calendar + streak widgets.",
    icon: "🧠",
    accent: "#10b981",
    builtin: true,
    category: "personal",
    tags: ["habits", "wellbeing"],
    entities: [
        {
            id: "habit", name: "Habit", plural: "Habits", icon: "🌱", color: "#10b981", titleField: "name",
            fields: [
                { id: "h1", key: "name", label: "Habit", type: "text", required: true },
                { id: "h2", key: "frequency", label: "Frequency", type: "select", options: ["daily", "weekly"] },
                { id: "h3", key: "color", label: "Color", type: "color" },
                { id: "h4", key: "notes", label: "Notes", type: "longtext" },
            ],
        },
        {
            id: "log", name: "Check-in", plural: "Check-ins", icon: "✅", color: "#10b981", titleField: "habit",
            fields: [
                { id: "l1", key: "habit", label: "Habit", type: "text", required: true },
                { id: "l2", key: "date", label: "Date", type: "date", required: true },
                { id: "l3", key: "mood", label: "Mood", type: "rating", max: 5 },
                { id: "l4", key: "note", label: "Note", type: "longtext" },
            ],
        },
    ],
    views: [
        { id: "hv1", name: "Habits", entityId: "habit", kind: "grid" },
        { id: "hv2", name: "Check-in calendar", entityId: "log", kind: "calendar", groupBy: "date" },
        { id: "hv3", name: "Recent check-ins", entityId: "log", kind: "feed" },
    ],
    dashboards: [{
        id: "hd1", name: "Today",
        widgets: [
            { id: "hw1", title: "Total habits", kind: "count", entityId: "habit", accent: "#10b981" },
            { id: "hw2", title: "Check-ins this week", kind: "kpi", entityId: "log", comparePeriodDays: 7, accent: "#0ea5e9" },
            { id: "hw3", title: "Current streak", kind: "streak", entityId: "log", dateField: "date", accent: "#f59e0b" },
            { id: "hw4", title: "Weekly goal", kind: "goal", entityId: "log", target: 21, accent: "#10b981" },
            { id: "hw5", title: "Mood distribution", kind: "chart", chartKind: "bar", entityId: "log", fieldKey: "mood", accent: "#8b5cf6" },
        ],
    }],
    workflows: [
        {
            id: "hwf1", name: "Stamp date on new check-in", entityId: "log", trigger: "onCreate", enabled: true,
            actions: [{ id: "a1", kind: "stampDate", fieldKey: "date" }]
        },
    ],
};

export const READING_LOG: PluginManifest = {
    id: "builtin-reading-log",
    slug: "reading-log",
    name: "Reading Log",
    version: "1.0.0",
    description: "Track books you're reading with ratings, progress, and a beautiful gallery shelf.",
    icon: "📚",
    accent: "#8b5cf6",
    builtin: true,
    category: "personal",
    entities: [{
        id: "book", name: "Book", plural: "Books", icon: "📖", color: "#8b5cf6", titleField: "title", statusField: "status",
        statuses: [
            { id: "queue", label: "Want to read", color: "slate" },
            { id: "reading", label: "Reading", color: "sky" },
            { id: "done", label: "Finished", color: "emerald" },
        ],
        fields: [
            { id: "b1", key: "title", label: "Title", type: "text", required: true },
            { id: "b2", key: "author", label: "Author", type: "text" },
            { id: "b3", key: "status", label: "Status", type: "select", options: ["queue", "reading", "done"] },
            { id: "b4", key: "rating", label: "Rating", type: "rating", max: 5 },
            { id: "b5", key: "progress", label: "Progress", type: "progress" },
            { id: "b6", key: "tags", label: "Tags", type: "tags" },
            { id: "b7", key: "notes", label: "Notes", type: "longtext" },
        ],
    }],
    views: [
        { id: "bv1", name: "Shelf", entityId: "book", kind: "gallery" },
        { id: "bv2", name: "Reading board", entityId: "book", kind: "kanban", groupBy: "status" },
        { id: "bv3", name: "All books", entityId: "book", kind: "table" },
    ],
    dashboards: [{
        id: "bd1", name: "Reading",
        widgets: [
            { id: "bw1", title: "Books tracked", kind: "count", entityId: "book", accent: "#8b5cf6" },
            { id: "bw2", title: "Annual goal", kind: "goal", entityId: "book", target: 24, accent: "#10b981" },
            { id: "bw3", title: "Status breakdown", kind: "chart", chartKind: "pie", entityId: "book", fieldKey: "status", accent: "#8b5cf6" },
            { id: "bw4", title: "Recently updated", kind: "recent", entityId: "book" },
        ],
    }],
};

export const WORKOUT_TRACKER: PluginManifest = {
    id: "builtin-workout-tracker",
    slug: "workout-tracker",
    name: "Workout Tracker",
    version: "1.0.0",
    description: "Plan workouts, log sets, and watch your streak grow with charts and progress goals.",
    icon: "💪",
    accent: "#ef4444",
    builtin: true,
    category: "fitness",
    entities: [{
        id: "session", name: "Session", plural: "Sessions", icon: "🏋️", color: "#ef4444", titleField: "title",
        fields: [
            { id: "s1", key: "title", label: "Workout", type: "text", required: true },
            { id: "s2", key: "date", label: "Date", type: "date" },
            { id: "s3", key: "type", label: "Type", type: "select", options: ["push", "pull", "legs", "cardio", "mobility"] },
            { id: "s4", key: "duration", label: "Minutes", type: "number" },
            { id: "s5", key: "intensity", label: "Intensity", type: "rating", max: 5 },
            { id: "s6", key: "notes", label: "Notes", type: "longtext" },
        ],
    }],
    views: [
        { id: "wv1", name: "Calendar", entityId: "session", kind: "calendar", groupBy: "date" },
        { id: "wv2", name: "Timeline", entityId: "session", kind: "timeline", groupBy: "date" },
        { id: "wv3", name: "Sessions", entityId: "session", kind: "table" },
    ],
    dashboards: [{
        id: "wd1", name: "Fitness",
        widgets: [
            { id: "ww1", title: "Total sessions", kind: "count", entityId: "session", accent: "#ef4444" },
            { id: "ww2", title: "Current streak", kind: "streak", entityId: "session", dateField: "date", accent: "#f59e0b" },
            { id: "ww3", title: "Minutes this week", kind: "kpi", entityId: "session", fieldKey: "duration", comparePeriodDays: 7, accent: "#0ea5e9" },
            { id: "ww4", title: "Split by type", kind: "chart", chartKind: "pie", entityId: "session", fieldKey: "type", accent: "#ef4444" },
            { id: "ww5", title: "Monthly goal", kind: "goal", entityId: "session", target: 16, accent: "#10b981" },
        ],
    }],
};

export const FINANCE_TRACKER: PluginManifest = {
    id: "builtin-finance-tracker",
    slug: "finance-tracker",
    name: "Finance Tracker",
    version: "1.0.0",
    description: "Log income and expenses, categorize transactions, and see monthly cashflow at a glance.",
    icon: "💰",
    accent: "#0ea5e9",
    builtin: true,
    category: "finance",
    entities: [{
        id: "tx", name: "Transaction", plural: "Transactions", icon: "💸", color: "#0ea5e9", titleField: "label",
        fields: [
            { id: "t1", key: "label", label: "Label", type: "text", required: true },
            { id: "t2", key: "amount", label: "Amount", type: "currency", prefix: "$" },
            { id: "t3", key: "kind", label: "Kind", type: "select", options: ["income", "expense"] },
            { id: "t4", key: "category", label: "Category", type: "select", options: ["salary", "food", "rent", "transport", "fun", "other"] },
            { id: "t5", key: "date", label: "Date", type: "date" },
            { id: "t6", key: "notes", label: "Notes", type: "longtext" },
        ],
    }],
    views: [
        { id: "fv1", name: "Recent", entityId: "tx", kind: "feed" },
        { id: "fv2", name: "Calendar", entityId: "tx", kind: "calendar", groupBy: "date" },
        { id: "fv3", name: "Ledger", entityId: "tx", kind: "table" },
    ],
    dashboards: [{
        id: "fd1", name: "Money",
        widgets: [
            { id: "fw1", title: "Total tracked", kind: "sum", entityId: "tx", fieldKey: "amount", accent: "#0ea5e9" },
            { id: "fw2", title: "Transactions", kind: "count", entityId: "tx", accent: "#8b5cf6" },
            { id: "fw3", title: "By category", kind: "chart", chartKind: "bar", entityId: "tx", fieldKey: "category", accent: "#0ea5e9" },
            { id: "fw4", title: "Income vs expense", kind: "chart", chartKind: "pie", entityId: "tx", fieldKey: "kind", accent: "#10b981" },
            { id: "fw5", title: "Last 5 transactions", kind: "table", entityId: "tx" },
        ],
    }],
};

export const PROJECT_MANAGER: PluginManifest = {
    id: "builtin-project-manager",
    slug: "project-manager",
    name: "Project Manager",
    version: "1.0.0",
    description: "Plan projects, break them into tasks, run sprints with kanban + automations.",
    icon: "🎯",
    accent: "#6366f1",
    builtin: true,
    category: "work",
    entities: [
        {
            id: "proj", name: "Project", plural: "Projects", icon: "📁", color: "#6366f1", titleField: "name", statusField: "status",
            statuses: [
                { id: "active", label: "Active", color: "emerald" },
                { id: "paused", label: "Paused", color: "amber" },
                { id: "done", label: "Done", color: "slate" },
            ],
            fields: [
                { id: "pj1", key: "name", label: "Name", type: "text", required: true },
                { id: "pj2", key: "status", label: "Status", type: "select", options: ["active", "paused", "done"] },
                { id: "pj3", key: "owner", label: "Owner", type: "text" },
                { id: "pj4", key: "tags", label: "Tags", type: "tags" },
            ],
        },
        {
            id: "task", name: "Task", plural: "Tasks", icon: "✅", color: "#6366f1", titleField: "title", statusField: "status",
            statuses: [
                { id: "todo", label: "To do", color: "slate" },
                { id: "doing", label: "Doing", color: "sky" },
                { id: "review", label: "Review", color: "amber" },
                { id: "done", label: "Done", color: "emerald" },
            ],
            fields: [
                { id: "tk1", key: "title", label: "Task", type: "text", required: true },
                { id: "tk2", key: "status", label: "Status", type: "select", options: ["todo", "doing", "review", "done"] },
                { id: "tk3", key: "project", label: "Project", type: "relation", relationEntityId: "proj" },
                { id: "tk4", key: "due", label: "Due", type: "date" },
                { id: "tk5", key: "progress", label: "Progress", type: "progress" },
                { id: "tk6", key: "completedAt", label: "Completed at", type: "date" },
            ],
        },
    ],
    views: [
        { id: "pv1", name: "Sprint board", entityId: "task", kind: "kanban", groupBy: "status" },
        { id: "pv2", name: "Task calendar", entityId: "task", kind: "calendar", groupBy: "due" },
        { id: "pv3", name: "Projects gallery", entityId: "proj", kind: "gallery" },
    ],
    dashboards: [{
        id: "pd1", name: "Overview",
        widgets: [
            { id: "pw1", title: "Active projects", kind: "count", entityId: "proj", accent: "#6366f1" },
            { id: "pw2", title: "Open tasks", kind: "count", entityId: "task", accent: "#0ea5e9" },
            { id: "pw3", title: "Task status", kind: "chart", chartKind: "pie", entityId: "task", fieldKey: "status", accent: "#6366f1" },
            { id: "pw4", title: "Due soon", kind: "upcoming", entityId: "task", fieldKey: "due" },
            { id: "pw5", title: "Done this week", kind: "kpi", entityId: "task", comparePeriodDays: 7, accent: "#10b981" },
        ],
    }],
    workflows: [
        {
            id: "pwf1", name: "Stamp completion date", entityId: "task", trigger: "onFieldEquals", whenField: "status", whenValue: "done", enabled: true,
            actions: [
                { id: "a1", kind: "stampDate", fieldKey: "completedAt" },
                { id: "a2", kind: "setField", fieldKey: "progress", value: 100 },
            ]
        },
    ],
};

export const GOAL_TRACKER: PluginManifest = {
    id: "builtin-goal-tracker",
    slug: "goal-tracker",
    name: "Goal Tracker",
    version: "1.0.0",
    description: "Set quarterly goals, attach milestones, and visualize progress with goal widgets.",
    icon: "✨",
    accent: "#f59e0b",
    builtin: true,
    category: "personal",
    entities: [{
        id: "goal", name: "Goal", plural: "Goals", icon: "🎯", color: "#f59e0b", titleField: "title", statusField: "status",
        statuses: [
            { id: "active", label: "Active", color: "sky" },
            { id: "done", label: "Achieved", color: "emerald" },
            { id: "dropped", label: "Dropped", color: "slate" },
        ],
        fields: [
            { id: "g1", key: "title", label: "Goal", type: "text", required: true },
            { id: "g2", key: "status", label: "Status", type: "select", options: ["active", "done", "dropped"] },
            { id: "g3", key: "progress", label: "Progress", type: "progress" },
            { id: "g4", key: "deadline", label: "Deadline", type: "date" },
            { id: "g5", key: "why", label: "Why it matters", type: "longtext" },
        ],
    }],
    views: [
        { id: "gv1", name: "Active goals", entityId: "goal", kind: "gallery" },
        { id: "gv2", name: "Goal board", entityId: "goal", kind: "kanban", groupBy: "status" },
        { id: "gv3", name: "Deadline calendar", entityId: "goal", kind: "calendar", groupBy: "deadline" },
    ],
    dashboards: [{
        id: "gd1", name: "Focus",
        widgets: [
            { id: "gw1", title: "Active goals", kind: "count", entityId: "goal", accent: "#f59e0b" },
            { id: "gw2", title: "Achieved this year", kind: "kpi", entityId: "goal", comparePeriodDays: 365, accent: "#10b981" },
            { id: "gw3", title: "Status", kind: "chart", chartKind: "pie", entityId: "goal", fieldKey: "status", accent: "#f59e0b" },
            { id: "gw4", title: "Upcoming deadlines", kind: "upcoming", entityId: "goal", fieldKey: "deadline" },
        ],
    }],
};

export const PERSONAL_JOURNAL: PluginManifest = {
    id: "builtin-personal-journal",
    slug: "personal-journal",
    name: "Personal Journal",
    version: "1.0.0",
    description: "A daily journal with mood ratings, tags, and a beautiful feed.",
    icon: "📔",
    accent: "#ec4899",
    builtin: true,
    category: "personal",
    entities: [{
        id: "entry", name: "Entry", plural: "Entries", icon: "📝", color: "#ec4899", titleField: "title",
        fields: [
            { id: "j1", key: "title", label: "Title", type: "text", required: true },
            { id: "j2", key: "date", label: "Date", type: "date" },
            { id: "j3", key: "mood", label: "Mood", type: "rating", max: 5 },
            { id: "j4", key: "tags", label: "Tags", type: "tags" },
            { id: "j5", key: "body", label: "Entry", type: "longtext" },
        ],
    }],
    views: [
        { id: "jv1", name: "Journal feed", entityId: "entry", kind: "feed" },
        { id: "jv2", name: "Calendar", entityId: "entry", kind: "calendar", groupBy: "date" },
        { id: "jv3", name: "All entries", entityId: "entry", kind: "timeline", groupBy: "date" },
    ],
    dashboards: [{
        id: "jd1", name: "Reflection",
        widgets: [
            { id: "jw1", title: "Entries written", kind: "count", entityId: "entry", accent: "#ec4899" },
            { id: "jw2", title: "Writing streak", kind: "streak", entityId: "entry", dateField: "date", accent: "#f59e0b" },
            { id: "jw3", title: "Mood over time", kind: "chart", chartKind: "bar", entityId: "entry", fieldKey: "mood", accent: "#ec4899" },
            { id: "jw4", title: "Recent entries", kind: "recent", entityId: "entry" },
        ],
    }],
    workflows: [
        {
            id: "jwf1", name: "Auto-date new entries", entityId: "entry", trigger: "onCreate", enabled: true,
            actions: [{ id: "a1", kind: "stampDate", fieldKey: "date" }]
        },
    ],
};

export const BUILTIN_PLUGINS: PluginManifest[] = [
    FREELANCER_CRM,
    PROJECT_MANAGER,
    HABIT_TRACKER,
    GOAL_TRACKER,
    WORKOUT_TRACKER,
    READING_LOG,
    FINANCE_TRACKER,
    PERSONAL_JOURNAL,
    RESEARCH_WORKSPACE,
];