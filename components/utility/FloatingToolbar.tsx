"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Link,
  Link2Off,
  Type,
  Heading1,
  Heading2,
  Palette,
  ChevronDown,
  Check,
  X as XIcon,
  ExternalLink,
} from "lucide-react";
import { useRichTextFormat } from "@/hooks/useRichTextFormat";

interface FloatingToolbarProps {
  containerRef?: React.RefObject<HTMLElement>;
}

const textColors = [
  { name: "Default", value: "inherit", color: "bg-foreground" },
  { name: "Gray", value: "#6b7280", color: "bg-gray-500" },
  { name: "Red", value: "#ef4444", color: "bg-red-500" },
  { name: "Orange", value: "#f97316", color: "bg-orange-500" },
  { name: "Green", value: "#22c55e", color: "bg-green-500" },
  { name: "Blue", value: "#3b82f6", color: "bg-blue-500" },
  { name: "Purple", value: "#a855f7", color: "bg-purple-500" },
];

const highlightColors = [
  { name: "None", value: "transparent", color: "bg-transparent border border-dashed border-muted-foreground/30" },
  { name: "Yellow", value: "#fef08a", color: "bg-yellow-200" },
  { name: "Green", value: "#bbf7d0", color: "bg-green-200" },
  { name: "Blue", value: "#bfdbfe", color: "bg-blue-200" },
  { name: "Purple", value: "#e9d5ff", color: "bg-purple-200" },
  { name: "Pink", value: "#fbcfe8", color: "bg-pink-200" },
];

