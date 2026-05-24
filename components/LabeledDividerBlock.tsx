'use client'
import { useState } from "react";
import { motion } from "framer-motion";
import { Minus, Star, Circle, Diamond, Sparkles } from "lucide-react";

interface LabeledDividerBlockProps {
    label: string;
    style: string;
    onUpdate: (updates: { dividerLabel?: string; dividerStyle?: string }) => void;
}

const dividerStyles = [
    { id: "simple", label: "Simple" },
    { id: "dashed", label: "Dashed" },
    { id: "dots", label: "Dots" },
    { id: "gradient", label: "Gradient" },
    { id: "fancy", label: "Fancy" },
];

const LabeledDividerBlock = ({ label, style, onUpdate }: LabeledDividerBlockProps) => {
    const [showPicker, setShowPicker] = useState(false);

    const renderLine = (side: "left" | "right") => {
        const baseClass = "flex-1 h-px";
        switch (style) {
            case "dashed":
                return <div className={`${baseClass} border-t border-dashed border-border`} />;
            case "dots":
                return (
                    <div className={`${baseClass} flex items-center ${side === "left" ? "justify-end pr-2" : "justify-start pl-2"}`}>
                        <div className="flex gap-1.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="w-1 h-1 rounded-full bg-border" />
                            ))}
                        </div>
                    </div>
                );
            case "gradient":
                return (
                    <div
                        className={`${baseClass}`}
                        style={{
                            background: `linear-gradient(to ${side === "left" ? "right" : "left"}, transparent, currentColor)`,
                            opacity: 0.2
                        }}
                    />
                );
            case "fancy":
                return (
                    <div className="flex-1 flex flex-col justify-center">
                        <div
                            className="h-px w-full"
                            style={{
                                background: `linear-gradient(to ${side === "left" ? "right" : "left"}, transparent, var(--primary-color, #3b82f6), transparent)`,
                                opacity: 0.4
                            }}
                        />
                    </div>
                );
            default:
                return <div className={`${baseClass} bg-border`} />;
        }
    };

    const renderDecoration = () => {
        if (style === "fancy") {
            return (
                <div className="flex items-center gap-1.5 mx-1">
                    <Diamond className="w-2.5 h-2.5 text-primary/40" />
                </div>
            );
        }
        if (style === "dots") {
            return (
                <div className="flex items-center gap-1 mx-1">
                    <Circle className="w-1.5 h-1.5 fill-muted-foreground/30 text-muted-foreground/30" />
                </div>
            );
        }
        return null;
    };

    return (
        <div className="py-4 group w-full overflow-hidden select-none">
            {/* flex-nowrap ensures items never wrap or push past the viewport bounds */}
            <div className="flex items-center gap-1.5 sm:gap-3 w-full overflow-hidden flex-nowrap">
                {renderLine("left")}

                {/* flex-shrink-0 prevents icons from being pushed off-screen and creating scrollbars */}
                <div className="shrink-0">{renderDecoration()}</div>

                {/* Locked responsive wrapper using viewport percentage constraint */}
                <div className="inline-grid items-center justify-items-center relative min-w-10 max-w-[45vw] sm:max-w-[60vw] md:max-w-md overflow-hidden shrink-0">
                    {/* Invisible text mirror dictating the exact dynamic layout width */}
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] px-1 invisible col-start-1 row-start-1 whitespace-pre truncate w-full text-center">
                        {label || "LABEL"}
                    </span>

                    {/* w-0 min-w-full bypasses default mobile browser input width bugs entirely */}
                    <input
                        value={label}
                        onChange={(e) => onUpdate({ dividerLabel: e.target.value })}
                        className="w-0 min-w-full text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/60 bg-transparent border-none outline-none text-center placeholder:text-muted-foreground/30 px-1 col-start-1 row-start-1 "
                        placeholder="LABEL"
                    />
                </div>

                <div className="shrink-0">{renderDecoration()}</div>
                {renderLine("right")}
            </div>

            {/* Style picker on hover */}
            <div className="flex justify-center mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {showPicker ? (
                    <motion.div
                        className="flex items-center gap-1 bg-popover border border-border rounded-lg p-1 shadow-lg"
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        {dividerStyles.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => { onUpdate({ dividerStyle: s.id }); setShowPicker(false); }}
                                className={`px-2 py-1 rounded text-xs transition-colors ${style === s.id ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-muted-foreground"
                                    }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </motion.div>
                ) : (
                    <button
                        onClick={() => setShowPicker(true)}
                        className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                    >
                        Change style
                    </button>
                )}
            </div>
        </div>
    );
};

export default LabeledDividerBlock;
