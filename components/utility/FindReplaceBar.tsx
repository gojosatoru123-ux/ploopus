"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Replace, X, ChevronDown, ChevronUp, CaseSensitive } from "lucide-react";

interface FindReplaceBarProps {
  blocks: { id: string; content: string; toggleContent?: string; type: string }[];
  onHighlight?: (blockId: string, matches: { start: number; end: number }[]) => void;
  onReplace: (replacements: { blockId: string; field: "content" | "toggleContent"; oldText: string; newText: string }[]) => void;
}

const FindReplaceBar = ({ blocks, onReplace }: FindReplaceBarProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;
      if (modKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && isOpen) {
        clearHighlights();
        setIsOpen(false);
        setShowReplace(false);
        setFindText("");
        setReplaceText("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Find matches
  const getMatches = useCallback(() => {
    if (!findText) return [];
    const matches: { blockId: string; field: "content" | "toggleContent"; index: number }[] = [];
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);

    blocks.forEach((block) => {
      if (block.content) {
        let match;
        while ((match = regex.exec(block.content)) !== null) {
          matches.push({ blockId: block.id, field: "content", index: match.index });
        }
      }
      if (block.toggleContent) {
        let match;
        while ((match = regex.exec(block.toggleContent)) !== null) {
          matches.push({ blockId: block.id, field: "toggleContent", index: match.index });
        }
      }
    });
    return matches;
  }, [findText, blocks, caseSensitive]);

  const matches = getMatches();
  const totalMatches = matches.length;

  // Highlight matches in DOM
  useEffect(() => {
    clearHighlights();
    if (!findText || !isOpen) return;

    const editables = document.querySelectorAll("[contenteditable=true]");
    const flags = caseSensitive ? "g" : "gi";
    const regex = new RegExp(`(${findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, flags);

    editables.forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node;
      while ((node = walker.nextNode())) textNodes.push(node as Text);

      textNodes.forEach((textNode) => {
        const text = textNode.textContent || "";
        if (!regex.test(text)) return;
        regex.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        let m;
        while ((m = regex.exec(text)) !== null) {
          if (m.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
          }
          const mark = document.createElement("mark");
          mark.className = "find-highlight bg-yellow-300/60 dark:bg-yellow-500/40 rounded-sm";
          mark.textContent = m[0];
          fragment.appendChild(mark);
          lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode?.replaceChild(fragment, textNode);
      });
    });
  }, [findText, caseSensitive, isOpen, blocks]);

  const clearHighlights = () => {
    document.querySelectorAll("mark.find-highlight").forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
        parent.normalize();
      }
    });
  };

  const navigateMatch = (direction: "next" | "prev") => {
    if (totalMatches === 0) return;
    let newIndex = direction === "next" ? currentMatchIndex + 1 : currentMatchIndex - 1;
    if (newIndex >= totalMatches) newIndex = 0;
    if (newIndex < 0) newIndex = totalMatches - 1;
    setCurrentMatchIndex(newIndex);

    // Scroll to the match
    const allMarks = document.querySelectorAll("mark.find-highlight");
    allMarks.forEach((m) => m.classList.remove("ring-2", "ring-primary"));
    if (allMarks[newIndex]) {
      allMarks[newIndex].classList.add("ring-2", "ring-primary");
      allMarks[newIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleReplaceCurrent = () => {
    if (totalMatches === 0 || !findText) return;
    const match = matches[currentMatchIndex];
    if (!match) return;
    onReplace([{ blockId: match.blockId, field: match.field, oldText: findText, newText: replaceText }]);
  };

  const handleReplaceAll = () => {
    if (totalMatches === 0 || !findText) return;
    const replacements = matches.map((m) => ({
      blockId: m.blockId,
      field: m.field,
      oldText: findText,
      newText: replaceText,
    }));
    onReplace(replacements);
    setFindText("");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed top-14 right-6 z-50 bg-card border border-border rounded-lg shadow-xl p-3 w-80"
      >
        <div className="flex items-center gap-2 mb-2">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={findInputRef}
            type="text"
            value={findText}
            onChange={(e) => { setFindText(e.target.value); setCurrentMatchIndex(0); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") navigateMatch(e.shiftKey ? "prev" : "next");
            }}
            placeholder="Find..."
            className="flex-1 bg-muted/50 px-3 py-1.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />
          <button
            onClick={() => setCaseSensitive(!caseSensitive)}
            className={`p-1.5 rounded-md transition-colors ${caseSensitive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted"}`}
            title="Case sensitive"
          >
            <CaseSensitive className="w-4 h-4" />
          </button>
        </div>

        {findText && (
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">
              {totalMatches > 0 ? `${currentMatchIndex + 1} of ${totalMatches}` : "No results"}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => navigateMatch("prev")} className="p-1 rounded hover:bg-muted" title="Previous (Shift+Enter)">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => navigateMatch("next")} className="p-1 rounded hover:bg-muted" title="Next (Enter)">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowReplace(!showReplace)}
          className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
        >
          <Replace className="w-3 h-3" />
          {showReplace ? "Hide replace" : "Replace"}
        </button>

        <AnimatePresence>
          {showReplace && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Replace className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="Replace with..."
                  className="flex-1 bg-muted/50 px-3 py-1.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleReplaceCurrent}
                  disabled={totalMatches === 0}
                  className="flex-1 text-xs py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  Replace
                </button>
                <button
                  onClick={handleReplaceAll}
                  disabled={totalMatches === 0}
                  className="flex-1 text-xs py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                >
                  Replace all
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            clearHighlights();
            setIsOpen(false);
            setFindText("");
            setReplaceText("");
          }}
          className="absolute top-2 right-2 p-1 rounded hover:bg-muted text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default FindReplaceBar;
