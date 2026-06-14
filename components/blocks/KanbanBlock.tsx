"use client";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { X, PlusCircle, GripVertical } from "lucide-react";
import { NoteBlock } from "@/lib/types";

interface KanbanBlockProps {
  block: NoteBlock;
  updateBlock: (id: string, updates: Partial<NoteBlock>) => void;
}

const KanbanBlock = ({ block, updateBlock }: KanbanBlockProps) => {
  const [dragCard, setDragCard] = useState<{ colIndex: number; cardIndex: number } | null>(null);
  const [dragOverCol, setDragOverCol] = useState<number | null>(null);
  const [dragOverCardIndex, setDragOverCardIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);

  const columns = block.kanbanColumns || [];

  const handleDragStart = (colIndex: number, cardIndex: number, e: React.DragEvent) => {
    setDragCard({ colIndex, cardIndex });
    e.dataTransfer.effectAllowed = "move";
    // Set a transparent drag image
    const el = e.currentTarget as HTMLElement;
    dragNodeRef.current = el as HTMLDivElement;
    e.dataTransfer.setData("text/plain", ""); // Required for Firefox
  };

  const handleDragOver = (colIndex: number, cardIndex: number | null, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colIndex);
    setDragOverCardIndex(cardIndex);
  };

  const handleDragEnd = () => {
    if (dragCard === null || dragOverCol === null) {
      setDragCard(null);
      setDragOverCol(null);
      setDragOverCardIndex(null);
      return;
    }

    const newColumns = columns.map((col) => ({
      ...col,
      cards: [...col.cards],
    }));

    // Remove card from source
    const [movedCard] = newColumns[dragCard.colIndex].cards.splice(dragCard.cardIndex, 1);

    // Insert into target
    const targetIdx = dragOverCardIndex !== null ? dragOverCardIndex : newColumns[dragOverCol].cards.length;
    newColumns[dragOverCol].cards.splice(targetIdx, 0, movedCard);

    updateBlock(block.id, { kanbanColumns: newColumns });
    setDragCard(null);
    setDragOverCol(null);
    setDragOverCardIndex(null);
  };

  return (
    <div className="py-3">
      <div className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {columns.map((column, colIndex) => (
          <div
            key={column.id}
            className={`min-w-50 shrink-0 bg-muted/30 rounded-lg p-3 border transition-colors group/column ${
              dragOverCol === colIndex && dragCard?.colIndex !== colIndex
                ? "border-primary/50 bg-primary/5"
                : "border-border"
            }`}
            onDragOver={(e) => handleDragOver(colIndex, null, e)}
            onDrop={handleDragEnd}
          >
            <div className="flex items-center justify-between mb-3">
              <input
                type="text"
                value={column.title}
                onChange={(e) => {
                  const newColumns = [...columns];
                  newColumns[colIndex] = { ...column, title: e.target.value };
                  updateBlock(block.id, { kanbanColumns: newColumns });
                }}
                className="font-medium text-sm bg-transparent outline-none flex-1"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {column.cards.length}
                </span>
                {columns.length > 1 && (
                  <button
                    onClick={() => {
                      const newColumns = columns.filter((_, i) => i !== colIndex);
                      updateBlock(block.id, { kanbanColumns: newColumns });
                    }}
                    className="opacity-0 group-hover/column:opacity-100 p-1 rounded hover:bg-destructive/10 transition-all shrink-0"
                    title="Delete column"
                  >
                    <X className="w-3 h-3 text-destructive" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2 min-h-10">
              {column.cards.map((card, cardIndex) => (
                <motion.div
                  key={card.id}
                  draggable
                  onDragStart={(e) => handleDragStart(colIndex, cardIndex, e as unknown as React.DragEvent)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDragOver(colIndex, cardIndex, e as unknown as React.DragEvent);
                  }}
                  onDragEnd={handleDragEnd}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{
                    opacity: dragCard?.colIndex === colIndex && dragCard?.cardIndex === cardIndex ? 0.4 : 1,
                    y: 0,
                  }}
                  className={`bg-background p-2.5 rounded-lg border shadow-sm group/card cursor-grab active:cursor-grabbing transition-colors ${
                    dragOverCol === colIndex && dragOverCardIndex === cardIndex
                      ? "border-primary/50 border-t-2"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-1 shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                    <input
                      type="text"
                      value={card.content}
                      onChange={(e) => {
                        const newColumns = [...columns];
                        newColumns[colIndex] = {
                          ...column,
                          cards: column.cards.map((c, i) =>
                            i === cardIndex ? { ...c, content: e.target.value } : c
                          ),
                        };
                        updateBlock(block.id, { kanbanColumns: newColumns });
                      }}
                      className="flex-1 text-sm bg-transparent outline-none"
                      placeholder="Task..."
                    />
                    <button
                      onClick={() => {
                        const newColumns = [...columns];
                        newColumns[colIndex] = {
                          ...column,
                          cards: column.cards.filter((_, i) => i !== cardIndex),
                        };
                        updateBlock(block.id, { kanbanColumns: newColumns });
                      }}
                      className="opacity-0 group-hover/card:opacity-100 p-0.5 hover:bg-destructive/10 rounded transition-all"
                    >
                      <X className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                </motion.div>
              ))}
              <button
                onClick={() => {
                  const newColumns = [...columns];
                  newColumns[colIndex] = {
                    ...column,
                    cards: [...column.cards, { id: crypto.randomUUID(), content: "" }],
                  };
                  updateBlock(block.id, { kanbanColumns: newColumns });
                }}
                className="w-full shrink-0 py-2 text-xs text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              >
                + Add card
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={() => {
            const newColumn = { id: crypto.randomUUID(), title: "New Column", cards: [] as { id: string; content: string }[] };
            updateBlock(block.id, { kanbanColumns: [...columns, newColumn] });
          }}
          className="min-w-37.5 h-fit p-3 border-2 border-dashed border-muted-foreground/20 rounded-lg text-xs text-muted-foreground hover:border-primary/30 transition-colors"
        >
          + Add column
        </button>
      </div>
    </div>
  );
};

export default KanbanBlock;
