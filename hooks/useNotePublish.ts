import { useCallback } from "react";
import { Note, NoteBlock } from "@/lib/types";

// ─── Local URL detection (mirrors useNoteExport) ──────────────────────────────

const isLocal = (url = "") =>
  url.startsWith("blob:") ||
  url.startsWith("opfs://") ||
  url.startsWith("file:") ||
  (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("//"));

const safeName = (t: string) => t.replace(/[^a-z0-9]/gi, "_").slice(0, 50) || "note";

// ─── OPFS helpers (mirrors useNoteExport) ────────────────────────────────────

const opfsName = (url: string): string => {
  if (url.startsWith("opfs://")) return url.slice(7);
  return url.replace(/^\/+/, "");
};

const isOpfsUrl = (url: string): boolean =>
  url.startsWith("opfs://") ||
  (!url.startsWith("blob:") &&
    !url.startsWith("data:") &&
    !url.startsWith("http://") &&
    !url.startsWith("https://") &&
    !url.startsWith("//") &&
    !url.startsWith("file:"));

const readFromOpfs = async (filename: string): Promise<File | null> => {
  if (!navigator?.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    try {
      const handle = await root.getFileHandle(filename, { create: false });
      return await handle.getFile();
    } catch { /* not at root */ }
    const subDirs = ["images", "media", "uploads", "files", "attachments", "assets"];
    for (const dir of subDirs) {
      try {
        const dirHandle = await root.getDirectoryHandle(dir, { create: false });
        try {
          const handle = await dirHandle.getFileHandle(filename, { create: false });
          return await handle.getFile();
        } catch { /* not in this sub-dir */ }
      } catch { /* sub-dir doesn't exist */ }
    }
    const basename = filename.split("/").pop();
    if (basename && basename !== filename) {
      try {
        const handle = await root.getFileHandle(basename, { create: false });
        return await handle.getFile();
      } catch { /* not at root with basename */ }
      for (const dir of subDirs) {
        try {
          const dirHandle = await root.getDirectoryHandle(dir, { create: false });
          try {
            const handle = await dirHandle.getFileHandle(basename, { create: false });
            return await handle.getFile();
          } catch { /* not here */ }
        } catch { /* sub-dir doesn't exist */ }
      }
    }
    return null;
  } catch {
    return null;
  }
};

// ─── Asset resolution ─────────────────────────────────────────────────────────
//
// For zip export we do NOT base64-encode assets — we bundle the raw files.
// Local media URLs get rewritten to relative `assets/<filename>` paths.
// Public https:// URLs are left untouched; they work from any static host.

type AssetEntry = {
  originalUrl: string;  // URL as stored in the block
  assetPath: string;    // relative path inside the zip, e.g. "assets/1_photo.jpg"
  blob: Blob;
};

/** Derive a safe, unique asset filename from a URL. */
const assetFilename = (url: string, index: number): string => {
  let name = url.split("?")[0].split("/").pop() || "";
  if (url.startsWith("opfs://")) name = url.slice(7).split("/").pop() || "";
  name = name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
  if (!name || name === "_") name = `asset_${index}`;
  return `${index}_${name}`;
};

/** Fetch a local URL and return its Blob, or null on failure. */
const fetchLocalBlob = async (url: string): Promise<Blob | null> => {
  if (isOpfsUrl(url)) {
    const file = await readFromOpfs(opfsName(url));
    if (file) return file;
    // Fall through — might also be served as a static file
  }
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
};

/**
 * Walk all blocks and collect every local media URL, then fetch each as a Blob.
 * Returns AssetEntry[] ready for zipping. Public URLs are excluded.
 */
const collectAssets = async (note: Note): Promise<AssetEntry[]> => {
  const needsAsset = (url: string | undefined): url is string => {
    if (!url) return false;
    if (url.startsWith("data:")) return false;
    return isLocal(url);
  };

  const urls = new Set<string>();

  const collectFromBlock = (block: NoteBlock) => {
    if (needsAsset(block.imageUrl)) urls.add(block.imageUrl!);
    if (needsAsset(block.videoUrl)) urls.add(block.videoUrl!);
    if (needsAsset(block.audioUrl)) urls.add(block.audioUrl!);
    if (needsAsset(block.fileUrl)) urls.add(block.fileUrl!);
    if (needsAsset(block.imageTextUrl)) urls.add(block.imageTextUrl!);
    block.galleryImages?.forEach(img => { if (needsAsset(img.url)) urls.add(img.url); });
    block.columns?.forEach(col => col.forEach(collectFromBlock));
    block.tabsData?.forEach(tab => tab.blocks?.forEach(collectFromBlock));
  };
  note.blocks.forEach(collectFromBlock);

  if (!urls.size) return [];

  const results = await Promise.all(
    [...urls].map(async (url, index) => {
      const blob = await fetchLocalBlob(url);
      if (!blob) return null;
      return {
        originalUrl: url,
        assetPath: `assets/${assetFilename(url, index + 1)}`,
        blob,
      } satisfies AssetEntry;
    })
  );

  return results.filter((e): e is AssetEntry => e !== null);
};

// ─── URL rewriter ─────────────────────────────────────────────────────────────
// Replaces local URLs in the HTML with relative `assets/<filename>` paths.
// Mirrors the mediaMap post-pass in buildHtml() but writes paths, not data URIs.

