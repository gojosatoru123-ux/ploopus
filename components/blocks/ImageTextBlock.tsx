'use client';

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, ArrowLeftRight, ZoomIn, Trash2, Upload } from "lucide-react";
// Import your new components
import { MediaUploader } from "./MediaUploader";
import PersistentImage from "./PersistentImage";

// --- ContentEditable div that supports rich text formatting ---
const EditableDiv = ({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    className: string;
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const isFocused = useRef(false);

    useEffect(() => {
        if (ref.current && !isFocused.current) {
            if (ref.current.innerHTML !== value) {
                ref.current.innerHTML = value;
            }
        }
    }, [value]);

    return (
        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={placeholder}
            onFocus={() => { isFocused.current = true; }}
            onBlur={(e) => {
                isFocused.current = false;
                onChange(e.currentTarget.innerHTML);
            }}
            onInput={(e) => onChange(e.currentTarget.innerHTML)}
            className={`w-full bg-transparent outline-none transition-all ${className} empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/25 empty:before:pointer-events-none`}
        />
    );
};

// --- Main ImageTextBlock Component ---
interface ImageTextBlockProps {
    imageUrl: string;
    title: string;
    description: string;
    layout: "imageLeft" | "imageRight";
    onUpdate: (updates: {
        imageTextUrl?: string;
        imageTextTitle?: string;
        imageTextDescription?: string;
        imageTextLayout?: "imageLeft" | "imageRight";
    }) => void;
    onOpenLightbox?: (images: { url: string }[], index: number) => void;
}

const ImageTextBlock = ({
    imageUrl,
    title,
    description,
    layout,
    onUpdate,
    onOpenLightbox
}: ImageTextBlockProps) => {
    const [hoverCard, setHoverCard] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const isLeft = layout === "imageLeft";

    return (
        <div className="py-4">
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative rounded-2xl overflow-hidden bg-card border border-border/20 shadow-sm transition-shadow duration-500"
                onMouseEnter={() => setHoverCard(true)}
                onMouseLeave={() => setHoverCard(false)}
            >
                <div className={`flex flex-col sm:flex-row ${!isLeft ? "sm:flex-row-reverse" : ""} min-h-55`}>

                    {/* IMAGE SECTION */}
                    <div className="sm:w-[45%] relative overflow-hidden bg-muted/30">
                        {imageUrl ? (
                            <div className="relative group/image h-full w-full overflow-hidden">
                                <PersistentImage
                                    src={imageUrl}
                                    alt="Embedded"
                                    className="w-full h-full object-cover min-h-55 cursor-pointer block"
                                    onClick={() => onOpenLightbox?.([{ url: imageUrl }], 0)}
                                />
                                {/* Stability Fix: pointer-events-none added to the overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none">
                                    <div className="flex gap-2 pointer-events-auto">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenLightbox?.([{ url: imageUrl }], 0);
                                            }}
                                            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                                        >
                                            <ZoomIn className="w-4 h-4 text-white" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onUpdate({ imageTextUrl: "" });
                                            }}
                                            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full min-h-55 p-8 transition-colors duration-300">
                                <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">
                                    <ImagePlus className="w-7 h-7 text-muted-foreground/40" />
                                </div>
                                {/* MediaUploader integrated here */}
                                <MediaUploader
                                    currentValue={imageUrl}
                                    accept="image/*"
                                    placeholder="Paste URL or upload..."
                                    onUploadComplete={(newPath) => onUpdate({ imageTextUrl: newPath })}
                                />
                            </div>
                        )}
                    </div>

                    {/* TEXT CONTENT SECTION */}
                    <div className="sm:w-[55%] p-8 flex flex-col justify-center relative">
                        <div className={`absolute top-8 ${isLeft ? "left-8" : "right-8"} w-10 h-1 rounded-full bg-primary/20`} />

                        <EditableDiv
                            value={title}
                            onChange={(val) => onUpdate({ imageTextTitle: val })}
                            className="text-2xl font-bold text-foreground tracking-tight mb-3 mt-4"
                            placeholder="Add a title…"
                        />

                        <EditableDiv
                            value={description}
                            onChange={(val) => onUpdate({ imageTextDescription: val })}
                            className="text-[15px] text-muted-foreground leading-relaxed"
                            placeholder="Write your content here…"
                        />
                    </div>
                </div>

                {/* LAYOUT TOGGLE */}
                <AnimatePresence>
                    {hoverCard && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="absolute top-3 right-3"
                        >
                            <button
                                onClick={() => onUpdate({ imageTextLayout: isLeft ? "imageRight" : "imageLeft" })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-md border border-border/40 text-muted-foreground hover:text-foreground transition-all shadow-md text-xs font-medium"
                            >
                                <ArrowLeftRight className="w-3 h-3" />
                                Swap
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

export default ImageTextBlock;