const FloatingToolbar = ({ containerRef }: FloatingToolbarProps) => {
  const { formatState, applyFormat } = useRichTextFormat();
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isOnLink, setIsOnLink] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputValue, setLinkInputValue] = useState("https://");
  const linkInputRef = useRef<HTMLInputElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const showLinkInputRef = useRef(false);
  const [hoveredLink, setHoveredLink] = useState<{ href: string; top: number; left: number } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateToolbarPosition = useCallback(() => {
    // Don't touch visibility while link input is open
    if (showLinkInputRef.current) return;

    const selection = window.getSelection();
    
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
      setIsVisible(false);
      setShowColorPicker(false);
      setShowHighlightPicker(false);
      return;
    }

    // Check if selection is within a contenteditable element
    const anchorNode = selection.anchorNode;
    const element = anchorNode?.nodeType === Node.TEXT_NODE 
      ? anchorNode.parentElement 
      : anchorNode as HTMLElement;
    
    if (!element) {
      setIsVisible(false);
      return;
    }

    const editableParent = element.closest('[contenteditable="true"]');
    if (!editableParent) {
      setIsVisible(false);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Calculate position relative to viewport
    const toolbarWidth = 320; // Approximate toolbar width
    let left = rect.left + rect.width / 2 - toolbarWidth / 2;
    
    // Keep toolbar within viewport
    const padding = 16;
    if (left < padding) left = padding;
    if (left + toolbarWidth > window.innerWidth - padding) {
      left = window.innerWidth - toolbarWidth - padding;
    }

    setPosition({
      top: rect.top - 50, // Position above selection
      left: left,
    });
    setIsVisible(true);

    // Check if selection is inside a link
    const anchor = selection.anchorNode;
    const el = anchor?.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor as HTMLElement;
    setIsOnLink(!!el?.closest("a"));
  }, []);

  // Show link preview popup on hover or cursor inside link
  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("[contenteditable] a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      const rect = anchor.getBoundingClientRect();
      setHoveredLink({ href: anchor.href, top: rect.bottom + 6, left: rect.left });
    };

    const handleMouseOut = (e: MouseEvent) => {
      const related = e.relatedTarget as HTMLElement | null;
      // Keep popup if moving into the popup itself
      if (related?.closest("[data-link-preview]")) return;
      hoverTimeoutRef.current = setTimeout(() => setHoveredLink(null), 200);
    };

    const handleSelectionChangeForLink = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      const el = selection.anchorNode?.nodeType === Node.TEXT_NODE
        ? selection.anchorNode.parentElement
        : selection.anchorNode as HTMLElement;
      const anchor = el?.closest("[contenteditable] a") as HTMLAnchorElement | null;
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        setHoveredLink({ href: anchor.href, top: rect.bottom + 6, left: rect.left });
      } else {
        setHoveredLink(null);
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);
    document.addEventListener("selectionchange", handleSelectionChangeForLink);
    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
      document.removeEventListener("selectionchange", handleSelectionChangeForLink);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      // Small delay to ensure selection is stable
      requestAnimationFrame(updateToolbarPosition);
    };

    const handleMouseUp = () => {
      setTimeout(updateToolbarPosition, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        updateToolbarPosition();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [updateToolbarPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
        setShowHighlightPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFormat = (format: string, value?: string) => {
    applyFormat(format, value);
    // Keep toolbar visible after formatting
    setTimeout(updateToolbarPosition, 10);
  };

  const ToolbarButton = ({
    icon: Icon,
    label,
    onClick,
    active = false,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <motion.button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      onMouseDown={(e) => e.preventDefault()}
      className={`p-2 rounded-md transition-all ${
        active
          ? "bg-white/20 text-white"
          : "text-white/80 hover:text-white hover:bg-white/10"
      }`}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  );

  const openLinkInput = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      savedRangeRef.current = selection.getRangeAt(0).cloneRange();
    }
    const el = selection?.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : selection?.anchorNode as HTMLElement;
    const existingLink = el?.closest("a") as HTMLAnchorElement | null;
    setLinkInputValue(existingLink?.href || "https://");
    setShowLinkInput(true);
    showLinkInputRef.current = true;
    setTimeout(() => {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }, 50);
  }, []);

  // Intercept Cmd+K to open our custom link input instead of the browser prompt
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
        const target = e.target as HTMLElement;
        if (target.isContentEditable) {
          e.preventDefault();
          e.stopImmediatePropagation();
          openLinkInput();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [openLinkInput]);

  const submitLink = () => {
    const url = linkInputValue.trim();
    if (url && url !== "https://" && savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
      document.execCommand("createLink", false, url);
      savedRangeRef.current = null;
    }
    setShowLinkInput(false);
    showLinkInputRef.current = false;
    setLinkInputValue("https://");
    setTimeout(updateToolbarPosition, 10);
  };

  const handleRemoveLink = () => {
    document.execCommand("unlink", false);
    setTimeout(updateToolbarPosition, 10);
  };

  return (
    <>
      <style>{`
        [contenteditable] a {
          color: #3b82f6;
          text-decoration: underline;
          cursor: pointer;
        }
        [contenteditable] a:hover {
          color: #2563eb;
        }
      `}</style>
      <AnimatePresence>
      {isVisible && (
        <motion.div
          ref={toolbarRef}
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            zIndex: 9999,
          }}
          className="flex items-center gap-0.5 px-2 py-1.5 bg-zinc-900 rounded-lg shadow-2xl border border-zinc-700/50"
        >
          {/* Text Formatting */}
          <ToolbarButton
            icon={Bold}
            label="Bold (⌘B)"
            onClick={() => handleFormat("bold")}
            active={formatState.bold}
          />
          <ToolbarButton
            icon={Italic}
            label="Italic (⌘I)"
            onClick={() => handleFormat("italic")}
            active={formatState.italic}
          />
          <ToolbarButton
            icon={Underline}
            label="Underline (⌘U)"
            onClick={() => handleFormat("underline")}
            active={formatState.underline}
          />
          <ToolbarButton
            icon={Strikethrough}
            label="Strikethrough"
            onClick={() => handleFormat("strikethrough")}
            active={formatState.strikethrough}
          />
          <ToolbarButton
            icon={Code}
            label="Code (⌘E)"
            onClick={() => handleFormat("code")}
            active={formatState.code}
          />

          <div className="w-px h-5 bg-zinc-600 mx-1" />

          {/* Text Color */}
          <div className="relative">
            <motion.button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowColorPicker(!showColorPicker);
                setShowHighlightPicker(false);
              }}
              className="flex items-center gap-0.5 p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Text Color"
            >
              <Palette className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </motion.button>
            
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 p-2 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 min-w-35"
                >
                  <p className="text-xs text-zinc-400 mb-2 px-1">Text Color</p>
                  <div className="grid grid-cols-4 gap-1">
                    {textColors.map((color) => (
                      <button
                        key={color.value}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFormat("textColor", color.value);
                          setShowColorPicker(false);
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center hover:ring-2 ring-white/30 transition-all"
                        title={color.name}
                      >
                        <div className={`w-5 h-5 rounded-full ${color.color}`} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Highlight Color */}
          <div className="relative">
            <motion.button
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowHighlightPicker(!showHighlightPicker);
                setShowColorPicker(false);
              }}
              className="flex items-center gap-0.5 p-2 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Highlight"
            >
              <Highlighter className="w-4 h-4" />
              <ChevronDown className="w-3 h-3" />
            </motion.button>
            
            <AnimatePresence>
              {showHighlightPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -5, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 p-2 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 min-w-35"
                >
                  <p className="text-xs text-zinc-400 mb-2 px-1">Highlight</p>
                  <div className="grid grid-cols-3 gap-1">
                    {highlightColors.map((color) => (
                      <button
                        key={color.value}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleFormat("highlight", color.value);
                          setShowHighlightPicker(false);
                        }}
                        className="w-8 h-8 rounded-md flex items-center justify-center hover:ring-2 ring-white/30 transition-all"
                        title={color.name}
                      >
                        <div className={`w-6 h-6 rounded ${color.color}`} />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-px h-5 bg-zinc-600 mx-1" />

          {/* Link / Unlink */}
          {isOnLink ? (
            <ToolbarButton
              icon={Link2Off}
              label="Remove Link"
              onClick={handleRemoveLink}
              active={true}
            />
          ) : (
            <div className="relative">
              <ToolbarButton
                icon={Link}
                label="Add Link (⌘K)"
                onClick={openLinkInput}
                active={showLinkInput}
              />
              <AnimatePresence>
                {showLinkInput && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl p-3 w-72 z-50"
                  >
                    <p className="text-xs text-zinc-400 mb-2 font-medium">Add link</p>
                    <div className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-700 focus-within:border-blue-500 transition-colors">
                      <Link className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <input
                        ref={linkInputRef}
                        type="url"
                        value={linkInputValue}
                        onChange={(e) => setLinkInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); submitLink(); }
                          if (e.key === "Escape") { e.preventDefault(); setShowLinkInput(false); showLinkInputRef.current = false; }
                        }}
                        className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-600"
                        placeholder="https://"
                      />
                    </div>
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setShowLinkInput(false); showLinkInputRef.current = false; }}
                        className="flex-1 px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={submitLink}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Apply
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>
      {/* Link hover preview */}
      <AnimatePresence>
        {hoveredLink && (
          <motion.div
            data-link-preview
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{ position: "fixed", top: hoveredLink.top, left: hoveredLink.left, zIndex: 9998 }}
            className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-xs"
            onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); }}
            onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredLink(null), 200); }}
          >
            <ExternalLink className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="text-xs text-zinc-300 truncate max-w-48">{hoveredLink.href}</span>
            <a
              href={hoveredLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              Open
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingToolbar;