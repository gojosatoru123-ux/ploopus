"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Lightbulb, Shuffle, GraduationCap } from "lucide-react";
import { FlashcardItem } from "@/lib/types";

interface FlashcardBlockProps {
  flashcards: FlashcardItem[];
  title: string;
  onChange: (flashcards: FlashcardItem[]) => void;
  onTitleChange: (title: string) => void;
  onOpenStudyMode: () => void;
}

const cardColors = [
  { name: "yellow", bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-300 dark:border-yellow-700", text: "text-yellow-900 dark:text-yellow-100" },
  { name: "green", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-900 dark:text-emerald-100" },
  { name: "blue", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-300 dark:border-blue-700", text: "text-blue-900 dark:text-blue-100" },
  { name: "purple", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-300 dark:border-purple-700", text: "text-purple-900 dark:text-purple-100" },
  { name: "pink", bg: "bg-pink-100 dark:bg-pink-900/30", border: "border-pink-300 dark:border-pink-700", text: "text-pink-900 dark:text-pink-100" },
  { name: "orange", bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-300 dark:border-orange-700", text: "text-orange-900 dark:text-orange-100" },
];

const getCardStyle = (colorName: string) => {
  const color = cardColors.find(c => c.name === colorName) || cardColors[0];
  return `${color.bg} ${color.border} ${color.text}`;
};

const FlashcardBlock = ({ flashcards, title, onChange, onTitleChange, onOpenStudyMode }: FlashcardBlockProps) => {
  const [newCardContent, setNewCardContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const addFlashcard = () => {
    if (!newCardContent.trim()) return;
    const randomColor = cardColors[Math.floor(Math.random() * cardColors.length)].name;
    const newCard: FlashcardItem = {
      id: crypto.randomUUID(),
      content: newCardContent.trim(),
      color: randomColor,
    };
    onChange([...flashcards, newCard]);
    setNewCardContent("");
  };

  const deleteFlashcard = (id: string) => {
    onChange(flashcards.filter(card => card.id !== id));
  };

  const startEditing = (card: FlashcardItem) => {
    setEditingId(card.id);
    setEditContent(card.content);
  };

  const saveEdit = () => {
    if (editingId && editContent.trim()) {
      onChange(flashcards.map(card => 
        card.id === editingId ? { ...card, content: editContent.trim() } : card
      ));
    }
    setEditingId(null);
    setEditContent("");
  };

  const cycleColor = (id: string) => {
    const card = flashcards.find(c => c.id === id);
    if (!card) return;
    const currentIndex = cardColors.findIndex(c => c.name === card.color);
    const nextIndex = (currentIndex + 1) % cardColors.length;
    onChange(flashcards.map(c => 
      c.id === id ? { ...c, color: cardColors[nextIndex].name } : c
    ));
  };

  return (
    <div className="py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-1">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="font-semibold text-lg bg-transparent border-none outline-none text-foreground"
            placeholder="Flashcards"
          />
        </div>
        {flashcards.length > 0 && (
          <motion.button
            onClick={onOpenStudyMode}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <GraduationCap className="w-4 h-4" />
            Study Mode
          </motion.button>
        )}
      </div>

      {/* Flashcards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        <AnimatePresence mode="popLayout">
          {flashcards.map((card) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`relative group p-4 rounded-xl border-2 min-h-25 ${getCardStyle(card.color)} shadow-sm hover:shadow-md transition-shadow`}
            >
              {/* Action buttons - Color and Delete */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => cycleColor(card.id)}
                  className="p-1 rounded-full bg-background/80 hover:bg-background transition-colors"
                  title="Change color"
                >
                  <div className={`w-3 h-3 rounded-full ${cardColors.find(c => c.name === card.color)?.bg || 'bg-yellow-200'}`} />
                </button>
                <button
                  onClick={() => deleteFlashcard(card.id)}
                  className="p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                  title="Delete card"
                >
                  <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>

              {/* Content - Click to edit */}
              {editingId === card.id ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onBlur={saveEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      saveEdit();
                    }
                    if (e.key === "Escape") {
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                  className="w-full h-full min-h-15 bg-transparent border-none outline-none resize-none text-sm font-medium"
                />
              ) : (
                <div
                  onClick={() => startEditing(card)}
                  className="text-sm font-medium cursor-pointer select-none"
                >
                  {card.content}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add new card */}
        <motion.div
          className="relative p-4 rounded-xl border-2 border-dashed border-muted-foreground/30 min-h-25 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors bg-muted/30"
        >
          <textarea
            value={newCardContent}
            onChange={(e) => setNewCardContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                addFlashcard();
              }
            }}
            placeholder="Type a quick note..."
            className="w-full h-full min-h-10 bg-transparent border-none outline-none resize-none text-sm text-center placeholder:text-muted-foreground/50"
          />
          {newCardContent && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={addFlashcard}
              className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className="w-3 h-3" />
              Add
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground text-center">
        Click to edit • Hover to change color • Enter to add new card
      </p>
    </div>
  );
};

export default FlashcardBlock;
