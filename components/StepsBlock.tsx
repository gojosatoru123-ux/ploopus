'use client'
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check } from "lucide-react";

interface StepItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

interface StepsBlockProps {
  steps: StepItem[];
  onUpdate: (steps: StepItem[]) => void;
}

const stepColors = [
  "from-blue-500 to-cyan-500",
  "from-violet-500 to-purple-500",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-emerald-500 to-teal-500",
  "from-fuchsia-500 to-pink-500",
];

// contentEditable div that stays in sync with external value without fighting the cursor
const EditableDiv = ({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  className: string;
  placeholder: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);

  // Only sync from outside when not focused (avoids cursor jumping while typing)
  useEffect(() => {
    if (ref.current && !isFocused.current) {
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value;
      }
    }
  }, [value]);

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
      className={`${className} empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/50 empty:before:pointer-events-none`}
    />
  );
};

const StepsBlock = ({ steps, onUpdate }: StepsBlockProps) => {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);

  const addStep = () => {
    onUpdate([...steps, {
      id: crypto.randomUUID(),
      title: "",
      description: "",
      completed: false,
    }]);
  };

  const removeStep = (id: string) => {
    if (steps.length <= 1) return;
    onUpdate(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<StepItem>) => {
    onUpdate(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const toggleComplete = (id: string) => {
    onUpdate(steps.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const completedCount = steps.filter(s => s.completed).length;
  const progress = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="py-3">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-linear-to-r from-blue-500 to-emerald-500"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {completedCount}/{steps.length}
        </span>
      </div>

      <div className="relative">
        <div className="absolute left-5 top-6 bottom-6 w-px bg-border/60" />

        <AnimatePresence mode="popLayout" initial={false}>
          {steps.map((step, index) => {
            const color = stepColors[index % stepColors.length];
            return (
              <motion.div
                key={step.id}
                layout
                className="relative flex gap-4 mb-3 last:mb-0 group"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                <motion.button
                  onClick={() => toggleComplete(step.id)}
                  className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-all duration-300 cursor-pointer ${
                    step.completed
                      ? "bg-linear-to-br from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25"
                      : `bg-linear-to-br ${color} text-white shadow-md`
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {step.completed ? <Check className="w-4 h-4" /> : index + 1}
                </motion.button>

                <div className={`flex-1 rounded-xl border border-border/50 p-3 transition-all duration-200 ${
                  step.completed ? "bg-muted/30 opacity-70" : "bg-card hover:border-border"
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <EditableDiv
                        value={step.title}
                        onChange={(val) => updateStep(step.id, { title: val })}
                        className={`w-full bg-transparent outline-none text-sm font-semibold text-foreground ${
                          step.completed ? "line-through" : ""
                        }`}
                        placeholder={`Step ${index + 1} title...`}
                      />
                      <EditableDiv
                        value={step.description}
                        onChange={(val) => updateStep(step.id, { description: val })}
                        className="w-full bg-transparent outline-none text-xs text-muted-foreground mt-1"
                        placeholder="Add details..."
                      />
                    </div>
                    {hoveredStep === step.id && steps.length > 1 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={() => removeStep(step.id)}
                        className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <motion.button
        onClick={addStep}
        className="mt-3 ml-14 flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        whileHover={{ x: 4 }}
      >
        <Plus className="w-3.5 h-3.5" />
        Add step
      </motion.button>
    </div>
  );
};

export default StepsBlock;