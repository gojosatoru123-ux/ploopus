import { CALENDAR_FILE, FOLDERS_FILE, INDEXES_FILE, MANIFEST_FILE, NOTES_DIR, SLIDEDECK_FILE, MEDIA_DIR } from "./constants";
import { CalendarEvent, FlashcardDeck, Folder, NoteBlock, NoteIndex } from "./types";

export type SyncStatus = "synced" | "syncing" | "fetching" | "error" | "offline" | "nocloud";
export type SyncProgress = { current: number; total: number };

/**
 * CONFLICT RESOLUTION (FUTURE-PROOF HOOK)
 * This is where you can implement merge logic (e.g., LWW or CRDT) later.
 */
const ConflictManager = {
  async resolve(fileName: string, localData: any, incomingCloudData: any): Promise<any> {
    // Current behavior: Cloud version takes precedence if conflict check is triggered
    return incomingCloudData;
  }
};

/**
 * CLOUD PROVIDER (DUMMY WRAPPER)
 * Purely local right now. Flip 'isEnabled' to true and add API calls here to re-enable sync.
 */
const CloudProvider = {
  isEnabled: false,

  async upload(fileName: string, data: any): Promise<{ id: string; v: number } | null> {
    if (!this.isEnabled) return null;
    await new Promise(r => setTimeout(r, 1000)); // Latency Simulation
    return { id: `cloud_ref_${Math.random().toString(36).substring(7)}`, v: (data.v || 0) + 1 };
  },

  async fetchLatest(fileName: string): Promise<any | null> {
    if (!this.isEnabled) return null;
    return null;
  },

  async delete(cloudId: string): Promise<void> {
    if (!this.isEnabled) return;
    console.log(`Cloud: Resource ${cloudId} removed.`);
  }
};

/**
 * ENGINE STATE
 */
let statusListener: ((status: SyncStatus) => void) | null = null;
let progressListener: ((progress: SyncProgress) => void) | null = null;

let manifest: Record<string, { id: string; dirty: boolean; ts: number }> = {};

const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const uploadQueue = new Map<string, Promise<any>>();
let initPromise: Promise<void> | null = null;

const getRoot = () => navigator.storage.getDirectory();

