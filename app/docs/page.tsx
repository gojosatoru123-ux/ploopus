'use client'
import Image from "next/image";
import Link from "next/link";
import { useState, useMemo, useRef, useEffect } from "react";
import ploopusLogo from '@/public/ploopus_logo.webp';

const BLOCK_CATEGORIES = [
  {
    id: "basic", label: "Basic Blocks",
    accent: { hex: "#10b981" },
    blocks: [
      { cmd: "/text", name: "Text", desc: "Plain paragraph. Supports inline bold, italic, underline, code, links, and highlight." },
      { cmd: "/heading1", name: "Heading 1", desc: "Top-level section title. Large and bold, ideal for major page sections." },
      { cmd: "/heading2", name: "Heading 2", desc: "Subsection heading, slightly smaller — great for topic breakdowns." },
      { cmd: "/heading3", name: "Heading 3", desc: "Minor heading for nested content groupings and deep hierarchies." },
      { cmd: "/bullet", name: "Bullet List", desc: "Unordered list with bullet markers. Supports nesting up to 3 levels via Tab." },
      { cmd: "/numbered", name: "Numbered List", desc: "Auto-numbered ordered list with multi-tier nesting mechanics." },
      { cmd: "/todo", name: "To-do", desc: "Checkbox item for tracking tasks. Click the checkbox to toggle done state." },
      { cmd: "/quote", name: "Quote", desc: "Left-bordered callout block for highlighted passages or citations." },
      { cmd: "/divider", name: "Divider", desc: "Horizontal rule for separating content sections cleanly." },
      { cmd: "/callout", name: "Callout", desc: "Colored callout box for tips, warnings, or architectural notes with emoji icon." },
      { cmd: "/code", name: "Code Block", desc: "Monospaced block with syntax highlighting for 30+ programming languages." },
    ],
  },
  {
    id: "media", label: "Media & Embeds",
    accent: { hex: "#f59e0b" },
    blocks: [
      { cmd: "/image", name: "Image", desc: "Embed images from local upload or external URL. Supports captions and resize handles." },
      { cmd: "/video", name: "Video", desc: "Embed YouTube, Vimeo, or direct video files with an inline player and controls." },
      { cmd: "/audio", name: "Audio", desc: "Native audio player for recordings, podcasts, or sound clip assets." },
      { cmd: "/file", name: "File", desc: "Attach any file type with filename metadata, size, and a download button." },
      { cmd: "/bookmark", name: "Bookmark", desc: "Rich link preview card showing page title, favicon, description, and URL." },
      { cmd: "/embed", name: "Embed", desc: "Inline iframes for Figma, Spotify, X posts, Codepen, and custom URLs." },
      { cmd: "/gallery", name: "Gallery", desc: "Responsive image grid with lightbox preview and per-image captions." },
    ],
  },
  {
    id: "data", label: "Data & Analysis",
    accent: { hex: "#3b82f6" },
    blocks: [
      { cmd: "/table", name: "Table", desc: "Grid with sortable columns, editable cells, and row/column management controls. Select any table and click 'Create Chart' to instantly visualize the data." },
      { cmd: "/chart", name: "Chart", desc: "Bar, line, pie, area, or radar charts. Link to a Table block as a live data source — the chart updates whenever the table changes." },
      { cmd: "/progress", name: "Progress Bar", desc: "Visual completion tracker with a label and percentage value on a baseline track." },
      { cmd: "/rating", name: "Rating", desc: "Interactive star metric from 1–10 for numerical appraisal and evaluation." },
    ],
  },
  {
    id: "layout", label: "Layout & Structure",
    accent: { hex: "#8b5cf6" },
    blocks: [
      { cmd: "/columns", name: "Columns", desc: "Side-by-side column layout. Drag to resize. Supports 2–4 columns with nested blocks." },
      { cmd: "/toggle", name: "Toggle", desc: "Collapsible section. Click to expand hidden nested block content." },
      { cmd: "/tabs", name: "Tabs", desc: "Horizontal tab group. Each tab contains its own independent block stack." },
      { cmd: "/steps", name: "Steps", desc: "Sequential numbered flow with labels and optional status icons for guides." },
      { cmd: "/labeledDivider", name: "Labeled Divider", desc: "Horizontal rule with a centered text label for named section breaks." },
      { cmd: "/imageText", name: "Image + Text", desc: "Split layout pairing an image with descriptive text side by side." },
    ],
  },
  {
    id: "productivity", label: "Productivity & Strategy",
    accent: { hex: "#f43f5e" },
    blocks: [
      { cmd: "/kanban", name: "Kanban Board", desc: "Drag-and-drop columns with task cards. Each card supports sub-tasks and labels." },
      { cmd: "/timeline", name: "Timeline", desc: "Vertical roadmap pairing chronologically ordered project milestones with notes." },
      { cmd: "/faq", name: "FAQ", desc: "Accordion of question–answer pairs with smooth expand animation." },
      { cmd: "/swot", name: "SWOT Analysis", desc: "Four-quadrant matrix for Strengths, Weaknesses, Opportunities, and Threats." },
      { cmd: "/comparisonTable", name: "Comparison Table", desc: "Side-by-side feature comparison with boolean checkmarks across multiple items." },
      { cmd: "/flashcard", name: "Flashcards", desc: "Flip cards for active recall study. Decks support Study Mode — a full-screen session with spaced repetition, flip animation, and per-deck progress tracking." },
      { cmd: "/mindmap", name: "Mind Map", desc: "Interactive node-and-branch canvas for brainstorming and relational planning." },
      { cmd: "/equation", name: "Equation", desc: "LaTeX-powered math rendering via KaTeX. Supports inline or full display mode." },
    ],
  },
];

