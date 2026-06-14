"use client";
import { useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EquationBlockProps {
  content: string;
  onChange: (content: string) => void;
}

const EquationBlock = ({ content, onChange }: EquationBlockProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [copiedFormula, setCopiedFormula] = useState(false);

  const renderLatex = (latex: string): string => {
    try {
      return katex.renderToString(latex, {
        throwOnError: false,
        strict: false,
      });
    } catch {
      return "";
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopiedFormula(true);
    setTimeout(() => setCopiedFormula(false), 2000);
  };

  const insertFormula = (formula: string) => {
    onChange(formula);
    setIsEditing(true);
  };

  const commonFormulas = [
    { name: "Quadratic", formula: "x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}" },
    { name: "Pythagorean", formula: "a^2 + b^2 = c^2" },
    { name: "Distance", formula: "d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}" },
    { name: "Circle", formula: "A = \\pi r^2" },
    { name: "Euler", formula: "e^{i\\pi} + 1 = 0" },
    { name: "Integral", formula: "\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}" },
  ];

  const hasValidLatex = content.trim().length > 0;
  const renderedLatex = renderLatex(content);

  return (
    <div className="py-2 space-y-2">
      {/* Editor/Preview Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            isEditing
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setIsEditing(false)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            !isEditing
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Preview
        </button>
        {content && (
          <button
            onClick={copyToClipboard}
            className="ml-auto p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            title="Copy LaTeX"
          >
            {copiedFormula ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Editor/Preview Content */}
      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editor"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-muted/30 rounded-lg border border-border p-3"
          >
            <textarea
              value={content}
              onChange={(e) => onChange(e.target.value)}
              placeholder="x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}"
              className="w-full h-20 bg-transparent outline-none resize-none font-mono text-sm placeholder:text-muted-foreground/50"
            />
          </motion.div>
        ) : (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bg-linear-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-4 flex items-center justify-center min-h-20"
          >
            {hasValidLatex && renderedLatex ? (
              <div
                dangerouslySetInnerHTML={{ __html: renderedLatex }}
                className="text-center"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Enter a formula to see preview</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EquationBlock;
