"use client";
import { useState, useRef, KeyboardEvent, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  GripVertical,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Trash2,
  Minus,
  Code,
  FileText,
  Table,
  PlusCircle,
  X,
  ChevronRight,
  Image,
  Link2,
  Calculator,
  BarChart3,
  Play,
  Columns,
  ExternalLink,
  Copy,
  Check,
  Paperclip,
  Music,
  GitBranch,
  Kanban,
  Star,
  Lightbulb,
  Globe,
  Database,
  Share2,
  ImagePlus,
  Timer,
  Sparkles,
  AlertCircle,
  Calendar,
  Pause,
  Volume2,
  ZoomIn,
  Layers,
  SeparatorHorizontal,
  HelpCircle,
  GitCompare,
  Footprints,
  Grid2x2,
  LayoutTemplate,
} from "lucide-react";
import { NoteBlock, FlashcardItem } from "@/lib/types";
import ImageLightbox from "./ImageLightbox";
import MindMap from "./MindMap";
import FlashcardBlock from "./FlashcardBlock";
import ChartBlock from "./ChartBlock";
import EquationBlock from "./EquationBlock";
import DatabaseBlock from "./DatabaseBlock";
import DataTable from "./DataTable";
import KanbanBlock from "./KanbanBlock";
import FlashcardStudyMode from "./FlashcardStudyMode";
import TabsBlock from "./TabsBlock";
import LabeledDividerBlock from "./LabeledDividerBlock";
import FaqBlock from "./FaqBlock";
import ComparisonTableBlock from "./ComparisonTableBlock";
import StepsBlock from "./StepsBlock";
import SwotBlock from "./SwotBlock";
import ImageTextBlock from "./ImageTextBlock";
import FileBlock from "./FileBlock";
import { StorageEngine } from "@/lib/storage-engine";
import { MediaUploader } from "./MediaUploader";
import PersistentImage from "./PersistentImage";
import PersistentVideo from "./PersistentVideo";
import PersistentAudio from "./PersistentAudio";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";
import MobileEditorToolbar from "./MobileEditorToolbar";

interface NotionEditorProps {
  blocks: NoteBlock[];
  onChange: (blocks: NoteBlock[]) => void;
}

// Subtle, Apple-inspired affordance that appears between blocks on hover.
// A hairline rule fades in, with a soft glassy "+" button centered on it.
const InlineInserter = ({ onInsert }: { onInsert: () => void }) => {
  return (
    <div
      onClick={onInsert}
      className="group/inserter relative h-px my-0.5 cursor-pointer"
      aria-label="Insert block"
    >
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover/inserter:opacity-100 transition-opacity duration-200" />
      <motion.div
        initial={false}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover/inserter:opacity-100 transition-opacity duration-200"
      >
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-background/80 backdrop-blur-md border border-border/60 shadow-sm hover:shadow-md hover:scale-110 active:scale-95 transition-all duration-150">
          <Plus className="w-3 h-3 text-muted-foreground group-hover/inserter:text-primary transition-colors" strokeWidth={2.5} />
        </div>
      </motion.div>
    </div>
  );
};

const blockTypes = [
  { type: "text", icon: Type, label: "Text", description: "Plain text block", category: "basic" },
  { type: "heading1", icon: Heading1, label: "Heading 1", description: "Large section heading", category: "basic" },
  { type: "heading2", icon: Heading2, label: "Heading 2", description: "Medium section heading", category: "basic" },
  { type: "heading3", icon: Heading3, label: "Heading 3", description: "Small section heading", category: "basic" },
  { type: "divider" as const, icon: Minus, label: "Divider", description: "Visual separator", category: "basic" },
  { type: "bullet", icon: List, label: "Bullet List", description: "Create a bullet list", category: "lists" },
  { type: "numbered", icon: ListOrdered, label: "Numbered List", description: "Create a numbered list", category: "lists" },
  { type: "todo", icon: CheckSquare, label: "To-do", description: "Track tasks with checkboxes", category: "lists" },
  { type: "toggle" as const, icon: ChevronRight, label: "Toggle", description: "Collapsible content", category: "lists" },
  { type: "quote", icon: Quote, label: "Quote", description: "Capture a quote", category: "media" },
  { type: "code" as const, icon: Code, label: "Code Block", description: "Display code snippet", category: "media" },
  { type: "callout" as const, icon: FileText, label: "Callout", description: "Highlight important info", category: "media" },
  { type: "image" as const, icon: Image, label: "Image", description: "Embed an image", category: "media" },
  { type: "bookmark" as const, icon: Link2, label: "Bookmark", description: "Save a web link", category: "media" },
  { type: "video" as const, icon: Play, label: "Video", description: "Embed YouTube video", category: "media" },
  { type: "audio" as const, icon: Music, label: "Audio", description: "Embed audio file", category: "media" },
  { type: "file" as const, icon: Paperclip, label: "File", description: "Attach a file link", category: "media" },
  { type: "gallery" as const, icon: ImagePlus, label: "Gallery", description: "Image gallery grid", category: "media" },
  { type: "table" as const, icon: Table, label: "Table", description: "Add rows & columns", category: "advanced" },
  { type: "equation" as const, icon: Calculator, label: "Equation", description: "Math formula", category: "advanced" },
  { type: "progress" as const, icon: BarChart3, label: "Progress", description: "Visual progress bar", category: "advanced" },
  { type: "columns" as const, icon: Columns, label: "Columns", description: "Side-by-side layout", category: "advanced" },
  { type: "timeline" as const, icon: GitBranch, label: "Timeline", description: "Track milestones", category: "advanced" },
  { type: "kanban" as const, icon: Kanban, label: "Kanban", description: "Task board", category: "advanced" },
  { type: "rating" as const, icon: Star, label: "Rating", description: "Star rating", category: "advanced" },
  { type: "countdown" as const, icon: Timer, label: "Countdown", description: "Timer to date", category: "advanced" },
  { type: "embed" as const, icon: Globe, label: "Embed", description: "External embed", category: "advanced" },
  { type: "database" as const, icon: Database, label: "Database", description: "Mini database", category: "advanced" },
  { type: "mindmap" as const, icon: Share2, label: "Mind Map", description: "Interactive mind map", category: "advanced" },
  { type: "flashcard" as const, icon: Lightbulb, label: "Flashcards", description: "Quick revision cards", category: "advanced" },
  { type: "chart" as const, icon: BarChart3, label: "Chart", description: "Data visualization charts", category: "advanced" },
  { type: "tabs" as const, icon: Layers, label: "Tabs", description: "Tabbed content sections", category: "advanced" },
  { type: "labeledDivider" as const, icon: SeparatorHorizontal, label: "Labeled Divider", description: "Divider with centered label", category: "basic" },
  { type: "faq" as const, icon: HelpCircle, label: "FAQ", description: "Collapsible Q&A accordion", category: "advanced" },
  { type: "comparisonTable" as const, icon: GitCompare, label: "Comparison", description: "Compare options side by side", category: "advanced" },
  { type: "steps" as const, icon: Footprints, label: "Steps", description: "Step-by-step process flow", category: "advanced" },
  { type: "swot" as const, icon: Grid2x2, label: "SWOT Analysis", description: "Strengths, Weaknesses, Opportunities, Threats", category: "advanced" },
  { type: "imageText" as const, icon: LayoutTemplate, label: "Image + Text", description: "Split layout with image", category: "media" },
] as const;

const progressColors = [
  { name: "Blue", value: "bg-blue-500" },
  { name: "Green", value: "bg-green-500" },
  { name: "Purple", value: "bg-purple-500" },
  { name: "Orange", value: "bg-orange-500" },
  { name: "Pink", value: "bg-pink-500" },
];

const timelineColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500"];

// ── Module-level clipboard — persists across note switches ────────────────────
// Stored outside the component so navigating to a different note never clears it.
let _blockClipboard: NoteBlock[] = [];
let _clipboardIsCut = false;
const getBlockClipboard = () => _blockClipboard;
const setBlockClipboard = (blocks: NoteBlock[], isCut: boolean) => {
  _blockClipboard = blocks;
  _clipboardIsCut = isCut;
};
// ─────────────────────────────────────────────────────────────────────────────

