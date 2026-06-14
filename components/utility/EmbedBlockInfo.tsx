import { Info } from "lucide-react"

interface EmbedBlockInfoProps {
    type: "video" | "audio" | "design" | "document" | "code" | "wiki" | "all" | string;
}

const EmbedBlockInfo = ({ type }: EmbedBlockInfoProps) => {
    // Lowercase the type to prevent case-sensitive mismatches
    const currentType = type?.toLowerCase();

    // Determine visibility conditions
    const showAll = currentType === "all" || !currentType;
    const showVideo = showAll || currentType === "video";
    const showAudio = showAll || currentType === "audio";
    const showDesign = showAll || currentType === "design";
    const showDocument = showAll || currentType === "document" || currentType === "documents";
    const showCode = showAll || currentType === "code" || currentType === "developer";
    const showWiki = showAll || currentType === "wiki" || currentType === "spaces";

    return (
        <>
            {/* Info Trigger Top Right */}
            <div className="absolute top-5 right-3 group/info">
                {/* Trigger Button with Smooth Rotation/Scale on Hover */}
                <div className="cursor-pointer p-1.5 rounded-full bg-muted/40 hover:bg-muted/80 text-muted-foreground/50 hover:text-foreground border border-transparent hover:border-border/40 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm backdrop-blur-sm">
                    <Info className="w-3.5 h-3.5" />
                </div>

                {/* Apple-styled Glassmorphism Flyout */}
                <div className="absolute top-8 right-0 pointer-events-none opacity-0 scale-95 origin-top-right group-hover/info:opacity-100 group-hover/info:scale-100 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 w-72 p-4 bg-background/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-zinc-800/50 shadow-[0_10px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] rounded-2xl text-left">

                    {/* Minimalist Header */}
                    <div className="flex items-center space-x-1.5 mb-3 pb-2 border-b border-border/40">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                        <p className="font-semibold text-foreground/80 tracking-widest uppercase text-[9px]">
                            {showAll ? "Supported Integrations" : "Supported Integration"}
                        </p>
                    </div>

                    {/* Elegant Grid System */}
                    <div className="space-y-2.5">
                        {/* Category: Video */}
                        {showVideo && (
                            <div className="flex items-start space-x-3 group/item">
                                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-red-500/10 text-red-500 dark:text-red-400 text-[10px] font-bold">
                                    ▶
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-medium text-foreground tracking-tight leading-none mb-0.5">Media & Video</h4>
                                    <p className="text-[10px] text-muted-foreground/70 font-normal">YouTube, Vimeo, Loom</p>
                                </div>
                            </div>
                        )}

                        {/* Category: Audio */}
                        {showAudio && (
                            <div className="flex items-start space-x-3 group/item">
                                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 text-[10px] font-bold">
                                    ♫
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-medium text-foreground tracking-tight leading-none mb-0.5">Audio Streaming</h4>
                                    <p className="text-[10px] text-muted-foreground/70 font-normal">Spotify, SoundCloud, Podcasts</p>
                                </div>
                            </div>
                        )}

                        {/* Category: Design */}
                        {showDesign && (
                            <div className="flex items-start space-x-3 group/item">
                                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 text-[10px] font-bold">
                                    ✦
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-medium text-foreground tracking-tight leading-none mb-0.5">Design & Whiteboards</h4>
                                    <p className="text-[10px] text-muted-foreground/70 font-normal">Figma, Canva, Miro, Whimsical</p>
                                </div>
                            </div>
                        )}

                        {/* Category: Documents */}
                        {showDocument && (
                            <div className="flex items-start space-x-3 group/item">
                                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-green-500/10 text-green-500 dark:text-green-400 text-[10px] font-bold">
                                    ■
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-medium text-foreground tracking-tight leading-none mb-0.5">Google Workspace</h4>
                                    <p className="text-[10px] text-muted-foreground/70 font-normal">Docs, Sheets, Slides, Forms</p>
                                </div>
                            </div>
                        )}

                        {/* Category: Developer */}
                        {showCode && (
                            <div className="flex items-start space-x-3 group/item">
                                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/10 text-amber-500 dark:text-amber-400 text-[10px] font-bold">
                                    &lt;/&gt;
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-medium text-foreground tracking-tight leading-none mb-0.5">Code Playgrounds</h4>
                                    <p className="text-[10px] text-muted-foreground/70 font-normal">CodeSandbox, JSFiddle, Replit</p>
                                </div>
                            </div>
                        )}

                        {/* Category: Spaces */}
                        {showWiki && (
                            <div className="flex items-start space-x-3 group/item">
                                <div className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-500/10 text-purple-500 dark:text-purple-400 text-[10px] font-bold">
                                    ⬡
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-medium text-foreground tracking-tight leading-none mb-0.5">Wikis & Planning</h4>
                                    <p className="text-[10px] text-muted-foreground/70 font-normal">Notion, Mural, Glitch</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Fine-print Apple-style Footer */}
                    <div className="mt-3.5 pt-2 border-t border-border/30 text-center">
                        <p className="text-[9px] text-muted-foreground/40 font-medium tracking-tight">
                            {currentType && currentType !== "all" 
                                ? `Paste a valid ${currentType} link to preview` 
                                : "Paste any link to auto-detect frame format"}
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}

export default EmbedBlockInfo;