"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Shuffle, RotateCcw, Lightbulb, Check } from "lucide-react";
import { FlashcardItem } from "@/lib/types";

interface FlashcardStudyModeProps {
  flashcards: FlashcardItem[];
  title: string;
  onClose: () => void;
}

const cardColors = [
  { name: "yellow", bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-400 dark:border-yellow-600", text: "text-yellow-900 dark:text-yellow-100" },
  { name: "green", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-400 dark:border-emerald-600", text: "text-emerald-900 dark:text-emerald-100" },
  { name: "blue", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-400 dark:border-blue-600", text: "text-blue-900 dark:text-blue-100" },
  { name: "purple", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-400 dark:border-purple-600", text: "text-purple-900 dark:text-purple-100" },
  { name: "pink", bg: "bg-pink-100 dark:bg-pink-900/30", border: "border-pink-400 dark:border-pink-600", text: "text-pink-900 dark:text-pink-100" },
  { name: "orange", bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-400 dark:border-orange-600", text: "text-orange-900 dark:text-orange-100" },
];

const getCardStyle = (colorName: string) => {
  const color = cardColors.find(c => c.name === colorName) || cardColors[0];
  return `${color.bg} ${color.border} ${color.text}`;
};

const FlashcardStudyMode = ({ flashcards, title, onClose }: FlashcardStudyModeProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cards, setCards] = useState(flashcards);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState(0);

  const currentCard = cards[currentIndex];
  const progress = (reviewed.size / cards.length) * 100;

  const goNext = useCallback(() => {
    if (currentIndex < cards.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, cards.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const markReviewed = useCallback(() => {
    if (currentCard) {
      setReviewed(prev => new Set([...prev, currentCard.id]));
      goNext();
    }
  }, [currentCard, goNext]);

  const shuffleCards = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setReviewed(new Set());
  };

  const resetStudy = () => {
    setCards(flashcards);
    setCurrentIndex(0);
    setReviewed(new Set());
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Enter") markReviewed();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, markReviewed, onClose]);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.9,
    }),
  };

  if (cards.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div className="text-center">
          <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">No flashcards to study</h2>
          <p className="text-muted-foreground mb-4">Add some flashcards first!</p>
          <button onClick={onClose} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg">
            Close
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h2 className="font-semibold text-lg">{title}</h2>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={shuffleCards}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Shuffle cards"
          >
            <Shuffle className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={resetStudy}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Reset progress"
          >
            <RotateCcw className="w-5 h-5" />
          </motion.button>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Card Display */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="relative w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentCard.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`w-full min-h-75 p-8 rounded-2xl border-4 shadow-xl flex items-center justify-center ${getCardStyle(currentCard.color)}`}
            >
              <p className="text-2xl md:text-3xl font-medium text-center leading-relaxed">
                {currentCard.content}
              </p>
              {reviewed.has(currentCard.id) && (
                <div className="absolute top-4 right-4">
                  <div className="p-1.5 bg-green-500 rounded-full">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-6 border-t border-border">
        <div className="flex items-center justify-center gap-4">
          <motion.button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="p-3 rounded-xl bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>

          <motion.button
            onClick={markReviewed}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Check className="w-5 h-5" />
            Mark as Reviewed
          </motion.button>

          <motion.button
            onClick={goNext}
            disabled={currentIndex === cards.length - 1}
            className="p-3 rounded-xl bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronRight className="w-6 h-6" />
          </motion.button>
        </div>

        {/* Keyboard hints */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">←</kbd> Previous</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">→</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd> Mark reviewed</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd> Close</span>
        </div>

        {/* Completion message */}
        {reviewed.size === cards.length && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center"
          >
            <p className="text-lg font-semibold text-green-600 dark:text-green-400">
              🎉 All cards reviewed!
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default FlashcardStudyMode;
