'use client';

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, Plus, Trash2, FolderOpen, StickyNote, X, ArrowLeft, Check, Search, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNotesContext } from "@/contexts/NotesContext";
import { SidebarTrigger } from "@/components/ui/sidebar";

// Animation Variants for the staggered list
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 }
  },
};


const FolderPage = () => {
  const router = useRouter();
  const {
    isInitialized,
    folders,
    createFolder,
    deleteFolder,
    createNoteIndex,
    getNoteIndexesForFolder
  } = useNotesContext();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  // Mobile Sidebar State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const filteredFolders = useMemo(() => {
    return folders.filter((f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [folders, searchQuery]);

  const getFolderStyle = (folderId: string) => {
    const styles = [
      { bg: "bg-emerald-500/10", text: "text-emerald-500" },
      { bg: "bg-blue-500/10", text: "text-blue-500" },
      { bg: "bg-purple-500/10", text: "text-purple-500" },
      { bg: "bg-orange-500/10", text: "text-orange-500" },
      { bg: "bg-pink-500/10", text: "text-pink-500" },
    ];
    const index = folderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return styles[index % styles.length];
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const folderNotes = useMemo(() =>
    selectedFolderId ? getNoteIndexesForFolder(selectedFolderId) : [],
    [selectedFolderId, folders, getNoteIndexesForFolder]
  );

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName("");
    setShowCreateModal(false);
  };

  if (!isInitialized) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background relative">

      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* LEFT COLUMN: Folder Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0 lg:w-80 shrink-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Folders</h2>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsSearching(!isSearching);
                  if (isSearching) setSearchQuery("");
                }}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                {isSearching ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </button>
              {/* Mobile Close Button */}
              <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2">
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSearching && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="mt-2 overflow-hidden"
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search folders..."
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border outline-none text-sm"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <AnimatePresence mode="wait">
            <motion.div key={`${searchQuery}-${folders.length}`} variants={containerVariants} initial="hidden" animate="visible">
              {filteredFolders.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">No folders.</div>
              ) : (
                filteredFolders.map((folder) => {
                  const isDeleting = deletingFolderId === folder.id;
                  const isActive = selectedFolderId === folder.id;
                  const style = getFolderStyle(folder.id);

                  return (
                    <motion.div
                      key={folder.id}
                      variants={itemVariants}
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setIsMobileMenuOpen(false); // Close sidebar on mobile after selection
                      }}
                      className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isActive ? "bg-primary/10" : "hover:bg-muted"}`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${style.bg} ${style.text}`}>
                        {isActive ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${isActive ? "text-primary" : ""}`}>{folder.name}</p>
                        <p className="text-xs text-muted-foreground">{getNoteIndexesForFolder(folder.id).length} notes</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center pr-1">
                          <AnimatePresence mode="wait">
                            {isDeleting ? (
                              <motion.div key="confirm" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteFolder(folder.id);
                                    setDeletingFolderId(null);
                                    if (isActive) setSelectedFolderId(null);
                                  }}
                                  className="p-1.5 rounded-md bg-destructive text-white shadow-sm"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeletingFolderId(null); }}
                                  className="p-1.5 rounded-md bg-muted border border-border"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </motion.div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeletingFolderId(folder.id); }}
                                className="p-2 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="p-4 border-t border-border">
          <button onClick={() => setShowCreateModal(true)} className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            <span className="font-medium">New Folder</span>
          </button>
        </div>
      </aside>

      {/* RIGHT CONTENT AREA */}
      <main className="flex-1 h-full bg-background overflow-y-auto flex flex-col">
        {/* MOBILE HEADER (Only visible on mobile) */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -ml-2">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold text-sm uppercase tracking-widest opacity-50">Collections</span>
          <div className="w-10" /> {/* Spacer for centering */}
        </header>

        <div className="p-4 md:p-8 max-w-5xl mx-auto w-full">
          <AnimatePresence mode="wait">
            {selectedFolder ? (
              <motion.div key={selectedFolder.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground">{selectedFolder.name}</h1>
                    <p className="text-muted-foreground mt-2 flex items-center gap-2">
                      <StickyNote className="w-4 h-4" />
                      {folderNotes.length} notes found
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const noteId = createNoteIndex(selectedFolder.id);
                      router.push(`/note/ideas/${noteId}`);
                    }}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium shadow-lg"
                  >
                    <Plus className="w-5 h-5" />
                    New Note
                  </button>
                </div>

                {folderNotes.length === 0 ? (
                  <div className="py-20 border-2 border-dashed border-border rounded-3xl text-center">
                    <p className="text-muted-foreground">This folder is empty</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {folderNotes.map((note, idx) => (
                      <Link key={note.id} href={`/note/ideas/${note.id}`}>
                        <div className="p-5 rounded-2xl border border-border bg-card hover:border-primary transition-all">
                          <h3 className="font-semibold truncate">{note.title || "Untitled"}</h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(note.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="flex-1 h-screen flex flex-col items-center justify-center text-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-center"
                >
                  <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h2 className="text-xl font-semibold">Select a collection</h2>
                  <p className="text-muted-foreground mb-4">
                    Choose a folder from the list or create a new one
                  </p>
                  <motion.button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Create new folder
                  </motion.button>
                  <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="lg:hidden mt-4 text-primary font-medium"
                  >
                    Browse Folders
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main >

      {/* CREATE FOLDER MODAL */}
      <AnimatePresence>
        {
          showCreateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-background/40 backdrop-blur-md"
                onClick={() => setShowCreateModal(false)}
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl p-8"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold">New Folder</h3>
                  <button onClick={() => setShowCreateModal(false)} className="p-2 rounded-full hover:bg-muted transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Name your category..."
                  className="w-full px-4 py-4 rounded-2xl bg-muted/50 border border-border outline-none mb-8 focus:ring-2 ring-primary/20 transition-all text-lg"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3.5 rounded-2xl border border-border font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateFolder}
                    className="flex-1 py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
                  >
                    Create Folder
                  </button>
                </div>
              </motion.div>
            </div>
          )
        }
      </AnimatePresence >
    </div >
  );
};

export default FolderPage;