const rewriteAssetUrls = (html: string, assets: AssetEntry[]): string => {
  let out = html;
  for (const { originalUrl, assetPath } of assets) {
    const rawEscaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const htmlEncoded = originalUrl
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const htmlEscaped = htmlEncoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    out = out.replace(new RegExp(`(src|href)="${rawEscaped}"`, "g"), `$1="${assetPath}"`);
    if (htmlEncoded !== originalUrl) {
      out = out.replace(new RegExp(`(src|href)="${htmlEscaped}"`, "g"), `$1="${assetPath}"`);
    }
  }
  return out;
};

// ─── Minimal ZIP builder (no dependencies) ───────────────────────────────────
// Writes a spec-compliant ZIP using STORE (no compression).
// STORE is fine here: images/video are already compressed; HTML is small.

const u8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const le16 = (n: number) => { const a = new Uint8Array(2); new DataView(a.buffer).setUint16(0, n, true); return a; };
const le32 = (n: number) => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n, true); return a; };

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
};

const concat = (...arrays: Uint8Array[]): Uint8Array => {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
};

interface ZipEntry { name: string; data: Uint8Array; }

const buildZip = (entries: ZipEntry[]): Blob => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const now = new Date();
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);

  for (const entry of entries) {
    const nameBytes = u8(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    // Local file header (PK\x03\x04)
    const localHeader = concat(
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
      le16(20), le16(0), le16(0),   // version, flags, STORE
      le16(dosTime), le16(dosDate),
      le32(crc), le32(size), le32(size),
      le16(nameBytes.length), le16(0),
      nameBytes,
    );
    localParts.push(localHeader, entry.data);

    // Central directory header (PK\x01\x02)
    centralParts.push(concat(
      new Uint8Array([0x50, 0x4B, 0x01, 0x02]),
      le16(20), le16(20), le16(0), le16(0),
      le16(dosTime), le16(dosDate),
      le32(crc), le32(size), le32(size),
      le16(nameBytes.length), le16(0), le16(0),
      le16(0), le16(0), le32(0),
      le32(offset),
      nameBytes,
    ));
    offset += localHeader.length + entry.data.length;
  }

  const centralDir = concat(...centralParts);
  const eocd = concat(
    new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
    le16(0), le16(0),
    le16(entries.length), le16(entries.length),
    le32(centralDir.length), le32(offset),
    le16(0),
  );

  return new Blob([...localParts, centralDir, eocd], { type: "application/zip" });
};

// ─── Public types ─────────────────────────────────────────────────────────────

export type PublishProgress =
  | { phase: "idle" }
  | { phase: "collecting" }
  | { phase: "building" }
  | { phase: "zipping"; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

export interface PublishResult {
  /** Trigger the browser download of the zip file. */
  download: () => void;
  /** Number of local asset files bundled into assets/. */
  assetCount: number;
  /** Approximate zip size in bytes. */
  zipSize: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useNotePublish
 *
 * Builds a self-hostable ZIP from a note:
 *   index.html    — full note HTML with local URLs rewritten to `assets/<file>`
 *   assets/       — all local media files (images, audio, video, attachments)
 *
 * CSS and JS are unchanged from the normal HTML export — all CDN-hosted,
 * all hardcoded hex colours — so the site works from any static origin.
 *
 * Usage:
 *   const { publishZip } = useNotePublish(buildHtml);
 *   const result = await publishZip(note, setProgress);
 *   result.download();
 *
 * @param buildHtmlFn  Pass the `buildHtml` function exported from useNoteExport.
 *                     Signature: (note, forPdf, mediaMap) => string
 */
export const useNotePublish = (
  buildHtmlFn: (note: Note, forPdf: boolean, mediaMap: Map<string, string>) => string
) => {
  const publishZip = useCallback(
    async (
      note: Note,
      onProgress?: (p: PublishProgress) => void
    ): Promise<PublishResult> => {
      try {
        // 1. Collect local assets from OPFS / blob URLs
        onProgress?.({ phase: "collecting" });
        const assets = await collectAssets(note);

        // 2. Build HTML — pass an empty MediaMap so local URLs stay as-is,
        //    then rewrite them to relative `assets/` paths ourselves.
        onProgress?.({ phase: "building" });
        const rawHtml = buildHtmlFn(note, false, new Map());
        const html = rewriteAssetUrls(rawHtml, assets);

        // 3. Assemble ZIP
        onProgress?.({ phase: "zipping", total: assets.length + 1 });

        const zipEntries: ZipEntry[] = [
          { name: "index.html", data: u8(html) },
          ...await Promise.all(
            assets.map(async (a) => ({
              name: a.assetPath,
              data: new Uint8Array(await a.blob.arrayBuffer()),
            }))
          ),
        ];

        const zipBlob = buildZip(zipEntries);
        onProgress?.({ phase: "done" });

        const filename = `${safeName(note.title)}_site.zip`;

        return {
          assetCount: assets.length,
          zipSize: zipBlob.size,
          download: () => {
            const url = URL.createObjectURL(zipBlob);
            const a = Object.assign(document.createElement("a"), {
              href: url,
              download: filename,
              style: "display:none",
            });
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        onProgress?.({ phase: "error", message });
        throw err;
      }
    },
    [buildHtmlFn]
  );

  return { publishZip };
};