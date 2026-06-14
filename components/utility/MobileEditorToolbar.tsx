// ✅
import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  ChevronDown,
} from "lucide-react";

export type MobileBlockDef = {
  type: string;
  icon: React.ElementType;
  label: string;
  description: string;
  category: string;
};

interface MobileEditorToolbarProps {
  onOpenBlockMenu: () => void;
  isEditing: boolean;
}

const MobileEditorToolbar = ({ onOpenBlockMenu, isEditing }: MobileEditorToolbarProps) => {
  const [bottomOffset, setBottomOffset] = useState(0);
  const lastScrollEl = useRef<Element | null>(null);

  // Keep the toolbar pinned just above the on-screen keyboard.
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const updateOffset = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty("--mobile-editor-keyboard-offset", `${offset}px`);
      setBottomOffset(offset);
    };
    updateOffset();
    vv.addEventListener("resize", updateOffset);
    vv.addEventListener("scroll", updateOffset);
    return () => {
      vv.removeEventListener("resize", updateOffset);
      vv.removeEventListener("scroll", updateOffset);
    };
  }, []);

  // Auto-scroll the focused block into view above the toolbar/keyboard.
  useEffect(() => {
    if (!isEditing) return;
    const TOOLBAR_HEIGHT = 56;
    const PADDING = 12;
    const ensureVisible = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !(el as any).getBoundingClientRect) return;
      const editable =
        el.isContentEditable || el.tagName === "INPUT" || el.tagName === "TEXTAREA";
      if (!editable) return;
      const rect = el.getBoundingClientRect();
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      const viewportBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
      const safeBottom = viewportBottom - TOOLBAR_HEIGHT - PADDING;
      if (rect.bottom > safeBottom) {
        const delta = rect.bottom - safeBottom;
        let parent: HTMLElement | null = el.parentElement;
        while (parent) {
          const style = window.getComputedStyle(parent);
          const overflowY = style.overflowY;
          if (
            (overflowY === "auto" || overflowY === "scroll") &&
            parent.scrollHeight > parent.clientHeight
          ) {
            parent.scrollBy({ top: delta, behavior: "smooth" });
            lastScrollEl.current = parent;
            return;
          }
          parent = parent.parentElement;
        }
        window.scrollBy({ top: delta, behavior: "smooth" });
      }
    };
    const onFocusIn = () => requestAnimationFrame(ensureVisible);
    const onSelectionChange = () => requestAnimationFrame(ensureVisible);
    const onResize = () => setTimeout(ensureVisible, 50);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("selectionchange", onSelectionChange);
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    vv?.addEventListener("resize", onResize);
    setTimeout(ensureVisible, 100);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("selectionchange", onSelectionChange);
      vv?.removeEventListener("resize", onResize);
    };
  }, [isEditing]);

  if (!isEditing && bottomOffset === 0) return null;

  return (
    <>
      <motion.div
        initial={false}
        animate={{ y: 0 }}
        style={{ bottom: bottomOffset }}
        className="fixed left-0 right-0 z-9997 bg-card/95 backdrop-blur-md border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => {
          const t = e.target as HTMLElement;
          if (!t.closest("button, input, textarea")) e.preventDefault();
        }}
      >
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto scrollbar-thin">
          <button
            onTouchStart={(e) => {
              e.preventDefault();
              onOpenBlockMenu();
            }}
            onClick={onOpenBlockMenu}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium shrink-0"
          >
            <Plus className="w-4 h-4" />
            Block
            <ChevronDown className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </motion.div>

      <div aria-hidden style={{ height: 56 + bottomOffset }} />
    </>
  );
};

export default MobileEditorToolbar;
