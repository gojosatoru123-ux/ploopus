"use client";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ChevronRight } from "lucide-react";
import { HeadingIndex } from "@/hooks/useHeadingIndex";

interface IndexPanelProps {
  index: HeadingIndex[];
  onHeadingClick: (headingId: string) => void;
  isVisible: boolean;
}

const IndexPanel = ({ index, onHeadingClick, isVisible }: IndexPanelProps) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="w-64 h-full bg-card/50 backdrop-blur-sm border-r border-border flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Document Index</h3>
            </div>
            <p className="text-xs text-muted-foreground">Navigate by sections</p>
          </div>

          {/* Headings List */}
          <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1">
            {index.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">No headings yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Add headings to create an index
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {index.map((heading) => (
                  <motion.button
                    key={heading.id}
                    onClick={() => onHeadingClick(heading.id)}
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
      )}
    </AnimatePresence>
  );
};

export default IndexPanel;
