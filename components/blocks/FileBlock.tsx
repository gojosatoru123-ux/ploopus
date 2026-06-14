import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ExternalLink, FileText, Image, Film, Music, 
  File, Trash2, Eye, EyeOff, AlertTriangle, 
  ChevronDown, Globe
} from "lucide-react";
import { MediaUploader } from "./MediaUploader"; // Path to your component
import { StorageEngine } from "@/lib/storage-engine";

interface FileBlockProps {
  fileUrl: string; // The stored value (URL or OPFS filename)
  fileName: string;
  onUpdate: (updates: { fileUrl?: string; fileName?: string }) => void;
}

type FileType = "pdf" | "image" | "video" | "audio" | "document" | "unknown";

// --- UTILS ---
const detectFileType = (url: string, name: string): FileType => {
  const combined = (url + name).toLowerCase();
  if (/\.(pdf)(\?|$)/.test(combined)) return "pdf";
  if (/\.(jpe?g|png|gif|webp|svg|bmp|ico)(\?|$)/.test(combined)) return "image";
  if (/\.(mp4|webm|ogg|mov)(\?|$)/.test(combined)) return "video";
  if (/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/.test(combined)) return "audio";
  if (/\.(docx?|xlsx?|pptx?|csv|txt|md|rtf)(\?|$)/.test(combined)) return "document";
  return "unknown";
};

const getFileIcon = (type: FileType) => {
  switch (type) {
    case "pdf": return FileText;
    case "image": return Image;
    case "video": return Film;
    case "audio": return Music;
    default: return File;
  }
};

const getFileAccent = (type: FileType) => {
  switch (type) {
    case "pdf": return { bg: "bg-red-500/10", text: "text-red-500", ring: "ring-red-500/20", gradient: "from-red-500/10 to-transparent" };
    case "image": return { bg: "bg-blue-500/10", text: "text-blue-500", ring: "ring-blue-500/20", gradient: "from-blue-500/10 to-transparent" };
    case "video": return { bg: "bg-purple-500/10", text: "text-purple-500", ring: "ring-purple-500/20", gradient: "from-purple-500/10 to-transparent" };
    case "audio": return { bg: "bg-emerald-500/10", text: "text-emerald-500", ring: "ring-emerald-500/20", gradient: "from-emerald-500/10 to-transparent" };
    default: return { bg: "bg-muted/50", text: "text-muted-foreground", ring: "ring-border", gradient: "from-muted/30 to-transparent" };
  }
};

const FileBlock = ({ fileUrl, fileName, onUpdate }: FileBlockProps) => {
  const [showPreview, setShowPreview] = useState(true);
  const [hover, setHover] = useState(false);

  const fileType = detectFileType(fileUrl, fileName);
  const Icon = getFileIcon(fileType);
  const accent = getFileAccent(fileType);

  // --- EMPTY STATE ---
  if (!fileUrl) {
    return (
      <div className="py-3">
        <div className="relative rounded-[24px] border-2 border-dashed border-border/40 p-10 flex flex-col items-center bg-muted/3 transition-all hover:border-primary/20">
          <div className="w-16 h-16 rounded-[18px] bg-muted/20 flex items-center justify-center mb-6">
            <Globe className="w-7 h-7 text-muted-foreground/30" />
          </div>
          
          <MediaUploader 
            currentValue={fileUrl}
            accept="*/*"
            placeholder="Paste file URL..."
            onUploadComplete={(newUrlOrName) => {
              // Note: If we had access to the File object here, we could set the actual name.
              // For now, we derive a fallback name from the string.
              const name = newUrlOrName.split('/').pop()?.split('-').pop() || "Attached File";
              onUpdate({ fileUrl: newUrlOrName, fileName: name });
            }}
          />
        </div>
      </div>
    );
  }

  // --- FILLED STATE ---
  return (
    <div className="py-3">
      <motion.div 
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="group relative border border-border/50 rounded-[24px] bg-card shadow-sm overflow-hidden"
      >
        <div className="flex items-center gap-4 p-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent.bg} ${accent.ring} ring-1`}>
            <Icon className={`w-5 h-5 ${accent.text}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-[14px] truncate">{fileName}</h4>
              {!fileUrl.startsWith("http") && (
                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary">OPFS Local</span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/40 font-mono truncate">{fileUrl}</p>
          </div>

          <AnimatePresence>
            {hover && (
              <motion.div initial={{ opacity: 0, x: 5 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1">
                <button onClick={() => setShowPreview(!showPreview)} className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><EyeOff className="w-4 h-4" /></button>
                <button onClick={() => onUpdate({ fileUrl: "", fileName: "" })} className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full py-2 text-[11px] font-medium text-muted-foreground/30 border-t border-border/10 hover:bg-muted/50 flex items-center justify-center gap-1"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${showPreview ? "rotate-180" : ""}`} />
          {showPreview ? "Hide Preview" : "Show Preview"}
        </motion.button>

        <AnimatePresence>
          {showPreview && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
               {/* 
                  IMPORTANT: We pass fileUrl to the preview. 
                  Inside your preview logic, you'll need the same 'resolve' 
                  logic found in MediaUploader to show the actual image/video.
               */}
               <div className="p-4 pt-0">
                  <FilePreviewRenderer url={fileUrl} type={fileType} name={fileName} />
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// --- PREVIEW RENDERER (With OPFS Resolution) ---
const FilePreviewRenderer = ({ url, type, name }: { url: string, type: FileType, name: string }) => {
  const [resolved, setResolved] = useState<string>("");

  useEffect(() => {
    if (url.startsWith('http') || url.startsWith('blob:')) {
        const youtubeMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
        const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
        if (youtubeMatch) setResolved(`https://www.youtube.com/embed/${youtubeMatch[1]}`);
        else if (vimeoMatch) setResolved(`https://player.vimeo.com/video/${vimeoMatch[1]}`);
        else setResolved(url);
    } else {
      StorageEngine.getMediaUrl(url).then(u => u && setResolved(u));
    }
  }, [url]);

  if (!resolved) return <div className="h-20 animate-pulse bg-muted rounded-xl" />;

  switch (type) {
    case "image": return <img src={resolved} alt={name} className="w-full rounded-xl max-h-125 object-contain bg-black/5" />;
    case "video": return <video src={resolved} controls className="w-full rounded-xl aspect-video bg-black" />;
    case "audio": return <audio src={resolved} controls className="w-full p-2" />;
    default: return (
      <iframe src={resolved} className="w-full h-100 rounded-xl border border-border/20 bg-white" title={name} />
    );
  }
};

export default FileBlock;