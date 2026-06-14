"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, X, ChevronLeft } from "lucide-react";
import { HeadingIndex } from "@/hooks/useHeadingIndex";

interface FloatingIndexSidebarProps {
  index: HeadingIndex[];
  onHeadingClick: (headingId: string) => void;
  focusMode?: boolean;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

const FloatingIndexSidebar = ({
  index,
  onHeadingClick,
  focusMode = false,
  isOpen: controlledIsOpen,
  onToggle
}: FloatingIndexSidebarProps) => {
  const [internalIsOpen, setInternalIsOpen] = useState(true);

  // Use controlled state if provided, otherwise use internal state
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleToggle = (newState: boolean) => {
    setInternalIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <>
      {/* Floating Index Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className={`fixed ${
              focusMode ? 'left-8 top-24' : 'left-8 top-24'
            } z-40 w-80 max-h-[calc(100vh-120px)] rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col`}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-border/30 shrink-0 bg-linear-to-r from-card/95 to-card/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight">Document Index</h3>
                </div>
                <motion.button
                  onClick={() => handleToggle(false)}
                  className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </motion.button>
              </div>
              <p className="text-xs text-muted-foreground/80">Navigate your sections</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {index.length === 0 ? (
                <div className="py-12 px-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <BookOpen className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">No headings yet</p>
                  <p className="text-xs text-muted-foreground/60">Add headings to create an index</p>
                </div>
              ) : (
                <div className="py-4 px-4 space-y-1">
                  {index.map((heading, idx) => (
                    <motion.button
                      key={heading.id}
                      onClick={() => onHeadingClick(heading.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all group relative overflow-hidden`}
                      style={{
                        paddingLeft: `${16 + heading.indent * 16}px`,
                      }}
                      whileHover={{ x: 6 }}
                      whileTap={{ scale: 0.98 }}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                    >
                      {/* Background on hover */}
                      <motion.div
                        className="absolute inset-0 bg-primary/5 rounded-xl"
                        initial={{ opacity: 0 }}
                        whileHover={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                      />

                      <div className="relative flex items-center gap-3">
                        {/* Heading indicator dot with animation */}
                        <motion.div
                          className={`w-2 h-2 rounded-full shrink-0 transition-colors ${
                            heading.level === 1
                              ? 'bg-primary shadow-lg shadow-primary/50'
                              : heading.level === 2
                              ? 'bg-primary/70 shadow-lg shadow-primary/30'
                              : 'bg-primary/40'
                          }`}
                          whileHover={{ scale: 1.4 }}
                        />

                        {/* Text with truncation */}
                        <span
                          className={`block flex-1 truncate transition-colors group-hover:text-primary ${
                            heading.level === 1
                              ? 'font-bold text-foreground text-sm'
                              : heading.level === 2
                              ? 'font-semibold text-foreground/90 text-sm'
                              : 'font-medium text-foreground/70 text-xs'
                          }`}
                          title={heading.text}
                        >
                          {heading.text || `Untitled ${heading.level === 1 ? "Heading" : "Subheading"}`}
                        </span>

                        {/* Hover chevron */}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Stats */}
            <div className="px-6 py-4 border-t border-border/30 bg-linear-to-r from-muted/30 to-muted/20 shrink-0 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {index.length} Section{index.length !== 1 ? 's' : ''}
                </p>
                {index.length > 0 && (
                  <div className="flex gap-1">
                    {index.map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1 h-1 rounded-full bg-primary/40"
                        animate={{
                          opacity: [0.4, 1, 0.4],
                        }}
                        transition={{
                          duration: 2,
                          delay: i * 0.1,
                          repeat: Infinity,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button (when closed) */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            onClick={() => handleToggle(true)}
            className="fixed left-8 top-24 z-40 p-3 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 text-primary shadow-lg transition-all"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Open document index"
          >
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingIndexSidebar;
