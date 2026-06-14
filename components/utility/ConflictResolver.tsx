"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConflictResolverProps {
  conflictId: string | null;
  onResolve: (strategy: "local" | "remote" | "both") => void;
}

export const ConflictResolver = ({ conflictId, onResolve }: ConflictResolverProps) => {
  return (
    <Dialog open={!!conflictId}>
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Sync Conflict
          </DialogTitle>
          <DialogDescription>
            The file <strong>{conflictId?.replace("note_", "")}</strong> has been modified on another device. 
            How would you like to resolve this?
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <Button 
            variant="default" 
            onClick={() => onResolve("local")}
            className="justify-start h-auto py-3 px-4 flex-col items-start"
          >
            <span className="font-bold">Keep My Changes</span>
            <span className="text-xs opacity-70">Overwrite the version on Google Drive</span>
          </Button>

          <Button 
            variant="secondary" 
            onClick={() => onResolve("remote")}
            className="justify-start h-auto py-3 px-4 flex-col items-start"
          >
            <span className="font-bold">Use Cloud Version</span>
            <span className="text-xs opacity-70">Discard local changes and download from Drive</span>
          </Button>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onResolve("both")}>
            Keep Both (Save as Copy)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};