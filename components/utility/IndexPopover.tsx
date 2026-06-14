"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight, X } from "lucide-react";
import { HeadingIndex } from "@/hooks/useHeadingIndex";

interface IndexPopoverProps {
  index: HeadingIndex[];
  onHeadingClick: (headingId: string) => void;
}

const IndexPopover = ({ index, onHeadingClick }: IndexPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleHeadingClick = (headingId: string) => {
    onHeadingClick(headingId);
    setIsOpen(false);
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed left-6 top-1/2 -translate-y-1/2 p-3 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all shadow-lg z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        title="Document index"
      >
        <BookOpen className="w-5 h-5 text-primary" />
        {index.length > 0 && (
          <motion.span
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            {index.length}
          </motion.span>
        )}
      </motion.button>

      {/* Popover Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/20 z-40"
            />

            {/* Popover Content */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -20, y: -20 }}
              transition={{ duration: 0.2 }}
              className="fixed left-24 top-1/2 -translate-y-1/2 w-72 max-h-[60vh] bg-card border border-border rounded-xl shadow-xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Document Index</h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-muted rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
                {index.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No headings yet</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Add headings to create an index
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {index.map((heading) => (
                      <motion.button
                        key={heading.id}
                        onClick={() => handleHeadingClick(heading.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-all hover:bg-muted/60 group relative`}
                        style={{
                          paddingLeft: `${12 + heading.indent * 12}px`,
                        }}
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Heading indicator dot */}
                        <div
                          className={`absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-colors ${
                            heading.level === 1
                              ? "bg-primary"
                              : heading.level === 2
                              ? "bg-primary/70"
                              : "bg-primary/40"
                          }`}
                        />

                        {/* Text */}
                        <span
                          className={`block text-sm truncate transition-colors ${
                            heading.level === 1
                              ? "font-semibold text-foreground"
                              : heading.level === 2
                              ? "font-medium text-foreground/90"
                              : "text-foreground/75 text-xs"
                          }`}
                        >
                          {heading.text || `Untitled ${heading.level === 1 ? "Heading" : "Subheading"}`}
                        </span>

                        {/* Hover indicator */}
                        <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer stats */}
              <div className="px-4 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground text-center shrink-0">
                <p>{index.length} section{index.length !== 1 ? "s" : ""}</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default IndexPopover;
