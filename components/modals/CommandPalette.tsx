"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  Calendar,
  Lightbulb,
  Folder,
  Rss,
  Sparkles,
  Bell,
  Briefcase,
  FileText,
  AppWindowMac,
  ReceiptEuro,
  Search,
  X,
} from "lucide-react";
import { useNotesContext } from "@/contexts/NotesContext";
import { usePluginContext } from "@/contexts/PluginsContext";
import { useRouter } from "next/navigation";

const PAGES = [
  { id: "dashboard", label: "Home", icon: Home, type: "page", url: "/dashboard" },
  { id: "calendar", label: "Calendar", icon: Calendar, type: "page", url: "/calendar" },
  { id: "flashcards", label: "Flashcards", icon: Lightbulb, type: "page", url: "/flashcards" },
  { id: "graphview", label: "Graph View", icon: Sparkles, type: "page", url: "/graphview" },
  { id: "note/ideas", label: "Ideas", icon: Lightbulb, type: "page", url: "/note/ideas" },
  { id: "note/folder", label: "Folders", icon: Folder, type: "page", url: "/note/folder" },
  { id: "memory-feed", label: "Memory Feed", icon: Rss, type: "page", url: "/memory-feed" },
  { id: "plateforms", label: "Plateforms", icon: Briefcase, type: "page", url: "/plateforms" },
  { id: "settings", label: "Settings", icon: Bell, type: "page", url: "/settings" },
  { id: "billings", label: "Billings", icon: ReceiptEuro, type: "page", url: "/billings" },
];

const MAX_RENDERED_NOTES = 15;

export const CustomCommandPalette = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const { noteIndexes } = useNotesContext();
  const { pluginIndexes } = usePluginContext();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeIndexRef = useRef(0);

  // Sync ref with state for stable keyboard handler
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  // Memoized sorted notes (only re-sorts when notes change)
  const sortedNotes = useMemo(() => {
    return [...noteIndexes].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }, [noteIndexes]);

  // Main filtered list
  const flatItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filteredPages = PAGES.filter((p) =>
      p.label.toLowerCase().includes(query)
    );

    const filteredPlugins = pluginIndexes
      .filter((p) => p.name.toLowerCase().includes(query))
      .map((p) => ({
        id: p.id,
        label: p.name,
        icon: AppWindowMac,
        type: "plugin" as const,
        url: `/plateforms/${p.id}`,
      }));

    const filteredNotes = (
      query
        ? sortedNotes.filter((n) => n.title?.toLowerCase().includes(query))
        : sortedNotes
    )
      .slice(0, MAX_RENDERED_NOTES)
      .map((n) => ({
        id: n.id,
        label: n.title || "Untitled",
        icon: FileText,
        type: "note" as const,
        url: `/note/ideas/${n.id}`,
      }));

    return [...filteredPages, ...filteredPlugins, ...filteredNotes];
  }, [searchQuery, sortedNotes, pluginIndexes]);

  // O(1) global index lookup
  const indexMap = useMemo(() => {
    const map = new Map<string, number>();
    flatItems.forEach((item, index) => {
      map.set(`${item.type}-${item.id}`, index);
    });
    return map;
  }, [flatItems]);

  // Global toggle: Cmd/Ctrl + K and Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [open]);

  // Reset state when palette closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  // Reset cursor when search query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [searchQuery]);

  // Keyboard navigation (stable listener)
  useEffect(() => {
    if (!open) return;

    const handleNav = (e: KeyboardEvent) => {
      if (flatItems.length === 0) return;

      // Allow left/right arrows inside the search input
      if (e.target === inputRef.current) {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % flatItems.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + flatItems.length) % flatItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flatItems[activeIndexRef.current];
        if (item) {
          router.push(item.url);
          setOpen(false);
        }
      }
    };

    document.addEventListener("keydown", handleNav);
    return () => document.removeEventListener("keydown", handleNav);
  }, [open, flatItems, router]); // flatItems included for correctness

  // Auto-scroll active item into view
  useEffect(() => {
    const activeEl = listRef.current?.querySelector(`[data-active="true"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [activeIndex]);

  const selectItem = useCallback((url: string) => {
    router.push(url);
    setOpen(false);
  }, [router]);

  // Grouped sections for rendering
  const pagesGroup = flatItems.filter((i) => i.type === "page");
  const pluginsGroup = flatItems.filter((i) => i.type === "plugin");
  const notesGroup = flatItems.filter((i) => i.type === "note");

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 pointer-events-auto"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: "easeInOut" }}
            className="fixed inset-x-0 top-[12vh] mx-auto w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-51 flex flex-col max-h-[80vh] pointer-events-auto"
          >
            {/* Search Input */}
            <div className="flex items-center px-4 border-b border-border/60 h-12 shrink-0 gap-3">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, folders, or pages..."
                className="flex-1 h-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-muted rounded text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ESC
              </kbd>
            </div>

            {/* Results Area */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-4 max-h-100">
              {flatItems.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No results found.
                </div>
              )}

              {pagesGroup.length > 0 && (
                <div>
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
                    Pages
                  </div>
                  <div className="space-y-0.5">
                    {pagesGroup.map((item) => {
                      const globalIndex = indexMap.get(`${item.type}-${item.id}`) ?? -1;
                      const Icon = item.icon;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          data-active={globalIndex === activeIndex}
                          onClick={() => selectItem(item.url)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer select-none transition-colors ${globalIndex === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-muted/40"
                            }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pluginsGroup.length > 0 && (
                <div>
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase border-t border-border/30 mt-2 pt-2">
                    Plugins
                  </div>
                  <div className="space-y-0.5">
                    {pluginsGroup.map((item) => {
                      const globalIndex = indexMap.get(`${item.type}-${item.id}`) ?? -1;
                      const Icon = item.icon;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          data-active={globalIndex === activeIndex}
                          onClick={() => selectItem(item.url)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer select-none transition-colors ${globalIndex === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-muted/40"
                            }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {notesGroup.length > 0 && (
                <div>
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase border-t border-border/30 mt-2 pt-2">
                    Notes
                  </div>
                  <div className="space-y-0.5">
                    {notesGroup.map((item) => {
                      const globalIndex = indexMap.get(`${item.type}-${item.id}`) ?? -1;
                      const Icon = item.icon;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          data-active={globalIndex === activeIndex}
                          onClick={() => selectItem(item.url)}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer select-none transition-colors ${globalIndex === activeIndex
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground hover:bg-muted/40"
                            }`}
                        >
                          <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Help Footer */}
            <div className="px-4 py-2 bg-muted/30 border-t border-border/60 flex items-center justify-end gap-3 text-[11px] text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <kbd className="bg-background px-1.5 py-0.5 rounded border shadow-xs">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-background px-1.5 py-0.5 rounded border shadow-xs">Enter</kbd> Select
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CustomCommandPalette;