const SYSTEM_OPS = [
  { name: "Find & Replace", shortcut: "Ctrl+F / Ctrl+R", location: "Editor canvas", desc: "Search and replace text across all blocks without altering block IDs or structure." },
  { name: "Multi-format Export", shortcut: "Export menu", location: "Document actions bar", desc: "Export to HTML, PDF, Markdown, or plain text in one click from the document toolbar." },
  { name: "Flashcard Study Mode", shortcut: "Study Mode button", location: "Flashcard block header", desc: "Full-screen active recall session with flip animation and per-deck progress tracking." },
  { name: "Table → Chart Link", shortcut: "Link Chart action", location: "Table block footer", desc: "One-click binding of a table's data to any Chart block in the same document." },
  { name: "Storage Reset", shortcut: "Clear Storage", location: "Settings → Advanced", desc: "Wipe all localStorage and return the app to its initial clean state. Irreversible." },
  { name: "Backup & Restore", shortcut: "Import / Export", location: "Settings → Backup", desc: "Serialize your entire workspace to portable JSON. Restore from any previous backup." },
  { name: "Block Drag & Drop", shortcut: "Drag ⠿ handle", location: "Every block (on hover)", desc: "Grab the six-dot handle to freely reorder any block within the document." },
  { name: "Slash Command Menu", shortcut: "/ key", location: "Editor cursor", desc: "Type / anywhere in the editor to open the full block insertion palette." },
];

const PLUGINS = [
  { name: "Mini CRM", desc: "Contact management with a deal pipeline, per-contact notes, and a full activity log.", features: ["Contacts & companies", "Deal pipeline stages", "Activity log & notes", "AI-drafted email copy"] },
  { name: "Project Manager", desc: "Full project tracking with milestones, assignees, sprint planning, and Gantt charts.", features: ["Milestones & sprints", "Assignee tracking", "Gantt chart view", "Burn-down chart"] },
  { name: "Habit Tracker", desc: "Daily habit streaks with a heatmap calendar, goal setting, and reminder scheduling.", features: ["Daily check-in logging", "Streak & heatmap calendar", "Goal targets", "Reminders"] },
  { name: "Finance Tracker", desc: "Expense categories, budget limits, and monthly spending breakdowns with chart summaries.", features: ["Income & expenses", "Budget limits per category", "Monthly chart reports", "CSV export"] },
  { name: "Knowledge Base", desc: "Internal wiki with AI-powered search, deeply nested pages, and access level controls.", features: ["Nested page hierarchy", "AI-powered search", "Version history", "Access controls"] },
  { name: "Custom Dashboard", desc: "Build any dashboard by combining blocks, charts, and live data from other plugins.", features: ["Drag-and-drop widgets", "Cross-plugin data binding", "Shareable read-only link", "Embeddable anywhere"] },
];

const MARKETPLACE_PLUGINS = [
  { name: "Job Hunt Tracker", cat: "Work", downloads: "4.2k" },
  { name: "Bug Issue Tracker", cat: "Work", downloads: "3.8k" },
  { name: "Meeting Notes", cat: "Work", downloads: "3.1k" },
  { name: "Product Roadmaps", cat: "Work", downloads: "2.9k" },
  { name: "Network Builder", cat: "Work", downloads: "2.7k" },
  { name: "Travel Planner", cat: "Lifestyle", downloads: "2.5k" },
  { name: "Workout Logger", cat: "Health", downloads: "2.4k" },
  { name: "Budget Planner", cat: "Finance", downloads: "2.1k" },
  { name: "Mood Journal", cat: "Wellness", downloads: "1.8k" },
  { name: "Plant Care", cat: "Lifestyle", downloads: "1.3k" },
  { name: "Book Tracker", cat: "Lifestyle", downloads: "1.2k" },
  { name: "Recipe Collection", cat: "Lifestyle", downloads: "1.0k" },
  { name: "Fitness Log", cat: "Lifestyle", downloads: "1.0k" },
  { name: "Freelance", cat: "Finance", downloads: "1.0k" },
  { name: "Investment Portfolio", cat: "Finance", downloads: "1.0k" },
  { name: "Expense Tracker", cat: "Finance", downloads: "1.0k" },
];

const AI_PROVIDERS = [
  { name: "Claude", keyEnv: "ANTHROPIC_API_KEY", model: "claude-opus-4-6", color: "#d97706" },
  { name: "ChatGPT", keyEnv: "OPENAI_API_KEY", model: "gpt-4o", color: "#10b981" },
  { name: "Gemini", keyEnv: "GOOGLE_API_KEY", model: "gemini-2.5-pro", color: "#3b82f6" },
  { name: "Grok", keyEnv: "XAI_API_KEY", model: "grok-3", color: "#6366f1" },
  { name: "Groq", keyEnv: "GROQ_API_KEY", model: "llama-3.3-70b", color: "#8b5cf6" },
  { name: "Ollama Local", keyEnv: "localhost:11434", model: "llama3.2 / custom", color: "#64748b" },
  { name: "Ollama Cloud", keyEnv: "OLLAMA_CLOUD_KEY", model: "Custom", color: "#0ea5e9" },
];

const DEPLOY_STEPS = [
  { num: "01", title: "Export as ZIP", desc: "Go to Document → Export → Download ZIP. Ploopus bundles your note as a self-contained HTML file with all assets inlined — fonts, images, styles.", tip: "The file works offline and requires no server or dependencies." },
  { num: "02", title: "Deploy to GitHub Pages", desc: "Click Deploy → GitHub Pages. Authorize Ploopus via GitHub OAuth (read/write to one repo), pick a repository name, and Ploopus handles the rest automatically.", tip: "Your note goes live at username.github.io/repo-name within roughly 30 seconds." },
  { num: "03", title: "Custom domain (optional)", desc: "In your GitHub repo Settings → Pages, add a custom domain. Then in your DNS provider, create a CNAME record pointing to username.github.io.", tip: "HTTPS is provisioned automatically by GitHub Pages via Let's Encrypt." },
];