const NotionEditor = ({ blocks, onChange }: NotionEditorProps) => {
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [menuFilter, setMenuFilter] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toolbarFeedback, setToolbarFeedback] = useState<"copied" | "cut" | null>(null);
  const toolbarFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Block-level selection (Ctrl+A / drag-select) ──────────────────────────
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());

  // ── Drag-to-select state ───────────────────────────────────────────────────
  const [dragSelect, setDragSelect] = useState<{
    startX: number; startY: number; curX: number; curY: number; active: boolean;
  } | null>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const isDragSelectingRef = useRef(false);

  // ✅
  const isTouch = useIsTouchDevice();
  const [isEditingFocus, setIsEditingFocus] = useState(false);

  // Track whether any editable surface inside the editor currently owns focus,
  // so the mobile toolbar only appears while the user is actively editing.
  useEffect(() => {
    if (!isTouch) return;
    const onFocusIn = () => {
      const el = document.activeElement as HTMLElement | null;
      const editable =
        !!el &&
        (el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA");
      setIsEditingFocus(editable);
      if (editable) {
        const blockEl = el!.closest("[data-block-id]") as HTMLElement | null;
        const id = blockEl?.getAttribute("data-block-id");
        if (id) setActiveBlockId(id);
      }
    };
    const onFocusOut = () => {
      // Defer so focus moving between editables doesn't flicker the toolbar.
      setTimeout(onFocusIn, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [isTouch]);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; caption?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [studyModeBlock, setStudyModeBlock] = useState<NoteBlock | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const blockRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const contentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  // Focusable wrapper refs for non-editable special blocks (divider, chart, kanban, etc.)
  const specialBlockNavRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragYRef = useRef(0);

  const updateBlock = (id: string, updates: Partial<NoteBlock>) => {
    onChange(
      blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      )
    );
  };

  const updateNestedBlock = (parentBlockId: string, columnIndex: number, nestedBlockId: string, updates: Partial<NoteBlock>) => {
    onChange(
      blocks.map((block) => {
        if (block.id === parentBlockId && block.columns) {
          const newColumns = block.columns.map((column, colIdx) => {
            if (colIdx === columnIndex) {
              return column.map((nestedBlock) =>
                nestedBlock.id === nestedBlockId ? { ...nestedBlock, ...updates } : nestedBlock
              );
            }
            return column;
          });
          return { ...block, columns: newColumns };
        }
        return block;
      })
    );
  };

  const openLightbox = (images: { url: string; caption?: string }[], startIndex = 0) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  const addBlockAfter = (afterId: string, type: NoteBlock["type"] = "text") => {
    const newBlock: NoteBlock = {
      id: crypto.randomUUID(),
      type,
      content: type === "divider" ? "---" : "",
      checked: type === "todo" ? false : undefined,
      tableData: type === "table" ? [["", "", ""], ["", "", ""], ["", "", ""]] : undefined,
      isExpanded: type === "toggle" ? true : undefined,
      toggleContent: type === "toggle" ? "" : undefined,
      progressValue: type === "progress" ? 50 : undefined,
      progressColor: type === "progress" ? "bg-blue-500" : undefined,
      columns: type === "columns" ? [[{ id: crypto.randomUUID(), type: "text", content: "" }], [{ id: crypto.randomUUID(), type: "text", content: "" }]] : undefined,
      columnTitles: type === "columns" ? ["Column 1", "Column 2"] : undefined,
      // New block type defaults
      timelineItems: type === "timeline" ? [{ id: crypto.randomUUID(), title: "Milestone 1", description: "Description", date: new Date().toISOString().split('T')[0], color: "bg-blue-500" }] : undefined,
      kanbanColumns: type === "kanban" ? [
        { id: crypto.randomUUID(), title: "To Do", cards: [{ id: crypto.randomUUID(), content: "New task" }] },
        { id: crypto.randomUUID(), title: "In Progress", cards: [] },
        { id: crypto.randomUUID(), title: "Done", cards: [] }
      ] : undefined,
      ratingValue: type === "rating" ? 3 : undefined,
      ratingMax: type === "rating" ? 5 : undefined,
      countdownDate: type === "countdown" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined,
      countdownTitle: type === "countdown" ? "Countdown" : undefined,
      databaseRows: type === "database" ? [{ id: crypto.randomUUID(), cells: { name: "", status: "", date: "" } }] : undefined,
      databaseColumns: type === "database" ? [
        { id: "name", name: "Name", type: "text" },
        { id: "status", name: "Status", type: "select" },
        { id: "date", name: "Date", type: "date" }
      ] : undefined,
      mindMapNodes: type === "mindmap" ? [{ id: crypto.randomUUID(), text: "Central Idea", x: 150, y: 150, color: "bg-blue-500" }] : undefined,
      mindMapConnections: type === "mindmap" ? [] : undefined,
      galleryImages: type === "gallery" ? [] : undefined,
      chartType: type === "chart" ? "bar" : undefined,
      chartTitle: type === "chart" ? "My Chart" : undefined,
      chartColumns: type === "chart" ? [
        { id: crypto.randomUUID(), key: "name", type: "text" },
        { id: crypto.randomUUID(), key: "value", type: "number" },
      ] : undefined,
      chartRows: type === "chart" ? [
        { id: crypto.randomUUID(), cells: { name: "Jan", value: 400 } },
        { id: crypto.randomUUID(), cells: { name: "Feb", value: 300 } },
        { id: crypto.randomUUID(), cells: { name: "Mar", value: 200 } },
        { id: crypto.randomUUID(), cells: { name: "Apr", value: 278 } },
        { id: crypto.randomUUID(), cells: { name: "May", value: 189 } },
      ] : undefined,
      chartXAxisKey: type === "chart" ? "name" : undefined,
      chartSelectedSeries: type === "chart" ? ["value"] : undefined,
      chartSeriesColors: type === "chart" ? { value: "#3b82f6" } : undefined,
      // Labeled Divider
      dividerLabel: type === "labeledDivider" ? "Section" : undefined,
      dividerStyle: type === "labeledDivider" ? "simple" : undefined,
      // tabs data
      tabsData: type === "tabs" ? [
        { id: crypto.randomUUID(), label: "Tab 1", content: "", blocks: [{ id: crypto.randomUUID(), type: "text" as const, content: "" }] },
        { id: crypto.randomUUID(), label: "Tab 2", content: "", blocks: [{ id: crypto.randomUUID(), type: "text" as const, content: "" }] },
      ] : undefined,
      // FAQ
      faqItems: type === "faq" ? [
        { id: crypto.randomUUID(), question: "", answer: "" },
      ] : undefined,
      // Steps
      stepsItems: type === "steps" ? [
        { id: crypto.randomUUID(), title: "Step 1", description: "", completed: false },
        { id: crypto.randomUUID(), title: "Step 2", description: "", completed: false },
        { id: crypto.randomUUID(), title: "Step 3", description: "", completed: false },
      ] : undefined,
      swotStrengths: type === "swot" ? [""] : undefined,
      swotWeaknesses: type === "swot" ? [""] : undefined,
      swotOpportunities: type === "swot" ? [""] : undefined,
      swotThreats: type === "swot" ? [""] : undefined,
      // Image + Text
      imageTextUrl: type === "imageText" ? "" : undefined,
      imageTextTitle: type === "imageText" ? "" : undefined,
      imageTextDescription: type === "imageText" ? "" : undefined,
      imageTextLayout: type === "imageText" ? "imageLeft" : undefined,
    };
    const index = blocks.findIndex((b) => b.id === afterId);
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onChange(newBlocks);
    setShowMenu(null);
    setMenuFilter("");

    setTimeout(() => {
      const el = blockRefs.current.get(newBlock.id);
      if (el) {
        const input = el.querySelector('[contenteditable], input');
        if (input) (input as HTMLElement).focus();
      }
    }, 10);
  };

  const updateTableCell = (blockId: string, rowIndex: number, colIndex: number, value: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block?.tableData) return;

    const newTableData = block.tableData.map((row, rIdx) =>
      row.map((cell, cIdx) => (rIdx === rowIndex && cIdx === colIndex ? value : cell))
    );
    updateBlock(blockId, { tableData: newTableData });
  };

  const addTableRow = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block?.tableData) return;

    const cols = block.tableData[0]?.length || 3;
    const newRow = Array(cols).fill("");
    updateBlock(blockId, { tableData: [...block.tableData, newRow] });
  };

  const addTableColumn = (blockId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block?.tableData) return;

    const newTableData = block.tableData.map(row => [...row, ""]);
    updateBlock(blockId, { tableData: newTableData });
  };

  const deleteTableRow = (blockId: string, rowIndex: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block?.tableData || block.tableData.length <= 1) return;

    const newTableData = block.tableData.filter((_, idx) => idx !== rowIndex);
    updateBlock(blockId, { tableData: newTableData });
  };

  const deleteTableColumn = (blockId: string, colIndex: number) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block?.tableData || block.tableData[0]?.length <= 1) return;

    const newTableData = block.tableData.map(row => row.filter((_, idx) => idx !== colIndex));
    updateBlock(blockId, { tableData: newTableData });
  };

  const deleteBlock = (id: string) => {
    if (blocks.length <= 1) return;
    const index = blocks.findIndex((b) => b.id === id);
    const newBlocks = blocks.filter((b) => b.id !== id);
    onChange(newBlocks);

    if (index > 0) {
      setTimeout(() => {
        const prevBlock = newBlocks[index - 1];
        const el = blockRefs.current.get(prevBlock.id);
        if (el) {
          const input = el.querySelector('[contenteditable], input');
          if (input) (input as HTMLElement).focus();
        }
      }, 10);
    }
  };

  // ── Selection helpers ──────────────────────────────────────────────────────

  const selectAll = () => {
    setSelectedBlockIds(new Set(blocks.map((b) => b.id)));
  };

  const clearSelection = () => {
    setSelectedBlockIds(new Set());
  };

  /**
   * Fully deep-clone a block array with fresh IDs at every level.
   *
   * Every NoteBlock property that is an array-of-objects with an `id` field
   * gets new IDs so pasted copies are completely independent of the originals.
   * Plain arrays (tableData, cellFormattingMap values, etc.) are structurally
   * cloned so mutations to the copy never reach the source.
   */
  const cloneBlocksWithNewIds = (src: NoteBlock[]): NoteBlock[] =>
    src.map((b) => {
      // structuredClone gives us a true deep copy with no shared references.
      // It handles nested arrays, plain objects, primitives, and undefined/null.
      // (Available in all modern browsers and Node 17+.)
      const clone: NoteBlock = structuredClone(b);

      // Fresh top-level block id
      clone.id = crypto.randomUUID();

      // Refresh ids on every sub-item that carries one, so e.g. two pasted
      // kanban boards don't share card ids that other code might key on.
      if (clone.tableData) {
        // tableData is string[][] — no ids, nothing to refresh
      }
      if (clone.timelineItems) {
        clone.timelineItems = clone.timelineItems.map((item) => ({
          ...item, id: crypto.randomUUID(),
        }));
      }
      if (clone.kanbanColumns) {
        clone.kanbanColumns = clone.kanbanColumns.map((col) => ({
          ...col,
          id: crypto.randomUUID(),
          cards: col.cards.map((card) => ({ ...card, id: crypto.randomUUID() })),
        }));
      }
      if (clone.galleryImages) {
        clone.galleryImages = clone.galleryImages.map((img) => ({
          ...img, id: crypto.randomUUID(),
        }));
      }
      if (clone.databaseRows) {
        clone.databaseRows = clone.databaseRows.map((row) => ({
          ...row, id: crypto.randomUUID(),
        }));
      }
      if (clone.databaseColumns) {
        clone.databaseColumns = clone.databaseColumns.map((col) => ({
          ...col, id: crypto.randomUUID(),
        }));
      }
      if (clone.mindMapNodes) {
        // Build an old→new id map so connections stay consistent
        const nodeIdMap = new Map<string, string>();
        clone.mindMapNodes = clone.mindMapNodes.map((node) => {
          const newId = crypto.randomUUID();
          nodeIdMap.set(node.id, newId);
          return { ...node, id: newId };
        });
        if (clone.mindMapConnections) {
          clone.mindMapConnections = clone.mindMapConnections.map((conn) => ({
            ...conn,
            id: crypto.randomUUID(),
            from: nodeIdMap.get(conn.from) ?? conn.from,
            to:   nodeIdMap.get(conn.to)   ?? conn.to,
          }));
        }
      }
      if (clone.tabsData) {
        clone.tabsData = clone.tabsData.map((tab) => ({
          ...tab,
          id: crypto.randomUUID(),
          // Recursively clone nested blocks inside tabs
          blocks: tab.blocks ? cloneBlocksWithNewIds(tab.blocks) : undefined,
        }));
      }
      if (clone.flashcards) {
        clone.flashcards = clone.flashcards.map((card) => ({
          ...card, id: crypto.randomUUID(),
        }));
      }
      if (clone.chartColumns) {
        clone.chartColumns = clone.chartColumns.map((col) => ({
          ...col, id: crypto.randomUUID(),
        }));
      }
      if (clone.chartRows) {
        clone.chartRows = clone.chartRows.map((row) => ({
          ...row, id: crypto.randomUUID(),
        }));
      }
      if (clone.chartData) {
        clone.chartData = clone.chartData.map((d) => ({
          ...d, id: crypto.randomUUID(),
        }));
      }
      if (clone.stepsItems) {
        clone.stepsItems = clone.stepsItems.map((step) => ({
          ...step, id: crypto.randomUUID(),
        }));
      }
      if (clone.faqItems) {
        clone.faqItems = clone.faqItems.map((item) => ({
          ...item, id: crypto.randomUUID(),
        }));
      }
      if (clone.comparisonColumns) {
        // Build old→new id map so comparisonRows.values keys stay consistent
        const colIdMap = new Map<string, string>();
        clone.comparisonColumns = clone.comparisonColumns.map((col) => {
          const newId = crypto.randomUUID();
          colIdMap.set(col.id, newId);
          return { ...col, id: newId };
        });
        if (clone.comparisonRows) {
          clone.comparisonRows = clone.comparisonRows.map((row) => {
            const newValues: typeof row.values = {};
            for (const [oldKey, val] of Object.entries(row.values)) {
              newValues[colIdMap.get(oldKey) ?? oldKey] = val;
            }
            return { ...row, id: crypto.randomUUID(), values: newValues };
          });
        }
      }
      if (clone.columns) {
        // columns blocks — recursively clone each column's block array
        clone.columns = clone.columns.map((col) => cloneBlocksWithNewIds(col));
      }
      return clone;
    });

  const showToolbarFeedback = (type: "copied" | "cut") => {
    if (toolbarFeedbackTimer.current) clearTimeout(toolbarFeedbackTimer.current);
    setToolbarFeedback(type);
    toolbarFeedbackTimer.current = setTimeout(() => setToolbarFeedback(null), 1500);
  };

  const copySelectedBlocks = () => {
    const ordered = blocks.filter((b) => selectedBlockIds.has(b.id));
    if (!ordered.length) return;
    setBlockClipboard(ordered, false);
    const text = ordered.map((b) => b.content || "").filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).catch(() => {/* ignore */});
    showToolbarFeedback("copied");
  };

  const cutSelectedBlocks = () => {
    const ordered = blocks.filter((b) => selectedBlockIds.has(b.id));
    if (!ordered.length) return;
    setBlockClipboard(ordered, true);
    const text = ordered.map((b) => b.content || "").filter(Boolean).join("\n");
    navigator.clipboard.writeText(text).catch(() => {/* ignore */});
    showToolbarFeedback("cut");
    onChange(blocks.filter((b) => !selectedBlockIds.has(b.id)));
    clearSelection();
  };

  const pasteBlocks = (afterBlockId?: string) => {
    const clipboard = getBlockClipboard();
    if (!clipboard.length) return;
    const pasted = cloneBlocksWithNewIds(clipboard);

    let insertAt: number;
    if (afterBlockId !== undefined) {
      // Toolbar "Paste after" — insert right after the specified block
      const idx = blocks.findIndex((b) => b.id === afterBlockId);
      insertAt = idx >= 0 ? idx + 1 : blocks.length;
    } else {
      // Ctrl+V — insert after the currently focused block, or after last selected, or at end
      const focusedBlockId = activeBlockId;
      if (focusedBlockId) {
        const idx = blocks.findIndex((b) => b.id === focusedBlockId);
        insertAt = idx >= 0 ? idx + 1 : blocks.length;
      } else {
        // Fall back: after last selected block, or end of note
        let last = -1;
        blocks.forEach((b, i) => { if (selectedBlockIds.has(b.id)) last = i; });
        insertAt = last >= 0 ? last + 1 : blocks.length;
      }
    }

    const newBlocks = [...blocks];
    newBlocks.splice(insertAt, 0, ...pasted);
    onChange(newBlocks);

    // Highlight the pasted blocks and focus the first one
    setSelectedBlockIds(new Set(pasted.map((b) => b.id)));
    setTimeout(() => {
      const el = blockRefs.current.get(pasted[0].id);
      if (el) {
        const input = el.querySelector('[contenteditable], input') as HTMLElement | null;
        input?.focus();
      }
    }, 20);
  };

  const deleteSelectedBlocks = () => {
    if (!selectedBlockIds.size) return;
    const remaining = blocks.filter((b) => !selectedBlockIds.has(b.id));
    // Always keep at least one block
    if (remaining.length === 0) {
      const empty: NoteBlock = { id: crypto.randomUUID(), type: "text", content: "" };
      onChange([empty]);
    } else {
      onChange(remaining);
    }
    clearSelection();
  };

  // Global keyboard shortcut handler for block-level operations
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      // Ctrl/Cmd+A — select all blocks whenever the cursor is anywhere inside the editor
      if (e.key === "a" || e.key === "A") {
        const active = document.activeElement as HTMLElement | null;
        if (!active?.closest("[data-editor-root]")) return;
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
        selectAll();
        return;
      }

      if (!selectedBlockIds.size && e.key !== "v" && e.key !== "V") return;

      if (e.key === "c" || e.key === "C") {
        const sel = window.getSelection()?.toString() ?? "";
        if (sel.length === 0) {
          e.preventDefault();
          copySelectedBlocks();
        }
        return;
      }

      if (e.key === "x" || e.key === "X") {
        const sel = window.getSelection()?.toString() ?? "";
        if (sel.length === 0) {
          e.preventDefault();
          cutSelectedBlocks();
        }
        return;
      }

      if (e.key === "v" || e.key === "V") {
        const active = document.activeElement as HTMLElement | null;
        if (!active?.closest("[data-editor-root]")) return;
        if (getBlockClipboard().length > 0) {
          e.preventDefault();
          pasteBlocks(); // no afterBlockId → uses activeBlockId from state
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, selectedBlockIds]);

  // ── Drag-to-select mouse logic ─────────────────────────────────────────────
  useEffect(() => {
    const root = editorRootRef.current;
    if (!root) return;

    // Helper: get the rect of the drag selection box
    const getSelectionRect = (ds: NonNullable<typeof dragSelect>) => ({
      left:   Math.min(ds.startX, ds.curX),
      top:    Math.min(ds.startY, ds.curY),
      right:  Math.max(ds.startX, ds.curX),
      bottom: Math.max(ds.startY, ds.curY),
    });

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;

      // If clicking an interactive element, just clear any existing block-selection
      // (so typing in a text block properly deselects the multi-block highlight)
      const isInteractive =
        target.isContentEditable ||
        !!target.closest('button, input, textarea, [contenteditable], [data-no-drag-select]');

      if (isInteractive) {
        clearSelection();
        return;
      }

      // Start drag selection from anywhere on the editor surface
      isDragSelectingRef.current = false;
      const startX = e.clientX;
      const startY = e.clientY;
      setDragSelect({ startX, startY, curX: startX, curY: startY, active: false });

      const onMouseMove = (me: MouseEvent) => {
        const dx = Math.abs(me.clientX - startX);
        const dy = Math.abs(me.clientY - startY);
        if (dx > 5 || dy > 5) {
          isDragSelectingRef.current = true;
          setDragSelect({ startX, startY, curX: me.clientX, curY: me.clientY, active: true });

          const selRect = {
            left:   Math.min(startX, me.clientX),
            top:    Math.min(startY, me.clientY),
            right:  Math.max(startX, me.clientX),
            bottom: Math.max(startY, me.clientY),
          };

          const newSelected = new Set<string>();
          blocks.forEach((block) => {
            const el = blockRefs.current.get(block.id);
            if (!el) return;
            const r = el.getBoundingClientRect();
            // A block is "hit" when the drag rect overlaps its vertical span
            // (use vertical-only overlap so horizontal gutter drag still works)
            const overlapsV = r.top < selRect.bottom && r.bottom > selRect.top;
            if (overlapsV) newSelected.add(block.id);
          });
          setSelectedBlockIds(newSelected);
          window.getSelection()?.removeAllRanges();
        }
      };

      const onMouseUp = () => {
        setDragSelect(null);
        if (!isDragSelectingRef.current) {
          clearSelection();
        }
        isDragSelectingRef.current = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    };

    root.addEventListener("mousedown", onMouseDown);
    return () => root.removeEventListener("mousedown", onMouseDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks]);

  const isListType = (type: NoteBlock["type"]) => type === "bullet" || type === "numbered" || type === "todo";

  // ── Arrow-key navigation helpers ─────────────────────────────────────────
  /**
   * Focus a block at the given index. For text-like blocks the contentEditable
   * is focused; for special blocks the focusable nav wrapper is used instead.
   * `edge` controls where the caret lands: "start" | "end" (default "start").
   */
  const focusBlock = (index: number, edge: "start" | "end" = "start") => {
    if (index < 0 || index >= blocks.length) return;
    const target = blocks[index];

    // Try the special-block nav wrapper first
    const navEl = specialBlockNavRefs.current.get(target.id);
    if (navEl) {
      navEl.focus();
      return;
    }

    // Otherwise focus the contentEditable / input
    const el = blockRefs.current.get(target.id);
    if (!el) return;
    const editable = el.querySelector<HTMLElement>('[contenteditable], input, textarea');
    if (!editable) return;
    editable.focus();

    // Place caret at the correct edge
    if (editable.isContentEditable) {
      const sel = window.getSelection();
      if (!sel) return;
      const range = document.createRange();
      if (edge === "end") {
        range.selectNodeContents(editable);
        range.collapse(false);
      } else {
        range.selectNodeContents(editable);
        range.collapse(true);
      }
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // <input> / <textarea>
      const inp = editable as HTMLInputElement;
      if (edge === "end") {
        inp.setSelectionRange(inp.value.length, inp.value.length);
      } else {
        inp.setSelectionRange(0, 0);
      }
    }
  };

  /** Returns true when the caret is on the very first visual line of a contentEditable. */
  const isCaretAtFirstLine = (el: HTMLElement): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false; // text is selected, not just a caret

    // Get bounding rect of caret
    const caretRange = range.cloneRange();
    caretRange.collapse(true);
    const caretRect = caretRange.getBoundingClientRect();
    if (!caretRect || caretRect.height === 0) {
      // Fallback: check if at offset 0
      return range.startOffset === 0 && (range.startContainer === el || !el.contains(range.startContainer.previousSibling));
    }
    const elRect = el.getBoundingClientRect();
    // Caret is on the first line if its top is within one line-height of the element top
    return caretRect.top < elRect.top + caretRect.height * 1.5;
  };

  /** Returns true when the caret is on the very last visual line of a contentEditable. */
  const isCaretAtLastLine = (el: HTMLElement): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;

    const caretRange = range.cloneRange();
    caretRange.collapse(false);
    const caretRect = caretRange.getBoundingClientRect();
    if (!caretRect || caretRect.height === 0) {
      // Fallback: check if caret offset is at end of text
      const node = range.startContainer;
      const offset = range.startOffset;
      const nodeText = node.textContent || "";
      return offset === nodeText.length && !node.nextSibling?.textContent?.trim();
    }
    const elRect = el.getBoundingClientRect();
    return caretRect.bottom > elRect.bottom - caretRect.height * 1.5;
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleKeyDown = (e: KeyboardEvent, block: NoteBlock) => {
    // Don't prevent formatting shortcuts
    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey && ['b', 'i', 'u', 'e', 'k', 's', '\\'].includes(e.key.toLowerCase())) {
      return; // Let the formatting hook handle it
    }

    const contentEl = contentRefs.current.get(block.id);
    const isEmpty = contentEl ? (contentEl.textContent || "").trim() === "" : block.content === "";

    // Handle Tab / Shift+Tab for list indentation
    if (e.key === "Tab" && isListType(block.type)) {
      e.preventDefault();
      const currentIndent = block.indentLevel || 0;
      if (e.shiftKey) {
        // Outdent
        if (currentIndent > 0) {
          updateBlock(block.id, { indentLevel: currentIndent - 1 });
        }
      } else {
        // Indent (max 3 levels)
        if (currentIndent < 3) {
          updateBlock(block.id, { indentLevel: currentIndent + 1 });
        }
      }
      return;
    }

    // ── Arrow-key cross-block navigation ────────────────────────────────────
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const blockIndex = blocks.findIndex((b) => b.id === block.id);

      if (e.key === "ArrowUp") {
        if (blockIndex > 0) {
          const atFirst = contentEl ? isCaretAtFirstLine(contentEl) : true;
          if (atFirst) {
            e.preventDefault();
            focusBlock(blockIndex - 1, "end");
          }
        }
      } else {
        // ArrowDown
        if (blockIndex < blocks.length - 1) {
          const atLast = contentEl ? isCaretAtLastLine(contentEl) : true;
          if (atLast) {
            e.preventDefault();
            focusBlock(blockIndex + 1, "start");
          }
        }
      }
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    // Handle Enter key
    if (e.key === "Enter" && !e.shiftKey) {
      // For code blocks: allow new lines (Shift+Enter to exit)
      if (block.type === "code") {
        return; // Allow native Enter behavior for new lines
      }

      // For lists, todos, bullets: exit on empty second press
      if (isListType(block.type)) {
        if (isEmpty) {
          // If indented, outdent first instead of exiting
          if ((block.indentLevel || 0) > 0) {
            e.preventDefault();
            updateBlock(block.id, { indentLevel: (block.indentLevel || 0) - 1 });
            return;
          }
          // Empty list item at root: delete it and create a new text block
          e.preventDefault();
          const index = blocks.findIndex((b) => b.id === block.id);
          const newBlocks = blocks.filter((b) => b.id !== block.id);

          const newBlock: NoteBlock = {
            id: crypto.randomUUID(),
            type: "text",
            content: "",
          };
          newBlocks.splice(index, 0, newBlock);
          onChange(newBlocks);

          setTimeout(() => {
            const el = blockRefs.current.get(newBlock.id);
            if (el) {
              const input = el.querySelector('[contenteditable], input');
              if (input) (input as HTMLElement).focus();
            }
          }, 10);
        } else {
          // Non-empty: create new list item at same indent level
          e.preventDefault();
          const newBlock: NoteBlock = {
            id: crypto.randomUUID(),
            type: block.type,
            content: "",
            checked: block.type === "todo" ? false : undefined,
            indentLevel: block.indentLevel || 0,
          };
          const index = blocks.findIndex((b) => b.id === block.id);
          const newBlocks = [...blocks];
          newBlocks.splice(index + 1, 0, newBlock);
          onChange(newBlocks);
          setShowMenu(null);
          setMenuFilter("");
          setTimeout(() => {
            const el = blockRefs.current.get(newBlock.id);
            if (el) {
              const input = el.querySelector('[contenteditable], input');
              if (input) (input as HTMLElement).focus();
            }
          }, 10);
        }
        return;
      }

      // For other blocks: normal behavior
      e.preventDefault();
      addBlockAfter(block.id, "text");
    }

    // Handle Shift+Enter: exit code blocks or create new line in other blocks
    if (e.key === "Enter" && e.shiftKey && block.type === "code") {
      e.preventDefault();
      addBlockAfter(block.id, "text");
      return;
    }

    if (e.key === "Backspace" && isEmpty && blocks.length > 1) {
      // If indented list, outdent first
      if (isListType(block.type) && (block.indentLevel || 0) > 0) {
        e.preventDefault();
        updateBlock(block.id, { indentLevel: (block.indentLevel || 0) - 1 });
        return;
      }
      e.preventDefault();
      deleteBlock(block.id);
    }

    if (e.key === "/" && isEmpty && !isTouch) {
      e.preventDefault();
      setShowMenu(block.id);
      setMenuFilter("");
    }
    if (e.key === "Escape") {
      if (selectedBlockIds.size > 0) {
        clearSelection();
      }
      setShowMenu(null);
      setMenuFilter("");
    }
  };

  // Helper function to extract text from contentEditable while preserving line breaks
  const extractContentFromEditable = (el: HTMLElement): string => {
    // Use innerText which respects visual line breaks, then clean up
    return (el.innerText || el.textContent || "").trimEnd();
  };

  const handleContentInput = (block: NoteBlock, el: HTMLDivElement) => {
    const text = el.textContent || "";
    updateBlock(block.id, { content: text });
  };

  const copyCodeToClipboard = async (blockId: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedCode(blockId);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getVideoEmbedUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith('http') || url.startsWith('blob:')) {
      // YouTube
      const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (youtubeMatch) {
        return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
      }
      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) {
        return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
    }
    return null;
  };

  const getBlockStyle = (type: NoteBlock["type"]) => {
    switch (type) {
      case "heading1":
        return "text-3xl font-bold tracking-tight";
      case "heading2":
        return "text-2xl font-semibold tracking-tight";
      case "heading3":
        return "text-xl font-medium";
      case "quote":
        return "border-l-4 border-primary pl-4 italic text-muted-foreground bg-muted/30 py-2 rounded-r-lg";
      case "code":
        return "font-mono text-sm bg-zinc-900 text-green-400 p-4 rounded-lg border border-zinc-700 whitespace-pre-wrap";
      case "callout":
        return "bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg";
      case "equation":
        return "font-mono text-lg bg-muted/30 p-4 rounded-lg text-center border border-border";
      default:
        return "text-base";
    }
  };

  const getNumberedIndex = (blockId: string) => {
    const targetIdx = blocks.findIndex(b => b.id === blockId);
    if (targetIdx === -1) return 1;
    const targetIndent = blocks[targetIdx].indentLevel || 0;
    let count = 0;
    for (let i = 0; i <= targetIdx; i++) {
      const b = blocks[i];
      if (b.type === "numbered" && (b.indentLevel || 0) === targetIndent) {
        count++;
      } else if (b.type === "numbered" && (b.indentLevel || 0) < targetIndent) {
        // Reset count when we encounter a parent-level numbered item
        count = 0;
      } else if (b.type !== "numbered" && (b.indentLevel || 0) <= targetIndent) {
        // Reset when a non-numbered block at same or lower indent breaks the sequence
        count = 0;
      }
    }
    return count || 1;
  };

  const filteredBlockTypes = blockTypes.filter(
    (bt) =>
      bt.label.toLowerCase().includes(menuFilter.toLowerCase()) ||
      bt.description.toLowerCase().includes(menuFilter.toLowerCase())
  );

  const handleBlockDragStart = (blockId: string, clientY: number) => {
    setDraggedBlockId(blockId);
    setShowMenu(null);
    dragYRef.current = clientY;
  };

  const handleBlockDragEnd = (draggedId: string) => {
    if (dragOverBlockId && dragOverBlockId !== draggedId) {
      reorderBlocks(draggedId, dragOverBlockId);
    }
    setDraggedBlockId(null);
    setDragOverBlockId(null);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!draggedBlockId) return;

    // Find which block the pointer is over
    let foundBlock = false;
    blocks.forEach((block) => {
      const element = blockRefs.current.get(block.id);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      const isOver =
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom &&
        block.id !== draggedBlockId;

      if (isOver && !foundBlock) {
        setDragOverBlockId(block.id);
        foundBlock = true;
      }
    });

    // Clear dragOverBlockId if not over any block
    if (!foundBlock) {
      setDragOverBlockId(null);
    }
  };

  const reorderBlocks = (draggedId: string, targetId: string) => {
    const draggedIndex = blocks.findIndex(b => b.id === draggedId);
    const targetIndex = blocks.findIndex(b => b.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex) {
      return;
    }

    const newBlocks = [...blocks];
    const [draggedBlock] = newBlocks.splice(draggedIndex, 1);

    if (draggedIndex < targetIndex) {
      newBlocks.splice(targetIndex - 1, 0, draggedBlock);
    } else {
      newBlocks.splice(targetIndex, 0, draggedBlock);
    }

    onChange(newBlocks);
  };

  // Track content refs to avoid re-renders resetting cursor
  const initializedRefs = useRef<Set<string>>(new Set());
  const currentBlockIds = useRef<string>("");

  // Clear initialized refs when blocks change (switching notes) or content changes externally
  useEffect(() => {
    const blockIds = blocks.map(b => b.id).join(",");
    if (currentBlockIds.current !== blockIds) {
      initializedRefs.current.clear();
      currentBlockIds.current = blockIds;
    }
    // Sync DOM with state for blocks whose content changed externally (e.g., find & replace)
    // Skip sync for the currently focused element to prevent cursor reset (especially in code blocks)
    blocks.forEach((block) => {
      const el = contentRefs.current.get(block.id);
      if (el && initializedRefs.current.has(block.id)) {
        // Don't sync if this element has focus - prevents cursor jumping in code blocks
        if (document.activeElement === el) return;
        const currentContent = block.type === "code" ? extractContentFromEditable(el) : (el.innerHTML || "");
        if (currentContent !== block.content) {
          if (block.type === "code") {
            // Preserve line breaks for code blocks
            el.innerText = block.content || "";
          } else {
            el.innerHTML = block.content || "";
          }
        }
      }
    });
  }, [blocks]);

  // Add pointer move and up listeners for drag detection
  useEffect(() => {
    if (!draggedBlockId) return;

    const handlePointerUp = () => {
      handleBlockDragEnd(draggedBlockId);
    };

    window.addEventListener("pointermove", handlePointerMove as EventListener);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove as EventListener);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggedBlockId, blocks, dragOverBlockId]);

  // Render editable content with formatting preserved - NO children to avoid cursor reset
  const renderEditableContent = (block: NoteBlock) => {
    return (
      <div
        ref={(el) => {
          if (el) {
            contentRefs.current.set(block.id, el);
            // Only set content on first mount to avoid cursor reset
            if (!initializedRefs.current.has(block.id)) {
              el.innerHTML = block.content || "";
              initializedRefs.current.add(block.id);
            }
          }
        }}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          const html = e.currentTarget.innerHTML || "";
          if (html !== block.content) {
            updateBlock(block.id, { content: html });
          }
        }}
        onBlur={(e) => {
          const html = e.currentTarget.innerHTML || "";
          if (html !== block.content) {
            updateBlock(block.id, { content: html });
          }
        }}
        onKeyDown={(e) => handleKeyDown(e, block)}
        className={`outline-none py-1 transition-all ${getBlockStyle(block.type)} empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40`}
        data-placeholder={
          block.type === "heading1" ? "Heading 1" :
            block.type === "heading2" ? "Heading 2" :
              block.type === "heading3" ? "Heading 3" :
                block.type === "quote" ? "Write a quote..." :
                  block.type === "code" ? "Write code..." :
                    block.type === "callout" ? "Write a callout..." :
                      block.type === "equation" ? "E = mc²" :
                        "Type '/' for commands, or start writing..."
        }
      />
    );
  };

  const renderBlock = (block: NoteBlock) => {
    switch (block.type) {
      case "divider":
        return (
          <div className="py-3">
            <div className="h-px bg-linear-to-r from-transparent via-border to-transparent" />
          </div>
        );

      case "todo": {
        const todoIndent = block.indentLevel || 0;
        return (
          <div className="flex items-start flex-row-reverse gap-3 py-1" style={{ paddingLeft: `${todoIndent * 24}px` }}>
            <div
              ref={(el) => {
                if (el) {
                  contentRefs.current.set(block.id, el);
                  if (!initializedRefs.current.has(block.id)) {
                    el.innerHTML = block.content || "";
                    initializedRefs.current.add(block.id);
                  }
                }
              }}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const html = e.currentTarget.innerHTML || "";
                if (html !== block.content) {
                  updateBlock(block.id, { content: html });
                }
              }}
              onBlur={(e) => {
                const html = e.currentTarget.innerHTML || "";
                if (html !== block.content) {
                  updateBlock(block.id, { content: html });
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, block)}
              className={`flex-1 outline-none transition-all ${!!block.checked ? 'line-through text-muted-foreground/50' : ''}`}
              data-placeholder="To-do"
            />
            <motion.div
              className="mt-1"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <input
                type="checkbox"
                checked={!!block.checked}
                onChange={(e) => updateBlock(block.id, { checked: e.target.checked })}
                className="w-5 h-5 rounded-md border-2 border-muted-foreground/30 accent-primary cursor-pointer transition-all checked:border-primary"
              />
            </motion.div>
          </div>
        );
      }

      case "bullet": {
        const bulletIndent = block.indentLevel || 0;
        const bulletStyles = ["rounded-full bg-primary/60", "rounded-full border-2 border-primary/60 bg-transparent", "rounded-sm bg-primary/40", "rounded-full bg-primary/30"];
        const bulletSizes = ["w-2 h-2", "w-2 h-2", "w-1.5 h-1.5", "w-1.5 h-1.5"];
        return (
          <div className="flex items-start gap-3 py-1" style={{ paddingLeft: `${bulletIndent * 24}px` }}>
            <span className={`mt-2.5 ${bulletSizes[bulletIndent]} ${bulletStyles[bulletIndent]} shrink-0`} />
            <div
              ref={(el) => {
                if (el) {
                  contentRefs.current.set(block.id, el);
                  if (!initializedRefs.current.has(block.id)) {
                    el.innerHTML = block.content || "";
                    initializedRefs.current.add(block.id);
                  }
                }
              }}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const html = e.currentTarget.innerHTML || "";
                if (html !== block.content) {
                  updateBlock(block.id, { content: html });
                }
              }}
              onBlur={(e) => {
                const html = e.currentTarget.innerHTML || "";
                if (html !== block.content) {
                  updateBlock(block.id, { content: html });
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, block)}
              className="flex-1 outline-none"
              data-placeholder="List item"
            />
          </div>
        );
      }

      case "numbered": {
        const numIndent = block.indentLevel || 0;
        const numberStyles = ["", "text-sm", "text-xs italic", "text-xs"];
        return (
          <div className="flex items-start gap-3 py-1" style={{ paddingLeft: `${numIndent * 24}px` }}>
            <span className={`mt-0.5 text-primary/60 font-medium min-w-6 ${numberStyles[numIndent]}`}>
              {getNumberedIndex(block.id)}.
            </span>
            <div
              ref={(el) => {
                if (el) {
                  contentRefs.current.set(block.id, el);
                  if (!initializedRefs.current.has(block.id)) {
                    el.innerHTML = block.content || "";
                    initializedRefs.current.add(block.id);
                  }
                }
              }}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                const html = e.currentTarget.innerHTML || "";
                if (html !== block.content) {
                  updateBlock(block.id, { content: html });
                }
              }}
              onBlur={(e) => {
                const html = e.currentTarget.innerHTML || "";
                if (html !== block.content) {
                  updateBlock(block.id, { content: html });
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, block)}
              className="flex-1 outline-none"
              data-placeholder="List item"
            />
          </div>
        );
      }

      case "toggle":
        return (
          <div className="py-1">
            <div className="flex items-start gap-2">
              <motion.button
                onClick={() => {
                  // When collapsing, remove the toggle content key so it re-initializes on expand
                  if (block.isExpanded) {
                    initializedRefs.current.delete(`${block.id}-toggle`);
                  }
                  updateBlock(block.id, { isExpanded: !block.isExpanded });
                }}
                className="p-1 rounded hover:bg-muted transition-colors mt-0.5"
                animate={{ rotate: block.isExpanded ? 90 : 0 }}
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </motion.button>
              <div
                ref={(el) => {
                  if (el) {
                    contentRefs.current.set(block.id, el);
                    if (!initializedRefs.current.has(block.id)) {
                      el.innerHTML = block.content || "";
                      initializedRefs.current.add(block.id);
                    }
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const html = e.currentTarget.innerHTML || "";
                  if (html !== block.content) {
                    updateBlock(block.id, { content: html });
                  }
                }}
                onBlur={(e) => {
                  const html = e.currentTarget.innerHTML || "";
                  if (html !== block.content) {
                    updateBlock(block.id, { content: html });
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, block)}
                className="flex-1 outline-none font-medium"
                data-placeholder="Toggle heading"
              />
            </div>
            <AnimatePresence>
              {block.isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-7 mt-2 pl-4 border-l-2 border-muted"
                >
                  <div
                    ref={(el) => {
                      if (el) {
                        const toggleKey = `${block.id}-toggle`;
                        if (!initializedRefs.current.has(toggleKey)) {
                          el.innerHTML = block.toggleContent || "";
                          initializedRefs.current.add(toggleKey);
                        }
                      }
                    }}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const html = e.currentTarget.innerHTML || "";
                      if (html !== block.toggleContent) {
                        updateBlock(block.id, { toggleContent: html });
                      }
                    }}
                    onBlur={(e) => {
                      const html = e.currentTarget.innerHTML || "";
                      if (html !== block.toggleContent) {
                        updateBlock(block.id, { toggleContent: html });
                      }
                    }}
                    className="outline-none text-sm min-h-10 py-1 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                    data-placeholder="Add content inside this toggle..."
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );

      case "code":
        return (
          <div className="py-2 relative group/code">
            <div className={getBlockStyle("code")}>
              <div
                ref={(el) => {
                  if (el) {
                    contentRefs.current.set(block.id, el);
                    if (!initializedRefs.current.has(block.id)) {
                      el.textContent = block.content || "";
                      initializedRefs.current.add(block.id);
                    }
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const text = extractContentFromEditable(e.currentTarget);
                  if (text !== block.content) {
                    updateBlock(block.id, { content: text });
                  }
                }}
                onBlur={(e) => {
                  const text = extractContentFromEditable(e.currentTarget);
                  if (text !== block.content) {
                    updateBlock(block.id, { content: text });
                  }
                }}
                onKeyDown={(e) => handleKeyDown(e, block)}
                className="outline-none min-h-15"
                data-placeholder="// Write your code here..."
              />
            </div>
            <motion.button
              onClick={() => copyCodeToClipboard(block.id, block.content)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors opacity-0 group-hover/code:opacity-100"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {copiedCode === block.id ? (
                <Check className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-zinc-400" />
              )}
            </motion.button>
          </div>
        );

      case "image":
        return (
          <div className="py-2">
            {block.imageUrl ? (
              <div className="relative group/image rounded-lg overflow-hidden">
                {/* Using PersistentImage to ensure local files resolve correctly */}
                <PersistentImage
                  src={block.imageUrl}
                  alt="Embedded"
                  className="w-full max-h-100 object-cover rounded-lg cursor-pointer"
                  onClick={() => openLightbox([{ url: block.imageUrl! }], 0)}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                  <div className="flex gap-2 pointer-events-auto">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox([{ url: block.imageUrl! }], 0);
                      }}
                      className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <ZoomIn className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateBlock(block.id, { imageUrl: undefined });
                      }}
                      className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                <Image className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                {/* Replaced input with MediaUploader */}
                <MediaUploader
                  currentValue={block.imageUrl}
                  accept="image/*"
                  placeholder="Paste image URL and press Enter..."
                  onUploadComplete={(newUrlOrPath) => {
                    updateBlock(block.id, { imageUrl: newUrlOrPath });
                  }}
                />
              </div>
            )}
          </div>
        );

      case "bookmark":
        return (
          <div className="py-2">
            {block.bookmarkUrl ? (
              <motion.a
                href={block.bookmarkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group/bookmark"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{block.bookmarkTitle || block.bookmarkUrl}</p>
                  {block.bookmarkDescription && (
                    <p className="text-sm text-muted-foreground truncate">{block.bookmarkDescription}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60 truncate mt-1">{block.bookmarkUrl}</p>
                </div>
                <ExternalLink className="w-5 h-5 text-muted-foreground opacity-0 group-hover/bookmark:opacity-100 transition-opacity" />
              </motion.a>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center">
                <Link2 className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <input
                  type="text"
                  placeholder="Paste URL and press Enter..."
                  className="w-full max-w-md mx-auto px-4 py-2 bg-muted/50 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const url = (e.target as HTMLInputElement).value;
                      updateBlock(block.id, {
                        bookmarkUrl: url,
                        bookmarkTitle: new URL(url).hostname,
                      });
                    }
                  }}
                />
              </div>
            )}
          </div>
        );

      case "video":
        const embedUrl = getVideoEmbedUrl(block.videoUrl || '');

        return (
          <div className="py-2">
            {block.videoUrl ? (
              <div className="relative rounded-4xl overflow-hidden aspect-video bg-black shadow-2xl border border-border/50 group">
                {embedUrl ? (
                  /* External YouTube/Vimeo */
                  <iframe
                    src={embedUrl}
                    className="w-full h-full border-none"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  /* Local OPFS File */
                  <PersistentVideo
                    src={block.videoUrl}
                    className="w-full h-full object-contain"
                  />
                )}

                <button
                  onClick={() => updateBlock(block.id, { videoUrl: undefined })}
                  className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Empty Uploader State */
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                <Play className="w-12 h-12 mx-auto text-muted-foreground/20 mb-6" />
                <MediaUploader
                  placeholder="Paste YouTube/Vimeo link or upload..."
                  currentValue={block.videoUrl}
                  onUploadComplete={(url) => updateBlock(block.id, { videoUrl: url })}
                  accept="video/*"
                />
              </div>
            )}
          </div>
        );

      case "progress":
        return (
          <div className="py-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${block.progressColor || 'bg-blue-500'} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${block.progressValue || 0}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
              <input
                type="number"
                min="0"
                max="100"
                value={block.progressValue || 0}
                onChange={(e) => updateBlock(block.id, { progressValue: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                className="w-16 px-2 py-1 text-sm bg-muted rounded-lg outline-none text-center"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <div className="flex gap-2 mt-2">
              {progressColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateBlock(block.id, { progressColor: color.value })}
                  className={`w-5 h-5 rounded-full ${color.value} ${block.progressColor === color.value ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                />
              ))}
            </div>
          </div>
        );

      case "equation":
        return (
          <EquationBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
          />
        );

        case "columns":
          const columnTitles = block.columnTitles || ["Column 1", "Column 2"];
  
          // Add a new text block after blockIndex and focus it
          const addNestedBlock = (colIndex: number, afterIndex: number) => {
            const newBlock: NoteBlock = { id: crypto.randomUUID(), type: "text", content: "" };
            const newColumns = [...(block.columns || [[], []])];
            newColumns[colIndex] = [
              ...newColumns[colIndex].slice(0, afterIndex + 1),
              newBlock,
              ...newColumns[colIndex].slice(afterIndex + 1),
            ];
            updateBlock(block.id, { columns: newColumns });
            // Focus the new block after React re-renders
            setTimeout(() => {
              const el = contentRefs.current.get(newBlock.id);
              el?.focus();
            }, 20);
          };
  
          // Delete block at blockIndex and focus the previous one (or next if first)
          const deleteNestedBlock = (colIndex: number, blockIndex: number) => {
            const col = block.columns?.[colIndex] || [];
            if (col.length <= 1) return; // keep at least one block
            const focusId = blockIndex > 0
              ? col[blockIndex - 1].id
              : col[blockIndex + 1]?.id;
            const newColumns = [...(block.columns || [[], []])];
            newColumns[colIndex] = newColumns[colIndex].filter((_, i) => i !== blockIndex);
            updateBlock(block.id, { columns: newColumns });
            setTimeout(() => {
              if (focusId) {
                const el = contentRefs.current.get(focusId);
                el?.focus();
                // Move cursor to end
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(el!);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }, 20);
          };
  
          const handleNestedKeyDown = (
            e: React.KeyboardEvent<HTMLDivElement>,
            colIndex: number,
            blockIndex: number,
            nestedBlock: NoteBlock
          ) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              // Save current content first
              const html = e.currentTarget.innerHTML || "";
              updateNestedBlock(block.id, colIndex, nestedBlock.id, { content: html });
              addNestedBlock(colIndex, blockIndex);
            } else if (e.key === "Backspace") {
              const isEmpty = e.currentTarget.innerHTML === "" || e.currentTarget.innerHTML === "<br>";
              if (isEmpty) {
                e.preventDefault();
                deleteNestedBlock(colIndex, blockIndex);
              }
            }
          };
  
          return (
            <div className="py-2">
              <div className="grid grid-cols-2 gap-4">
                {(block.columns || [[], []]).map((column, colIndex) => (
                  <div key={colIndex} className="min-h-25 border border-dashed border-muted-foreground/20 rounded-lg p-3">
                    <div
                      ref={(el) => {
                        if (el) {
                          // Create a unique key for the title ref using the block ID and column index
                          const titleKey = `${block.id}-title-${colIndex}`;
                          contentRefs.current.set(titleKey, el);
                          if (!initializedRefs.current.has(titleKey)) {
                            el.innerHTML = columnTitles[colIndex] || `Column ${colIndex + 1}`;
                            initializedRefs.current.add(titleKey);
                          }
                        }
                      }}
                      contentEditable
                      suppressContentEditableWarning
                      data-placeholder={`Column ${colIndex + 1}`}
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML || "";
                        if (html !== columnTitles[colIndex]) {
                          const newTitles = [...columnTitles];
                          newTitles[colIndex] = html;
                          updateBlock(block.id, { columnTitles: newTitles });
                        }
                      }}
                      onInput={(e) => {
                        // Optional: Keep this if you need instant state sync for other parts of the UI,
                        // but remove dangerouslySetInnerHTML to prevent the cursor jump.
                        const newTitles = [...columnTitles];
                        newTitles[colIndex] = e.currentTarget.innerHTML;
                        updateBlock(block.id, { columnTitles: newTitles });
                      }}
                      className="text-sm font-semibold mb-3 bg-muted/40 outline-none focus:bg-muted focus:text-foreground transition-colors w-full px-2 py-1 rounded border border-transparent focus:border-primary/30 text-foreground empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                    />
                    <div className="space-y-2">
                      {(column || []).map((nestedBlock, blockIndex) => (
                        <div key={nestedBlock.id || blockIndex} className="relative group/nested">
                          {nestedBlock.type === "text" && (
                            <div
                              ref={(el) => {
                                if (el) {
                                  contentRefs.current.set(nestedBlock.id, el);
                                  if (!initializedRefs.current.has(nestedBlock.id)) {
                                    el.innerHTML = nestedBlock.content || "";
                                    initializedRefs.current.add(nestedBlock.id);
                                  }
                                }
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const html = e.currentTarget.innerHTML || "";
                                if (html !== nestedBlock.content) {
                                  updateNestedBlock(block.id, colIndex, nestedBlock.id, { content: html });
                                }
                              }}
                              onKeyDown={(e) => handleNestedKeyDown(e, colIndex, blockIndex, nestedBlock)}
                              className="outline-none py-1 text-sm empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                              data-placeholder="Type here..."
                            />
                          )}
                          {nestedBlock.type === "bullet" && (
                            <div className="flex items-start gap-3 py-1">
                              <span className="mt-2.5 w-2 h-2 rounded-full bg-primary/60 shrink-0" />
                              <div
                                ref={(el) => {
                                  if (el) {
                                    contentRefs.current.set(nestedBlock.id, el);
                                    if (!initializedRefs.current.has(nestedBlock.id)) {
                                      el.innerHTML = nestedBlock.content || "";
                                      initializedRefs.current.add(nestedBlock.id);
                                    }
                                  }
                                }}
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const html = e.currentTarget.innerHTML || "";
                                  if (html !== nestedBlock.content) {
                                    updateNestedBlock(block.id, colIndex, nestedBlock.id, { content: html });
                                  }
                                }}
                                onKeyDown={(e) => handleNestedKeyDown(e, colIndex, blockIndex, nestedBlock)}
                                className="flex-1 outline-none text-sm"
                                data-placeholder="List item"
                              />
                            </div>
                          )}
                          {nestedBlock.type === "heading1" && (
                            <div
                              ref={(el) => {
                                if (el) {
                                  contentRefs.current.set(nestedBlock.id, el);
                                  if (!initializedRefs.current.has(nestedBlock.id)) {
                                    el.innerHTML = nestedBlock.content || "";
                                    initializedRefs.current.add(nestedBlock.id);
                                  }
                                }
                              }}
                              contentEditable
                              suppressContentEditableWarning
                              onBlur={(e) => {
                                const html = e.currentTarget.innerHTML || "";
                                if (html !== nestedBlock.content) {
                                  updateNestedBlock(block.id, colIndex, nestedBlock.id, { content: html });
                                }
                              }}
                              onKeyDown={(e) => handleNestedKeyDown(e, colIndex, blockIndex, nestedBlock)}
                              className="outline-none text-2xl font-bold empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40"
                              data-placeholder="Heading 1"
                            />
                          )}
                          <button
                            onClick={() => {
                              const newColumns = [...(block.columns || [])];
                              newColumns[colIndex] = newColumns[colIndex].filter((_, idx) => idx !== blockIndex);
                              updateBlock(block.id, { columns: newColumns });
                            }}
                            className="absolute top-0 right-0 opacity-0 group-hover/nested:opacity-100 p-1 rounded hover:bg-destructive/10 transition-opacity"
                            title="Delete"
                          >
                            <X className="w-3 h-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const newColumns = [...(block.columns || [])];
                        newColumns[colIndex].push({ id: crypto.randomUUID(), type: "text", content: "" });
                        updateBlock(block.id, { columns: newColumns });
                      }}
                      className="mt-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
                    >
                      + Add content
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );

          case "table":
            return (
              <DataTable
                block={block}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onCreateChart={(tableId, columnNames) => {
                  const index = blocks.findIndex((b) => b.id === block.id);
                  const tableData = block.tableData || [];
          
                  // Helper to strip out all internal HTML elements cleanly
                  const cleanText = (html: string) => {
                    if (!html) return "";
                    
                    // Create a temporary element to let the browser natively decode entities like &nbsp;
                    let txt = html;
                    if (typeof window !== "undefined") {
                      const parser = new DOMParser();
                      const doc = parser.parseFromString(html, "text/html");
                      txt = doc.body.textContent || doc.body.innerText || html;
                    }
                  
                    // Sanitize formatting tags and line breaks
                    txt = txt.replace(/<\/?(div|p)[^>]*>/gi, " ").replace(/<br\s*\/?>/gi, " ");
                    txt = txt.replace(/<[^>]*>/g, "");
                    
                    // Normalize both standard spaces and unicode non-breaking spaces
                    return txt.replace(/[\u00A0\s]+/g, " ").trim();
                  };
          
                  // Clean headers cleanly so Recharts keys won't contain active HTML syntax
                  const sanitizedHeaders = (tableData[0] || []).map((header, idx) => cleanText(header) || `col${idx}`);
          
                  // Convert table data to chart format with stripped content keys and numbers
                  const chartRows = tableData.slice(1).map((row) => ({
                    id: crypto.randomUUID(),
                    cells: row.reduce((acc, cell, idx) => {
                      const cleanedCell = cleanText(cell);
                      const key = sanitizedHeaders[idx];
                      return {
                        ...acc,
                        [key]: isNaN(Number(cleanedCell)) || cleanedCell === "" ? cleanedCell : Number(cleanedCell),
                      };
                    }, {}),
                  }));
          
                  const chartColumns: { id: string; key: string; type: "text" | "number" }[] = sanitizedHeaders.map((name, idx) => {
                    const firstRowValue = cleanText(tableData[1]?.[idx] || "");
                    return {
                      id: `col${idx}`,
                      key: name,
                      type: (/^\d+(\.\d+)?$/.test(firstRowValue) ? "number" : "text") as "text" | "number",
                    };
                  });
          
                  const chartBlock: NoteBlock = {
                    id: crypto.randomUUID(),
                    type: "chart",
                    content: "Chart from Table",
                    chartType: "bar",
                    chartTitle: "My Chart",
                    chartColumns,
                    chartRows,
                    chartXAxisKey: chartColumns[0]?.key, // Sync directly to the sanitized key string
                    chartSelectedSeries: chartColumns.filter(c => c.type === "number").map(c => c.key),
                    chartSeriesColors: {},
                    linkedTableId: tableId,
                  };
                  const newBlocks = [...blocks];
                  newBlocks.splice(index + 1, 0, chartBlock);
                  onChange(newBlocks);
                }}
              />
            );

      case "file":
        return (
          <FileBlock
            fileUrl={block.fileUrl || ""}
            fileName={block.fileName || ""}
            onUpdate={(updates) => updateBlock(block.id, updates)}
          />
        );

      case "audio":
        return (
          <div className="py-2">
            {block.audioUrl ? (
              /* Minimalist "Single Row" Player */
              <div className="group relative flex items-center gap-4 p-3 bg-secondary/30 backdrop-blur-md rounded-[1.5rem] border border-border/40 transition-all duration-300 hover:border-primary/20">

                {/* 1. Icon */}
                <div className="shrink-0 w-10 h-10 bg-card rounded-xl border border-border/50 flex items-center justify-center shadow-sm">
                  <Music className="w-5 h-5 text-primary/70" />
                </div>

                {/* 2. Player - Fills the middle space */}
                <div className="flex-1 min-w-0">
                  <PersistentAudio
                    src={block.audioUrl}
                    className="w-full h-8 opacity-80 hover:opacity-100 transition-opacity"
                  />
                </div>

                {/* 3. Remove Button */}
                <button
                  onClick={() => updateBlock(block.id, { audioUrl: undefined })}
                  className="shrink-0 p-2 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-full transition-all active:scale-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Standard Empty State */
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                <Music className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                <MediaUploader
                  placeholder="Audio URL or upload..."
                  currentValue={block.audioUrl}
                  onUploadComplete={(url) => updateBlock(block.id, { audioUrl: url })}
                  accept="audio/*"
                />
              </div>
            )}
          </div>
        );

      case "timeline":
        return (
          <div className="py-3">
            <div className="relative pl-6 space-y-4">
              {(block.timelineItems || []).map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="relative group/timeline"
                >
                  <div className={`absolute left-0 top-2 w-3 h-3 rounded-full ${item.color} -translate-x-7`} />
                  {index < (block.timelineItems?.length || 0) - 1 && (
                    <div className="absolute left-0 top-5 w-0.5 h-full bg-border -translate-x-6" />
                  )}
                  <div className="bg-muted/30 rounded-lg p-3 border border-border hover:border-primary/30 transition-colors">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const newItems = [...(block.timelineItems || [])];
                        newItems[index] = { ...item, title: e.target.value };
                        updateBlock(block.id, { timelineItems: newItems });
                      }}
                      className="font-medium bg-transparent outline-none w-full"
                      placeholder="Milestone title"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...(block.timelineItems || [])];
                        newItems[index] = { ...item, description: e.target.value };
                        updateBlock(block.id, { timelineItems: newItems });
                      }}
                      className="text-sm text-muted-foreground bg-transparent outline-none w-full mt-1"
                      placeholder="Description"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) => {
                          const newItems = [...(block.timelineItems || [])];
                          newItems[index] = { ...item, date: e.target.value };
                          updateBlock(block.id, { timelineItems: newItems });
                        }}
                        className="text-xs bg-transparent outline-none text-muted-foreground"
                      />
                      <div className="flex gap-1 ml-auto">
                        {timelineColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => {
                              const newItems = [...(block.timelineItems || [])];
                              newItems[index] = { ...item, color };
                              updateBlock(block.id, { timelineItems: newItems });
                            }}
                            className={`w-3 h-3 rounded-full ${color} ${item.color === color ? 'ring-1 ring-offset-1 ring-primary' : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const newItems = (block.timelineItems || []).filter((_, i) => i !== index);
                        updateBlock(block.id, { timelineItems: newItems });
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover/timeline:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
            <button
              onClick={() => {
                const newItem = {
                  id: crypto.randomUUID(),
                  title: "New milestone",
                  description: "",
                  date: new Date().toISOString().split('T')[0],
                  color: timelineColors[Math.floor(Math.random() * timelineColors.length)]
                };
                updateBlock(block.id, { timelineItems: [...(block.timelineItems || []), newItem] });
              }}
              className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors"
            >
              <PlusCircle className="w-3 h-3" />
              Add milestone
            </button>
          </div>
        );

      case "kanban":
        return (
          <KanbanBlock block={block} updateBlock={updateBlock} />
        );

      case "rating":
        return (
          <div className="py-3">
            <div className="flex items-center gap-1">
              {Array.from({ length: block.ratingMax || 5 }).map((_, index) => (
                <motion.button
                  key={index}
                  onClick={() => updateBlock(block.id, { ratingValue: index + 1 })}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.9 }}
                  className="p-1"
                >
                  <Star
                    className={`w-6 h-6 transition-colors ${index < (block.ratingValue || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground/30'
                      }`}
                  />
                </motion.button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {block.ratingValue || 0} / {block.ratingMax || 5}
              </span>
              <div className="ml-auto flex gap-1">
                {[3, 5, 10].map((max) => (
                  <button
                    key={max}
                    onClick={() => updateBlock(block.id, { ratingMax: max, ratingValue: Math.min(block.ratingValue || 0, max) })}
                    className={`text-xs px-2 py-1 rounded ${block.ratingMax === max ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
                  >
                    {max}★
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case "countdown":
        const CountdownDisplay = () => {
          const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

          useEffect(() => {
            const calculateTimeLeft = () => {
              const target = new Date(block.countdownDate || Date.now()).getTime();
              const now = Date.now();
              const diff = target - now;

              if (diff > 0) {
                setTimeLeft({
                  days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                  hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                  minutes: Math.floor((diff / 1000 / 60) % 60),
                  seconds: Math.floor((diff / 1000) % 60),
                });
              } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
              }
            };

            calculateTimeLeft();
            const interval = setInterval(calculateTimeLeft, 1000);
            return () => clearInterval(interval);
          }, [block.countdownDate]);

          return (
            <div className="flex gap-3 justify-center">
              {[
                { label: "Days", value: timeLeft.days },
                { label: "Hours", value: timeLeft.hours },
                { label: "Minutes", value: timeLeft.minutes },
                { label: "Seconds", value: timeLeft.seconds },
              ].map((unit) => (
                <div key={unit.label} className="text-center">
                  <motion.div
                    className="bg-primary/10 text-primary text-2xl font-bold px-4 py-3 rounded-lg min-w-15"
                    key={unit.value}
                    initial={{ scale: 1.1 }}
                    animate={{ scale: 1 }}
                  >
                    {unit.value.toString().padStart(2, '0')}
                  </motion.div>
                  <p className="text-xs text-muted-foreground mt-1">{unit.label}</p>
                </div>
              ))}
            </div>
          );
        };

        return (
          <div className="py-4">
            <div className="bg-linear-to-r from-primary/5 to-primary/10 rounded-xl p-6 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-primary" />
                  <input
                    type="text"
                    value={block.countdownTitle || "Countdown"}
                    onChange={(e) => updateBlock(block.id, { countdownTitle: e.target.value })}
                    className="font-medium bg-transparent outline-none"
                  />
                </div>
                <input
                  type="date"
                  value={block.countdownDate || ""}
                  onChange={(e) => updateBlock(block.id, { countdownDate: e.target.value })}
                  className="text-sm bg-muted/50 px-3 py-1 rounded-lg outline-none"
                />
              </div>
              <CountdownDisplay />
            </div>
          </div>
        );

      case "embed":
        return (
          <div className="py-2">
            {block.embedUrl ? (
              <div className="rounded-lg overflow-hidden border border-border">
                <iframe
                  src={block.embedUrl}
                  className="w-full h-100"
                  sandbox="allow-scripts allow-same-origin"
                />
                <div className="flex items-center justify-between p-2 bg-muted/30 text-xs">
                  <span className="truncate text-muted-foreground">{block.embedUrl}</span>
                  <button
                    onClick={() => updateBlock(block.id, { embedUrl: undefined })}
                    className="text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                <Globe className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground mb-3">Embed external content</p>
                <input
                  type="text"
                  placeholder="Paste embed URL (Figma, CodePen, etc.)..."
                  className="w-full max-w-md mx-auto px-4 py-2 bg-muted/50 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateBlock(block.id, { embedUrl: (e.target as HTMLInputElement).value });
                    }
                  }}
                />
              </div>
            )}
          </div>
        );

      case "database":
        return (
          <DataTable
            block={block}
            onUpdate={(updates) => updateBlock(block.id, updates)}
            onCreateChart={(tableId, columnNames) => {
              // Add a new chart block after this database block
              const index = blocks.findIndex((b) => b.id === block.id);
              const tableData = block.tableData || [];

              // Convert table data to chart format
              const chartRows = tableData.slice(1).map((row) => ({
                id: crypto.randomUUID(),
                cells: row.reduce((acc, cell, idx) => ({
                  ...acc,
                  [tableData[0][idx] || `col${idx}`]: isNaN(Number(cell)) ? cell : Number(cell),
                }), {}),
              }));

              const chartColumns: { id: string; key: string; type: "text" | "number" }[] = tableData[0].map((name, idx) => ({
                id: `col${idx}`,
                key: name || `col${idx}`,
                type: (/^\d+(\.\d+)?$/.test(tableData[1]?.[idx] || "") ? "number" : "text") as "text" | "number",
              }));

              const chartBlock: NoteBlock = {
                id: crypto.randomUUID(),
                type: "chart",
                content: "Chart from Table",
                chartType: "bar",
                chartTitle: `Chart from ${block.content || "Table"}`,
                chartColumns,
                chartRows,
                chartXAxisKey: chartColumns[0]?.id,
                chartSelectedSeries: chartColumns.filter(c => c.type === "number").map(c => c.id),
                chartSeriesColors: {},
                linkedTableId: tableId, // Link back to source table for live updates
              };
              const newBlocks = [...blocks];
              newBlocks.splice(index + 1, 0, chartBlock);
              onChange(newBlocks);
            }}
          />
        );

      case "mindmap":
        return (
          <div className="py-2">
            <MindMap
              nodes={block.mindMapNodes || []}
              connections={block.mindMapConnections || []}
              onChange={(nodes, connections) => updateBlock(block.id, { mindMapNodes: nodes, mindMapConnections: connections })}
              title={block.content || "Mind Map"}
              onTitleChange={(title) => updateBlock(block.id, { content: title })}
            />
          </div>
        );

      case "gallery":
        const galleryImages = block.galleryImages || [];
        return (
          <div className="py-3">
            <div className="grid grid-cols-3 gap-2">
              {galleryImages.map((img, index) => (
                /* 
                   1. THE TRIGGER: This outer div has aspect-square. 
                   It NEVER moves and its size is fixed by the grid. 
                */
                <div key={img.id} className="relative group/img aspect-square overflow-hidden rounded-lg bg-muted/10">
                  <PersistentImage
                    src={img.url}
                    alt={img.caption || "Gallery image"}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => openLightbox(galleryImages, index)}
                  />

                    /*
                  2. THE OVERLAY:
                  - Added 'pointer-events-none' so the mouse "sees through" to the image.
                  - Added 'z-10' to ensure it sits on top properly.
                  */
                  <div className="absolute inset-0 z-10 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                    <div className="flex gap-2 pointer-events-auto">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openLightbox(galleryImages, index);
                        }}
                        className="p-2 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/30 transition-colors"
                      >
                        <ZoomIn className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newImages = galleryImages.filter((_, i) => i !== index);
                          updateBlock(block.id, { galleryImages: newImages });
                        }}
                        className="p-2 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Image Slot */}
              <div className="aspect-square border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center hover:border-primary/30 transition-colors bg-muted/5">
                <MediaUploader
                  currentValue=""
                  accept="image/*"
                  placeholder="URL..."
                  onUploadComplete={(urlOrPath) => {
                    if (urlOrPath) {
                      const newImage = { id: crypto.randomUUID(), url: urlOrPath };
                      updateBlock(block.id, {
                        galleryImages: [...galleryImages, newImage]
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>
        );

      case "flashcard":
        return (
          <div className="py-2">
            <FlashcardBlock
              flashcards={block.flashcards || []}
              title={block.content || "Flashcards"}
              onChange={(flashcards) => updateBlock(block.id, { flashcards })}
              onTitleChange={(title) => updateBlock(block.id, { content: title })}
              onOpenStudyMode={() => setStudyModeBlock(block)}
            />
          </div>
        );

      case "chart":
        return (
          <div className="py-2">
            <ChartBlock
              chartType={block.chartType || "bar"}
              chartTitle={block.chartTitle || "My Chart"}
              chartColumns={block.chartColumns}
              chartRows={block.chartRows}
              chartXAxisKey={block.chartXAxisKey}
              chartSelectedSeries={block.chartSelectedSeries}
              chartSeriesColors={block.chartSeriesColors}
              linkedTableId={block.linkedTableId}
              blocks={blocks}
              chartData={block.chartData}
              onUpdate={(updates) => updateBlock(block.id, updates)}
            />
          </div>
        );

      case "tabs":
        return (
          <div className="py-2">
            <TabsBlock
              tabs={block.tabsData || [{ id: crypto.randomUUID(), label: "Tab 1", content: "" }]}
              onChange={(tabsData) => updateBlock(block.id, { tabsData })}
            />
          </div>
        );

      case "labeledDivider":
        return (
          <LabeledDividerBlock
            label={block.dividerLabel || ""}
            style={block.dividerStyle || "simple"}
            onUpdate={(updates) => updateBlock(block.id, updates)}
          />
        );

      case "faq":
        return (
          <FaqBlock
            items={block.faqItems || []}
            onUpdate={(faqItems) => updateBlock(block.id, { faqItems })}
          />
        );

      case "comparisonTable":
        return (
          <ComparisonTableBlock
            columns={block.comparisonColumns || [
              { id: "col1", name: "Option A" },
              { id: "col2", name: "Option B" },
            ]}
            rows={block.comparisonRows || []}
            onUpdate={(updates) => updateBlock(block.id, updates)}
          />
        );

      case "steps":
        return (
          <StepsBlock
            steps={block.stepsItems || []}
            onUpdate={(stepsItems) => updateBlock(block.id, { stepsItems })}
          />
        );

      case "swot":
        return (
          <SwotBlock
            strengths={block.swotStrengths || [""]}
            weaknesses={block.swotWeaknesses || [""]}
            opportunities={block.swotOpportunities || [""]}
            threats={block.swotThreats || [""]}
            onUpdate={(updates) => updateBlock(block.id, updates)}
          />
        );

      case "imageText":
        return (
          <ImageTextBlock
            imageUrl={block.imageTextUrl || ""}
            title={block.imageTextTitle || ""}
            description={block.imageTextDescription || ""}
            layout={block.imageTextLayout || "imageLeft"}
            onUpdate={(updates) => updateBlock(block.id, updates)}
            onOpenLightbox={openLightbox}
          />
        );
      default:
        return renderEditableContent(block);
    }
  };

  return (
    <>
      <div
        ref={editorRootRef}
        className="space-y-1 min-h-50 w-full min-w-0 relative"
        data-editor-root
        style={{ userSelect: dragSelect?.active ? 'none' : undefined, cursor: dragSelect?.active ? 'crosshair' : undefined }}
      >
        {/* Drag-select rectangle */}
        {dragSelect?.active && (
          <div
            className="fixed pointer-events-none z-40 border border-primary/60 bg-primary/10 rounded"
            style={{
              left:   Math.min(dragSelect.startX, dragSelect.curX),
              top:    Math.min(dragSelect.startY, dragSelect.curY),
              width:  Math.abs(dragSelect.curX - dragSelect.startX),
              height: Math.abs(dragSelect.curY - dragSelect.startY),
            }}
          />
        )}
        {blocks.map((block,blockIndex) => {
          const isSelected = selectedBlockIds.has(block.id);
          
          return (
            <div key={block.id}>
              <motion.div
                key={`${block.id}-${block.type}`}
                layout
                data-block-id={block.id}
                ref={(el) => { if (el) blockRefs.current.set(block.id, el); }}
                initial={{ opacity: 0, y: -5 }}
                animate={{
                  opacity: draggedBlockId === block.id ? 0.5 : 1,
                  y: 0,
                  scale: draggedBlockId === block.id ? 0.98 : 1,
                }}
                transition={{ duration: 0.15, type: "spring", stiffness: 300, damping: 30 }}
                className={`group relative flex items-start gap-1 rounded-lg transition-all w-full min-w-0
                  ${draggedBlockId === block.id ? 'bg-primary/5 shadow-lg shadow-primary/20' : ''}
                  ${dragOverBlockId === block.id && draggedBlockId !== block.id ? 'border-t-2 border-primary/50 pt-1' : ''}
                  ${isSelected ? 'bg-primary/8 ring-1 ring-primary/30 ring-inset' : ''}
                `}
                onMouseEnter={() => {
                  setActiveBlockId(block.id);
                  if (draggedBlockId && draggedBlockId !== block.id) {
                    setDragOverBlockId(block.id);
                  }
                }}
                onMouseLeave={() => {
                  if (draggedBlockId !== block.id) {
                    setActiveBlockId(null);
                    if (dragOverBlockId === block.id) {
                      setDragOverBlockId(null);
                    }
                  }
                }}
              >
                {/* Block Controls */}
                <motion.div
                  className={`hidden md:flex items-center gap-0.5 pt-1 transition-all shrink-0 duration-200 ${activeBlockId === block.id || isSelected ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
                    }`}
                >
                  <motion.button
                    onClick={() => setShowMenu(showMenu === block.id ? null : block.id)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors group/btn shrink-0"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Plus className="w-4 h-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                  </motion.button>
                  <motion.button
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors cursor-grab active:cursor-grabbing shrink-0"
                    whileHover={{ scale: 1.1 }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleBlockDragStart(block.id, e.clientY);
                    }}
                  >
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                </motion.div>

                {/* Block Content */}
                <div className="flex-1 relative min-w-0">
                  {(() => {
                    // Blocks that have their own contentEditable and already handle arrow keys
                    const textLikeBlocks = new Set([
                      "text", "heading1", "heading2", "heading3",
                      "bullet", "numbered", "todo", "toggle",
                      "quote", "code", "callout",
                    ]);
                    if (textLikeBlocks.has(block.type)) {
                      return renderBlock(block);
                    }
                    // Special / widget blocks: wrap with a focusable div so ArrowUp/Down can navigate past them
                    const blockIndex = blocks.findIndex((b) => b.id === block.id);
                    return (
                      <div
                        ref={(el) => {
                          if (el) specialBlockNavRefs.current.set(block.id, el);
                          else specialBlockNavRefs.current.delete(block.id);
                        }}
                        tabIndex={0}
                        data-special-block
                        onKeyDown={(e) => {
                          if (e.key === "ArrowUp") {
                            if (blockIndex > 0) {
                              e.preventDefault();
                              focusBlock(blockIndex - 1, "end");
                            }
                          } else if (e.key === "ArrowDown") {
                            if (blockIndex < blocks.length - 1) {
                              e.preventDefault();
                              focusBlock(blockIndex + 1, "start");
                            }
                          }
                        }}
                        className="outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 rounded-lg"
                      >
                        {renderBlock(block)}
                      </div>
                    );
                  })()}

                  {/* Block Type Menu */}
                  <AnimatePresence>
                    {showMenu === block.id && (
                      <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-70"
                      >
                        {/* Search Input */}
                        <div className="p-2 border-b border-border">
                          <input
                            type="text"
                            value={menuFilter}
                            onChange={(e) => setMenuFilter(e.target.value)}
                            placeholder="Filter blocks..."
                            className="w-full px-3 py-2 text-sm bg-muted/50 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            autoFocus
                          />
                        </div>

                        <div className="p-1.5 max-h-87.5 overflow-y-auto scrollbar-thin">
                          {/* Basic Blocks */}
                          {filteredBlockTypes.filter(bt => bt.category === "basic").length > 0 && (
                            <>
                              <p className="px-3 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                                Basic
                              </p>
                              {filteredBlockTypes.filter(bt => bt.category === "basic").map((bt) => (
                                <motion.button
                                  key={bt.type}
                                  onClick={() => {
                                    updateBlock(block.id, { type: bt.type, content: bt.type === "divider" ? "---" : block.content });
                                    setShowMenu(null);
                                    setMenuFilter("");
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-all text-left group/item"
                                  whileHover={{ x: 4 }}
                                >
                                  <div className="p-2 rounded-lg bg-muted group-hover/item:bg-primary/10 transition-colors">
                                    <bt.icon className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium block">{bt.label}</span>
                                    <span className="text-xs text-muted-foreground">{bt.description}</span>
                                  </div>
                                </motion.button>
                              ))}
                            </>
                          )}

                          {/* Lists */}
                          {filteredBlockTypes.filter(bt => bt.category === "lists").length > 0 && (
                            <>
                              <p className="px-3 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-2">
                                Lists
                              </p>
                              {filteredBlockTypes.filter(bt => bt.category === "lists").map((bt) => (
                                <motion.button
                                  key={bt.type}
                                  onClick={() => {
                                    updateBlock(block.id, {
                                      type: bt.type,
                                      content: block.content,
                                      isExpanded: bt.type === "toggle" ? true : undefined,
                                      toggleContent: bt.type === "toggle" ? "" : undefined,
                                    });
                                    setShowMenu(null);
                                    setMenuFilter("");
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-all text-left group/item"
                                  whileHover={{ x: 4 }}
                                >
                                  <div className="p-2 rounded-lg bg-muted group-hover/item:bg-primary/10 transition-colors">
                                    <bt.icon className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium block">{bt.label}</span>
                                    <span className="text-xs text-muted-foreground">{bt.description}</span>
                                  </div>
                                </motion.button>
                              ))}
                            </>
                          )}

                          {/* Media & Embeds */}
                          {filteredBlockTypes.filter(bt => bt.category === "media").length > 0 && (
                            <>
                              <p className="px-3 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-2">
                                Media & Embeds
                              </p>
                              {filteredBlockTypes.filter(bt => bt.category === "media").map((bt) => (
                                <motion.button
                                  key={bt.type}
                                  onClick={() => {
                                    const baseUpdate: Partial<NoteBlock> = { type: bt.type, content: "" };
                                    if (bt.type === "gallery") {
                                      baseUpdate.galleryImages = [];
                                    } else if (bt.type === "imageText") {
                                      baseUpdate.imageTextUrl = "";
                                      baseUpdate.imageTextTitle = "";
                                      baseUpdate.imageTextDescription = "";
                                      baseUpdate.imageTextLayout = "imageLeft";
                                    }
                                    updateBlock(block.id, baseUpdate);
                                    setShowMenu(null);
                                    setMenuFilter("");
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-all text-left group/item"
                                  whileHover={{ x: 4 }}
                                >
                                  <div className="p-2 rounded-lg bg-muted group-hover/item:bg-primary/10 transition-colors">
                                    <bt.icon className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium block">{bt.label}</span>
                                    <span className="text-xs text-muted-foreground">{bt.description}</span>
                                  </div>
                                </motion.button>
                              ))}
                            </>
                          )}

                          {/* Advanced */}
                          {filteredBlockTypes.filter(bt => bt.category === "advanced").length > 0 && (
                            <>
                              <p className="px-3 py-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-2">
                                Advanced
                              </p>
                              {filteredBlockTypes.filter(bt => bt.category === "advanced").map((bt) => (
                                <motion.button
                                  key={bt.type}
                                  onClick={() => {
                                    const baseUpdate: Partial<NoteBlock> = { type: bt.type, content: "" };

                                    // Set default values for each advanced block type
                                    if (bt.type === "table") {
                                      baseUpdate.tableData = [["", "", ""], ["", "", ""], ["", "", ""]];
                                    } else if (bt.type === "progress") {
                                      baseUpdate.progressValue = 50;
                                      baseUpdate.progressColor = "bg-blue-500";
                                    } else if (bt.type === "columns") {
                                      baseUpdate.columns = [[{ id: crypto.randomUUID(), type: "text", content: "" }], [{ id: crypto.randomUUID(), type: "text", content: "" }]];
                                      baseUpdate.columnTitles = ["Column 1", "Column 2"];
                                    } else if (bt.type === "timeline") {
                                      baseUpdate.timelineItems = [{ id: crypto.randomUUID(), title: "Milestone 1", description: "Description", date: new Date().toISOString().split('T')[0], color: "bg-blue-500" }];
                                    } else if (bt.type === "kanban") {
                                      baseUpdate.kanbanColumns = [
                                        { id: crypto.randomUUID(), title: "To Do", cards: [{ id: crypto.randomUUID(), content: "New task" }] },
                                        { id: crypto.randomUUID(), title: "In Progress", cards: [] },
                                        { id: crypto.randomUUID(), title: "Done", cards: [] }
                                      ];
                                    } else if (bt.type === "rating") {
                                      baseUpdate.ratingValue = 3;
                                      baseUpdate.ratingMax = 5;
                                    } else if (bt.type === "countdown") {
                                      baseUpdate.countdownDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                                      baseUpdate.countdownTitle = "Countdown";
                                    } else if (bt.type === "database") {
                                      baseUpdate.databaseRows = [{ id: crypto.randomUUID(), cells: { name: "", status: "", date: "" } }];
                                      baseUpdate.databaseColumns = [
                                        { id: "name", name: "Name", type: "text" },
                                        { id: "status", name: "Status", type: "select" },
                                        { id: "date", name: "Date", type: "date" }
                                      ];
                                    } else if (bt.type === "mindmap") {
                                      baseUpdate.mindMapNodes = [{ id: crypto.randomUUID(), text: "Central Idea", x: 150, y: 150, color: "bg-blue-500" }];
                                      baseUpdate.mindMapConnections = [];
                                    } else if (bt.type === "flashcard") {
                                      baseUpdate.flashcards = [];
                                      baseUpdate.content = "Flashcards";
                                    } else if (bt.type === "swot") {
                                      baseUpdate.swotStrengths = [""];
                                      baseUpdate.swotWeaknesses = [""];
                                      baseUpdate.swotOpportunities = [""];
                                      baseUpdate.swotThreats = [""];
                                    }

                                    updateBlock(block.id, baseUpdate);
                                    setShowMenu(null);
                                    setMenuFilter("");
                                  }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-all text-left group/item"
                                  whileHover={{ x: 4 }}
                                >
                                  <div className="p-2 rounded-lg bg-muted group-hover/item:bg-primary/10 transition-colors">
                                    <bt.icon className="w-4 h-4 text-muted-foreground group-hover/item:text-primary transition-colors" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium block">{bt.label}</span>
                                    <span className="text-xs text-muted-foreground">{bt.description}</span>
                                  </div>
                                </motion.button>
                              ))}
                            </>
                          )}

                          {filteredBlockTypes.length === 0 && (
                            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                              No blocks found
                            </p>
                          )}

                          <div className="border-t border-border my-1.5" />
                          <motion.button
                            onClick={() => deleteBlock(block.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-destructive/10 transition-all text-left group/delete"
                            whileHover={{ x: 4 }}
                          >
                            <div className="p-2 rounded-lg bg-destructive/10">
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </div>
                            <div>
                              <span className="text-sm font-medium text-destructive block">Delete</span>
                              <span className="text-xs text-destructive/60">Remove this block</span>
                            </div>
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
              {/* Inline inserter between blocks */}
              {blockIndex < blocks.length - 1 && (
                <InlineInserter onInsert={() => addBlockAfter(block.id, "text")} />
              )}
            </div>
          );
        })}

        {/* Click to add block at end */}
        <motion.div
          onClick={() => {
            clearSelection();
            addBlockAfter(blocks[blocks.length - 1]?.id || "");
          }}
          className="h-51 cursor-text flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          whileHover={{ scale: 1.01 }}
        >
          <span className="text-sm text-muted-foreground/50">Click to add a block</span>
        </motion.div>
      </div>

      {/* ── Block selection action bar ─────────────────────────────────── */}
      {selectedBlockIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border shadow-2xl shadow-black/20 backdrop-blur-sm"
          data-editor-root
        >
          <span className="text-xs text-muted-foreground font-medium px-2 border-r border-border mr-1">
            {selectedBlockIds.size} block{selectedBlockIds.size > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={copySelectedBlocks}
            title="Copy (Ctrl+C)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              toolbarFeedback === "copied"
                ? "bg-green-500/15 text-green-600 dark:text-green-400"
                : "hover:bg-muted text-foreground"
            }`}
          >
            {toolbarFeedback === "copied"
              ? <><Check className="w-3.5 h-3.5" /> Copied!</>
              : <><Copy className="w-3.5 h-3.5" /> Copy</>
            }
          </button>
          <button
            onClick={cutSelectedBlocks}
            title="Cut (Ctrl+X)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              toolbarFeedback === "cut"
                ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                : "hover:bg-muted text-foreground"
            }`}
          >
            {toolbarFeedback === "cut"
              ? <><Check className="w-3.5 h-3.5" /> Cut!</>
              : <><X className="w-3.5 h-3.5" /> Cut</>
            }
          </button>
          <button
            onClick={() => {
              // Pass the last selected block id so toolbar paste inserts right after selection
              const lastId = [...selectedBlockIds].reduce<string | undefined>((acc, id) => {
                const idx = blocks.findIndex(b => b.id === id);
                const accIdx = acc ? blocks.findIndex(b => b.id === acc) : -1;
                return idx > accIdx ? id : acc;
              }, undefined);
              pasteBlocks(lastId);
            }}
            title="Paste after selected (Ctrl+V)"
            disabled={getBlockClipboard().length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-muted transition-colors text-foreground disabled:opacity-40"
          >
            <PlusCircle className="w-3.5 h-3.5" /> Paste after
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={deleteSelectedBlocks}
            title="Delete selected"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-destructive/10 transition-colors text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
          <button
            onClick={clearSelection}
            title="Deselect"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={lightboxImages}
        currentIndex={lightboxIndex}
        onNavigate={setLightboxIndex}
      />

      {/* Flashcard Study Mode */}
      <AnimatePresence>
        {studyModeBlock && (
          <FlashcardStudyMode
            flashcards={studyModeBlock.flashcards || []}
            title={studyModeBlock.content || "Flashcards"}
            onClose={() => setStudyModeBlock(null)}
          />
        )}
      </AnimatePresence>

      {/* Mobile / tablet editing toolbar — pinned above the on-screen keyboard.
          On touch devices, ⌘+/ slash menu is unavailable, so this provides the
          basic block conversions plus inline formatting. ✅*/}
      {isTouch && (
        <MobileEditorToolbar
          isEditing={isEditingFocus}
          onOpenBlockMenu={() => {
            if (activeBlockId) {
              setShowMenu(activeBlockId);
              setMenuFilter("");
            }
          }}
        />
      )}
    </>
  );
};

export default NotionEditor;