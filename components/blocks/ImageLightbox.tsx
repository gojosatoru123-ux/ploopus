"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { StorageEngine } from "@/lib/storage-engine";

interface ImageLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: { url: string; caption?: string }[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

/**
 * Helper component to resolve image paths inside the lightbox.
 * This handles both web URLs and persistent OPFS filenames.
 */
const LightboxImage = ({ url, alt }: { url: string; alt: string }) => {
  const [resolved, setResolved] = useState<string>("");

  useEffect(() => {
    let currentBlob: string | null = null;

    async function resolve() {
      if (!url) return;
      // Use direct URL if it's a web link or already a blob
      if (url.startsWith('http') || url.startsWith('blob:')) {
        setResolved(url);
      } else {
        // Fetch the persistent file from OPFS
        const blobUrl = await StorageEngine.getMediaUrl(url);
        if (blobUrl) {
          currentBlob = blobUrl;
          setResolved(blobUrl);
        }
      }
    }
    resolve();

    // Cleanup the temporary blob URL when moving to next image or closing
    return () => {
      if (currentBlob) URL.revokeObjectURL(currentBlob);
    };
  }, [url]);

  if (!resolved) {
    return (
      <div className="w-[50vw] h-[50vh] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={alt}
      className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
    />
  );
};

const ImageLightbox = ({ isOpen, onClose, images, currentIndex, onNavigate }: ImageLightboxProps) => {
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const handlePrev = () => {
    onNavigate(currentIndex > 0 ? currentIndex - 1 : images.length - 1);
  };

  const handleNext = () => {
    onNavigate(currentIndex < images.length - 1 ? currentIndex + 1 : 0);
  };

  // Global keyboard listeners for navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasMultiple) handlePrev();
      if (e.key === "ArrowRight" && hasMultiple) handleNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, hasMultiple]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 bg-black/95 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-110"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Navigation UI */}
          {hasMultiple && (
            <>
              <div className="absolute top-4 left-4 px-4 py-2 bg-white/10 rounded-full text-white text-sm">
                {currentIndex + 1} / {images.length}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-110"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-110"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Image Content */}
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <LightboxImage
              url={currentImage?.url}
              alt={currentImage?.caption || "Enlarged image"}
            />

            {currentImage?.caption && (
              <p className="mt-4 text-white/80 text-center max-w-lg">{currentImage.caption}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageLightbox;