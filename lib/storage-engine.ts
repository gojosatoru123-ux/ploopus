import * as Y from "yjs";
import { CALENDAR_FILE, FOLDERS_FILE, INDEXES_FILE, MANIFEST_FILE, NOTES_DIR, SLIDEDECK_FILE, MEDIA_DIR } from "./constants";
import { CalendarEvent, FlashcardDeck, Folder, NoteBlock, NoteIndex } from "./types";

export type SyncStatus = "synced" | "syncing" | "fetching" | "error" | "offline" | "nocloud";
export type SyncProgress = { current: number; total: number };

export interface DocLoadResult {
  doc: Y.Doc;
  status: "new" | "loaded" | "corrupted";
}

/**
 * IN-MEMORY DOCUMENT CACHE
 * Namespaced keys (e.g. "notes:id" vs "root:id") protect data context 
 * and preserve historical operational sequences for smooth future syncing.
 */
const activeDocs = new Map<string, Y.Doc>();

/**
 * SERIALIZATION TRANSACTION LOCKS
 * Forces overlapping requests to the same file handle to execute sequentially,
 * completely neutralizing OPFS concurrent createWritable() data-loss race windows.
 */
const fileWriteLocks = new Map<string, Promise<void>>();

/**
 * CLOUD PROVIDER STUB RELAY
 */
const CloudProvider = {
  isEnabled: false,
  async upload(fileName: string, data: any): Promise<{ id: string; v: number } | null> {
    return null;
  },
  async fetchLatest(fileName: string): Promise<any | null> {
    return null;
  }
};

let statusListener: ((status: SyncStatus) => void) | null = null;
let progressListener: ((progress: SyncProgress) => void) | null = null;

let manifest: Record<string, { id: string; dirty: boolean; ts: number }> = {};
const saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
let initPromise: Promise<void> | null = null;

const getRoot = () => navigator.storage.getDirectory();
const getCacheKey = (id: string, isNote: boolean) => `${isNote ? "notes" : "root"}:${id}`;