const NOTE_TEMPLATES = [
  { name: "Meeting Notes", cat: "Work" }, { name: "Project Brief", cat: "Work" },
  { name: "Weekly Review", cat: "Productivity" }, { name: "Daily Journal", cat: "Personal" },
  { name: "Reading Notes", cat: "Learning" }, { name: "Book Summary", cat: "Learning" },
  { name: "Research Paper", cat: "Academic" }, { name: "Lecture Notes", cat: "Academic" },
  { name: "Study Guide", cat: "Academic" }, { name: "Exam Prep", cat: "Academic" },
  { name: "OKR Tracker", cat: "Strategy" }, { name: "SWOT Analysis", cat: "Strategy" },
  { name: "Business Plan", cat: "Strategy" }, { name: "Sprint Planning", cat: "Dev" },
  { name: "Bug Report", cat: "Dev" }, { name: "API Documentation", cat: "Dev" },
  { name: "Tech Spec", cat: "Dev" }, { name: "Product Roadmap", cat: "Product" },
  { name: "User Story Map", cat: "Product" }, { name: "Retrospective", cat: "Product" },
  { name: "Interview Notes", cat: "Work" }, { name: "1:1 Template", cat: "Work" },
  { name: "Performance Review", cat: "Work" }, { name: "Travel Itinerary", cat: "Personal" },
  { name: "Meal Plan", cat: "Personal" }, { name: "Fitness Log", cat: "Personal" },
  { name: "Habit Tracker", cat: "Personal" }, { name: "Budget Sheet", cat: "Finance" },
  { name: "Invoice Template", cat: "Finance" }, { name: "Expense Report", cat: "Finance" },
  { name: "Mood Journal", cat: "Wellness" }, { name: "Gratitude Log", cat: "Wellness" },
  { name: "Therapy Notes", cat: "Wellness" }, { name: "Recipe Card", cat: "Creative" },
  { name: "Story Outline", cat: "Creative" },
];

const TEMPLATE_CATS = ["All", "Work", "Productivity", "Personal", "Learning", "Academic", "Strategy", "Dev", "Product", "Finance", "Wellness", "Creative"];

const MEMORY_FEED_SECTIONS = [
  { name: "Knowledge Feed", desc: "A live, auto-updating stream of insights extracted from your notes. Ploopus scans for definitions, key facts, named entities, and recurring themes — surfacing connections you might have missed across your entire workspace." },
  { name: "Timeline", desc: "A chronological view of everything you've written, created, or imported. Events, note creations, file uploads, and achievements are plotted on an interactive timeline you can scrub and filter by date range or type." },
  { name: "Achievements", desc: "Milestones and streaks earned from your usage patterns — writing streaks, notes created, flashcard decks mastered, study sessions completed, and plugin usage. Each achievement shows the date it was earned." },
  { name: "Dead Notes", desc: "Notes that haven't been opened or edited in 30+ days. Ploopus flags these so you can decide to archive, revive, or delete them. Dead notes are never removed automatically — only if you explicitly choose." },
  { name: "Files", desc: "A unified gallery of every file attached across all notes — images, PDFs, audio, video, and documents. Browse by type, sort by date uploaded, and jump directly to the note that contains each file." },
  { name: "Linked Mentions", desc: "A cross-note reference map showing every time one note links to, cites, or semantically relates to another. Powered by the same BM25 + TF-IDF engine that drives Graph View." },
  { name: "Usage Stats", desc: "Word count trends, most-edited notes, average session length, blocks used most frequently, and plugin activity. A local-only analytics dashboard that never leaves your browser." },
];

const GRAPH_FEATURES = [
  { name: "Semantic Search", desc: "BM25 + TF-IDF cosine similarity search across every note, flashcard, and uploaded file (PDF, DOCX, PPTX, XLSX) in your workspace. Results are ranked by relevance, not just keyword match." },
  { name: "Knowledge Graph", desc: "An interactive canvas of nodes and edges. Each note is a node; edges represent links, shared tags, or high semantic similarity. Drag to explore, zoom to focus, click to open." },
  { name: "Fuzzy Matching", desc: "Even misspelled queries return relevant results. The fuzzy layer runs before BM25 scoring so typos never block discovery." },
  { name: "File Indexing", desc: "PDFs, Word documents, PowerPoints, and spreadsheets uploaded into notes are fully indexed. Searching 'Q3 revenue' finds text inside an attached spreadsheet, not just note titles." },
  { name: "Flashcard Search", desc: "Flashcard front and back sides are indexed separately. Searching for a term surfaces not only notes that contain it but also any flashcard decks where it appears." },
  { name: "Tag & Cluster Filters", desc: "Filter the graph by tag, note type, plugin, or date range. Clustering groups semantically similar notes together automatically so patterns emerge visually." },
  { name: "Inline Web Worker", desc: "All indexing and search computation runs in a background Web Worker — the editor stays responsive even while reindexing 2000+ files after edits." },
];

const CALENDAR_FEATURES = [
  { name: "Month / Week / Day Views", desc: "Switch between a full month grid, a week timeline with hourly slots, or a focused day view. The current date is always highlighted and you can navigate freely with arrow keys." },
  { name: "Create Events", desc: "Click any date or time slot to open the event creation modal. Set a title, start/end time, description, color label, and optional recurrence rule (daily, weekly, monthly)." },
  { name: "Recurring Events", desc: "Create events that repeat on a schedule — daily, every weekday, weekly on specific days, monthly by date or by weekday, or yearly. Edit one instance or all future instances." },
  { name: "Color Labels", desc: "Assign one of 8 color labels to each event for visual categorization — Work, Personal, Health, Finance, Learning, Social, Focus, and Other." },
  { name: "Reminders", desc: "Set a reminder for any event — 5 min, 15 min, 30 min, 1 hour, 1 day, or a custom interval before the event. Reminders surface as browser notifications if permission is granted." },
  { name: "Note Linking", desc: "Link any event to a note in your workspace. The note icon appears on the event card and clicking it opens the note directly from the calendar view." },
  { name: "Event Search", desc: "Search all events by title, description, or label. Results show the event date and a quick-jump button. Useful for finding recurring meetings or past appointments." },
];

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting Started" },
  { id: "editor", label: "Editor & Blocks" },
  { id: "templates", label: "Note Templates" },
  { id: "flashcards", label: "Flashcards & Study" },
  { id: "charts", label: "Charts & Tables" },
  { id: "plugins", label: "Plugins" },
  { id: "platforms", label: "Plugin Marketplace" },
  { id: "memory", label: "Memory Feed" },
  { id: "graphview", label: "Graph View" },
  { id: "calendar", label: "Calendar" },
  { id: "ai", label: "AI Features" },
  { id: "deployment", label: "Deployment" },
  { id: "export", label: "Export & Backup" },
];

