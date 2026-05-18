'use client'
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Check, Minus } from "lucide-react";

interface ComparisonColumn {
    id: string;
    name: string;
    highlighted?: boolean;
}

interface ComparisonRow {
    id: string;
    feature: string;
    values: Record<string, "yes" | "no" | "partial" | string>;
}

interface ComparisonTableBlockProps {
    columns: ComparisonColumn[];
    rows: ComparisonRow[];
    onUpdate: (updates: { comparisonColumns?: ComparisonColumn[]; comparisonRows?: ComparisonRow[] }) => void;
}

const AutoSizeTextarea = ({
    value,
    onChange,
    onEnter,
    placeholder,
    className,
    shouldFocus
}: {
    value: string;
    onChange: (val: string) => void;
    onEnter?: () => void;
    placeholder: string;
    className: string;
    shouldFocus?: boolean;
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            if (shouldFocus) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(value.length, value.length);
            }
        }
    }, [value, shouldFocus]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey && onEnter) {
            e.preventDefault();
            onEnter();
        }
    };

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`${className} resize-none overflow-hidden`}
            placeholder={placeholder}
            rows={1}
        />
    );
};

const ComparisonTableBlock = ({ columns, rows, onUpdate }: ComparisonTableBlockProps) => {
    const [focusTarget, setFocusTarget] = useState<string | null>(null);
    const [activeCell, setActiveCell] = useState<{ rowId: string | null; colId: string | null }>({ rowId: null, colId: null });

    const addColumn = () => {
        if (columns.length >= 6) return;
        const newCol: ComparisonColumn = { id: crypto.randomUUID(), name: "" };
        const insertAfterIdx = activeCell.colId ? columns.findIndex(c => c.id === activeCell.colId) : columns.length - 1;
        const insertAt = insertAfterIdx + 1;
        const newColumns = [
            ...columns.slice(0, insertAt),
            newCol,
            ...columns.slice(insertAt),
        ];
        const newRows = rows.map(r => ({ ...r, values: { ...r.values, [newCol.id]: "" } }));
        onUpdate({ comparisonColumns: newColumns, comparisonRows: newRows });
    };

    const removeColumn = (id: string) => {
        if (columns.length <= 2) return;
        onUpdate({
            comparisonColumns: columns.filter(c => c.id !== id),
            comparisonRows: rows.map(r => {
                const { [id]: _, ...rest } = r.values;
                return { ...r, values: rest };
            }),
        });
    };

    const addRow = (index?: number) => {
        const values: Record<string, string> = {};
        columns.forEach(c => { values[c.id] = ""; });
        const newRow = { id: crypto.randomUUID(), feature: "", values };

        let newRows = [...rows];
        if (typeof index === 'number') {
            // Called from onEnter inside a row — insert after that row
            newRows.splice(index + 1, 0, newRow);
        } else {
            // Called from Add row button — insert after active row, fallback to end
            // If only a column header is active (rowId null, colId set), insert as first row
            let insertAt: number;
            if (activeCell.rowId) {
                insertAt = rows.findIndex(r => r.id === activeCell.rowId) + 1;
            } else if (activeCell.colId) {
                insertAt = 0;
            } else {
                insertAt = rows.length;
            }
            newRows.splice(insertAt, 0, newRow);
        }

        onUpdate({ comparisonRows: newRows });
        setFocusTarget(newRow.id);
    };

    const removeRow = (id: string) => {
        if (rows.length <= 1) return;
        onUpdate({ comparisonRows: rows.filter(r => r.id !== id) });
    };

    const updateColumnName = (id: string, name: string) => {
        onUpdate({ comparisonColumns: columns.map(c => c.id === id ? { ...c, name } : c) });
    };

    const toggleHighlight = (id: string) => {
        onUpdate({ comparisonColumns: columns.map(c => c.id === id ? { ...c, highlighted: !c.highlighted } : c) });
    };

    const updateFeature = (id: string, feature: string) => {
        onUpdate({ comparisonRows: rows.map(r => r.id === id ? { ...r, feature } : r) });
    };

    const cycleValue = (rowId: string, colId: string) => {
        const current = rows.find(r => r.id === rowId)?.values[colId] || "";
        const cycle = ["yes", "no", "partial", ""];
        const next = cycle[(cycle.indexOf(current) + 1) % cycle.length];
        onUpdate({
            comparisonRows: rows.map(r =>
                r.id === rowId ? { ...r, values: { ...r.values, [colId]: next } } : r
            ),
        });
    };

    const renderValue = (value: string) => {
        switch (value) {
            case "yes": return <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center"><Check className="w-3.5 h-3.5 text-emerald-500" /></div>;
            case "no": return <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center"><X className="w-3.5 h-3.5 text-red-400" /></div>;
            case "partial": return <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center"><Minus className="w-3.5 h-3.5 text-amber-500" /></div>;
            default: return <div className="w-6 h-6 rounded-full border border-dashed border-border" />;
        }
    };

    return (
        <div className="py-4">
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className=" overflow-hidden"
            >
                <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] rounded-lg border border-border">
                    <table className="w-full table-auto border-collapse">
                        <thead>
                            <tr className="bg-muted/5">
                                <th className="text-left p-4 pb-3 border-b border-border/20 min-w-50">
                                    <span className="text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">Feature</span>
                                </th>
                                {columns.map((col) => (
                                    <th
                                        key={col.id}
                                        className={`p-4 pb-3 border-b border-border/10 transition-colors ${col.highlighted ? "bg-primary/5" : ""}`}
                                    >
                                        <div className="flex flex-col items-center gap-1 group/col min-w-25">
                                            <input
                                                value={col.name}
                                                onChange={(e) => updateColumnName(col.id, e.target.value)}
                                                onFocus={() => setActiveCell({ rowId: null, colId: col.id })}
                                                placeholder="Option"
                                                className="text-sm font-semibold text-foreground bg-transparent outline-none text-center min-w-[4ch] placeholder:text-muted-foreground/30 border-none focus:ring-0"
                                                style={{ width: `${Math.max(col.name.length, 6)}ch` }}
                                            />
                                            <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => toggleHighlight(col.id)}
                                                    className={`text-[9px] px-1.5 py-0.5 rounded-md transition-colors ${col.highlighted ? "bg-primary/15 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                                                >
                                                    {col.highlighted ? "★" : "☆"}
                                                </button>
                                                {columns.length > 2 && (
                                                    <button onClick={() => removeColumn(col.id)} className="text-muted-foreground/30 hover:text-destructive p-0.5">
                                                        <X className="w-2.5 h-2.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout" initial={false}>
                                {rows.map((row, ri) => (
                                    <motion.tr
                                        key={row.id}
                                        layout
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="group/row border-b border-border/10 last:border-0 hover:bg-muted/10 transition-colors"
                                    >
                                        <td className="p-3 px-4 align-top" onClick={() => setActiveCell({ rowId: row.id, colId: null })}>
                                            <div className="flex items-start gap-2">
                                                <AutoSizeTextarea
                                                    value={row.feature}
                                                    shouldFocus={focusTarget === row.id}
                                                    onChange={(val) => updateFeature(row.id, val)}
                                                    onEnter={() => addRow(ri)}
                                                    className="text-[13px] text-foreground/80 bg-transparent outline-none w-full placeholder:text-muted-foreground/25 py-1 leading-relaxed"
                                                    placeholder="Feature name…"
                                                />
                                                {rows.length > 1 && (
                                                    <button
                                                        onClick={() => removeRow(row.id)}
                                                        className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground/30 hover:text-destructive transition-all mt-1.5"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        {columns.map((col) => (
                                            <td key={col.id} className={`p-3 text-center transition-colors ${col.highlighted ? "bg-primary/5" : ""}`} onClick={() => setActiveCell({ rowId: row.id, colId: col.id })}>
                                                <button
                                                    onClick={() => cycleValue(row.id, col.id)}
                                                    className="mx-auto flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                                                >
                                                    {renderValue(row.values[col.id] || "")}
                                                </button>
                                            </td>
                                        ))}
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center gap-4 py-3">
                    <button onClick={() => addRow()} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                        <Plus className="w-3 h-3" /> Add row
                    </button>
                    {columns.length < 6 && (
                        <button onClick={addColumn} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded-lg transition-colors">
                            <Plus className="w-3 h-3" /> Add column
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ComparisonTableBlock;