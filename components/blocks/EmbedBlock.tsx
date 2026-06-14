'use client'

import { NoteBlock } from "@/lib/types";
import { Globe, Info, Maximize2, X } from "lucide-react";
import { useState } from "react";
import EmbedBlockInfo from "../utility/EmbedBlockInfo";
interface EmbedBlockProps {
    block: NoteBlock;
    updateBlock: (id: string, updates: Partial<NoteBlock>) => void;
    getEmbedUrl: (url: string) => string | null | undefined
}

const EmbedBlock = ({ block, updateBlock, getEmbedUrl }: EmbedBlockProps) => {

    const [isExtended, setIsExtended] = useState(false);
    const embedUrl = getEmbedUrl(block.embedUrl || '') || block.embedUrl;

    return (
        <div className="py-2">
            {embedUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border/80 shadow-sm bg-background transition-all duration-300 hover:shadow-md group">
                    {/* Iframe Frame Container */}
                    <div className="relative w-full h-100 bg-black/2 dark:bg-white/2">
                        <iframe
                            src={embedUrl}
                            className="w-full h-full border-none"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                            allowFullScreen
                        />

                        {/* Apple-styled Hover Action Overlay */}
                        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 sequential-all">
                            <button
                                onClick={() => setIsExtended(true)}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-background/80 dark:bg-muted/80 backdrop-blur-md border border-border/60 shadow-sm text-muted-foreground hover:text-foreground hover:scale-105 active:scale-95 transition-all duration-150"
                                title="Expand View"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Clean Sub-Footer Bar */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 dark:bg-muted/10 border-t border-border/60 text-[11px] tracking-wide">
                        <span className="truncate max-w-[70%] text-muted-foreground/80 font-medium">{block.embedUrl}</span>
                        <button
                            onClick={() => updateBlock(block.id, { embedUrl: undefined })}
                            className="text-destructive/80 hover:text-destructive hover:underline font-medium transition-colors duration-150"
                        >
                            Remove
                        </button>
                    </div>

                    {/* Extended Immersive Modal (Apple Styled) */}
                    {isExtended && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/30 dark:bg-black/60 backdrop-blur-xl animate-in fade-in duration-200">
                            <div className="relative w-full max-w-6xl h-[85vh] bg-background border border-border/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 timing-cubic-bezier(0.16, 1, 0.3, 1)">

                                {/* Modal Header */}
                                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 bg-muted/20 backdrop-blur-md">
                                    <div className="flex items-center space-x-2">
                                        {/* Apple Style Window Controls (Decorative) */}
                                        <div className="w-3 h-3 rounded-full bg-[#FF5F56] opacity-80" />
                                        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] opacity-80" />
                                        <div className="w-3 h-3 rounded-full bg-[#27C93F] opacity-80" />
                                        <span className="text-xs font-medium text-muted-foreground pl-2 truncate max-w-md">
                                            {block.embedUrl}
                                        </span>
                                    </div>

                                    {/* Close button */}
                                    <button
                                        onClick={() => setIsExtended(false)}
                                        className="flex items-center justify-center w-7 h-7 rounded-full bg-muted/60 dark:bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors duration-150"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Extended Live Iframe Viewer */}
                                <div className="flex-1 bg-black/1">
                                    <iframe
                                        src={embedUrl}
                                        className="w-full h-full border-none"
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                /* Empty State Dropzone with Hover Info Micro-popup */
                <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-8 text-center">
                    <EmbedBlockInfo type="all" />
                    <Globe className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">Embed external content</p>
                    <input
                        type="text"
                        placeholder="Paste embed URL (Figma, CodePen, etc.)..."
                        className="w-full max-w-md mx-auto px-4 py-2 bg-muted/50 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                updateBlock(block.id, { embedUrl: (e.target as HTMLInputElement).value });
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
}
export default EmbedBlock;