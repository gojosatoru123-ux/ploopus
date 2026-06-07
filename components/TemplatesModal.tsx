"use client";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search } from "lucide-react";
import { templates, Template } from "@/data/templates";


interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: Template) => void;
}

const TemplatesModal = ({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplatesModalProps) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const blockTypes = [...new Set(t.blocks.map((b) => b.type))].join(" ");
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.icon.includes(q) ||
        blockTypes.toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Group templates by category
  const groupedTemplates = filteredTemplates.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, Template[]>
  );

  // Define category order and colors
  const categoryOrder = [
    "Personal & Learning",
    "Health & Wellness",
    "Education",
    "Creative & Design",
    "Project Management",
    "Sales & Business",
    "Marketing",
    "Leadership & Strategy",
    "Operations & Finance",
    "People & HR",
    "Customer Success",
    "Travel & Lifestyle",
  ];

  const categoryColors: Record<string, string> = {
    "Personal & Learning": "from-blue-500/30 to-cyan-500/30",
    "Health & Wellness": "from-emerald-500/30 to-teal-500/30",
    "Education": "from-violet-500/30 to-indigo-500/30",
    "Creative & Design": "from-fuchsia-500/30 to-pink-500/30",
    "Project Management": "from-green-500/30 to-emerald-500/30",
    "Sales & Business": "from-purple-500/30 to-pink-500/30",
    Marketing: "from-orange-500/30 to-red-500/30",
    "Leadership & Strategy": "from-amber-500/30 to-yellow-500/30",
    "Operations & Finance": "from-rose-500/30 to-pink-500/30",
    "People & HR": "from-indigo-500/30 to-purple-500/30",
    "Customer Success": "from-teal-500/30 to-cyan-500/30",
    "Travel & Lifestyle": "from-sky-500/30 to-blue-500/30",
  };


  const sortedCategories = categoryOrder.filter((cat) => groupedTemplates[cat]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Modal Container - Centered with Flexbox */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{
              duration: 0.3,
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            {/* Modal Content */}
            <div className="w-full max-w-4xl bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-5 border-b border-border/50 shrink-0 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Choose a Template
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      {templates.length}+ pre-designed templates to jumpstart any note
                    </p>
                  </div>
                  <motion.button
                    onClick={onClose}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-muted-foreground" />
                  </motion.button>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search templates by name, category, or block type…"
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-muted/40 border border-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 placeholder:text-muted-foreground text-foreground"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {sortedCategories.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-4xl mb-3">🔍</div>
                    <p className="text-sm text-muted-foreground">
                      No templates match “{query}”
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">

                    {sortedCategories.map((category, categoryIndex) => (
                      <motion.div
                        key={category}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: categoryIndex * 0.05 }}
                      >
                        {/* Category Header */}
                        <div
                          className={`bg-linear-to-r ${categoryColors[category]} border border-border/50 rounded-xl px-4 py-3 mb-4`}
                        >
                          <h3 className="text-sm font-semibold text-foreground">
                            {category}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            {groupedTemplates[category].length} template
                            {groupedTemplates[category].length !== 1 ? "s" : ""}
                          </p>
                        </div>

                        {/* Category Templates Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {groupedTemplates[category].map((template, index) => (
                            <motion.button
                              key={template.id}
                              onClick={() => {
                                onSelectTemplate(template);
                                onClose();
                              }}
                              className="text-left group"
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: categoryIndex * 0.05 + index * 0.03,
                              }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                            >
                              <div
                                className={`bg-linear-to-br ${template.color} border border-border/50 rounded-xl p-5 h-full transition-all group-hover:border-primary/50 group-hover:shadow-lg`}
                              >
                                {/* Icon */}
                                <div className="text-3xl mb-3">
                                  {template.icon}
                                </div>

                                {/* Title */}
                                <h4 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                                  {template.name}
                                </h4>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground mb-4">
                                  {template.description}
                                </p>

                                {/* Block Preview */}
                                <div className="flex flex-wrap gap-1">
                                  {[...new Set(template.blocks.map((b) => b.type))]
                                    .slice(0, 5)
                                    .map((blockType) => (
                                      <span
                                        key={blockType}
                                        className="text-xs px-2 py-1 bg-muted/50 text-muted-foreground rounded-full"
                                      >
                                        {blockType === "heading1"
                                          ? "H1"
                                          : blockType === "heading2"
                                            ? "H2"
                                            : blockType === "heading3"
                                              ? "H3"
                                              : blockType.charAt(0).toUpperCase() +
                                              blockType.slice(1)}
                                      </span>
                                    ))}
                                  {template.blocks.length > 5 && (
                                    <span className="text-xs px-2 py-1 text-muted-foreground">
                                      +{template.blocks.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>


              {/* Footer */}
              <div className="px-6 py-4 border-t border-border/50 bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">
                  💡 You can edit or customize the template after selecting it
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TemplatesModal;