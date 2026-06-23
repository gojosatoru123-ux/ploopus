"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Play, Layers, Trash2, Edit2, Check, X, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FlashcardDeck, FlashcardItem } from "@/lib/types";
import FlashcardStudyMode from "@/components/utility/FlashcardStudyMode";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { StorageEngine } from "@/lib/storage-engine";
import { SyncStatusIndicator } from "@/components/utility/SyncStatusIndicator";

const cardColors = [
  { name: "yellow", bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-300 dark:border-yellow-700", text: "text-yellow-900 dark:text-yellow-100" },
  { name: "green", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-900 dark:text-emerald-100" },
  { name: "blue", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-300 dark:border-blue-700", text: "text-blue-900 dark:text-blue-100" },
  { name: "purple", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-300 dark:border-purple-700", text: "text-purple-900 dark:text-purple-100" },
  { name: "pink", bg: "bg-pink-100 dark:bg-pink-900/30", border: "border-pink-300 dark:border-pink-700", text: "text-pink-900 dark:text-pink-100" },
  { name: "orange", bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-300 dark:border-orange-700", text: "text-orange-900 dark:text-orange-100" },
];

const FlashcardsPage = () => {
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [studyMode, setStudyMode] = useState<{ cards: FlashcardItem[]; title: string } | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null); // Added for card confirmation
  const [editingDeckName, setEditingDeckName] = useState("");
  const [newDeckName, setNewDeckName] = useState("");
  const [showNewDeck, setShowNewDeck] = useState(false);

  useEffect(() => {
    const initAndLoad = async () => {
      setIsLoading(true);
      try {
        const storedDecks = await StorageEngine.loadDecks();
        setDecks((storedDecks as unknown as FlashcardDeck[]) || []);
      } catch (error) {
        console.error("Failed to load decks:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initAndLoad();

    const handleExternalUpdate = () => initAndLoad();
    window.addEventListener("opfs-data-restored", handleExternalUpdate);
    return () => window.removeEventListener("opfs-data-restored", handleExternalUpdate);
  }, []);

  const syncToStorage = (updatedDecks: FlashcardDeck[]) => {
    setDecks(updatedDecks);
    StorageEngine.saveSlideDebounced(updatedDecks as any);
  };

  const totalCardsCount = useMemo(() => {
    return decks.reduce((acc, d) => acc + d.cards.length, 0);
  }, [decks]);

  const createDeck = () => {
    if (!newDeckName.trim()) return;
    const newDeck: FlashcardDeck = {
      id: crypto.randomUUID(),
      name: newDeckName.trim(),
      cards: [],
      createdAt: new Date().toISOString(),
    };
    syncToStorage([...decks, newDeck]);
    setNewDeckName("");
    setShowNewDeck(false);
  };

  const confirmDeleteDeck = (deckId: string) => {
    syncToStorage(decks.filter(d => d.id !== deckId));
    setDeletingDeckId(null);
  };

  const renameDeck = (deckId: string) => {
    if (!editingDeckName.trim()) return;
    const updated = decks.map(d =>
      d.id === deckId ? { ...d, name: editingDeckName.trim() } : d
    );
    syncToStorage(updated);
    setEditingDeckId(null);
    setEditingDeckName("");
  };

  const addCardToDeck = (deckId: string) => {
    const newCard: FlashcardItem = {
      id: crypto.randomUUID(),
      content: "",
      color: cardColors[Math.floor(Math.random() * cardColors.length)].name,
    };
    const updated = decks.map(d =>
      d.id === deckId ? { ...d, cards: [...d.cards, newCard] } : d
    );
    syncToStorage(updated);
  };

  const updateCard = (deckId: string, cardId: string, content: string) => {
    const updated = decks.map(d =>
      d.id === deckId
        ? { ...d, cards: d.cards.map(c => c.id === cardId ? { ...c, content } : c) }
        : d
    );
    syncToStorage(updated);
  };

  const confirmDeleteCard = (deckId: string, cardId: string) => {
    const updated = decks.map(d =>
      d.id === deckId
        ? { ...d, cards: d.cards.filter(c => c.id !== cardId) }
        : d
    );
    syncToStorage(updated);
    setDeletingCardId(null);
  };

  const changeCardColor = (deckId: string, cardId: string) => {
    const updated = decks.map(d => {
      if (d.id !== deckId) return d;
      return {
        ...d,
        cards: d.cards.map(c => {
          if (c.id !== cardId) return c;
          const currentIndex = cardColors.findIndex(col => col.name === c.color);
          const nextIndex = (currentIndex + 1) % cardColors.length;
          return { ...c, color: cardColors[nextIndex].name };
        }),
      };
    });
    syncToStorage(updated);
  };

  const getCardStyle = (colorName: string) => {
    const color = cardColors.find(c => c.name === colorName) || cardColors[0];
    return `${color.bg} ${color.border} ${color.text}`;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-y-auto scrollbar-thin">
      <ScrollArea className="flex-1">
        <div className="max-w-7xl mx-auto p-2 sm:p-8 space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 border-b border-border pb-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Flashcards</h1>
                  <p className="text-muted-foreground mt-1">
                    {totalCardsCount} cards across {decks.length} decks
                  </p>
                </div>
                <SyncStatusIndicator />
              </div>
            </div>
          </motion.div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">Your Decks</h2>
              </div>
              <motion.button
                onClick={() => setShowNewDeck(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Plus className="w-4 h-4" />
                New Deck
              </motion.button>
            </div>

            <AnimatePresence>
              {showNewDeck && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-muted">
                    <input
                      type="text"
                      value={newDeckName}
                      onChange={(e) => setNewDeckName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createDeck()}
                      placeholder="Deck name..."
                      className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                      autoFocus
                    />
                    <button onClick={createDeck} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setShowNewDeck(false); setNewDeckName(""); }} className="p-1.5 rounded-lg bg-muted-foreground/20 hover:bg-muted-foreground/30">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              {decks.map((deck) => {
                const isDeckDeleting = deletingDeckId === deck.id;

                return (
                  <motion.div
                    key={deck.id}
                    className="p-4 rounded-2xl border border-border bg-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      {editingDeckId === deck.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingDeckName}
                            onChange={(e) => setEditingDeckName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && renameDeck(deck.id)}
                            className="flex-1 bg-transparent outline-none text-foreground font-semibold"
                            autoFocus
                          />
                          <button onClick={() => renameDeck(deck.id)} className="p-1 rounded hover:bg-muted">
                            <Check className="w-4 h-4 text-green-500" />
                          </button>
                          <button onClick={() => setEditingDeckId(null)} className="p-1 rounded hover:bg-muted">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <h3 className="font-semibold text-foreground">{deck.name}</h3>
                            <p className="text-sm text-muted-foreground">{deck.cards.length} cards</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {deck.cards.length > 0 && !isDeckDeleting && (
                              <motion.button
                                onClick={() => setStudyMode({ cards: deck.cards, title: deck.name })}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Play className="w-4 h-4" />
                              </motion.button>
                            )}
                            {!isDeckDeleting && (
                              <motion.button
                                onClick={() => { setEditingDeckId(deck.id); setEditingDeckName(deck.name); }}
                                className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Edit2 className="w-4 h-4" />
                              </motion.button>
                            )}

                            <AnimatePresence mode="wait">
                              {isDeckDeleting ? (
                                <motion.div
                                  key="confirm"
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.8 }}
                                  className="flex items-center gap-1 bg-destructive/10 p-1 rounded-lg"
                                >
                                  <button
                                    onClick={() => confirmDeleteDeck(deck.id)}
                                    className="p-1.5 rounded-md bg-destructive text-white hover:bg-destructive/90"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingDeckId(null)}
                                    className="p-1.5 rounded-md bg-muted text-foreground border border-border"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </motion.div>
                              ) : (
                                <motion.button
                                  key="trash"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  onClick={() => setDeletingDeckId(deck.id)}
                                  className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {deck.cards.map((card) => {
                        const isCardDeleting = deletingCardId === card.id;

                        return (
                          <motion.div
                            key={card.id}
                            className={`relative p-3 rounded-xl border-2 ${getCardStyle(card.color)} min-h-20 group`}
                            whileHover={{ scale: 1.02 }}
                          >
                            <textarea
                              value={card.content}
                              onChange={(e) => updateCard(deck.id, card.id, e.target.value)}
                              placeholder="Add note..."
                              className="w-full h-full bg-transparent outline-none text-sm resize-none placeholder:text-muted-foreground/50"
                            />
                            <div className="absolute top-1 right-1 flex gap-1">
                              <AnimatePresence mode="wait">
                                {isCardDeleting ? (
                                  <motion.div
                                    key="card-confirm"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex gap-1 bg-background/90 p-1 rounded-full shadow-sm border border-destructive/20"
                                  >
                                    <button
                                      onClick={() => confirmDeleteCard(deck.id, card.id)}
                                      className="p-1 rounded-full bg-destructive text-white hover:bg-destructive/90"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingCardId(null)}
                                      className="p-1 rounded-full bg-muted text-foreground hover:bg-muted-foreground/10"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="card-actions"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"
                                  >
                                    <button onClick={() => changeCardColor(deck.id, card.id)} className="p-1 rounded-full bg-background/80 hover:bg-background">
                                      <div className={`w-3 h-3 rounded-full ${cardColors.find(c => c.name === card.color)?.bg || 'bg-yellow-200'}`} />
                                    </button>
                                    <button
                                      onClick={() => setDeletingCardId(card.id)}
                                      className="p-1 rounded-full bg-background/80 hover:bg-destructive/20"
                                    >
                                      <X className="w-3.5 h-3.5 text-destructive" />
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </motion.div>
                        );
                      })}
                      <motion.button
                        onClick={() => addCardToDeck(deck.id)}
                        className="p-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 min-h-20 flex items-center justify-center transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Plus className="w-5 h-5 text-muted-foreground" />
                      </motion.button>
                    </div>
                  </motion.div>
                );
              })}

              {decks.length === 0 && !showNewDeck && (
                <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No decks yet</p>
                  <motion.button
                    onClick={() => setShowNewDeck(true)}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Create your first deck
                  </motion.button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <AnimatePresence>
        {studyMode && (
          <FlashcardStudyMode
            flashcards={studyMode.cards}
            title={studyMode.title}
            onClose={() => setStudyMode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default FlashcardsPage;