// Per-page TOC definitions
const PAGE_TOC: Record<string, { label: string; anchor: string }[]> = {
  overview: [
    { label: "Introduction", anchor: "intro" },
    { label: "Quick stats", anchor: "stats" },
    { label: "What's inside", anchor: "whats-inside" },
  ],
  "getting-started": [
    { label: "Open Ploopus", anchor: "open" },
    { label: "Create a document", anchor: "create" },
    { label: "Add blocks", anchor: "add-blocks" },
    { label: "Keyboard shortcuts", anchor: "shortcuts" },
  ],
  editor: [
    { label: "Basic Blocks", anchor: "basic" },
    { label: "Media & Embeds", anchor: "media" },
    { label: "Data & Analysis", anchor: "data" },
    { label: "Layout & Structure", anchor: "layout" },
    { label: "Productivity & Strategy", anchor: "productivity" },
    { label: "Editor operations", anchor: "operations" },
  ],
  templates: [
    { label: "Browse templates", anchor: "browse" },
    { label: "Work", anchor: "work" },
    { label: "Academic", anchor: "academic" },
    { label: "Personal", anchor: "personal" },
  ],
  flashcards: [
    { label: "Overview", anchor: "fc-overview" },
    { label: "Study mode", anchor: "study-mode" },
    { label: "Spaced repetition", anchor: "spaced-rep" },
    { label: "Deck management", anchor: "decks" },
  ],
  charts: [
    { label: "Chart types", anchor: "chart-types" },
    { label: "Table linking", anchor: "table-link" },
    { label: "Live updates", anchor: "live-updates" },
  ],
  plugins: [
    { label: "Mini CRM", anchor: "mini-crm" },
    { label: "Project Manager", anchor: "project-manager" },
    { label: "Habit Tracker", anchor: "habit-tracker" },
    { label: "Finance Tracker", anchor: "finance-tracker" },
    { label: "Knowledge Base", anchor: "knowledge-base" },
    { label: "Custom Dashboard", anchor: "custom-dashboard" },
  ],
  platforms: [
    { label: "Browse marketplace", anchor: "marketplace" },
    { label: "Installing plugins", anchor: "install" },
  ],
  memory: [
    { label: "Knowledge Feed", anchor: "knowledge-feed" },
    { label: "Timeline", anchor: "timeline" },
    { label: "Achievements", anchor: "achievements" },
    { label: "Dead Notes", anchor: "dead-notes" },
    { label: "Files", anchor: "files" },
    { label: "Usage Stats", anchor: "usage-stats" },
  ],
  graphview: [
    { label: "Semantic Search", anchor: "semantic-search" },
    { label: "Knowledge Graph", anchor: "knowledge-graph" },
    { label: "Fuzzy Matching", anchor: "fuzzy" },
    { label: "File Indexing", anchor: "file-indexing" },
    { label: "Filters & Clusters", anchor: "filters" },
  ],
  calendar: [
    { label: "Views", anchor: "views" },
    { label: "Creating events", anchor: "create-events" },
    { label: "Recurring events", anchor: "recurring" },
    { label: "Reminders", anchor: "reminders" },
    { label: "Export to .ics", anchor: "ics-export" },
  ],
  ai: [
    { label: "Supported providers", anchor: "providers" },
    { label: "API key setup", anchor: "api-setup" },
    { label: "Local models", anchor: "local-models" },
  ],
  deployment: [
    { label: "Export as ZIP", anchor: "zip" },
    { label: "GitHub Pages", anchor: "github-pages" },
    { label: "Custom domain", anchor: "custom-domain" },
  ],
  export: [
    { label: "Export formats", anchor: "formats" },
    { label: "Backup & restore", anchor: "backup" },
    { label: "Storage reset", anchor: "reset" },
  ],
};

function buildSearchIndex() {
  const results: Array<{ type: string; label: string; title: string; desc: string; page: string; extra?: string }> = [];
  BLOCK_CATEGORIES.forEach(cat => cat.blocks.forEach(b => results.push({ type: "block", label: cat.label, title: `${b.name} (${b.cmd})`, desc: b.desc, page: "editor", extra: b.cmd })));
  SYSTEM_OPS.forEach(op => results.push({ type: "operation", label: "Editor Operations", title: op.name, desc: op.desc, page: "editor", extra: op.shortcut }));
  PLUGINS.forEach(p => results.push({ type: "plugin", label: "Built-in Plugins", title: p.name, desc: p.desc, page: "plugins", extra: p.features.join(", ") }));
  MARKETPLACE_PLUGINS.forEach(p => results.push({ type: "marketplace", label: "Plugin Marketplace", title: p.name, desc: `Category: ${p.cat} · ${p.downloads} downloads`, page: "platforms" }));
  AI_PROVIDERS.forEach(p => results.push({ type: "ai", label: "AI Providers", title: p.name, desc: `Key: ${p.keyEnv} · Model: ${p.model}`, page: "ai" }));
  NOTE_TEMPLATES.forEach(t => results.push({ type: "template", label: "Note Templates", title: t.name, desc: `Template category: ${t.cat}`, page: "templates" }));
  MEMORY_FEED_SECTIONS.forEach(s => results.push({ type: "memory", label: "Memory Feed", title: s.name, desc: s.desc, page: "memory" }));
  GRAPH_FEATURES.forEach(f => results.push({ type: "graph", label: "Graph View", title: f.name, desc: f.desc, page: "graphview" }));
  CALENDAR_FEATURES.forEach(f => results.push({ type: "calendar", label: "Calendar", title: f.name, desc: f.desc, page: "calendar" }));
  return results;
}

