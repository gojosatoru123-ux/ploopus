"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Image, Video } from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  type: string;
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: UploadedFile[];
}

const FileUploadModal = ({ isOpen, onClose, files }: FileUploadModalProps) => {
  const getFileIcon = (type: string) => {
    if (type.includes("image")) return Image;
    if (type.includes("video")) return Video;
    return FileText;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card rounded-2xl shadow-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Upload Your File</h3>
              <motion.button
                onClick={onClose}
                className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </motion.button>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* File List */}
              <div className="space-y-2 mb-4">
                {files.map((file, index) => {
                  const Icon = getFileIcon(file.type);
                  return (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Upload Area */}
              <motion.div
                className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Image className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="p-2 rounded-lg bg-muted">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="w-px h-6 bg-border" />
                  <div className="p-2 rounded-lg bg-muted">
                    <Video className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">Photo documents and audio</p>
                <p className="text-sm text-primary font-medium underline underline-offset-2">
                  Click or drag to upload
                </p>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FileUploadModal;