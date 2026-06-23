'use client';

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
    Trash2, HardDrive, Loader2, RefreshCcw, LayoutGrid,
    StickyNote,
    FolderOpen,
    ArrowRight,
    Sparkles,
    Calendar,
    Users
} from "lucide-react";
import JSZip from "jszip";
import { useNotesContext } from "@/contexts/NotesContext";
import { StorageEngine } from "@/lib/storage-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NoteIndex, Folder, FlashcardItem, CalendarEvent, FlashcardDeck } from "@/lib/types";
import { CALENDAR_FILE, FOLDERS_FILE, INDEXES_FILE, MANIFEST_FILE, PLUGINS_INDEXES_FILE, SLIDEDECK_FILE } from "@/lib/constants";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { PluginManifest, PluginNotification } from "@/lib/plugins/types";
import { usePluginContext } from "@/contexts/PluginsContext";

type SyncStatus = 'added' | 'updated' | 'skipped';
interface SyncLogEntry { id: string; title: string; status: SyncStatus; }

// Fixed Animation Variants with strict typing
const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.1
        }
    }
};

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: "spring" as const,
            stiffness: 260,
            damping: 20
        }
    }
};

const Settings = () => {
    const { noteIndexes, folders } = useNotesContext();
    const { pluginIndexes } = usePluginContext();
    const [showClearDialog, setShowClearDialog] = useState(false);
    const [confirmText, setConfirmText] = useState("");
    const [isRestoring, setIsRestoring] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
    const [opfsSize, setOpfsSize] = useState<string>("---");
    const {
        data: session,
        isPending, //loading state
        error, //error object
        refetch //refetch the session
      } = authClient.useSession()

    const updateStorageEstimate = useCallback(async () => {
        try {
            const { usage } = await navigator.storage.estimate();
            if (usage !== undefined) {
                setOpfsSize(usage < 1048576 ? `${(usage / 1024).toFixed(1)} KB` : `${(usage / 1048576).toFixed(2)} MB`);
            }
        } catch (e) { setOpfsSize("0 KB"); }
    }, []);

    useEffect(() => { updateStorageEstimate(); }, [updateStorageEstimate]);

    const handleExportZip = async () => {
        setIsExporting(true);
        const tid = toast.loading("Packaging library...", { position: "top-right" });
        try {
            const zip = new JSZip();
            const root = await navigator.storage.getDirectory();
            const walk = async (dir: FileSystemDirectoryHandle, path: string) => {
                // @ts-ignore
                for await (const entry of dir.values()) {
                    if (entry.kind === 'file') {
                        const file = await (entry as FileSystemFileHandle).getFile();
                        zip.file(`${path}${entry.name}`, file);
                    } else { await walk(entry, `${path}${entry.name}/`); }
                }
            };
            await walk(root, "");
            const blob = await zip.generateAsync({ type: "blob" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `ploopus-backup-${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            toast.success("Backup exported", { id: tid, position: "top-right" });
        } catch (e) { toast.error("Export failed", { id: tid, position: "top-right" }); }
        finally { setIsExporting(false); }
    };

    const restoreMediaFile = async (fileName: string, zipFile: JSZip.JSZipObject) => {
        try {
            const root = await navigator.storage.getDirectory();
            const mediaDir = await root.getDirectoryHandle("media", { create: true });

            // Check if file already exists
            try {
                await mediaDir.getFileHandle(fileName);
                return false; // Skip if exists
            } catch {
                const fileHandle = await mediaDir.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();

                const content = await zipFile.async("blob");
                await writable.write(content);
                await writable.close();
                return true; // New file added
            }
        } catch (err) {
            console.error(`Failed to restore: ${fileName}`, err);
            return false;
        }
    };

    const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsRestoring(true);
        setSyncLogs([]);
        const tid = toast.loading("Performing deep merge...", { position: "top-right" });

        try {
            const zip = await JSZip.loadAsync(file);

            // 1. Extract and Parse Backup Files
            const indexFile = zip.file(INDEXES_FILE);
            const manifestFile = zip.file(MANIFEST_FILE);
            const foldersFile = zip.file(FOLDERS_FILE);
            const flashcardsFile = zip.file(SLIDEDECK_FILE);
            const calendarFile = zip.file(CALENDAR_FILE);
            const pluginIndexesFile = zip.file(PLUGINS_INDEXES_FILE);

            if (!manifestFile || !indexFile || !foldersFile) {
                toast.error("Invalid backup: Missing system files", { id: tid, position: "top-right" });
                setIsRestoring(false);
                return;
            }

            const backupIndexes: NoteIndex[] = JSON.parse(await indexFile.async("string"));
            const backupFolders: Folder[] = JSON.parse(await foldersFile.async("string"));
            const backupManifest: Record<string, { id: string; dirty: boolean; ts: number }> = JSON.parse(await manifestFile.async("string"));
            const backupDecks: FlashcardDeck[] = flashcardsFile
                ? JSON.parse(await flashcardsFile.async("string"))
                : [];

            const backupCalender: CalendarEvent[] = calendarFile
                ? JSON.parse(await calendarFile.async("string"))
                : [];
            
            const backupPluginIndexes: PluginManifest[] = pluginIndexesFile
                ? JSON.parse(await pluginIndexesFile.async("string"))
                : [];

            // 2. Load Current Local Manifest
            const root = await navigator.storage.getDirectory();
            // Ensures directories exist so StorageEngine doesn't crash on an empty OPFS.
            await root.getDirectoryHandle("notes", { create: true });
            await root.getDirectoryHandle("media", { create: true });
            await root.getDirectoryHandle("plugins", { create: true });
            let currentManifest: Record<string, { id: string; dirty: boolean; ts: number }> = {};
            try {
                const mHandle = await root.getFileHandle(MANIFEST_FILE);
                const mFile = await mHandle.getFile();
                currentManifest = JSON.parse(await mFile.text());
            } catch (err) {
                currentManifest = {};
            }

            // --- LAYER 1: FOLDERS MERGE --- ✅
            const existingFolderIds = new Set((folders || []).map(f => f.id));
            const mergedFolders = [...folders];
            backupFolders.forEach(bFolder => {
                if (!existingFolderIds.has(bFolder.id)) {
                    mergedFolders.push(bFolder);
                }
            });

            // --- LAYER 2: NOTES & CONTENT MERGE ---
            const currentMap = new Map((noteIndexes || []).map(n => [n.id, n]));
            // for notes 3 things can happen
            // 1. backup has a note but not present in local => add the backedup note to local
            // 2. backup has a note present at both places
            // 1. backup and local has same note => do nothing
            // 2. local is updated after backing up => conflict
            let lastYieldTime = performance.now();
            const yieldToBrowser = () => new Promise(resolve => requestAnimationFrame(resolve));
            let notesProcessed = 0;

            for (const bNote of backupIndexes) {
                const fileName = `${bNote.id}.json`;
                const existing = currentMap.get(bNote.id);

                // Logic: Restore if Note is missing locally OR backup is strictly newer
                if (!existing) {
                    const contentFile = zip.file(`notes/${fileName}`);

                    if (contentFile) {
                        const content = JSON.parse(await contentFile.async("string"));

                        // Write actual note data to OPFS
                        await StorageEngine._saveToLocal(bNote.id, content, true, false);

                        // MANIFEST MERGE: 
                        // We pull the Drive ID from backupManifest if local doesn't have it.
                        const localMeta = currentManifest[bNote.id];
                        const backupMeta = backupManifest[bNote.id] || { id: "", ts: Date.now(), dirty: true };

                        currentManifest[bNote.id] = {
                            id: localMeta?.id || backupMeta.id || "",
                            ts: Math.max(localMeta?.ts || 0, backupMeta.ts || 0),
                            dirty: true // Force the sync engine to verify this file
                        };

                        notesProcessed++;
                        currentMap.set(bNote.id, bNote);


                        if (performance.now() - lastYieldTime > 50) {
                            const status = 'added' as SyncStatus;
                            setSyncLogs(prev => [
                                { id: bNote.id, title: bNote.title || "Untitled", status },
                                ...prev
                            ].slice(0, 15));

                            // 4. THE MAGIC KEY: 
                            // We yield for a single animation frame. 
                            // This forces the UI to render the new log line before the loop continues.

                            await yieldToBrowser();
                            lastYieldTime = performance.now();
                        }
                    }
                }
            }

            // LAYER 2.1 PLUGINS AND CONTENT MERGE
            const currentPluginMap = new Map((pluginIndexes || []).map(n=>[n.id,n]));
            let lastYieldTimePlugin = performance.now();
            const yieldToBrowserPlugin = () => new Promise(resolve => requestAnimationFrame(resolve));
            let pluginProcessed = 0;

            for (const bPlugin of backupPluginIndexes) {
                const fileNamePlugin = `${bPlugin.id}.json`;
                const existing = currentPluginMap.get(bPlugin.id);
                if(!existing){
                    const contentFilePlugin = zip.file(`plugins/${fileNamePlugin}`);
                    if (contentFilePlugin){
                        const contentPlugin = JSON.parse(await contentFilePlugin.async("string"));
                        await StorageEngine._saveToLocal(bPlugin.id,contentPlugin, false, true);

                        const localMeta = currentManifest[bPlugin.id];
                        const backupMeta = backupManifest[bPlugin.id] || { id: "", ts: Date.now(), dirty: true };

                        currentManifest[bPlugin.id] = {
                            id: localMeta?.id || backupMeta.id || "",
                            ts: Math.max(localMeta?.ts || 0, backupMeta.ts || 0),
                            dirty: true
                        }

                        pluginProcessed++;
                        currentPluginMap.set(bPlugin.id, bPlugin);

                        if (performance.now()-lastYieldTimePlugin > 50) {
                            const status = 'added' as SyncStatus;
                            setSyncLogs(prev => [
                                { id: bPlugin.id, title: bPlugin.name || "Unnamed Plugin", status },
                                ...prev
                            ].slice(0, 15));

                            await yieldToBrowserPlugin();
                            lastYieldTimePlugin = performance.now();
                        }
                    }
                }
            }

            // ---LAYER 3: DECK  ✅
            const localDecks = await StorageEngine.loadDecks();
            const localDecksMap = new Map(localDecks.map(d => [d.id, d]));
            const mergedDecks: FlashcardDeck[] = []
            const processedLocalIds = new Set<string>();
            backupDecks.forEach(bDeck => {
                const localDeck = localDecksMap.get(bDeck.id);
                if (!localDeck) {
                    mergedDecks.push(bDeck);
                } else {
                    processedLocalIds.add(bDeck.id);
                    const localCardsIds = new Set(localDeck.cards.map(c => c.id));
                    const mergedCards = [...localDeck.cards]
                    bDeck.cards.forEach(bCard => {
                        if (!localCardsIds.has(bCard.id)) {
                            mergedCards.push(bCard)
                        }
                    })
                    // now here three things can happen if have a deck both in backup and local -
                    // 1. backup deck has a card which is not present in local deck => add to the deck
                    // 2. local deck has card which is not present in backup deck => as it is
                    // 3. both have same cards
                    // if same cards are there then two conditions
                    // 1. local card is updated after backup creation => conflict (but since user has updated so keep the local one not updated one)
                    // 2. local card is not updated after backup creation => as it is
                    mergedDecks.push({ ...localDeck, cards: mergedCards })
                }
            });
            localDecks.forEach(lDeck => {
                if (!processedLocalIds.has(lDeck.id)) {
                    mergedDecks.push(lDeck)
                }
            })

            // ---LAYER 4: CALENDAR  ✅
            const localCalenderEvents = await StorageEngine.loadCalendars();
            const existingEventIds = new Set(localCalenderEvents.map(c => c.id));
            const mergedEvents = [...localCalenderEvents]
            backupCalender.forEach(bCalender => {
                if (!existingEventIds.has(bCalender.id)) {
                    mergedEvents.push(bCalender);
                }
            });


            // --- LAYER 4.5: MEDIA MERGE (UI-SAFE) --- 📸
            const mediaFolder = zip.folder("media");
            if (mediaFolder) {
                const mediaFiles: { name: string; file: JSZip.JSZipObject }[] = [];

                mediaFolder.forEach((relativePath, file) => {
                    if (!file.dir) mediaFiles.push({ name: relativePath, file });
                });

                if (mediaFiles.length > 0) {
                    let restoredCount = 0;

                    for (const m of mediaFiles) {
                        const isNew = await restoreMediaFile(m.name, m.file);
                        if (isNew) restoredCount++;

                        // Every 10 files, update the log so the user sees progress
                        if (restoredCount % 10 === 0) {
                            setSyncLogs(prev => [
                                {
                                    id: 'media-progress',
                                    title: `Restoring media: ${restoredCount}/${mediaFiles.length} files...`,
                                    status: 'syncing' as SyncStatus
                                },
                                ...prev.filter(log => log.id !== 'media-progress') // Replace old progress log
                            ].slice(0, 15));
                        }
                    }

                    setSyncLogs(prev => [
                        { id: 'media-done', title: `Successfully restored ${restoredCount} new assets.`, status: 'added' as SyncStatus },
                        ...prev
                    ].slice(0, 15));
                }
            }

            // --- LAYER 5: STRUCTURAL FILES (INDEX & FOLDERS) ---
            // Preserve Drive IDs for the main collection files to avoid duplicate files on Drive

            const structuralFiles = [INDEXES_FILE, FOLDERS_FILE, SLIDEDECK_FILE, CALENDAR_FILE, PLUGINS_INDEXES_FILE];

            structuralFiles.forEach(file => {
                const localMeta = currentManifest[file];
                const backupMeta = backupManifest[file];

                currentManifest[file] = {
                    id: localMeta?.id || backupMeta?.id || "",
                    ts: Date.now(), // Local was merged/updated, so it is the "newest"
                    dirty: true
                };
            });

            // --- FINAL PERSISTENCE ---
            // 1. Save data files
            await StorageEngine._saveToLocal(INDEXES_FILE, Array.from(currentMap.values()), false, false);
            await StorageEngine._saveToLocal(FOLDERS_FILE, mergedFolders, false, false);
            await StorageEngine._saveToLocal(SLIDEDECK_FILE, mergedDecks, false, false);
            await StorageEngine._saveToLocal(CALENDAR_FILE, mergedEvents, false, false);
            await StorageEngine._saveToLocal(MANIFEST_FILE, currentManifest, false, false);
            await StorageEngine._saveToLocal(PLUGINS_INDEXES_FILE, Array.from(currentPluginMap.values()), false, false);

            toast.success("Restore complete! Reloading to sync data...", { id: tid });

            // Global Refresh Trigger
            // 2. Small delay to ensure OPFS write-locks are released
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (err) {
            console.error("Restore Error:", err);
            toast.error("Critical Restore Failure: Check console", { id: tid, position: "top-right" });
        } finally {
            setIsRestoring(false);
            if (e.target) e.target.value = "";
        }
    };

    const handleHardReset = async () => {
        if (confirmText !== "DELETE EVERYTHING") return;
        setIsPurging(true);
        try {
            const root = await navigator.storage.getDirectory();
            // @ts-ignore
            for await (const name of root.keys()) await root.removeEntry(name, { recursive: true });
            await StorageEngine.init();
            window.dispatchEvent(new CustomEvent("opfs-data-restored"));
            updateStorageEstimate();
            toast.success("All data cleared", { position: "top-right" });
            setShowClearDialog(false);
        } catch (e) { toast.error("Reset failed", { position: "top-right" }); }
        finally { setIsPurging(false); }
    };

    // const requestGoogleDriveAccess = async () => {
    //     await authClient.linkSocial({
    //         provider: "google",
    //         scopes: ["https://www.googleapis.com/auth/drive.file"],
    //     });
    // };
    // if 'drive.file' then it will only give access to files created by the app from a particular device and not all the files in the drive. This is a security measure by google to prevent apps from having access to all the user's files without explicit permission for each file. If only 'drive' then on all devices and all files also

    const stats = [
        { label: "Total Notes", value: noteIndexes.length, icon: StickyNote },
        { label: "Folders", value: folders.length, icon: FolderOpen },
    ];

    const plan = session?.subscription?.planName?.toLowerCase() || "free";
    const expiresDate = session?.subscription?.expiresAt 
        ? new Date(session?.subscription.expiresAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })
        : "N/A";
        
    const joinYear = session?.subscription?.createdAt
        ? new Date(session?.subscription.createdAt).getFullYear()
        : new Date().getFullYear();

    const planConfig = {
        free: {
            badgeText: "Free",
            badgeStyles: "bg-zinc-600 text-white",
            title: "Basic Account Status",
            icon: Calendar,
            showExpiry: false,
        },
        pro: {
            badgeText: "Premium",
            badgeStyles: "bg-amber-400 text-black",
            title: "Pro Account Status",
            icon: Sparkles,
            showExpiry: true,
        },
        team: {
            badgeText: "Team Enterprise",
            badgeStyles: "bg-blue-500 text-white",
            title: "Team Account Status",
            icon: Users,
            showExpiry: true,
        }
    };
    const currentConfig = planConfig[plan as keyof typeof planConfig] || planConfig.free;
    const BackgroundIcon = currentConfig.icon;

    return (
        <div className="flex-1 h-full bg-background overflow-y-auto scrollbar-thin">
            <AnimatePresence>
                {isRestoring && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center p-6">
                        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-white border border-[#e2e4e2] w-full max-w-md rounded-4xl shadow-xl p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <RefreshCcw className="w-5 h-5 animate-spin text-[#2e312e]" />
                                <h3 className="font-bold text-lg">Updating engine...</h3>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-none">
                                {syncLogs.map((log, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm p-2 rounded-lg bg-[#f0f2f0]">
                                        <span className="truncate max-w-50 text-[#4a4d4a]">{log.title}</span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${log.status === 'added' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {log.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="max-w-7xl mx-auto p-2 sm:p-8">
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Welcome Header */}
                <motion.div
                    variants={itemVariants}
                    className="flex items-center justify-between mb-10 border-b border-border pb-4 pt-2"
                >
                    <header className="flex flex-col gap-1">
                        <div className="flex items-center gap-4">
                            <SidebarTrigger className="h-8 w-8 text-[#4a4d4a]" />
                            <div>
                                <h1 className="text-3xl font-bold text-foreground tracking-tight">
                                    Settings 👋
                                </h1>
                                <p className="text-muted-foreground text-sm font-medium">
                                    Manage your settings and system backups.
                                </p>
                            </div>
                        </div>
                    </header>
                </motion.div>

                {/* Stats & Premium Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {stats.map((stat) => (
                        <motion.div
                            key={stat.label}
                            variants={itemVariants}
                            whileHover={{ y: -4 }}
                            className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                        >
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-primary/10 border border-primary/5">
                                <stat.icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-foreground">
                                    {stat.value}
                                </p>
                                <p className="text-sm font-semibold text-muted-foreground">
                                    {stat.label}
                                </p>
                            </div>
                        </motion.div>
                    ))}

                    {/* Premium Member Card */}
                    <motion.div
                        variants={itemVariants}
                        whileHover={{ y: -4 }}
                        className="col-span-2 bg-[#1a1c1a] text-white rounded-2xl p-6 border border-[#2e312e] flex flex-col justify-between relative overflow-hidden group shadow-lg"
                    >
                        {/* Background Decorative Icon */}
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                            <BackgroundIcon className="w-20 h-20" />
                        </div>

                        {/* Top Badges */}
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${currentConfig.badgeStyles}`}>
                                {currentConfig.badgeText}
                            </div>
                            <p className="text-sm font-bold opacity-80">Member since {joinYear}</p>
                        </div>

                        {/* Bottom Content Area */}
                        <div className="flex items-end justify-between relative z-10 mt-4">
                            <div>
                                <h3 className="text-lg font-bold">{currentConfig.title}</h3>
                                
                                {currentConfig.showExpiry ? (
                                    <p className="text-xs opacity-60 flex items-center gap-1 mt-1">
                                        <Calendar className="w-3 h-3" /> Expires: {expiresDate}
                                    </p>
                                ) : (
                                    <p className="text-xs opacity-60 flex items-center gap-1 mt-1">
                                        Upgrade for premium features
                                    </p>
                                )}
                            </div>
                            
                            <Link href='/billings' className="flex justify-center items-center text-white hover:bg-white/10 rounded-full h-10 w-10 p-0">
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* System Sections */}
                <motion.div variants={itemVariants} className="space-y-6 mb-10">
                    <h2 className="text-lg font-bold flex items-center gap-2 px-1">
                        <LayoutGrid className="w-5 h-5" /> Maintenance
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <motion.div whileHover={{ scale: 1.01 }} className="bg-white border border-[#e2e4e2] rounded-[1.5rem] p-8 flex flex-col gap-6 shadow-sm">
                            <div className="space-y-2">
                                <h3 className="font-bold text-xl tracking-tight">Export Library</h3>
                                <p className="text-sm text-[#7a7d7a] leading-relaxed font-medium">
                                    Create a portable backup of your notes and storage manifest.
                                </p>
                            </div>
                            <Button onClick={handleExportZip} disabled={isExporting} className="w-full bg-primary hover:bg-primary/80 text-white rounded-xl h-12 font-bold transition-all shadow-sm">
                                {isExporting ? <Loader2 className="animate-spin" /> : "Export Backup (.zip)"}
                            </Button>
                        </motion.div>

                        <motion.div whileHover={{ scale: 1.01 }} className="bg-white border border-[#e2e4e2] rounded-[1.5rem] p-8 flex flex-col gap-6 shadow-sm">
                            <div className="space-y-2">
                                <h3 className="font-bold text-xl tracking-tight">Restore Backup</h3>
                                <p className="text-sm text-[#7a7d7a] leading-relaxed font-medium">
                                    Upload a previous archive to merge with your existing notes.
                                </p>
                            </div>
                            <input type="file" id="restore" className="hidden" accept=".zip" onChange={handleRestore} />
                            <label htmlFor="restore" className="w-full">
                                <Button asChild className="w-full bg-white border border-[#e2e4e2] hover:bg-[#f9faf9] text-[#1a1c1a] rounded-xl h-12 font-bold cursor-pointer transition-all shadow-sm">
                                    <span>Restore Archive</span>
                                </Button>
                            </label>
                        </motion.div>
                    </div>
                </motion.div>

                {/* Info & Danger */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="bg-[#f0f2f0] p-6 rounded-[1.25rem] space-y-3">
                        <div className="flex items-center gap-2 text-sm font-bold text-[#4a4d4a]">
                            <HardDrive className="w-4 h-4" /> LOCAL_ENGINE_STATUS
                        </div>
                        <div className="flex justify-between text-xs font-semibold text-[#7a7d7a]">
                            <span>OPFS Volume Usage</span>
                            <span className="text-[#1a1c1a]">{opfsSize}</span>
                        </div>
                        <div className="w-full bg-white rounded-full h-1.5 overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: "10%" }}
                                transition={{ delay: 1, duration: 1.5 }}
                                className="bg-green-500 h-full"
                            />
                        </div>
                    </div>

                    <div className="bg-red-50/50 border border-red-100 p-6 rounded-[1.25rem] flex items-center justify-between group hover:bg-red-50 transition-colors">
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-red-900">Delete all data</p>
                            <p className="text-xs text-red-700 opacity-80 font-medium">Clear entire local storage.</p>
                        </div>
                        <Button variant="ghost" onClick={() => setShowClearDialog(true)} className="text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg font-bold border border-red-200">
                            Reset Engine
                        </Button>
                    </div>
                </motion.div>

                {/* <button onClick={requestGoogleDriveAccess}>
                    Add Google Drive Permissions
                </button> */}
            </motion.div>

            <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
                <DialogContent className="bg-white border-[#e2e4e2] rounded-4xl p-10 max-w-md">
                    <DialogHeader className="text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="text-red-600 w-8 h-8" />
                        </div>
                        <DialogTitle className="text-2xl font-bold tracking-tight">Confirm Reset</DialogTitle>
                        <DialogDescription className="pt-2">
                            To proceed, type <span className="font-bold text-[#1a1c1a]">DELETE EVERYTHING</span> below. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={confirmText}
                        onChange={e => setConfirmText(e.target.value)}
                        className="h-12 rounded-xl my-6 text-center border-[#e2e4e2] focus:ring-red-500 font-bold"
                        placeholder="Verification phrase"
                    />
                    <DialogFooter className="gap-2 sm:flex-row flex-col">
                        <Button variant="destructive" disabled={confirmText !== "DELETE EVERYTHING" || isPurging} onClick={handleHardReset} className="flex-1 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700">
                            {isPurging ? <Loader2 className="animate-spin" /> : "Yes, clear data"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowClearDialog(false)} className="flex-1 h-12 rounded-xl font-bold border-[#e2e4e2]">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            </div>
        </div>
    );
};

export default Settings;