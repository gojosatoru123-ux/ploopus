"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Type,
  Link,
  Image,
  Minus,
  Undo,
  Redo,
  Palette,
  ChevronDown,
  Sparkles,
  RemoveFormatting,
} from "lucide-react";
import { NoteBlock } from "@/lib/types";
import { useRichTextFormat, FormatState } from "@/hooks/useRichTextFormat";

interface EditorToolbarProps {
  onInsertBlock: (type: NoteBlock["type"]) => void;
}

const fontFamilies = [
  { name: "Inter", value: "Inter" },
  { name: "Georgia", value: "Georgia" },
  { name: "Courier", value: "Courier New" },
  { name: "Comic Sans", value: "Comic Sans MS" },
];

const fontSizes = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const textColors = [
  { name: "Default", value: "inherit", color: "bg-foreground" },
  { name: "Gray", value: "#6b7280", color: "bg-gray-500" },
  { name: "Red", value: "#ef4444", color: "bg-red-500" },
  { name: "Orange", value: "#f97316", color: "bg-orange-500" },
  { name: "Yellow", value: "#eab308", color: "bg-yellow-500" },
  { name: "Green", value: "#22c55e", color: "bg-green-500" },
  { name: "Blue", value: "#3b82f6", color: "bg-blue-500" },
  { name: "Purple", value: "#a855f7", color: "bg-purple-500" },
  { name: "Pink", value: "#ec4899", color: "bg-pink-500" },
];

const highlightColors = [
  { name: "None", value: "transparent", color: "bg-transparent border border-dashed" },
  { name: "Yellow", value: "#fef08a", color: "bg-yellow-200" },
  { name: "Green", value: "#bbf7d0", color: "bg-green-200" },
  { name: "Blue", value: "#bfdbfe", color: "bg-blue-200" },
  { name: "Purple", value: "#e9d5ff", color: "bg-purple-200" },
  { name: "Pink", value: "#fbcfe8", color: "bg-pink-200" },
  { name: "Orange", value: "#fed7aa", color: "bg-orange-200" },
];

