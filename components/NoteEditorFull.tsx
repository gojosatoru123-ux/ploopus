"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, MoreHorizontal, Star, Share2, Clock, Focus, Minimize2, BookOpen, Sparkles, Undo2, Redo2, Download, FileText, FileCode, FileType, FileJsonIcon, File, Upload, Stars, BookTemplate, WandSparkles, CloudFog } from "lucide-react";
import NotionEditor from "./NotionEditor";
import FloatingToolbar from "./utility/FloatingToolbar";
import FindReplaceBar from "./utility/FindReplaceBar";
import TemplatesModal from "./modals/TemplatesModal";
import { Note, NoteBlock } from "@/lib/types";
import { useHeadingIndex } from "@/hooks/useHeadingIndex";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useNoteExport } from "@/hooks/useNoteExport";
import { Template } from "@/data/templates";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SyncStatusIndicator } from "./utility/SyncStatusIndicator";
import { toast } from "sonner";
import AiAssistantModal from "./modals/AiAssistantModal";
import PublishSiteModal from "./modals/PublishSiteModal";

interface NoteEditorFullProps {
  note: Note;
  onUpdate: (updates: Partial<Note>) => void;
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
}

const tagColors = [
  { name: "green", bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20" },
  { name: "blue", bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/20" },
  { name: "purple", bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/20" },
  { name: "orange", bg: "bg-orange-500/10", text: "text-orange-600", border: "border-orange-500/20" },
  { name: "pink", bg: "bg-pink-500/10", text: "text-pink-600", border: "border-pink-500/20" },
  { name: "gray", bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
];

const NoteEditorFull = ({ note, onUpdate, focusMode = false, onToggleFocusMode }: NoteEditorFullProps) => {
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const [showMoreModal, setShowMoreModal] = useState(false);
  const [showIndex, setShowIndex] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(event.target as Node)) {
        setShowMoreModal(false);
        setShowExportMenu(false);
        setShowIndex(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const activeBlockIndexRef = useRef<number>(-1);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Index functionality
  const { index, scrollToHeading } = useHeadingIndex(note.blocks);
  const { exportNote } = useNoteExport();

  // Undo/Redo functionality
  const { pushState, undo, redo, canUndo, canRedo, resetHistory } = useUndoRedo(note.blocks, {
    maxHistorySize: 100,
    debounceMs: 300,
  });

  const handleAppendAiBlocks = useCallback((newBlocks: NoteBlock[]) => {
    const merged = [...note.blocks, ...newBlocks];
    pushState(merged, true);
    onUpdate({ blocks: merged });
  }, [note.blocks, onUpdate, pushState]);

  // Reset history when switching notes
  useEffect(() => {
    resetHistory(note.blocks);
  }, [note.id, resetHistory]);

  // Handle undo action
  const handleUndo = useCallback(() => {
    const previousBlocks = undo();
    if (previousBlocks) {
      onUpdate({ blocks: previousBlocks });
    }
  }, [undo, onUpdate]);

  // Handle redo action
  const handleRedo = useCallback(() => {
    const nextBlocks = redo();
    if (nextBlocks) {
      onUpdate({ blocks: nextBlocks });
    }
  }, [redo, onUpdate]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      }

      // Windows-style redo with Ctrl+Y
      if (!isMac && e.ctrlKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleApplyTemplate = (template: Template) => {
    const newBlocks: NoteBlock[] = template.blocks.map((block) => ({
      ...block,
      content: block.content || "",
      id: crypto.randomUUID(),
    }));
    pushState(newBlocks, true); // Immediate push for template application
    onUpdate({ blocks: newBlocks });
  };

  const handleAddTag = () => {
    if (newTagInput.trim()) {
      const randomColor = tagColors[Math.floor(Math.random() * tagColors.length)];
      const newTag = {
        id: crypto.randomUUID(),
        label: newTagInput.trim(),
        color: randomColor.name,
      };
      onUpdate({ tags: [...note.tags, newTag] });
      setNewTagInput("");
      setShowTagInput(false);
    }
  };

  const handleRemoveTag = (tagId: string) => {
    onUpdate({ tags: note.tags.filter((t) => t.id !== tagId) });
  };

  const handleBlocksChange = (blocks: NoteBlock[]) => {
    pushState(blocks); // Track state for undo/redo
    onUpdate({ blocks });
  };

  // Track focused block index for import insertion point
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const blockEl = (e.target as HTMLElement).closest("[data-block-id]");
      if (!blockEl) return;
      const blockId = blockEl.getAttribute("data-block-id");
      if (!blockId) return;
      const idx = note.blocks.findIndex(b => b.id === blockId);
      if (idx !== -1) activeBlockIndexRef.current = idx;
    };
    document.addEventListener("focusin", handleFocusIn);
    return () => document.removeEventListener("focusin", handleFocusIn);
  }, [note.blocks]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = JSON.parse(ev.target?.result as string);
        // Support both raw array and { blocks: [...] } or full note object
        let importedRaw: any[] = [];
        if (Array.isArray(raw)) {
          importedRaw = raw;
        } else if (Array.isArray(raw?.blocks)) {
          importedRaw = raw.blocks;
        } else {
          toast.error("Invalid format: expected a JSON array of blocks or a note object with a blocks array.", { position: "top-right" });
          return;
        }
        if (importedRaw.length === 0) return;
        const importedBlocks: NoteBlock[] = importedRaw.map((b: any) => ({
          ...b,
          id: crypto.randomUUID(),
        }));
        const current = note.blocks;
        const insertAt = activeBlockIndexRef.current >= 0
          ? activeBlockIndexRef.current + 1
          : current.length;
        const newBlocks = [
          ...current.slice(0, insertAt),
          ...importedBlocks,
          ...current.slice(insertAt),
        ];
        handleBlocksChange(newBlocks);
        toast.success(`Successfully imported ${importedBlocks.length} blocks!`, { position: "top-right" });
      } catch (err) {
        toast.error("Failed to parse JSON file. Make sure it's a valid JSON.", { position: "top-right" });
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const getTagStyle = (colorName: string) => {
    const color = tagColors.find((c) => c.name === colorName) || tagColors[5];
    return `${color.bg} ${color.text} ${color.border}`;
  };

  // Find & Replace handler
  const handleFindReplace = useCallback((replacements: { blockId: string; field: "content" | "toggleContent"; oldText: string; newText: string }[]) => {
    const newBlocks = note.blocks.map((block) => {
      const blockReplacements = replacements.filter((r) => r.blockId === block.id);
      if (blockReplacements.length === 0) return block;
      const updated = { ...block };
      blockReplacements.forEach((r) => {
        const field = r.field;
        const current = updated[field] || "";
        const flags = "gi";
        const regex = new RegExp(r.oldText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
        (updated as any)[field] = current.replace(regex, r.newText);
      });
      return updated;
    });
    handleBlocksChange(newBlocks);
  }, [note.blocks, handleBlocksChange]);

  return (
    <>
      <div
        className={`flex-1 h-full bg-card flex flex-col overflow-hidden ${focusMode ? 'fixed inset-0 z-50 bg-background' : ''}`}
        style={{ transition: 'background-color 0.4s ease' }}
      >
        {/* Floating Toolbar - appears on text selection */}
        <FloatingToolbar />

        {/* Focus mode backdrop */}
        <AnimatePresence>
          {focusMode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="absolute inset-0 bg-background -z-10"
            />
          )}
        </AnimatePresence>

        {/* Top Bar */}
        <motion.div
          className={`flex items-center justify-between px-6 py-3 border-b border-border transition-all duration-300 ${focusMode
            ? 'bg-transparent border-transparent opacity-0 hover:opacity-100 absolute top-0 left-0 right-0 z-10'
            : 'bg-card/50 backdrop-blur-sm'
            }`}
          initial={false}
          animate={{ opacity: focusMode ? 0 : 1 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          whileHover={{ opacity: 1 }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="sm:hidden">{format(new Date(note.updatedAt), "MMM d ")}</span>
              <span className="hidden sm:block">Updated {format(new Date(note.updatedAt), "MMM d, h:mm a")}</span>
              <SyncStatusIndicator />
            </div>
          </div>
          <div className="flex items-center gap-1" ref={menuContainerRef}>
            {/* Undo/Redo Buttons */}
            <TooltipProvider delayDuration={200}>
              <div className="hidden sm:flex items-center gap-0.5 mr-2 border-r border-border pr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={handleUndo}
                      disabled={!canUndo}
                      className={`p-2 rounded-lg transition-colors ${canUndo
                        ? 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        : 'text-muted-foreground/30 cursor-not-allowed'
                        }`}
                      whileHover={canUndo ? { scale: 1.1 } : {}}
                      whileTap={canUndo ? { scale: 0.9 } : {}}
                    >
                      <Undo2 className="w-4 h-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Undo <kbd className="ml-1 px-1.5 py-0.5 text-[10px] rounded">⌘Z</kbd></p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={handleRedo}
                      disabled={!canRedo}
                      className={`p-2 rounded-lg transition-colors ${canRedo
                        ? 'hover:bg-muted text-muted-foreground hover:text-foreground'
                        : 'text-muted-foreground/30 cursor-not-allowed'
                        }`}
                      whileHover={canRedo ? { scale: 1.1 } : {}}
                      whileTap={canRedo ? { scale: 0.9 } : {}}
                    >
                      <Redo2 className="w-4 h-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Redo <kbd className="ml-1 px-1.5 py-0.5 text-[10px] rounded">⇧⌘Z</kbd></p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>

            <TooltipProvider delayDuration={200}>

              {/* Focus Mode Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    onClick={onToggleFocusMode}
                    className={`p-2 rounded-lg transition-colors ${focusMode
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground'
                      }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {focusMode ? <Minimize2 className="w-4 h-4" /> : <Focus className="w-4 h-4" />}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{focusMode ? "Exit focus mode (Esc)" : "Enter focus mode"}</p>
                </TooltipContent>
              </Tooltip>

              {/* Index Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    onClick={() => setShowIndex(!showIndex)}
                    className={`p-2 rounded-lg transition-colors relative ${showIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-muted-foreground'
                      }`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <BookOpen className="w-4 h-4" />
                    {index.length > 0 && (
                      <motion.span
                        className="absolute top-0 right-0 w-4 h-4 text-[10px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        {index.length}
                      </motion.span>
                    )}
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Toggle document index</p>
                </TooltipContent>
              </Tooltip>

              {/* More */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <motion.button
                      onClick={() => setShowMoreModal(!showMoreModal)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </motion.button>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>More</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </motion.div>

        {/* Find & Replace Bar (Cmd+F) */}
        <FindReplaceBar
          blocks={note.blocks}
          onReplace={handleFindReplace}
        />

        {/* Templates Modal */}
        <TemplatesModal
          isOpen={showTemplates}
          onClose={() => setShowTemplates(false)}
          onSelectTemplate={handleApplyTemplate}
        />

        {/* AI Assistant Modal */}
        <AiAssistantModal
          isOpen={showAi}
          onClose={() => setShowAi(false)}
          note={note}
          onAppendBlocks={handleAppendAiBlocks}
        />

        {/* Publish Site Modal */}
        <PublishSiteModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          note={note}
        />


        {/* Index Dropdown Menu */}
        <AnimatePresence>
          {showIndex && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="fixed right-6 top-16 z-50 w-72 max-h-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border/50 bg-muted/30">
                <h3 className="text-sm font-semibold text-foreground">Document Sections</h3>
              </div>

              {/* Content */}
              {index.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground text-center px-4">
                    No headings yet. Add headings to your note to create an index.
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  <div className="py-2 px-1">
                    {index.map((heading) => (
                      <motion.button
                        key={heading.id}
                        onClick={() => {
                          scrollToHeading(heading.id);
                          setShowIndex(false);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors group text-sm"
                        style={{
                          paddingLeft: `${16 + heading.indent * 16}px`,
                        }}
                        whileHover={{ x: 2 }}
                      >
                        <span
                          className={`block truncate transition-colors ${heading.level === 1
                            ? 'font-medium text-foreground'
                            : heading.level === 2
                              ? 'font-normal text-foreground/85'
                              : 'text-foreground/70 text-xs'
                            }`}
                        >
                          {heading.text || `Untitled ${heading.level === 1 ? "Heading" : "Subheading"}`}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer */}
              {index.length > 0 && (
                <div className="px-4 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
                  {index.length} section{index.length !== 1 ? 's' : ''}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Export Menu */}
        <AnimatePresence>
          {showExportMenu && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              className="fixed right-6 top-16 p-2 z-50 w-51 max-h-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden flex flex-col"
            >
              <button
                onClick={() => { exportNote(note, "markdown"); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <FileCode className="w-4 h-4" /> Markdown
              </button>
              <button
                onClick={() => { exportNote(note, "text"); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <FileText className="w-4 h-4" /> Plain Text
              </button>
              <button
                onClick={() => { exportNote(note, "html"); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <FileType className="w-4 h-4" /> HTML
              </button>
              <button
                onClick={() => { exportNote(note, "json"); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <FileJsonIcon className="w-4 h-4" /> JSON
              </button>
              <button
                onClick={() => { exportNote(note, "pdf"); setShowExportMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <File className="w-4 h-4" /> PDF
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* More Menu */}
        <AnimatePresence>
          {showMoreModal && (
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.95 }}
              className="fixed gap-2 right-6 top-16 p-2 z-50 max-h-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden flex flex-row"
            >
              <TooltipProvider delayDuration={200}>

                {/* AI Feature */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <motion.button
                        onClick={() => setShowAi(true)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <motion.span
                          className="absolute top-0 right-0 w-2 h-2 text-[10px] font-bold bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]"
                          initial={{ scale: 0 }}
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{
                            scale: { duration: 0.2 }, // Initial pop-in
                            default: { repeat: Infinity, duration: 2, ease: "easeInOut" } // Subtle pulse
                          }}
                        />
                        <WandSparkles className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>AI Features</p>
                  </TooltipContent>
                </Tooltip>

                {/* Templates Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      onClick={() => setShowTemplates(true)}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <Sparkles className="w-4 h-4" />
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Use a template</p>
                  </TooltipContent>
                </Tooltip>

                {/* Export Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <motion.button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <Download className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Export note</p>
                  </TooltipContent>
                </Tooltip>

                {/* Import Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <input
                        ref={importInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleImport}
                      />
                      <motion.button
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => importInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Import blocks from JSON</p>
                  </TooltipContent>
                </Tooltip>

                {/* Publish Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="relative">
                      <motion.button
                        onClick={() => setShowPublishModal(!showPublishModal)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <CloudFog className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Publish Site</p>
                  </TooltipContent>
                </Tooltip>

              </TooltipProvider>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Wrapper */}
        <div className="flex flex-1 overflow-hidden w-full min-w-0">
          {/* Content Area */}
          <div className={`flex-1 overflow-y-auto scrollbar-thin transition-all duration-300 w-full min-w-0  ${focusMode
            ? 'bg-linear-to-br from-background via-background to-primary/5 pt-8'
            : ''
            }`}>
            {/* Focus mode decorative elements */}
            {focusMode && (
              <>
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                  <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                </div>
              </>
            )}

            <motion.div
              className={`mx-auto relative z-10 w-full min-w-0 ${focusMode
                ? 'max-w-5xl pt-16 px-4 md:px-6 py-6'
                : 'max-w-5xl p-6 md:p-10'
                }`}
              animate={{
                paddingTop: focusMode ? 64 : undefined,
              }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              {/* Focus mode exit hint */}
              <AnimatePresence>
                {focusMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: "easeOut", delay: 0.15 }}
                    className="text-center mb-12"
                  >
                    <span className="text-xs text-muted-foreground bg-primary/10 px-4 py-2 rounded-full border border-primary/20 inline-block">
                      ✨ Focus mode • Press <kbd className="px-2 py-1 bg-primary/20 rounded text-[10px] font-mono ml-1">Esc</kbd> to exit
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Title */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${focusMode ? 'mb-8' : 'mb-6'}`}
              >
                <input
                  type="text"
                  value={note.title}
                  onChange={(e) => onUpdate({ title: e.target.value })}
                  className={`w-full font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/30 tracking-tight transition-all duration-300 ${focusMode
                    ? 'text-6xl md:text-7xl text-center bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent'
                    : 'text-4xl md:text-5xl'
                    }`}
                  placeholder="Untitled"
                />
              </motion.div>

              {/* Tags - hidden in focus mode */}
              <AnimatePresence>
                {!focusMode && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ delay: 0.05 }}
                    className="flex items-center gap-2 mb-8 flex-wrap overflow-hidden"
                  >
                    {note.tags.map((tag, index) => (
                      <motion.span
                        key={tag.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${getTagStyle(tag.color)}`}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
                        {tag.label}
                        <button
                          onClick={() => handleRemoveTag(tag.id)}
                          className="ml-0.5 hover:text-destructive transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.span>
                    ))}

                    {showTagInput ? (
                      <motion.input
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddTag();
                          if (e.key === "Escape") setShowTagInput(false);
                        }}
                        onBlur={() => {
                          if (newTagInput) handleAddTag();
                          else setShowTagInput(false);
                        }}
                        autoFocus
                        className="px-3 py-1.5 text-xs border-2 border-primary rounded-full outline-none bg-transparent min-w-20 focus:ring-2 focus:ring-primary/20"
                        placeholder="Tag name"
                      />
                    ) : (
                      <motion.button
                        onClick={() => setShowTagInput(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Plus className="w-3 h-3" />
                        Add tag
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Notion-like Editor */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={focusMode
                  ? 'text-lg leading-relaxed prose prose-invert max-w-none **:transition-colors'
                  : ''
                }
              >
                <NotionEditor blocks={note.blocks} onChange={handleBlocksChange} />
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Focus mode floating exit button */}
        <AnimatePresence>
          {focusMode && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.3, ease: "easeOut", delay: 0.2 }}
              onClick={onToggleFocusMode}
              className="fixed bottom-6 right-6 p-3 rounded-full bg-primary/10 border border-primary/30 shadow-lg hover:bg-primary/20 hover:border-primary/50 text-primary transition-all z-50"
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.85 }}
              title="Exit focus mode (Esc)"
            >
              <Minimize2 className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default NoteEditorFull;