const SEARCH_INDEX = buildSearchIndex();

export default function PloopusDocs() {
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [templateCat, setTemplateCat] = useState("All");
  const [activeSection, setActiveSection] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Observe headings for active TOC section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 }
    );
    const headings = mainRef.current?.querySelectorAll("h2[id], h3[id]") ?? [];
    headings.forEach(h => observer.observe(h));
    return () => observer.disconnect();
  }, [active]);

  const q = query.toLowerCase().trim();

  const searchResults = useMemo(() => {
    if (!q) return [];
    return SEARCH_INDEX.filter(r =>
      r.title.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [q]);

  const filteredCats = useMemo(() =>
    BLOCK_CATEGORIES.map(cat => ({
      ...cat,
      blocks: cat.blocks.filter(b =>
        (catFilter === "all" || catFilter === cat.id) &&
        (!q || b.name.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q))
      )
    })).filter(cat => cat.blocks.length > 0),
    [q, catFilter]
  );

  const filteredTemplates = useMemo(() =>
    NOTE_TEMPLATES.filter(t => templateCat === "All" || t.cat === templateCat),
    [templateCat]
  );

  const navigate = (id: string) => {
    setActive(id);
    setQuery("");
    setSidebarOpen(false);
    mainRef.current?.scrollTo(0, 0);
  };

  // Shared doc components
  const DocH1 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
    <h1 id={id} className="text-[1.75rem] font-semibold tracking-tight text-foreground mb-3 leading-tight">{children}</h1>
  );
  const DocH2 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
    <h2 id={id} className="text-base font-semibold text-foreground mt-10 mb-3 pt-2 scroll-mt-6">{children}</h2>
  );
  const DocH3 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
    <h3 id={id} className="text-sm font-semibold text-foreground mt-6 mb-2 scroll-mt-6">{children}</h3>
  );
  const Lead = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm text-muted-foreground leading-relaxed mb-6">{children}</p>
  );
  const Divider = () => <div className="border-t border-border my-8" />;

  const Callout = ({ type = "note", children }: { type?: "note" | "tip" | "warning"; children: React.ReactNode }) => {
    const styles = {
      note: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200",
      tip: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200",
      warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
    };
    const labels = { note: "Note", tip: "Tip", warning: "Warning" };
    return (
      <div className={`border rounded-lg px-4 py-3 text-xs leading-relaxed my-4 ${styles[type]}`}>
        <span className="font-semibold uppercase tracking-wide text-[10px] mr-2">{labels[type]}</span>
        {children}
      </div>
    );
  };

  const PropRow = ({ name, value }: { name: string; value: string }) => (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4 font-mono text-xs text-foreground w-36 align-top">{name}</td>
      <td className="py-2 text-xs text-muted-foreground leading-relaxed">{value}</td>
    </tr>
  );

  // ─── Page definitions ──────────────────────────────────────────────────────

  const SearchResultsPage = () => (
    <div>
      <DocH1>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;</DocH1>
      <Lead>Click a result to navigate to that section.</Lead>
      <div className="space-y-2 mt-6">
        {searchResults.map((r, i) => (
          <button
            key={i}
            onClick={() => navigate(r.page)}
            className="w-full text-left px-4 py-3 border border-border hover:border-primary/50 hover:bg-muted/40 rounded-lg transition-all group"
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground">{r.type}</span>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <span className="text-[10px] text-muted-foreground">{r.label}</span>
            </div>
            <div className="text-sm font-medium text-foreground group-hover:text-primary">{r.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.desc}</div>
          </button>
        ))}
        {searchResults.length === 0 && (
          <div className="text-sm text-muted-foreground py-8 text-center">No results found. Try different keywords.</div>
        )}
      </div>
    </div>
  );

  const pages: Record<string, React.ReactNode> = {
    overview: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-primary mb-3">Documentation</div>
        <DocH1 id="intro">Welcome to Ploopus</DocH1>
        <Lead>Ploopus is a local-first block-based workspace — everything on your device. This reference covers every block, template, plugin, and system feature.</Lead>

        <div id="stats" className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-8">
          {[
            { n: BLOCK_CATEGORIES.reduce((a, c) => a + c.blocks.length, 0), l: "Blocks" },
            { n: 35, l: "Templates" },
            { n: PLUGINS.length, l: "Plugins" },
            { n: AI_PROVIDERS.length, l: "AI providers" },
          ].map(item => (
            <div key={item.l} className="border border-border rounded-lg p-4">
              <div className="text-2xl font-semibold tabular-nums text-foreground">{item.n}</div>
              <div className="text-xs text-muted-foreground mt-1">{item.l}</div>
            </div>
          ))}
        </div>

        <Divider />
        <DocH2 id="whats-inside">What&rsquo;s inside</DocH2>
        <div className="space-y-1">
          {NAV.slice(1).map(n => (
            <button key={n.id} onClick={() => navigate(n.id)} className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors group">
              <span className="text-sm text-foreground group-hover:text-primary">{n.label}</span>
              <span className="ml-auto text-muted-foreground/40 text-xs">→</span>
            </button>
          ))}
        </div>
      </div>
    ),

    "getting-started": (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Getting started</div>
        <DocH1>Quick start</DocH1>
        <Lead>Get from zero to a working document in under two minutes.</Lead>

        <div className="space-y-0 my-8">
          {[
            { id: "open", step: "1", title: "Open Ploopus", desc: " Navigate to your Ploopus URL and your workspace loads instantly from localStorage. Everything stays on your device." },
            { id: "create", step: "2", title: "Create a document", desc: "Click the + New Document button in the left sidebar. Give it a title by clicking the untitled heading at the top of the page." },
            { id: "add-blocks", step: "3", title: "Add blocks", desc: "Click anywhere in the editor and type / to open the block insertion palette. Start typing to filter — press Enter to insert the selected block." },
            { id: "shortcuts", step: "4", title: "Learn the shortcuts", desc: "Ctrl+F opens Find & Replace. Drag the ⠿ handle on any block to reorder. Hover any block to reveal the action menu." },
          ].map((s, idx, arr) => (
            <div key={s.id} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className="w-7 h-7 rounded-full border-2 border-primary flex items-center justify-center text-xs font-semibold text-primary shrink-0">{s.step}</div>
                {idx < arr.length - 1 && <div className="w-px flex-1 bg-border mt-1 mb-0 min-h-8" />}
              </div>
              <div id={s.id} className={`pb-8 scroll-mt-6 ${idx === arr.length - 1 ? "" : ""}`}>
                <div className="font-medium text-sm text-foreground mb-1">{s.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Callout type="tip">You can also start from a template. Navigate to Note Templates in the ribbon.</Callout>
      </div>
    ),

    editor: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Reference</div>
        <DocH1>Editor & Blocks</DocH1>
        <Lead>Every block is inserted with the / command. Below is the full reference for all available block types and editor operations.</Lead>

        <div className="flex gap-1.5 flex-wrap mb-8">
          <button onClick={() => setCatFilter("all")} className={`px-3 py-1 text-xs rounded-full border transition-all ${catFilter === "all" ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>All</button>
          {BLOCK_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCatFilter(c.id)} className={`px-3 py-1 text-xs rounded-full border transition-all ${catFilter === c.id ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}>{c.label}</button>
          ))}
        </div>

        {filteredCats.map(cat => (
          <div key={cat.id} id={cat.id}>
            <DocH2 id={cat.id}>{cat.label}</DocH2>
            <div className="border border-border rounded-lg overflow-hidden mb-8">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Command</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Block</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.blocks.map((b, i) => (
                    <tr key={b.cmd} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                      <td className="px-4 py-3 font-mono text-[11px] text-primary">{b.cmd}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{b.name}</td>
                      <td className="px-4 py-3 text-muted-foreground leading-relaxed">{b.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        <DocH2 id="operations">Editor operations</DocH2>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-40">Operation</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-32">Shortcut</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Description</th>
              </tr>
            </thead>
            <tbody>
              {SYSTEM_OPS.map((op, i) => (
                <tr key={op.name} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{op.name}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{op.shortcut}</td>
                  <td className="px-4 py-3 text-muted-foreground leading-relaxed">{op.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),

    templates: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Reference</div>
        <DocH1>Note Templates</DocH1>
        <Lead>35 pre-built templates across work, study, strategy, and personal categories. Open any template from the Templates menu.</Lead>

        <DocH2 id="browse">Browse templates</DocH2>
        <div className="flex gap-1.5 flex-wrap mb-6">
          {TEMPLATE_CATS.map(cat => (
            <button
              key={cat}
              onClick={() => setTemplateCat(cat)}
              className={`px-3 py-1 text-xs rounded-full border transition-all ${templateCat === cat ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:border-foreground/30"}`}
            >{cat}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {filteredTemplates.map(t => (
            <div key={t.name} className="border border-border rounded-lg px-3 py-2.5 hover:border-primary/40 hover:bg-muted/30 transition-colors cursor-default">
              <div className="text-xs font-medium text-foreground">{t.name}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t.cat}</div>
            </div>
          ))}
        </div>

        <Divider />
        <DocH2 id="work">Using a template</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed">In the editor, open the Templates panel from the sidebar. Templates pre-populate blocks and placeholder text — edit any cell to adapt them to your needs. Templates don&apos;t alter your existing blocks; they insert into the document at the cursor position.</p>
      </div>
    ),

    flashcards: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Features</div>
        <DocH1>Flashcards & Study</DocH1>
        <Lead>Ploopus includes a full-featured flashcard system built on active recall principles. Decks live inside your notes as blocks and support a dedicated Study Mode.</Lead>

        <DocH2 id="fc-overview">Overview</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">Insert a flashcard deck with <code className="font-mono bg-muted px-1 rounded text-[11px]">/flashcard</code>. Each deck is self-contained — you can add as many decks as you want per note.</p>

        <DocH2 id="study-mode">Study Mode</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">Click the <strong className="font-medium text-foreground">Study Mode</strong> button in the deck header to enter a full-screen session. Cards are presented one at a time. After flipping, mark each card as <em>Got it</em> or <em>Try again</em>. Per-deck progress is tracked and persisted across sessions.</p>

        <Callout type="tip">Study Mode works entirely offline. Your progress is stored in localStorage alongside your notes.</Callout>

        <DocH2 id="spaced-rep">Spaced repetition</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">Cards marked <em>Try again</em> resurface more frequently within the same session. Ploopus uses a lightweight SM-2 variant — cards you know well are spaced further apart over successive study sessions, while difficult cards come up sooner.</p>

        <DocH2 id="decks">Deck management</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed">Decks can be renamed, duplicated, or deleted from the deck header menu. Graph View indexes flashcard content, so searching &ldquo;photosynthesis&rdquo; will surface any deck containing that term.</p>
      </div>
    ),

    charts: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Features</div>
        <DocH1>Charts & Tables</DocH1>
        <Lead>Ploopus ships a native charting system that can bind directly to Table blocks. When the table updates, the chart updates automatically.</Lead>

        <DocH2 id="chart-types">Chart types</DocH2>
        <div className="border border-border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Best for</th>
              </tr>
            </thead>
            <tbody>
              {[
                { type: "Bar", use: "Comparing discrete categories side by side." },
                { type: "Line", use: "Trends over time or continuous data." },
                { type: "Pie / Donut", use: "Part-to-whole proportions." },
                { type: "Area", use: "Cumulative totals and stacked values over time." },
                { type: "Radar", use: "Multi-axis attribute comparisons (e.g. skill matrices)." },
              ].map((r, i) => (
                <tr key={r.type} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{r.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.use}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DocH2 id="table-link">Linking a chart to a table</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">Insert a Table block with <code className="font-mono bg-muted px-1 rounded text-[11px]">/table</code> and populate it with data. Then insert a Chart block with <code className="font-mono bg-muted px-1 rounded text-[11px]">/chart</code>. In the chart configuration panel, click <strong className="font-medium text-foreground">Link data source</strong> and select the table. Ploopus automatically maps columns to chart axes.</p>

        <DocH2 id="live-updates">Live updates</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed">Any edit to a linked table cell triggers an immediate re-render of the bound chart with no manual refresh needed. Multiple charts can link to the same table. Charts without a linked table use static inline data you enter in the chart editor.</p>

        <Callout type="note">The <strong className="font-medium">Create Chart</strong> shortcut — available in the table footer — creates and links a chart in one click, inferring axis mapping from the column headers.</Callout>
      </div>
    ),

    plugins: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Reference</div>
        <DocH1>Built-in Plugins</DocH1>
        <Lead>Six first-party plugins extend Ploopus with purpose-built functionality. Each plugin is toggled from Settings → Plugins and adds its own sidebar panel and block types.</Lead>

        {PLUGINS.map(p => {
          const anchor = p.name.toLowerCase().replace(/\s+/g, "-");
          return (
            <div key={p.name}>
              <DocH2 id={anchor}>{p.name}</DocH2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">{p.desc}</p>
              <div className="border border-border rounded-lg overflow-hidden mb-2">
                <table className="w-full text-xs">
                  <tbody>
                    {p.features.map((f, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-muted-foreground">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 mr-2.5 -translate-y-px" />
                          {f}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    ),

    platforms: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Reference</div>
        <DocH1>Plugin Marketplace</DocH1>
        <Lead>Community-built plugins extend Ploopus further. Browse and install from Settings → Marketplace. Plugins are sandboxed and do not access your data without permission.</Lead>

        <DocH2 id="marketplace">Available plugins</DocH2>
        <div className="border border-border rounded-lg overflow-hidden mb-8">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Category</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground w-24">Downloads</th>
              </tr>
            </thead>
            <tbody>
              {MARKETPLACE_PLUGINS.map((p, i) => (
                <tr key={p.name} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{p.cat}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">{p.downloads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DocH2 id="install">Installing a plugin</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed">Open <strong className="font-medium text-foreground">Settings → Marketplace</strong>, find the plugin, and click Install. The plugin activates immediately — no reload required. Uninstall anytime from the same panel. Installed plugins appear under Settings → Plugins where you can enable, disable, or configure them.</p>
      </div>
    ),

    memory: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Features</div>
        <DocH1>Memory Feed</DocH1>
        <Lead>Memory Feed is a second brain view of your entire workspace. Open it from the sidebar icon. It has seven sections, each surfacing different signals from your notes.</Lead>

        {MEMORY_FEED_SECTIONS.map(s => {
          const anchor = s.name.toLowerCase().replace(/[\s&]+/g, "-");
          return (
            <div key={s.name}>
              <DocH2 id={anchor}>{s.name}</DocH2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">{s.desc}</p>
            </div>
          );
        })}
      </div>
    ),

    graphview: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Features</div>
        <DocH1>Graph View</DocH1>
        <Lead>Graph View is a visual knowledge network and search engine. It indexes every note, flashcard, and uploaded file in your workspace using BM25 + TF-IDF similarity scoring.</Lead>

        {GRAPH_FEATURES.map(f => {
          const anchor = f.name.toLowerCase().replace(/[\s+&]+/g, "-");
          return (
            <div key={f.name}>
              <DocH2 id={anchor}>{f.name}</DocH2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">{f.desc}</p>
            </div>
          );
        })}

        <Callout type="note">All indexing runs in a background Web Worker. The editor stays fully responsive during reindexing even with 2000+ documents.</Callout>
      </div>
    ),

    calendar: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Features</div>
        <DocH1>Calendar</DocH1>
        <Lead>Ploopus ships a full calendar with month, week, and day views, recurring events, reminders, note linking, and .ics export. Open it from the sidebar icon.</Lead>

        {CALENDAR_FEATURES.map(f => {
          const anchor = f.name.toLowerCase().replace(/[\s/.]+/g, "-");
          return (
            <div key={f.name}>
              <DocH2 id={anchor}>{f.name}</DocH2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">{f.desc}</p>
            </div>
          );
        })}
      </div>
    ),

    ai: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Reference</div>
        <DocH1>AI Features</DocH1>
        <Lead>Ploopus supports seven AI providers via bring-your-own-key. Keys are stored in localStorage and never sent to Ploopus servers — they go directly to the provider.</Lead>

        <DocH2 id="providers">Supported providers</DocH2>
        <div className="border border-border rounded-lg overflow-hidden mb-8">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Provider</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Default model</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">API key / endpoint</th>
              </tr>
            </thead>
            <tbody>
              {AI_PROVIDERS.map((p, i) => (
                <tr key={p.name} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{p.model}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{p.keyEnv}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DocH2 id="api-setup">Setting up an API key</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">Go to <strong className="font-medium text-foreground">AI modal → AI API Key</strong> and select your provider. Paste your API key into the field — it saves automatically. The key is encrypted in localStorage using the Web Crypto API before storage.</p>

        <DocH2 id="local-models">Local models via Ollama</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed">Select <strong className="font-medium text-foreground">Ollama Local</strong> as your provider and ensure Ollama is running on <code className="font-mono bg-muted px-1 rounded text-[11px]">localhost:11434</code>. Ploopus auto-discovers available models from the Ollama API. No key needed for local inference. For a hosted Ollama instance, use <strong className="font-medium text-foreground">Ollama Cloud</strong> and provide your endpoint URL and key.</p>
      </div>
    ),

    deployment: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Deployment</div>
        <DocH1>Deploying your notes</DocH1>
        <Lead>Ploopus notes can be published as static sites. No server required — the output is a single self-contained HTML file.</Lead>

        {DEPLOY_STEPS.map(s => {
          const anchors: Record<string, string> = { "01": "zip", "02": "github-pages", "03": "custom-domain" };
          return (
            <div key={s.num}>
              <DocH2 id={anchors[s.num]}>
                <span className="font-mono text-muted-foreground mr-2">{s.num}</span>{s.title}
              </DocH2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-2">{s.desc}</p>
              <Callout type="tip">{s.tip}</Callout>
            </div>
          );
        })}
      </div>
    ),

    export: (
      <div>
        <div className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground mb-3">Reference</div>
        <DocH1>Export & Backup</DocH1>
        <Lead>Ploopus gives you full ownership of your data. Export any document or your entire workspace at any time.</Lead>

        <DocH2 id="formats">Export formats</DocH2>
        <div className="border border-border rounded-lg overflow-hidden mb-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Format</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {[
                { fmt: "HTML", note: "Self-contained single file. All assets inlined. Works offline." },
                { fmt: "PDF", note: "Print-ready layout. Uses browser print engine." },
                { fmt: "Markdown", note: "Plain text with GFM syntax. Compatible with Obsidian, Notion, and most editors." },
                { fmt: "Plain text", note: "Strips all formatting. Useful for pasting into external tools." },
                { fmt: "JSON", note: "Used to take import and export." },
              ].map((r, i) => (
                <tr key={r.fmt} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                  <td className="px-4 py-3 font-mono text-[11px] text-foreground">{r.fmt}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DocH2 id="backup">Backup & restore</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">Go to <strong className="font-medium text-foreground">Settings → Backup</strong> and click <strong className="font-medium text-foreground">Export workspace</strong>. This produces a portable <code className="font-mono bg-muted px-1 rounded text-[11px]">.json</code> file containing all your notes, settings, and plugin data. Restore by clicking <strong className="font-medium text-foreground">Import backup</strong> and selecting the file. Importing merges with your current workspace rather than replacing it.</p>

        <DocH2 id="reset">Storage reset</DocH2>
        <p className="text-sm text-muted-foreground leading-relaxed">Found in <strong className="font-medium text-foreground">Settings → Advanced → Clear storage</strong>. This wipes all localStorage and returns Ploopus to its factory state. The action is irreversible — always export a backup first.</p>
        <Callout type="warning">Storage reset cannot be undone. Export your workspace before proceeding.</Callout>
      </div>
    ),
  };

  const showSearch = q.length > 0;
  const currentPage = showSearch ? <SearchResultsPage /> : pages[active];
  const currentLabel = showSearch ? "Search results" : NAV.find(n => n.id === active)?.label ?? "Overview";
  const currentTOC = PAGE_TOC[active] ?? [];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden text-sm">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Left Sidebar */}
      <aside className={`
        fixed lg:relative z-30 lg:z-auto
        w-64 h-full border-r border-border bg-card flex flex-col
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="px-4 py-3.5 border-b border-border flex items-center gap-2.5 shrink-0">
          <Link href="/" className="relative w-12 h-12 flex border-2 rounded-full">
            <Image
              src={ploopusLogo}
              alt="Ploopus"
              fill
              className="object-contain"
              priority
            />
          </Link>
          <span className="font-semibold text-sm tracking-tight">Ploopus</span>
          <span className="ml-auto text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Docs</span>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-border shrink-0">
          <div className="relative flex items-center">
            <svg className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search docs..."
              className="w-full bg-background border border-border focus:border-primary/50 focus:outline-none pl-8 pr-10 py-1.5 rounded-md text-xs placeholder:text-muted-foreground/60"
            />
            <span className="absolute right-2 text-[10px] text-muted-foreground/50 font-mono">⌘K</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-auto py-2 px-2">
          <div className="mb-1 px-2 pt-1 pb-0.5 text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60">Navigation</div>
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => navigate(n.id)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all flex items-center gap-2 ${active === n.id && !showSearch
                ? "bg-primary/8 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-11 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer" onClick={() => navigate("overview")}>Docs</span>
            {!showSearch && active !== "overview" && (
              <>
                <span>/</span>
                <span className="text-foreground">{currentLabel}</span>
              </>
            )}
            {showSearch && <><span>/</span><span className="text-foreground">Search</span></>}
          </div>
        </header>

        {/* Content + TOC */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main content */}
          <main
            ref={mainRef}
            className="flex-1 overflow-auto"
          >
            <div className="max-w-2xl mx-auto px-6 py-10">
              {currentPage}
            </div>
          </main>

          {/* Right TOC panel */}
          <aside className="w-52 shrink-0 border-l border-border bg-card overflow-auto py-6 px-4 hidden xl:block">
            {!showSearch && currentTOC.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60 mb-3">On this page</div>
                <nav className="space-y-0.5">
                  {currentTOC.map(item => (
                    <button
                      key={item.anchor}
                      onClick={() => {
                        const el = document.getElementById(item.anchor);
                        el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        setActiveSection(item.anchor);
                      }}
                      className={`w-full text-left text-xs py-1 px-2 rounded transition-colors block ${activeSection === item.anchor
                        ? "text-primary bg-primary/5"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
                <div className="border-t border-border mt-6 pt-5">
                  <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60 mb-3">Resources</div>
                  <div className="space-y-0.5">
                    <a href="https://www.youtube.com/@CursorBits" target="_blank" className="block text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded hover:bg-muted transition-colors">Youtube ↗</a>
                    <a href="mailto:cursorbits@gmail.com" className="block text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded hover:bg-muted transition-colors">Contact ↗</a>
                    <Link href="/" className="block text-xs text-muted-foreground hover:text-foreground py-1 px-2 rounded hover:bg-muted transition-colors">Home ↗</Link>
                  </div>
                </div>
              </>
            )}
            {showSearch && (
              <div className="text-xs text-muted-foreground">
                <div className="text-[10px] uppercase tracking-widest font-medium text-muted-foreground/60 mb-3">Search tips</div>
                <p className="leading-relaxed">Try block names like <code className="font-mono bg-muted px-1 rounded">kanban</code>, plugin names, or feature keywords.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}