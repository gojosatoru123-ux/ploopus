'use client'
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Shield, AlertTriangle, Zap, Target } from "lucide-react";

interface SwotBlockProps {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  onUpdate: (updates: {
    swotStrengths?: string[];
    swotWeaknesses?: string[];
    swotOpportunities?: string[];
    swotThreats?: string[];
  }) => void;
}

const quadrants = [
  { key: "strengths" as const, label: "Strengths", subtitle: "Internal advantages", icon: Shield, updateKey: "swotStrengths" as const, accentHsl: "142 71% 45%", dotClass: "bg-emerald-500", iconGradient: "from-emerald-400 to-green-500", pillBg: "bg-emerald-500/8 hover:bg-emerald-500/12", pillBorder: "border-emerald-500/15" },
  { key: "weaknesses" as const, label: "Weaknesses", subtitle: "Areas to improve", icon: AlertTriangle, updateKey: "swotWeaknesses" as const, accentHsl: "38 92% 50%", dotClass: "bg-amber-500", iconGradient: "from-amber-400 to-orange-500", pillBg: "bg-amber-500/8 hover:bg-amber-500/12", pillBorder: "border-amber-500/15" },
  { key: "opportunities" as const, label: "Opportunities", subtitle: "External potential", icon: Zap, updateKey: "swotOpportunities" as const, accentHsl: "217 91% 60%", dotClass: "bg-blue-500", iconGradient: "from-blue-400 to-indigo-500", pillBg: "bg-blue-500/8 hover:bg-blue-500/12", pillBorder: "border-blue-500/15" },
  { key: "threats" as const, label: "Threats", subtitle: "External risks", icon: Target, updateKey: "swotThreats" as const, accentHsl: "0 84% 60%", dotClass: "bg-rose-500", iconGradient: "from-rose-400 to-red-500", pillBg: "bg-rose-500/8 hover:bg-rose-500/12", pillBorder: "border-rose-500/15" },
];

// contentEditable div — syncs value in/out without fighting cursor position
const EditableDiv = ({
  value,
  onChange,
  onEnter,
  placeholder,
  className,
  shouldFocus,
}: {
  value: string;
  onChange: (val: string) => void;
  onEnter: () => void;
  placeholder: string;
  className: string;
  shouldFocus: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  useEffect(() => {
    if (ref.current && !isFocused.current) {
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value;
      }
    }
  }, [value]);

  useEffect(() => {
    if (shouldFocus && ref.current) {
      ref.current.focus();
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [shouldFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter();
    }
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onFocus={() => { isFocused.current = true; }}
      onBlur={(e) => {
        isFocused.current = false;
        onChange(e.currentTarget.innerHTML);
      }}
      onInput={(e) => onChange(e.currentTarget.innerHTML)}
      onKeyDown={handleKeyDown}
      className={`${className} empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/25 empty:before:pointer-events-none`}
    />
  );
};

const SwotBlock = ({ strengths, weaknesses, opportunities, threats, onUpdate }: SwotBlockProps) => {
  const data = { strengths, weaknesses, opportunities, threats };
  const [focusTarget, setFocusTarget] = useState<{ key: string; index: number } | null>(null);

  const insertItem = (q: typeof quadrants[number], index: number) => {
    const newItems = [...data[q.key]];
    newItems.splice(index + 1, 0, "");
    onUpdate({ [q.updateKey]: newItems });
    setFocusTarget({ key: q.key, index: index + 1 });
  };

  const updateItem = (q: typeof quadrants[number], index: number, value: string) => {
    const newItems = [...data[q.key]];
    newItems[index] = value;
    onUpdate({ [q.updateKey]: newItems });
  };

  const removeItem = (q: typeof quadrants[number], index: number) => {
    onUpdate({ [q.updateKey]: data[q.key].filter((_, i) => i !== index) });
  };

  return (
    <div className="py-4">
      <div className="rounded-2xl overflow-hidden bg-card/80 backdrop-blur-xl border border-border/30 shadow-sm">
        <div className="grid grid-cols-2 gap-px bg-border/20">
          {quadrants.map((q) => {
            const items = data[q.key];

            return (
              <div key={q.key} className="relative p-5 bg-card/90 group">
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-4">
                  <div className={`w-7 h-7 rounded-lg bg-linear-to-br ${q.iconGradient} flex items-center justify-center shadow-sm`}>
                    <q.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-foreground tracking-tight">{q.label}</span>
                </div>

                {/* Items */}
                <div className="space-y-1.5 min-h-12">
                  <AnimatePresence initial={false} mode="popLayout">
                    {items.map((item, index) => (
                      <motion.div
                        key={`${q.key}-${index}`}
                        layout
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group/item flex items-start gap-2 rounded-lg px-2.5 py-1.5 -mx-1 hover:bg-muted/40 transition-colors"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${q.dotClass} shrink-0 opacity-60 mt-2`} />
                        <EditableDiv
                          value={item}
                          shouldFocus={focusTarget?.key === q.key && focusTarget?.index === index}
                          onChange={(val) => updateItem(q, index, val)}
                          onEnter={() => insertItem(q, index)}
                          className="flex-1 text-[13px] bg-transparent outline-none text-foreground/90 leading-snug"
                          placeholder="..."
                        />
                        <button
                          onClick={() => removeItem(q, index)}
                          className="p-0.5 rounded-md opacity-0 group-hover/item:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Add button */}
                <button
                  onClick={() => insertItem(q, items.length - 1)}
                  className={`mt-3 flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all opacity-0 group-hover:opacity-100 ${q.pillBg} ${q.pillBorder}`}
                >
                  <Plus className="w-3 h-3" />
                  Add Item
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SwotBlock;