export const StorageEngine = {
  onStatusChange(cb: (s: SyncStatus) => void) { statusListener = cb; },
  onProgressChange(cb: (p: SyncProgress) => void) { progressListener = cb; },

  async init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const root = await getRoot();
      try {
        await root.getDirectoryHandle(NOTES_DIR, { create: true });

        // Load the journal (manifest)
        const localManifest = await this._readLocal(MANIFEST_FILE);
        if (localManifest) {
          manifest = localManifest;
        } else {
          manifest = {};
          await this._persistManifest();
        }

        this._emitStatus(CloudProvider.isEnabled ? "synced" : "nocloud");
      } catch (e) {
        console.error("Ploopus Storage Init Error:", e);
        this._emitStatus("error");
      }
    })();
    return initPromise;
  },

  /**
   * INTERNAL: Orchestrates the write cycle
   */
  async _performWrite(fileName: string, data: any, isNote: boolean) {
    await this.init();
    try {
      const now = Date.now();

      // Update Versioning
      if (!manifest[fileName]) manifest[fileName] = { id: "", dirty: true, ts: now };
      manifest[fileName].ts = now;
      manifest[fileName].dirty = true;

      // Atomic OPFS Write
      await this._saveToLocal(fileName, data, isNote);
      await this._persistManifest();

      // Cloud Logic Branch
      if (CloudProvider.isEnabled && navigator.onLine) {
        this._triggerCloudUpload(fileName, data);
      } else {
        this._emitStatus("nocloud");
      }
    } catch (e) {
      this._emitStatus("error");
    }
  },

  /**
   * INTERNAL: Handles the cloud sync queue with progress reporting
   */
  async _triggerCloudUpload(fileName: string, data: any) {
    if (uploadQueue.has(fileName)) return;

    const task = (async () => {
      this._emitStatus("syncing");
      this._emitProgress(1, 1);

      try {
        const cloudData = await CloudProvider.fetchLatest(fileName);
        let finalData = data;

        if (cloudData && cloudData.ts > manifest[fileName].ts) {
          finalData = await ConflictManager.resolve(fileName, data, cloudData);
          await this._saveToLocal(fileName, finalData, fileName !== MANIFEST_FILE);
        }

        const result = await CloudProvider.upload(fileName, finalData);
        if (result) {
          manifest[fileName].id = result.id;
          manifest[fileName].dirty = false;
          await this._persistManifest();
        }
        this._emitStatus("synced");
      } finally {
        this._emitProgress(0, 0);
        uploadQueue.delete(fileName);
      }
    })();

    uploadQueue.set(fileName, task);
  },

  /**
   * LOW-LEVEL OPFS ACCESSORS
   */
  async _saveToLocal(fileName: string, data: any, isNote: boolean) {
    const root = await getRoot();
    const dir = isNote ? await root.getDirectoryHandle(NOTES_DIR) : root;
    const name = isNote && !fileName.endsWith('.json') ? `${fileName}.json` : fileName;

    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data));
    await writable.close(); // Crucial for handle release
  },

  async _readLocal(fileName: string, isNote: boolean = false) {
    try {
      const root = await getRoot();
      const dir = isNote ? await root.getDirectoryHandle(NOTES_DIR) : root;
      const name = isNote && !fileName.endsWith('.json') ? `${fileName}.json` : fileName;
      const h = await dir.getFileHandle(name);
      return JSON.parse(await (await h.getFile()).text());
    } catch { return null; }
  },

  async _persistManifest() {
    const root = await getRoot();
    const handle = await root.getFileHandle(MANIFEST_FILE, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(manifest));
    await writable.close();
  },

  /**
   * ORIGINAL PUBLIC DATA LOADERS
   */
  async loadIndexes(): Promise<NoteIndex[]> { return await this._readLocal(INDEXES_FILE) || []; },
  async loadFolders(): Promise<Folder[]> { return await this._readLocal(FOLDERS_FILE) || []; },
  async loadCalendars(): Promise<CalendarEvent[]> { return await this._readLocal(CALENDAR_FILE) || []; },
  async loadDecks(): Promise<FlashcardDeck[]> { return await this._readLocal(SLIDEDECK_FILE) || []; },

  async loadNoteBlocks(id: string): Promise<NoteBlock[]> {
    const local = await this._readLocal(id, true);
    if (local) return local;
    return [{ id: crypto.randomUUID(), type: "text", content: "" }];
  },

  /**
   * ORIGINAL PUBLIC DEBOUNCED WRITERS
   */
  saveIndexesDebounced(i: NoteIndex[]) { this._writeFile(INDEXES_FILE, i, false); },
  saveFoldersDebounced(f: Folder[]) { this._writeFile(FOLDERS_FILE, f, false); },
  saveNoteBlocksDebounced(id: string, b: NoteBlock[]) { this._writeFile(id, b, true); },
  saveCalendarDebounced(c: CalendarEvent[]) { this._writeFile(CALENDAR_FILE, c, false); },
  saveSlideDebounced(d: FlashcardDeck[]) { this._writeFile(SLIDEDECK_FILE, d, false); },

  /**
   * INTERNAL COORDINATOR
   */
  _writeFile(name: string, data: any, isNote: boolean) {
    if (saveTimeouts.has(name)) {
      clearTimeout(saveTimeouts.get(name));
    }

    const timeout = setTimeout(() => {
      this._performWrite(name, data, isNote);
      saveTimeouts.delete(name);
    }, 800);

    saveTimeouts.set(name, timeout);
  },

  _emitStatus(s: SyncStatus) {
    if (statusListener) statusListener(s);
  },

  _emitProgress(current: number, total: number) {
    if (progressListener) progressListener({ current, total });
  },

  /**
   * DELETION
   */
  async deleteNoteFile(id: string) {
    await this.init();
    try {
      this._emitProgress(1, 1);
      const root = await getRoot();
      const dir = await root.getDirectoryHandle(NOTES_DIR);
      await dir.removeEntry(`${id}.json`);

      const cloudId = manifest[id]?.id;
      delete manifest[id];
      await this._persistManifest();

      if (CloudProvider.isEnabled && cloudId) {
        await CloudProvider.delete(cloudId);
      }
      this._emitStatus(CloudProvider.isEnabled ? "synced" : "nocloud");
    } catch (e) {
      console.warn(`Local file ${id} was already removed or doesn't exist.`);
    } finally {
      this._emitProgress(0, 0);
    }
  },

  /**
   * FILE UPLOADS
   */
  async getMediaUrl(fileName: string): Promise<string | null> {
    try {
      const root = await navigator.storage.getDirectory();
      const mediaDir = await root.getDirectoryHandle(MEDIA_DIR);
      const fileHandle = await mediaDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (e) {
      console.error("Failed to load media from OPFS:", fileName);
      return null;
    }
  },

  async saveMedia(file: File): Promise<string> {
    await this.init();
    const root = await navigator.storage.getDirectory();
    const mediaDir = await root.getDirectoryHandle(MEDIA_DIR, { create: true });
    const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const fileHandle = await mediaDir.getFileHandle(safeName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return safeName;
  },

  listAllFiles: async (): Promise<string[]> => {
    try {
      const root = await navigator.storage.getDirectory();
      let mediaDir;
      try {
        mediaDir = await root.getDirectoryHandle(MEDIA_DIR, { create: false });
      } catch (e) {
        console.warn("Media folder does not exist yet.");
        return [];
      }
      const files: string[] = [];

      // 2. Iterate specifically through the media directory
      // @ts-ignore
      const entries = mediaDir.entries();

      // @ts-ignore
      for await (const [name, handle] of entries) {
        if (handle.kind === 'file') {
          files.push(`${name}`);
        }
      }
      console.log("Media Library items found:", files);
      return files;
    } catch (error) {
      console.error("Failed to list OPFS media files:", error);
      return [];
    }
  },
};