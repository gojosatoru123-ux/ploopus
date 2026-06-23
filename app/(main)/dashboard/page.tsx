"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StickyNote, Clock, FolderOpen, Plus, ArrowRight, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useNotesContext } from "@/contexts/NotesContext";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { NoteIndex } from "@/lib/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SyncStatusIndicator } from "@/components/utility/SyncStatusIndicator";
import { StorageEngine } from "@/lib/storage-engine";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const router = useRouter();
  const [isRestoring, setIsRestoring] = useState(false);

  const {
    isInitialized,
    noteIndexes,
    folders,
    getRecentNoteIndexes,
    createNoteIndex
  } = useNotesContext();

  const recentNoteIndexes = getRecentNoteIndexes
    ? getRecentNoteIndexes(6)
    : [];

  const stats = [
    {
      label: "Total Notes",
      value: noteIndexes.length,
      icon: StickyNote,
    },
    {
      label: "Folders",
      value: folders.length,
      icon: FolderOpen,
    },
  ];

  const handleQuickNote = () => {
    const noteId = createNoteIndex();
    router.push(`/note/ideas/${noteId}`);
  };

  if (!isInitialized) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full bg-background overflow-y-auto scrollbar-thin">
      <div className="max-w-7xl mx-auto p-2 sm:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-10 border-b border-border pb-4 pt-2"
        >
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back! 👋
              </h1>
              <p className="text-muted-foreground text-sm">
                Here's what's happening with your notes
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats & Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat) => (
            <motion.div
              key={stat.label}
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="bg-card rounded-xl p-5 border border-border shadow-sm hover:shadow-md transition-all"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-linear-to-br from-primary/20 to-primary/5 border border-primary/10">
                <stat.icon className="w-5 h-5 text-primary" />
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stat.value}
              </p>
              <p className="text-sm text-muted-foreground">
                {stat.label}
              </p>
            </motion.div>
          ))}
          
          <motion.button
            onClick={handleQuickNote}
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.97 }}
            className="bg-linear-to-br from-primary/15 to-primary/5 hover:from-primary/20 hover:to-primary/10 rounded-xl p-5 border border-primary/20 shadow-sm flex flex-col items-center justify-center gap-2 transition-all"
          >
            <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary">
              Quick Note
            </p>
          </motion.button>

          <Link href="/note/ideas">
            <motion.div
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.97 }}
              className="bg-card hover:bg-muted rounded-xl p-5 border border-border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer h-full"
            >
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                All Notes
              </p>
            </motion.div>
          </Link>
        </div>
        
        {/* Recent Notes Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Recent Notes
              </h2>
              <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
              <SyncStatusIndicator />
              
              {/* Manual Restore Button */}
            </div>
            
            <Link
              href="/note/ideas"
              className="text-sm text-primary hover:underline"
            >
              View all
            </Link>
          </div>

          {recentNoteIndexes.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-10 text-center flex flex-col items-center">
              <StickyNote className="w-14 h-14 text-muted-foreground/60 mb-4" />
              <p className="text-muted-foreground mb-5">
                No notes yet
              </p>
              <motion.button
                onClick={handleQuickNote}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium"
              >
                Create your first note
              </motion.button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentNoteIndexes.map((noteIndex: NoteIndex, index: number) => (
                <Link
                  key={noteIndex.id}
                  href={`/note/ideas/${noteIndex.id}`}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                    whileHover={{ y: -3 }}
                    className="group bg-card rounded-xl border border-border p-5 cursor-pointer hover:border-primary/40 hover:shadow-lg transition-all h-full"
                  >
                    <h3 className="font-medium text-foreground truncate mb-2 group-hover:text-primary transition-colors">
                      {noteIndex.title || "Untitled"}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Last edited{" "}
                      {formatDistanceToNow(
                        new Date(noteIndex.updatedAt),
                        { addSuffix: true }
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {noteIndex.tags?.slice(0, 2).map((tag: any) => (
                        <span
                          key={tag.id}
                          className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
export default Dashboard;