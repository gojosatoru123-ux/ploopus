'use client';
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Network, ArrowLeft } from "lucide-react";
import GraphView from "@/components/GraphView";
import { SidebarTrigger } from "@/components/ui/sidebar";

const GraphPage = () => {
  const router = useRouter();
  const handleSelectNote = (noteId: string) => {
    router.push(`/note/ideas/${noteId}`);
  };

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 py-4 border-b border-border bg-card/50 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4">
            <SidebarTrigger/>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Network className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Knowledge Graph</h1>
              <p className="text-sm text-muted-foreground">
                Visualize connections between your notes
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Graph View */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex-1 p-1 sm:p-4"
      >
        <GraphView onSelectNote={handleSelectNote} />
      </motion.div>
    </div>
  );
};

export default GraphPage;
