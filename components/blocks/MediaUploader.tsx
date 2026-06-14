'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Upload, Loader2, HardDrive, Library, X,
    FileText, Music, Video, File as FileIcon, Search, CheckCircle2
} from 'lucide-react';
import { StorageEngine } from '@/lib/storage-engine';
import PersistentImage from './PersistentImage';

// --- TYPES ---
type FileCategory = 'images' | 'videos' | 'audio' | 'pdfs' | 'others';

interface MediaUploaderProps {
    currentValue?: string;
    onUploadComplete: (url: string) => void;
    accept: string;
    placeholder: string;
    icon?: React.ElementType;
}

// --- MAIN COMPONENT ---
export const MediaUploader = ({
    currentValue,
    onUploadComplete,
    accept,
    placeholder,
}: MediaUploaderProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [showLibrary, setShowLibrary] = useState(false);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const storedFileName = await StorageEngine.saveMedia(file);
            onUploadComplete(storedFileName);
        } catch (error) {
            console.error("OPFS Upload failed:", error);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center w-full gap-4">
            <div className="flex flex-col items-center justify-center w-full max-w-md gap-2 px-1">
                <input
                    type="text"
                    placeholder={placeholder}
                    defaultValue={currentValue?.startsWith('http') ? currentValue : ''}
                    className="w-full px-5 py-3 
                           bg-secondary/30 hover:bg-secondary/50 
                           rounded-2xl outline-none 
                           transition-all duration-200
                           text-sm placeholder:text-muted-foreground/50
                           border-none focus:ring-2 focus:ring-primary/20 focus:bg-secondary/60"
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onUploadComplete((e.target as HTMLInputElement).value);
                    }}
                />

                <div className='flex items-center justify-center gap-2'>
                    <button
                        type="button"
                        onClick={() => setShowLibrary(true)}
                        className="flex-1 flex justify-center items-center p-3 
                   bg-secondary/20 hover:bg-secondary/40 
                   rounded-xl transition-all duration-200 
                   text-muted-foreground hover:text-foreground group"
                    >
                        <Library className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                    </button>

                    <label className="flex-1 flex items-center justify-center p-3 
                      bg-secondary/20 hover:bg-secondary/40 
                      rounded-xl cursor-pointer transition-all duration-200 
                      text-muted-foreground hover:text-foreground group">
                        {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <HardDrive className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />}
                        <input type="file" accept={accept} className="hidden" onChange={handleFileChange} disabled={isUploading} />
                    </label>
                </div>
            </div>

            {showLibrary && (
                <MediaLibraryModal
                    onClose={() => setShowLibrary(false)}
                    onSelect={(path) => {
                        onUploadComplete(path);
                        setShowLibrary(false);
                    }}
                />
            )}
        </div>
    );
};

// --- MODAL COMPONENT ---
const MediaLibraryModal = ({ onClose, onSelect }: { onClose: () => void, onSelect: (path: string) => void }) => {
    const [allFiles, setAllFiles] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<FileCategory>('images');
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        StorageEngine.listAllFiles().then(setAllFiles);
    }, []);

    const categories = useMemo(() => ({
        images: allFiles.filter(f => /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(f)),
        videos: allFiles.filter(f => /\.(mp4|webm|mov)$/i.test(f)),
        audio: allFiles.filter(f => /\.(mp3|wav|ogg)$/i.test(f)),
        pdfs: allFiles.filter(f => /\.(pdf)$/i.test(f)),
        others: allFiles.filter(f => !/\.(jpg|jpeg|png|gif|webp|svg|avif|mp4|webm|mov|mp3|wav|ogg|pdf)$/i.test(f))
    }), [allFiles]);

    const filteredItems = useMemo(() => {
        const items = categories[activeTab];
        if (!searchQuery) return items;
        return items.filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [categories, activeTab, searchQuery]);

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-5xl h-[85vh] rounded-[2.5rem] border border-border shadow-2xl flex flex-col overflow-hidden ring-1 ring-black/5">

                {/* Header */}
                <div className="px-8 py-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Library</h2>
                        <p className="text-sm text-muted-foreground">{allFiles.length} local assets</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-8 pb-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex gap-1 bg-secondary/40 p-1 rounded-2xl w-full md:w-auto overflow-x-auto no-scrollbar">
                        {(Object.keys(categories) as FileCategory[]).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 text-sm font-medium rounded-xl capitalize transition-all ${activeTab === tab
                                    ? "bg-card shadow-sm text-foreground ring-1 ring-black/5"
                                    : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Find assets..."
                            className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border-none rounded-2xl text-sm outline-none focus:ring-2 ring-primary/20 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Grid Area */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30">
                            <FileIcon className="w-16 h-16 mb-4" />
                            <p className="text-lg font-medium">No {activeTab} yet</p>
                        </div>
                    ) : activeTab === 'images' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                            {filteredItems.map(item => (
                                <ImageCard key={item} item={item} onSelect={onSelect} />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredItems.map(item => (
                                <FileListItem key={item} item={item} type={activeTab} onSelect={onSelect} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- SUB-COMPONENTS ---

const ImageCard = React.memo(({ item, onSelect }: { item: string, onSelect: (p: string) => void }) => {
    return (
        <div
            onClick={() => onSelect(item)}
            className="group cursor-pointer flex flex-col gap-2"
        >
            <div className="aspect-square relative rounded-[1.5rem] overflow-hidden bg-secondary border border-border/50 group-hover:border-primary/50 group-hover:shadow-xl group-hover:shadow-primary/5 transition-all duration-500">
                <LazyThumbnail path={item} isImage />
                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            <div className="px-1">
                <p className="text-[11px] font-semibold truncate text-foreground/70 group-hover:text-primary transition-colors duration-300">
                    {item.split('-').slice(1).join('-') || item}
                </p>
                <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest italic">
                    {item.split('.').pop()}
                </p>
            </div>
        </div>
    );
});

const FileListItem = React.memo(({ item, type, onSelect }: { item: string, type: FileCategory, onSelect: (p: string) => void }) => (
    <div
        onClick={() => onSelect(item)}
        className="flex items-center p-4 rounded-2xl bg-secondary/30 border border-border/50 hover:border-primary/40 hover:bg-secondary/50 cursor-pointer transition-all gap-4 group"
    >
        <div className="p-3 bg-card rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-300">
            <FileIconType type={type} />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-medium whitespace-normal break-all transition-colors hover:text-primary">
                {item}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">System {type.slice(0, -1)}</p>
        </div>
    </div>
));

const LazyThumbnail = ({ path, isImage }: { path: string, isImage?: boolean }) => {
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '200px' });

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        let isMounted = true;
        StorageEngine.getMediaUrl(path).then(url => {
            if (isMounted && url) setBlobUrl(url);
        });
        return () => {
            isMounted = false;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [isVisible, path]);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center">
            {blobUrl ? (
                <img src={blobUrl} alt="" className="w-full h-full object-cover animate-in fade-in duration-700" />
            ) : (
                <div className="animate-pulse bg-muted w-full h-full" />
            )}
        </div>
    );
};

const FileIconType = ({ type }: { type: FileCategory }) => {
    switch (type) {
        case 'videos': return <Video className="w-5 h-5 text-blue-500" />;
        case 'audio': return <Music className="w-5 h-5 text-purple-500" />;
        case 'pdfs': return <FileText className="w-5 h-5 text-red-500" />;
        default: return <FileIcon className="w-5 h-5 text-zinc-400" />;
    }
};

ImageCard.displayName = "ImageCard";
FileListItem.displayName = "FileListItem";