const EditorToolbar = ({ onInsertBlock }: EditorToolbarProps) => {
  const { formatState, applyFormat } = useRichTextFormat();
  const [activeFont, setActiveFont] = useState("Inter");
  const [activeFontSize, setActiveFontSize] = useState(16);
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const [showColorDropdown, setShowColorDropdown] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [showBlockDropdown, setShowBlockDropdown] = useState(false);

  const ToolbarButton = ({
    icon: Icon,
    label,
    onClick,
    active = false,
    className = "",
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
    active?: boolean;
    className?: string;
  }) => (
    <motion.button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
      className={`p-2 rounded-lg transition-all duration-200 ${
        active
          ? "bg-primary/20 text-primary shadow-sm"
          : "hover:bg-muted text-muted-foreground hover:text-foreground"
      } ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={label}
    >
      <Icon className="w-4 h-4" />
    </motion.button>
  );

  const Divider = () => (
    <div className="h-6 w-px bg-border mx-1" />
  );

  const DropdownMenu = ({
    show,
    onClose,
    children,
  }: {
    show: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) => (
    <AnimatePresence>
      {show && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl p-2 min-w-40"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-2 border-b border-border bg-linear-to-r from-card via-card to-muted/30 sticky top-0 z-30"
    >
      <div className="flex items-center gap-1 flex-wrap">
        {/* Undo/Redo */}
        <div className="flex items-center gap-0.5 mr-1">
          <ToolbarButton
            icon={Undo}
            label={`Undo (${modKey}+Z)`}
            onClick={() => document.execCommand("undo")}
          />
          <ToolbarButton
            icon={Redo}
            label={`Redo (${modKey}+Shift+Z)`}
            onClick={() => document.execCommand("redo")}
          />
        </div>

        <Divider />

        {/* Font Family */}
        <div className="relative">
          <motion.button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowFontDropdown(!showFontDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-all text-sm font-medium min-w-22.5"
            whileHover={{ scale: 1.02 }}
          >
            <span className="truncate">{activeFont}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          </motion.button>
          <DropdownMenu show={showFontDropdown} onClose={() => setShowFontDropdown(false)}>
            {fontFamilies.map((font) => (
              <button
                key={font.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setActiveFont(font.name);
                  applyFormat("fontFamily", font.value);
                  setShowFontDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors ${
                  activeFont === font.name ? "bg-primary/10 text-primary" : ""
                }`}
                style={{ fontFamily: font.value }}
              >
                {font.name}
              </button>
            ))}
          </DropdownMenu>
        </div>

        {/* Font Size */}
        <div className="relative">
          <motion.button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-all text-sm font-medium min-w-15"
            whileHover={{ scale: 1.02 }}
          >
            <span>{activeFontSize}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </motion.button>
          <DropdownMenu show={showSizeDropdown} onClose={() => setShowSizeDropdown(false)}>
            <div className="grid grid-cols-2 gap-1">
              {fontSizes.map((size) => (
                <button
                  key={size}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setActiveFontSize(size);
                    applyFormat("fontSize", `${size}px`);
                    setShowSizeDropdown(false);
                  }}
                  className={`px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors text-center ${
                    activeFontSize === size ? "bg-primary/10 text-primary font-medium" : ""
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </DropdownMenu>
        </div>

        <Divider />

        {/* Text Formatting */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={Bold}
            label={`Bold (${modKey}+B)`}
            onClick={() => applyFormat("bold")}
            active={formatState.bold}
          />
          <ToolbarButton
            icon={Italic}
            label={`Italic (${modKey}+I)`}
            onClick={() => applyFormat("italic")}
            active={formatState.italic}
          />
          <ToolbarButton
            icon={Underline}
            label={`Underline (${modKey}+U)`}
            onClick={() => applyFormat("underline")}
            active={formatState.underline}
          />
          <ToolbarButton
            icon={Strikethrough}
            label={`Strikethrough (${modKey}+Shift+S)`}
            onClick={() => applyFormat("strikethrough")}
            active={formatState.strikethrough}
          />
          <ToolbarButton
            icon={Code}
            label={`Inline Code (${modKey}+E)`}
            onClick={() => applyFormat("code")}
            active={formatState.code}
          />
          <ToolbarButton
            icon={RemoveFormatting}
            label={`Clear Formatting (${modKey}+\\)`}
            onClick={() => applyFormat("removeFormat")}
          />
        </div>

        <Divider />

        {/* Text Color */}
        <div className="relative">
          <motion.button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowColorDropdown(!showColorDropdown)}
            className="flex items-center gap-1 p-2 rounded-lg hover:bg-muted transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Text Color"
          >
            <Palette className="w-4 h-4 text-muted-foreground" />
            <div className="w-3 h-3 rounded-full bg-foreground" />
          </motion.button>
          <DropdownMenu show={showColorDropdown} onClose={() => setShowColorDropdown(false)}>
            <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Text Color</p>
            <div className="grid grid-cols-3 gap-1">
              {textColors.map((color) => (
                <button
                  key={color.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyFormat("textColor", color.value);
                    setShowColorDropdown(false);
                  }}
                  className="flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors"
                  title={color.name}
                >
                  <div className={`w-5 h-5 rounded-full ${color.color}`} />
                </button>
              ))}
            </div>
          </DropdownMenu>
        </div>

        {/* Highlight Color */}
        <div className="relative">
          <motion.button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowHighlightDropdown(!showHighlightDropdown)}
            className="flex items-center gap-1 p-2 rounded-lg hover:bg-muted transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Highlight Color"
          >
            <Highlighter className="w-4 h-4 text-muted-foreground" />
          </motion.button>
          <DropdownMenu show={showHighlightDropdown} onClose={() => setShowHighlightDropdown(false)}>
            <p className="text-xs font-medium text-muted-foreground px-2 mb-2">Highlight</p>
            <div className="grid grid-cols-4 gap-1">
              {highlightColors.map((color) => (
                <button
                  key={color.value}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    applyFormat("highlight", color.value);
                    setShowHighlightDropdown(false);
                  }}
                  className="flex items-center justify-center p-2 rounded-lg hover:bg-muted transition-colors"
                  title={color.name}
                >
                  <div className={`w-5 h-5 rounded ${color.color}`} />
                </button>
              ))}
            </div>
          </DropdownMenu>
        </div>

        <Divider />

        {/* Alignment */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={AlignLeft}
            label="Align Left"
            onClick={() => applyFormat("alignLeft")}
          />
          <ToolbarButton
            icon={AlignCenter}
            label="Align Center"
            onClick={() => applyFormat("alignCenter")}
          />
          <ToolbarButton
            icon={AlignRight}
            label="Align Right"
            onClick={() => applyFormat("alignRight")}
          />
          <ToolbarButton
            icon={AlignJustify}
            label="Justify"
            onClick={() => applyFormat("justify")}
          />
        </div>

        <Divider />

        {/* Block Types */}
        <div className="relative">
          <motion.button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setShowBlockDropdown(!showBlockDropdown)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted transition-all text-sm font-medium"
            whileHover={{ scale: 1.02 }}
          >
            <Type className="w-4 h-4" />
            <span>Block</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </motion.button>
          <DropdownMenu show={showBlockDropdown} onClose={() => setShowBlockDropdown(false)}>
            <div className="space-y-1 max-h-100 overflow-y-auto">
              <p className="px-2 py-1 text-xs text-muted-foreground font-semibold">Headings</p>
              <button
                onClick={() => {
                  onInsertBlock("heading1");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Heading1 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Heading 1</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("heading2");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Heading2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Heading 2</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("heading3");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Heading3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Heading 3</span>
              </button>
              <div className="border-t border-border my-1" />
              <p className="px-2 py-1 text-xs text-muted-foreground font-semibold">Lists</p>
              <button
                onClick={() => {
                  onInsertBlock("bullet");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <List className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Bullet List</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("numbered");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <ListOrdered className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Numbered List</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("todo");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <CheckSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">To-do</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("toggle" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Toggle</span>
              </button>
              <div className="border-t border-border my-1" />
              <p className="px-2 py-1 text-xs text-muted-foreground font-semibold">Media</p>
              <button
                onClick={() => {
                  onInsertBlock("quote");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Quote className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Quote</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("code" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Code className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Code Block</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("image" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Image className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Image</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("video" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Image className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Video Embed</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("bookmark" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Link className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Bookmark</span>
              </button>
              <div className="border-t border-border my-1" />
              <p className="px-2 py-1 text-xs text-muted-foreground font-semibold">Advanced</p>
              <button
                onClick={() => {
                  onInsertBlock("table" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Minus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Table</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("equation" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Type className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Equation</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("progress" as any);
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Minus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Progress Bar</span>
              </button>
              <button
                onClick={() => {
                  onInsertBlock("divider");
                  setShowBlockDropdown(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <Minus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Divider</span>
              </button>
            </div>
          </DropdownMenu>
        </div>

        <Divider />

        {/* Insert Link & Image */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={Link}
            label={`Insert Link (${modKey}+K)`}
            onClick={() => applyFormat("link")}
          />
          <ToolbarButton
            icon={Image}
            label="Insert Image"
            onClick={() => {}}
          />
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{modKey}+B</kbd>
            <span>Bold</span>
            <span className="mx-1">•</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{modKey}+I</kbd>
            <span>Italic</span>
            <span className="mx-1">•</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">{modKey}+U</kbd>
            <span>Underline</span>
          </div>
          
          <motion.button
            onClick={() => {}}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-linear-to-r from-primary/20 to-primary/10 hover:from-primary/30 hover:to-primary/20 transition-all text-primary text-sm font-medium border border-primary/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">AI Assist</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default EditorToolbar;