export const StorageEngine = {
  onStatusChange(cb: (s: SyncStatus) => void) { statusListener = cb; },
  onProgressChange(cb: (p: SyncProgress) => void) { progressListener = cb; },

  async init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const root = await getRoot();
      try {
        await root.getDirectoryHandle(NOTES_DIR, { create: true });
        await root.getDirectoryHandle(MEDIA_DIR, { create: true });

        const manifestResult = await this.getOrCreateDoc(MANIFEST_FILE, false);
        if (manifestResult.status === "loaded") {
          manifest = manifestResult.doc.getMap("manifest").toJSON() as any;
        } else {
          manifest = {};
          await this._persistManifest();
        }

        this._emitStatus(CloudProvider.isEnabled ? "synced" : "nocloud");
      } catch (e) {
        console.error("Storage Engine Initialization Failed:", e);
        this._emitStatus("error");
      }
    })();
    return initPromise;
  },

  /**
   * SAFELY DISPATCHES OR CACHES DOCUMENT INSTANCES
   * Distinctly returns status states so corrupt storage layers are exposed rather than overwritten.
   */
  async getOrCreateDoc(id: string, isNote: boolean): Promise<DocLoadResult> {
    const cacheKey = getCacheKey(id, isNote);
    if (activeDocs.has(cacheKey)) {
      return { doc: activeDocs.get(cacheKey)!, status: "loaded" };
    }

    const doc = new Y.Doc();
    const root = await getRoot();
    const dir = isNote ? await root.getDirectoryHandle(NOTES_DIR) : root;
    const actualFileName = isNote && !id.endsWith(".bin") ? `${id}.bin` : id;

    try {
      const fileHandle = await dir.getFileHandle(actualFileName);
      const file = await fileHandle.getFile();
      const buffer = await file.arrayBuffer();
      const binaryData = new Uint8Array(buffer);

      if (binaryData.byteLength === 0) {
        activeDocs.set(cacheKey, doc);
        return { doc, status: "new" };
      }

      // V2 Encoding is highly optimized for local compaction and low network packet sizes
      Y.applyUpdateV2(doc, binaryData);
      activeDocs.set(cacheKey, doc);
      return { doc, status: "loaded" };

    } catch (error: any) {
      activeDocs.set(cacheKey, doc);
      if (error.name === "NotFoundError") {
        return { doc, status: "new" };
      }
      console.error(`CRITICAL STORAGE LAYER EXCEPTION: Binary file [${actualFileName}] is unreadable.`, error);
      return { doc, status: "corrupted" };
    }
  },

  /**
   * PIPELINE MUTEX TASK QUEUER
   */
  async _queueWriteTrack(fileName: string, isNote: boolean, writeTask: () => Promise<void>) {
    const cacheKey = getCacheKey(fileName, isNote);
    const backgroundChain = fileWriteLocks.get(cacheKey) || Promise.resolve();

    const currentTrack = backgroundChain.then(async () => {
      try {
        await writeTask();
      } catch (e) {
        console.error(`File write cycle structural crash on channel: ${cacheKey}`, e);
      }
    });

    fileWriteLocks.set(cacheKey, currentTrack);
    return currentTrack;
  },

  async _performWrite(fileName: string, data: any, isNote: boolean) {
    await this.init();
    const now = Date.now();

    if (!manifest[fileName]) manifest[fileName] = { id: "", dirty: true, ts: now };
    manifest[fileName].ts = now;
    manifest[fileName].dirty = true;

    await this._queueWriteTrack(fileName, isNote, async () => {
      const root = await getRoot();
      const dir = isNote ? await root.getDirectoryHandle(NOTES_DIR) : root;
      const actualFileName = isNote && !fileName.endsWith(".bin") ? `${fileName}.bin` : fileName;

      const loadResult = await this.getOrCreateDoc(fileName, isNote);
      if (loadResult.status === "corrupted") throw new Error("Abort write sequence to protect a corrupted target");
      
      const doc = loadResult.doc;

      // Wrap operations in a transaction to safely handle local delta mutations
      doc.transact(() => {
        if (Array.isArray(data)) {
          const sharedArray = doc.getArray("data_array");
          sharedArray.delete(0, sharedArray.length);
          if (data.length > 0) sharedArray.insert(0, data);
        } else if (typeof data === "object" && data !== null) {
          const sharedMap = doc.getMap("data");
          for (const key of Array.from(sharedMap.keys())) {
            if (!(key in data)) sharedMap.delete(key);
          }
          for (const [key, val] of Object.entries(data)) {
            sharedMap.set(key, val);
          }
        } else {
          doc.getMap("data").set("value", data);
        }
      });

      const binaryState = Y.encodeStateAsUpdateV2(doc);
      const handle = await dir.getFileHandle(actualFileName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(binaryState);
      await writable.close();
    });

    await this._persistManifest();
  },

  async _persistManifest() {
    await this._queueWriteTrack(MANIFEST_FILE, false, async () => {
      const root = await getRoot();
      const loadResult = await this.getOrCreateDoc(MANIFEST_FILE, false);
      const doc = loadResult.doc;

      doc.transact(() => {
        const sharedMap = doc.getMap("manifest");
        for (const key of Array.from(sharedMap.keys())) {
          if (!(key in manifest)) sharedMap.delete(key);
        }
        for (const [key, value] of Object.entries(manifest)) {
          sharedMap.set(key, value);
        }
      });

      const binaryManifest = Y.encodeStateAsUpdateV2(doc);
      const handle = await root.getFileHandle(MANIFEST_FILE, { create: true });
      const writable = await handle.createWritable();
      await writable.write(binaryManifest);
      await writable.close();
    });
  },

  async _readDataPayload(fileName: string, isNote: boolean): Promise<any> {
    const result = await this.getOrCreateDoc(fileName, isNote);
    if (result.status === "corrupted") return null;

    const doc = result.doc;
    const arrayData = doc.getArray("data_array");
    if (arrayData.length > 0 || doc.getMap("data").size === 0) {
      if (arrayData.length > 0) return arrayData.toJSON();
    }

    const mapData = doc.getMap("data");
    if (mapData.has("value") && mapData.size === 1) {
      return mapData.get("value");
    }
    
    return mapData.size > 0 ? mapData.toJSON() : null;
  },

  async loadIndexes(): Promise<NoteIndex[]> { return await this._readDataPayload(INDEXES_FILE, false) || []; },
  async loadFolders(): Promise<Folder[]> { return await this._readDataPayload(FOLDERS_FILE, false) || []; },
  async loadCalendars(): Promise<CalendarEvent[]> { return await this._readDataPayload(CALENDAR_FILE, false) || []; },
  async loadDecks(): Promise<FlashcardDeck[]> { return await this._readDataPayload(SLIDEDECK_FILE, false) || []; },

  async loadNoteBlocks(id: string): Promise<NoteBlock[]> {
    const localData = await this._readDataPayload(id, true);
    if (localData && Array.isArray(localData)) return localData;
    return [{ id: crypto.randomUUID(), type: "text", content: "" }];
  },

  saveIndexesDebounced(i: NoteIndex[]) { this._writeFile(INDEXES_FILE, i, false); },
  saveFoldersDebounced(f: Folder[]) { this._writeFile(FOLDERS_FILE, f, false); },
  saveNoteBlocksDebounced(id: string, b: NoteBlock[]) { this._writeFile(id, b, true); },
  saveCalendarDebounced(c: CalendarEvent[]) { this._writeFile(CALENDAR_FILE, c, false); },
  saveSlideDebounced(d: FlashcardDeck[]) { this._writeFile(SLIDEDECK_FILE, d, false); },

  _writeFile(name: string, data: any, isNote: boolean) {
    if (saveTimeouts.has(name)) clearTimeout(saveTimeouts.get(name));
    const timeout = setTimeout(() => {
      this._performWrite(name, data, isNote);
      saveTimeouts.delete(name);
    }, 800);
    saveTimeouts.set(name, timeout);
  },

  async deleteNoteFile(id: string) {
    await this.init();
    const actualFileName = id.endsWith(".bin") ? id : `${id}.bin`;
    const cleanId = id.endsWith(".bin") ? id.slice(0, -4) : id;

    try {
      this._emitProgress(1, 1);
      const root = await getRoot();
      const dir = await root.getDirectoryHandle(NOTES_DIR);
      
      await dir.removeEntry(actualFileName);

      delete manifest[cleanId];
      delete manifest[actualFileName];
      await this._persistManifest();

      const cacheKey = getCacheKey(cleanId, true);
      const doc = activeDocs.get(cacheKey);
      if (doc) {
        doc.destroy();
        activeDocs.delete(cacheKey);
      }
    } catch (e) {
      console.warn(`File target ${actualFileName} was already missing on disk.`);
    } finally {
      this._emitProgress(0, 0);
    }
  },

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
    const mediaDir = await root.getDirectoryHandle(MEDIA_DIR);
    const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const fileHandle = await mediaDir.getFileHandle(safeName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    return safeName;
  },

  async listAllFiles(): Promise<string[]> {
    try {
      await this.init();
      const root = await navigator.storage.getDirectory();
      const mediaDir = await root.getDirectoryHandle(MEDIA_DIR);
      const files: string[] = [];

      for await (const [name, handle] of (mediaDir as any).entries()) {
        if (handle.kind === 'file') {
          files.push(name);
        }
      }
      return files;
    } catch (error) {
      console.error("Failed to compile list of media directory paths:", error);
      return [];
    }
  },

  _emitStatus(s: SyncStatus) { if (statusListener) statusListener(s); },
  _emitProgress(current: number, total: number) { if (progressListener) progressListener({ current, total }); }
};