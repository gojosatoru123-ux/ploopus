"use client";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, X, ChevronRight, FileText,
  Search, Maximize2, Minimize2,
  Layers, Calendar, FolderOpen, Play, Pause,
  Sparkles, Zap, Brain, FileSearch, AlertCircle,
  ChevronDown, Tag, File, Code2, Table2, Presentation,
  Music, Video, Image as ImageIcon, BookOpen, Hash
} from "lucide-react";
import { NoteIndex, Folder, CalendarEvent, FlashcardDeck } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  type: "note" | "tag" | "folder" | "deck" | "event" | "media";
  color: string;
  accent: string;
  parentId?: string;
  mediaType?: "image" | "video" | "audio" | "file";
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface SemanticResult {
  id: string;
  title: string;
  type: "note" | "media" | "deck";
  mediaSubtype?: string;
  tags?: string[];
  folderId?: string;
  deckId?: string;
  deckName?: string;
  cardIndex?: number;
  score: number;
  bm25Score: number;
  fuzzyScore: number;
  lsaScore: number;
  snippet: string;
  matchedTerms: string[];
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const PALETTE = {
  bgCanvas: "#0A0A0F",
  nodeBg: "#111114",
  note: { base: "#60A5FA", accent: "rgba(96, 165, 250, 0.12)" },
  tag: { base: "#FBBF24", accent: "rgba(251, 191, 36, 0.12)" },
  folder: { base: "#E2E8F0", accent: "rgba(226, 232, 240, 0.08)" },
  deck: { base: "#4ADE80", accent: "rgba(74, 222, 128, 0.12)" },
  event: { base: "#C084FC", accent: "rgba(192, 132, 252, 0.12)" },
  media: { base: "#A78BFA", accent: "rgba(167, 139, 250, 0.12)" }
};

const INDEXES_FILE = "note-indexes-nickblake.json";
const FOLDERS_FILE = "folders-nickblake.json";
const SLIDEDECK_FILE = "ploopus-flashcard-decks-nickblake.json";
const CALENDAR_FILE = "ploopus-calendar-events-nickblake.json";

// ─── Semantic Search Worker Code (inline blob) ───────────────────────────────

const SEMANTIC_WORKER_CODE = `
// ─── Utilities ─────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the","a","an","and","or","but","in","on","at","to","for","of","with",
  "by","from","is","was","are","were","be","been","has","have","had",
  "do","does","did","will","would","could","should","may","might","shall",
  "this","that","these","those","it","its","i","we","you","he","she","they",
  "me","him","her","us","them","my","your","his","our","their","what","which",
  "who","when","where","how","why","not","no","so","as","if","then","than",
  "into","onto","up","out","off","over","under","about","through","after","before"
]);

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^\\w\\s'-]/g," ").split(/\\s+/)
    .map(t => t.replace(/^['-]+|['-]+$/g,""))
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

function stem(word) {
  if (word.length < 4) return word;
  if (word.endsWith("ies")) return word.slice(0,-3)+"y";
  if (word.endsWith("ied")) return word.slice(0,-3)+"y";
  if (word.endsWith("ing") && word.length > 6) return word.slice(0,-3);
  if (word.endsWith("tion")) return word.slice(0,-4);
  if (word.endsWith("tions")) return word.slice(0,-5);
  if (word.endsWith("ness")) return word.slice(0,-4);
  if (word.endsWith("ment")) return word.slice(0,-4);
  if (word.endsWith("ical")) return word.slice(0,-4);
  if (word.endsWith("ally")) return word.slice(0,-4);
  if (word.endsWith("ful")) return word.slice(0,-3);
  if (word.endsWith("less")) return word.slice(0,-4);
  if (word.endsWith("er") && word.length > 5) return word.slice(0,-2);
  if (word.endsWith("ed") && word.length > 5) return word.slice(0,-2);
  if (word.endsWith("ly") && word.length > 5) return word.slice(0,-2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) return word.slice(0,-1);
  return word;
}

function stemTokenize(text) {
  return tokenize(text).map(stem);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++)
    for (let j = 1; j <= a.length; j++)
      m[i][j] = b[i-1] === a[j-1] ? m[i-1][j-1] : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
  return m[b.length][a.length];
}

function fuzzyMatchScore(query, tokens) {
  if (!tokens.length) return 0;
  const qS = stem(query.toLowerCase());
  let best = 0;
  for (const tok of tokens) {
    const tS = stem(tok);
    if (tS === qS) { best = Math.max(best, 1.0); continue; }
    if (tS.includes(qS) || qS.includes(tS)) { best = Math.max(best, 0.8); continue; }
    const maxLen = Math.max(qS.length, tS.length);
    if (maxLen > 0) {
      const sim = 1 - levenshtein(qS, tS) / maxLen;
      if (sim > 0.6) best = Math.max(best, sim * 0.7);
    }
  }
  return best;
}

const BM25_K1 = 1.5, BM25_B = 0.75;
function computeBM25(queryTerms, doc, avgDocLen, idfMap) {
  let score = 0;
  const docLen = doc.tokens.length;
  for (const term of queryTerms) {
    const tf = doc.tf.get(term) ?? 0;
    if (!tf) continue;
    const idf = idfMap.get(term) ?? 0;
    const tfNorm = (tf*(BM25_K1+1)) / (tf+BM25_K1*(1-BM25_B+BM25_B*docLen/avgDocLen));
    score += idf * tfNorm;
  }
  return score;
}

function buildTFIDF(terms, tf, idfMap) {
  const vec = new Map();
  for (const term of terms) {
    const tfVal = tf.get(term) ?? 0;
    const idf = idfMap.get(term) ?? 0;
    if (tfVal > 0) vec.set(term, tfVal * idf);
  }
  return vec;
}

function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (const [k, va] of a) { const vb = b.get(k) ?? 0; dot += va*vb; normA += va*va; }
  for (const [, vb] of b) normB += vb*vb;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function extractSnippet(content, queryTerms, maxLen = 240) {
  if (!content) return "";
  const lower = content.toLowerCase();
  let bestIdx = -1, bestCount = 0;
  for (let i = 0; i < lower.length - 180; i += 40) {
    const chunk = lower.slice(i, i+180);
    let count = 0;
    for (const t of queryTerms) if (chunk.includes(t)) count++;
    if (count > bestCount) { bestCount = count; bestIdx = i; }
  }
  if (bestIdx === -1) bestIdx = 0;
  let snip = content.slice(bestIdx, bestIdx+maxLen).trim();
  if (bestIdx > 0) snip = "…" + snip;
  if (bestIdx+maxLen < content.length) snip += "…";
  return snip;
}

// ─── File Extraction ─────────────────────────────────────────────────────────

async function readFullNote(id) {
    try {
      const root = await navigator.storage.getDirectory();
      const notesDir = await root.getDirectoryHandle("notes", { create: false });
      const fileHandle = await notesDir.getFileHandle(id + ".json");
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    } catch (e) { return null; }
  }

async function extractTextFromFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const textExts = ["txt","md","markdown","json","js","ts","jsx","tsx","css","html","htm",
    "py","java","cpp","c","cs","go","rs","rb","php","sh","bash","yml","yaml",
    "xml","sql","r","swift","kt","dart","scala","vue","svelte","csv","tsv"];
  if (textExts.includes(ext)) {
    try { return (await file.text()).slice(0, 100000); } catch { return ""; }
  }
  if (ext === "pdf") return await extractPDFText(file);
  if (["docx","doc"].includes(ext)) return await extractDocxText(file);
  if (["pptx","ppt"].includes(ext)) return await extractPptxText(file);
  if (["xlsx","xls"].includes(ext)) return await extractXlsxText(file);
  return "";
}

async function extractPDFText(file) {
  try {
    const buf = await file.arrayBuffer();
    const raw = new TextDecoder("latin1").decode(new Uint8Array(buf));
    const texts = [];
    const btRe = /BT([\\s\\S]*?)ET/g;
    let m;
    while ((m = btRe.exec(raw)) !== null) {
      const block = m[1];
      for (const mm of block.matchAll(/\\(([^)]*)\\)\\s*(?:Tj|'|")/g)) {
        const d = mm[1].replace(/\\\\n/g," ").replace(/\\\\r/g," ")
          .replace(/\\\\t/g," ").replace(/\\\\\\\\(.)/g,"$1")
          .replace(/\\\\([0-7]{3})/g,(_,o)=>String.fromCharCode(parseInt(o,8)));
        if (d.trim()) texts.push(d);
      }
      for (const mm of block.matchAll(/\\[([^\\]]*)\\]/g)) {
        for (const s of mm[1].matchAll(/\\(([^)]*)\\)/g))
          if (s[1].trim()) texts.push(s[1].replace(/\\\\n/g," "));
      }
    }
    return texts.join(" ").slice(0, 100000);
  } catch { return ""; }
}

async function extractFromZip(zipBytes, targets) {
  try {
    const view = new DataView(zipBytes.buffer);
    let offset = 0;
    while (offset < zipBytes.length - 30) {
      const sig = view.getUint32(offset, true);
      if (sig !== 0x04034b50) break;
      const fileNameLen = view.getUint16(offset+26, true);
      const extraLen = view.getUint16(offset+28, true);
      const compressedSize = view.getUint32(offset+18, true);
      const compression = view.getUint16(offset+8, true);
      const fileName = new TextDecoder().decode(zipBytes.slice(offset+30, offset+30+fileNameLen));
      const dataStart = offset + 30 + fileNameLen + extraLen;
      const dataEnd = dataStart + compressedSize;
      if (targets.some(t => fileName === t || fileName.endsWith("/"+t.split("/").pop()))) {
        const compressed = zipBytes.slice(dataStart, dataEnd);
        let text = "";
        if (compression === 0) {
          text = new TextDecoder("utf-8",{fatal:false}).decode(compressed);
        } else if (compression === 8) {
          try {
            const ds = new DecompressionStream("deflate-raw");
            const writer = ds.writable.getWriter();
            const reader = ds.readable.getReader();
            writer.write(compressed); writer.close();
            const chunks = [];
            while (true) { const {done,value} = await reader.read(); if(done)break; chunks.push(value); }
            const total = chunks.reduce((a,c)=>a+c.length,0);
            const merged = new Uint8Array(total);
            let pos = 0;
            for (const c of chunks) { merged.set(c,pos); pos += c.length; }
            text = new TextDecoder("utf-8",{fatal:false}).decode(merged);
          } catch { text = ""; }
        }
        return text;
      }
      offset = dataEnd;
      while (offset < zipBytes.length-4) {
        const ns = view.getUint32(offset,true);
        if (ns===0x04034b50||ns===0x02014b50||ns===0x06054b50) break;
        offset++;
      }
    }
    return null;
  } catch { return null; }
}

async function extractDocxText(file) {
  try {
    const buf = await file.arrayBuffer();
    const text = await extractFromZip(new Uint8Array(buf), ["word/document.xml","word/body.xml"]);
    return text ? text.replace(/<[^>]+>/g," ").replace(/\\s+/g," ").trim().slice(0,100000) : "";
  } catch { return ""; }
}

async function extractPptxText(file) {
  try {
    const buf = await file.arrayBuffer();
    const zip = new Uint8Array(buf);
    const texts = [];
    for (let i = 1; i <= 200; i++) {
      const t = await extractFromZip(zip, [\`ppt/slides/slide\${i}.xml\`]);
      if (!t) break;
      const s = t.replace(/<[^>]+>/g," ").replace(/\\s+/g," ").trim();
      if (s) texts.push(s);
    }
    return texts.join(" ").slice(0,100000);
  } catch { return ""; }
}

async function extractXlsxText(file) {
  try {
    const buf = await file.arrayBuffer();
    const zip = new Uint8Array(buf);
    const ss = await extractFromZip(zip,["xl/sharedStrings.xml"]);
    const sh = await extractFromZip(zip,["xl/worksheets/sheet1.xml"]);
    return [ss,sh].filter(Boolean).join(" ").replace(/<[^>]+>/g," ").replace(/\\s+/g," ").trim().slice(0,100000);
  } catch { return ""; }
}

// ─── Index State ──────────────────────────────────────────────────────────────

let indexedDocs = [];
let idfMap = new Map();
let avgDocLen = 0;
let indexBuilt = false;

async function buildIndex(noteIndexes, progressCb) {
  indexedDocs = [];

  // Notes
  for (let i = 0; i < noteIndexes.length; i++) {
    const note = noteIndexes[i];
    const tags = (note.tags || []).map(t => t.label || t);
    const contentParts = [note.title||"", ...tags];
    if (note.preview) contentParts.push(note.preview);
    if (note.summary) contentParts.push(note.summary);
    if (note.description) contentParts.push(note.description);
    const noteData = await readFullNote(note.id);
    const content=noteData.map(item=>item.content).join(" ")

    const titleToks = stemTokenize(note.title||"");
    const tagToks = tags.flatMap(t=>stemTokenize(t));
    const baseToks = stemTokenize(content);
    const boosted = [...titleToks,...titleToks,...titleToks,...titleToks,...tagToks,...tagToks,...baseToks];

    const tf = new Map();
    for (const t of boosted) tf.set(t,(tf.get(t)??0)+1);

    indexedDocs.push({ id:note.id, title:note.title||"Untitled", content, type:"note", tags, folderId:note.folderId, tokens:boosted, tf });
    if (i%50===0) progressCb(Math.round(i/noteIndexes.length*40));
  }

  // Flashcard Decks
  try {
    const root = await navigator.storage.getDirectory();
    const decksFile = await root.getFileHandle("ploopus-flashcard-decks-nickblake.json");
    const decksRaw = JSON.parse(await (await decksFile.getFile()).text());
    for (const deck of decksRaw) {
      const deckName = deck.name || deck.title || "Untitled Deck";
      const cards = deck.cards || deck.flashcards || [];
      cards.forEach((card, idx) => {
        const content = card.content;
        const titleToks = stemTokenize(deckName);
        const baseToks = stemTokenize(content);
        const boosted = [...titleToks,...titleToks,...titleToks,...baseToks];
        const tf = new Map();
        for (const t of boosted) tf.set(t,(tf.get(t)??0)+1);
        indexedDocs.push({
          id: "deck-card-" + deck.id + "-" + idx,
          title:  deckName,
          content,
          type: "deck",
          deckId: deck.id,
          deckName,
          cardIndex: idx,
          tokens: boosted,
          tf
        });
      });
    }
  } catch {}

  // Media
  try {
    const root = await navigator.storage.getDirectory();
    const mediaDir = await root.getDirectoryHandle("media",{create:false});
    const entries = [];
    for await (const [name,handle] of mediaDir.entries()) if (handle.kind==="file") entries.push([name,handle]);

    for (let i = 0; i < entries.length; i++) {
      const [name,handle] = entries[i];
      try {
        const file = await handle.getFile();
        const extracted = await extractTextFromFile(file);
        const ext = name.split(".").pop()?.toLowerCase()??"";
        let mediaSubtype = "file";
        if (["jpg","jpeg","png","gif","webp","heic"].includes(ext)) mediaSubtype="image";
        else if (["mp4","mov","webm","avi"].includes(ext)) mediaSubtype="video";
        else if (["mp3","wav","m4a","aac"].includes(ext)) mediaSubtype="audio";
        else if (ext==="pdf") mediaSubtype="pdf";
        else if (["doc","docx"].includes(ext)) mediaSubtype="doc";
        else if (["ppt","pptx"].includes(ext)) mediaSubtype="ppt";
        else if (["xlsx","xls"].includes(ext)) mediaSubtype="spreadsheet";
        else if (["csv","tsv"].includes(ext)) mediaSubtype="csv";
        else if (["js","ts","jsx","tsx","py","java","cpp","c","cs","go","rs"].includes(ext)) mediaSubtype="code";
        else if (["md","markdown"].includes(ext)) mediaSubtype="markdown";
        else if (["json","yml","yaml","xml"].includes(ext)) mediaSubtype="data";

        const nameClean = name.replace(/\\.[^.]+$/,"").replace(/[-_]/g," ");
        const content = [nameClean, extracted].join(" ");
        const nameToks = stemTokenize(nameClean);
        const baseToks = stemTokenize(content);
        const boosted = [...nameToks,...nameToks,...nameToks,...baseToks];
        const tf = new Map();
        for (const t of boosted) tf.set(t,(tf.get(t)??0)+1);

        indexedDocs.push({ id:"media-"+name, title:name, content:content.slice(0,5000), type:"media", mediaSubtype, tokens:boosted, tf });
      } catch {}
      if (i%20===0) progressCb(40+Math.round(i/entries.length*40));
    }
  } catch {}

  // IDF
  const N = indexedDocs.length;
  const dfMap = new Map();
  for (const doc of indexedDocs) {
    for (const t of new Set(doc.tokens)) dfMap.set(t,(dfMap.get(t)??0)+1);
  }
  idfMap = new Map();
  for (const [term,df] of dfMap) idfMap.set(term, Math.log((N-df+0.5)/(df+0.5)+1));
  avgDocLen = indexedDocs.reduce((s,d)=>s+d.tokens.length,0) / Math.max(1,N);
  indexBuilt = true;
  progressCb(100);
}

function search(rawQuery, topK=50) {
  if (!indexBuilt || !rawQuery.trim()) return [];
  const queryTokens = stemTokenize(rawQuery);
  const queryRaw = tokenize(rawQuery);
  if (!queryTokens.length) return [];

  const queryTF = new Map();
  for (const t of queryTokens) queryTF.set(t,(queryTF.get(t)??0)+1);
  const queryVec = buildTFIDF(queryTokens, queryTF, idfMap);

  const results = [];
  for (const doc of indexedDocs) {
    const bm25 = computeBM25(queryTokens, doc, avgDocLen, idfMap);
    let fuzzyTotal = 0;
    for (const qt of queryRaw) fuzzyTotal += fuzzyMatchScore(qt, doc.tokens);
    const fuzzy = queryRaw.length ? fuzzyTotal/queryRaw.length : 0;
    const docVec = buildTFIDF(queryTokens, doc.tf, idfMap);
    const lsa = cosineSim(queryVec, docVec);

    const titleToks = stemTokenize(doc.title);
    let titleBoost = 0;
    for (const qt of queryTokens) {
      if (titleToks.includes(qt)) titleBoost += 2.5;
      else for (const tt of titleToks) if (tt.includes(qt)||qt.includes(tt)) { titleBoost += 1.2; break; }
    }
    let tagBoost = 0;
    if (doc.tags?.length) {
      const tagToks = doc.tags.flatMap(t=>stemTokenize(t));
      for (const qt of queryTokens) if (tagToks.includes(qt)) tagBoost += 1.8;
    }

    const score = bm25*1.0 + fuzzy*2.5 + lsa*3.0 + titleBoost + tagBoost;
    if (score > 0.01) {
      const matchedTerms = queryRaw.filter(qt => doc.content.toLowerCase().includes(qt) || doc.title.toLowerCase().includes(qt));
      results.push({ id:doc.id, title:doc.title, type:doc.type, mediaSubtype:doc.mediaSubtype, tags:doc.tags, folderId:doc.folderId, deckId:doc.deckId, deckName:doc.deckName, cardIndex:doc.cardIndex, score, bm25Score:bm25, fuzzyScore:fuzzy, lsaScore:lsa, snippet:extractSnippet(doc.content,queryRaw), matchedTerms:[...new Set(matchedTerms)] });
    }
  }
  return results.sort((a,b)=>b.score-a.score).slice(0,topK);
}

self.onmessage = async (e) => {
  const {type, payload} = e.data;
  if (type === "BUILD_INDEX") {
    await buildIndex(payload.noteIndexes, p => self.postMessage({type:"INDEX_PROGRESS",progress:p}));
    self.postMessage({type:"INDEX_READY", docCount:indexedDocs.length});
  } else if (type === "SEARCH") {
    if (!indexBuilt) { self.postMessage({type:"SEARCH_RESULTS",results:[],query:payload.query}); return; }
    self.postMessage({type:"SEARCH_RESULTS", results:search(payload.query, payload.topK??50), query:payload.query});
  }
};
`;

// ─── Graph Worker Code ────────────────────────────────────────────────────────

const workerCode = `
  const PALETTE = {
    note:   { base: "#60A5FA" },
    tag:    { base: "#FBBF24" },
    folder: { base: "#E2E8F0" },
    deck:   { base: "#4ADE80" },
    event:  { base: "#C084FC" },
    media:  { base: "#A78BFA" }
  };

  function deepFindFields(obj, targetKeys) {
    let results = [];
    if (!obj || typeof obj !== 'object') return results;
    for (const key of targetKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) results.push(obj[key]);
    }
    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] && typeof obj[k] === 'object') {
        results = results.concat(deepFindFields(obj[k], targetKeys));
      }
    }
    return results;
  }

  async function readOPFSFile(fileName, fallbackDefault) {
    try {
      const root = await navigator.storage.getDirectory();
      const fileHandle = await root.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    } catch (e) { return fallbackDefault; }
  }

  async function listMediaFiles() {
    try {
      const root = await navigator.storage.getDirectory();
      const mediaDir = await root.getDirectoryHandle("media", { create: false });
      const mediaFiles = [];
      for await (const [name, handle] of mediaDir.entries()) {
        if (handle.kind === "file") {
          const ext = name.split('.').pop()?.toLowerCase() || "";
          let mediaType = "file";
          if (["jpg","jpeg","png","gif","webp","heic"].includes(ext)) mediaType = "image";
          else if (["mp4","mov","webm","avi"].includes(ext)) mediaType = "video";
          else if (["mp3","wav","m4a","aac"].includes(ext)) mediaType = "audio";
          mediaFiles.push({ id: "media-" + name, name, type: mediaType });
        }
      }
      return mediaFiles;
    } catch (e) { return []; }
  }

  async function readFullNote(id) {
    try {
      const root = await navigator.storage.getDirectory();
      const notesDir = await root.getDirectoryHandle("notes", { create: false });
      const fileHandle = await notesDir.getFileHandle(id + ".json");
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    } catch (e) { return null; }
  }

  function extractMediaUrls(note) {
    if (!note) return [];
    const targetFields = ["audioUrl", "videoUrl", "fileUrl", "imageUrl", "fileName", "imageTextUrl", "url"];
    const foundValues = deepFindFields(note, targetFields);
    const urls = new Set();
    foundValues.forEach(val => { if (typeof val === 'string' && val.trim()) urls.add(val.trim()); });
    return Array.from(urls);
  }

  self.onmessage = async (e) => {
    const { width, height } = e.data;
    if (!width || !height) return;

    const noteIndexes = await readOPFSFile("note-indexes-nickblake.json", []);
    const folders = await readOPFSFile("folders-nickblake.json", []);
    const decks = await readOPFSFile("ploopus-flashcard-decks-nickblake.json", []);
    const calendarEvents = await readOPFSFile("ploopus-calendar-events-nickblake.json", []);
    const mediaFiles = await listMediaFiles();

    const folderMap = new Map(folders.map(f => [f.id, f.name]));
    const generatedNodes = [];
    const linkMap = [];
    const centerX = width / 2;
    const centerY = height / 2;

    const uniqueFolderIds = [...new Set(noteIndexes.map(n => n.folderId).filter(Boolean))];
    const uniqueTags = [...new Set(noteIndexes.flatMap(n => (n.tags || []).map(t => t.label)))];

    const folderPositions = new Map();
    const notePositions = new Map();
    const noteTitleMap = new Map();
    const mediaToNoteLinks = [];

    await Promise.all(noteIndexes.map(async (indexNote) => {
      const fullNote = await readFullNote(indexNote.id);
      if (!fullNote) return;
      const mediaUrls = extractMediaUrls(fullNote);
      mediaUrls.forEach(url => {
        let cleanName = "";
        try { cleanName = decodeURIComponent(url.split('/').pop()?.split('?')[0]?.trim() || ""); }
        catch(err) { cleanName = url.split('/').pop()?.split('?')[0]?.trim() || ""; }
        if (!cleanName) return;
        const matchingMedia = mediaFiles.find(m => {
          const targetName = m.name.toLowerCase();
          const sourceName = cleanName.toLowerCase();
          return targetName === sourceName || targetName.includes(sourceName) || sourceName.includes(targetName);
        });
        if (matchingMedia) mediaToNoteLinks.push({ source: indexNote.id, target: matchingMedia.id });
      });
    }));

    uniqueFolderIds.forEach((fId, index) => {
      const angle = (index / Math.max(1, uniqueFolderIds.length)) * Math.PI * 2 - Math.PI / 2;
      const orbitR = 380;
      const x = centerX + Math.cos(angle) * orbitR;
      const y = centerY + Math.sin(angle) * orbitR;
      folderPositions.set(fId, { x, y });
      generatedNodes.push({ id: "folder-" + fId, label: folderMap.get(fId) || "Folder", x, y, radius: 22, type: "folder", color: PALETTE.folder.base, accent: "rgba(226,232,240,0.08)" });
    });

    noteIndexes.forEach((note, noteIdx) => {
      let x = centerX + (Math.random() - 0.5) * 700;
      let y = centerY + (Math.random() - 0.5) * 600;
      if (note.folderId && folderPositions.has(note.folderId)) {
        const fPos = folderPositions.get(note.folderId);
        const notesInFolder = noteIndexes.filter(n => n.folderId === note.folderId);
        const localIdx = notesInFolder.findIndex(n => n.id === note.id);
        const subAngle = (localIdx / Math.max(1, notesInFolder.length)) * Math.PI * 2;
        const subDist = 110 + (noteIdx % 3) * 38;
        x = fPos.x + Math.cos(subAngle) * subDist;
        y = fPos.y + Math.sin(subAngle) * subDist;
      }
      notePositions.set(note.id, { x, y });
      if (note.title) noteTitleMap.set(note.title.toLowerCase().trim(), note.id);
      generatedNodes.push({ id: note.id, label: note.title || "Untitled Note", x, y, radius: 11, type: "note", color: PALETTE.note.base, accent: "rgba(96,165,250,0.12)", parentId: note.folderId ? "folder-" + note.folderId : undefined });
      if (note.folderId) linkMap.push({ source: note.id, target: "folder-" + note.folderId });
      (note.tags || []).forEach(t => linkMap.push({ source: note.id, target: "tag-" + t.label }));
    });

    linkMap.push(...mediaToNoteLinks);

    decks.forEach((deck) => {
      let x = centerX + (Math.random() - 0.5) * 800;
      let y = centerY + (Math.random() - 0.5) * 700;
      const deckNameClean = (deck.name || "").toLowerCase().trim();
      let matchedNoteId = null;
      for (let [title, id] of noteTitleMap.entries()) {
        if (deckNameClean.includes(title) || title.includes(deckNameClean)) { matchedNoteId = id; break; }
      }
      if (matchedNoteId && notePositions.has(matchedNoteId)) {
        const nPos = notePositions.get(matchedNoteId);
        const angle = Math.random() * Math.PI * 2;
        x = nPos.x + Math.cos(angle) * 90;
        y = nPos.y + Math.sin(angle) * 90;
      }
      generatedNodes.push({ id: "deck-" + deck.id, label: deck.name || "Flashcard Deck", x, y, radius: 10, type: "deck", color: PALETTE.deck.base, accent: "rgba(74,222,128,0.12)", parentId: matchedNoteId || undefined });
      if (matchedNoteId) linkMap.push({ source: "deck-" + deck.id, target: matchedNoteId });
    });

    calendarEvents.forEach((event, idx) => {
      const angle = (idx / Math.max(1, calendarEvents.length)) * Math.PI * 2 + 0.3;
      generatedNodes.push({ id: "event-" + event.id, label: event.title || "Calendar Event", x: centerX + Math.cos(angle) * 750, y: centerY + Math.sin(angle) * 600, radius: 10, type: "event", color: PALETTE.event.base, accent: "rgba(192,132,252,0.12)" });
    });

    uniqueTags.forEach((tag, index) => {
      const angle = (index / Math.max(1, uniqueTags.length)) * Math.PI * 2 - 0.6;
      generatedNodes.push({ id: "tag-" + tag, label: tag, x: centerX + Math.cos(angle) * 960, y: centerY + Math.sin(angle) * 820, radius: 9, type: "tag", color: PALETTE.tag.base, accent: "rgba(251,191,36,0.12)" });
    });

    mediaFiles.forEach((media, idx) => {
      let x = centerX + (Math.random() - 0.5) * 600;
      let y = centerY + (Math.random() - 0.5) * 500;
      if (uniqueFolderIds.length > 0) {
        const fId = uniqueFolderIds[idx % uniqueFolderIds.length];
        if (folderPositions.has(fId)) {
          const fPos = folderPositions.get(fId);
          const angle = (idx / Math.max(1, mediaFiles.length)) * Math.PI * 2 + 1.0;
          x = fPos.x + Math.cos(angle) * (160 + (idx % 2) * 50);
          y = fPos.y + Math.sin(angle) * (130 + (idx % 2) * 40);
        }
      }
      generatedNodes.push({ id: media.id, label: media.name.length > 28 ? media.name.slice(0, 25) + "..." : media.name, x, y, radius: 10, type: "media", color: PALETTE.media.base, accent: "rgba(167,139,250,0.12)", mediaType: media.type });
    });

    const nodeMap = new Map(generatedNodes.map(n => [n.id, n]));
    const idealDist = 120;
    for (let tick = 0; tick < 220; tick++) {
      for (let i = 0; i < generatedNodes.length; i++) {
        const n1 = generatedNodes[i];
        for (let j = i + 1; j < generatedNodes.length; j++) {
          const n2 = generatedNodes[j];
          const dx = n2.x - n1.x, dy = n2.y - n1.y;
          const distSq = dx*dx + dy*dy;
          if (distSq < 1) continue;
          const dist = Math.sqrt(distSq);
          const minDist = (n1.type === "folder" || n2.type === "folder") ? 200 : idealDist;
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.55;
            n1.x -= dx*force*0.5; n1.y -= dy*force*0.5;
            n2.x += dx*force*0.5; n2.y += dy*force*0.5;
          }
        }
      }
      linkMap.forEach(link => {
        const src = nodeMap.get(link.source), tgt = nodeMap.get(link.target);
        if (!src || !tgt) return;
        const dx = tgt.x-src.x, dy = tgt.y-src.y;
        const dist = Math.hypot(dx,dy)||1;
        const targetLen = (tgt.type==="folder"||src.type==="folder") ? 140 : idealDist*1.1;
        const force = (dist-targetLen)/dist*0.18;
        src.x += dx*force; src.y += dy*force;
        tgt.x -= dx*force; tgt.y -= dy*force;
      });
      generatedNodes.forEach(node => { node.x += (centerX-node.x)*0.004; node.y += (centerY-node.y)*0.004; });
    }

    self.postMessage({ nodes: generatedNodes, edges: linkMap, rawNotes: noteIndexes, rawFolders: folders, rawDecks: decks, rawEvents: calendarEvents, rawMedia: mediaFiles });
  };
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMediaIcon(subtype?: string) {
  const cls = "w-4 h-4";
  switch (subtype) {
    case "pdf": return <FileText className={`${cls} text-red-400`} />;
    case "doc": return <BookOpen className={`${cls} text-blue-400`} />;
    case "ppt": return <Presentation className={`${cls} text-orange-400`} />;
    case "spreadsheet": return <Table2 className={`${cls} text-green-400`} />;
    case "csv": return <Table2 className={`${cls} text-emerald-400`} />;
    case "code": return <Code2 className={`${cls} text-cyan-400`} />;
    case "markdown": return <Hash className={`${cls} text-slate-300`} />;
    case "data": return <File className={`${cls} text-violet-400`} />;
    case "image": return <ImageIcon className={`${cls} text-pink-400`} />;
    case "video": return <Video className={`${cls} text-purple-400`} />;
    case "audio": return <Music className={`${cls} text-yellow-400`} />;
    default: return <File className={`${cls} text-slate-400`} />;
  }
}

function getSubtypeLabel(subtype?: string): string {
  const labels: Record<string, string> = {
    pdf: "PDF", doc: "Document", ppt: "Presentation", spreadsheet: "Spreadsheet",
    csv: "CSV", code: "Code", markdown: "Markdown", data: "Data File",
    image: "Image", video: "Video", audio: "Audio", file: "File"
  };
  return labels[subtype ?? "file"] ?? "File";
}

const TYPE_COLORS: Record<string, { text: string; bg: string; border: string; node: string }> = {
  note: { text: "#93C5FD", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.25)", node: "#3B82F6" },
  media: { text: "#C4B5FD", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)", node: "#8B5CF6" },
  deck: { text: "#86EFAC", bg: "rgba(74,222,128,0.10)", border: "rgba(74,222,128,0.25)", node: "#22C55E" },
};

function highlightText(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text;
  const escaped = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(re);
  return parts.map((part, i) =>
    re.test(part)
      ? <mark key={i} style={{ background: "rgba(139,92,246,0.35)", color: "#DDD6FE", borderRadius: "3px", padding: "0 2px" }}>{part}</mark>
      : part
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(100, value * 100);
  return (
    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── Semantic Panel (redesigned as floating modal popup) ──────────────────────

interface SemanticSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onHighlightNodes: (ids: Set<string> | null) => void;
  rawNotes: NoteIndex[];
  onSelectNote?: (id: string) => void;
}

function SemanticSearchPanel({ isOpen, onClose, onHighlightNodes, rawNotes, onSelectNote }: SemanticSearchPanelProps) {
  const workerRef = useRef<Worker | null>(null);
  const [indexState, setIndexState] = useState<"idle" | "building" | "ready" | "error">("idle");
  const [indexProgress, setIndexProgress] = useState(0);
  const [docCount, setDocCount] = useState(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "note" | "media" | "deck">("all");
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Boot worker — CORE LOGIC UNCHANGED
  useEffect(() => {
    if (!isOpen || workerRef.current) return;
    const blob = new Blob([SEMANTIC_WORKER_CODE], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, progress, docCount: dc, results: res } = e.data;
      if (type === "INDEX_PROGRESS") setIndexProgress(progress);
      if (type === "INDEX_READY") { setIndexState("ready"); setDocCount(dc); setIndexProgress(100); }
      if (type === "SEARCH_RESULTS") {
        setResults(res);
        setIsSearching(false);
        if (res.length > 0) {
          const ids = new Set<string>(res.map((r: SemanticResult) => {
            // Deck cards map to their parent deck graph node
            if (r.type === "deck" && r.deckId) return "deck-" + r.deckId;
            return r.id;
          }));
          onHighlightNodes(ids);
        } else {
          onHighlightNodes(null);
        }
      }
    };
    worker.onerror = () => setIndexState("error");
    return () => { worker.terminate(); workerRef.current = null; };
  }, [isOpen]);

  const handleBuildIndex = useCallback(() => {
    if (!workerRef.current) return;
    setIndexState("building");
    setIndexProgress(0);
    workerRef.current.postMessage({ type: "BUILD_INDEX", payload: { noteIndexes: rawNotes } });
  }, [rawNotes]);

  const handleSearch = useCallback((q: string) => {
    if (!workerRef.current || indexState !== "ready" || !q.trim()) {
      if (!q.trim()) { setResults([]); onHighlightNodes(null); }
      return;
    }
    setIsSearching(true);
    workerRef.current.postMessage({ type: "SEARCH", payload: { query: q, topK: 60 } });
  }, [indexState, onHighlightNodes]);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => handleSearch(v), 300);
  };

  useEffect(() => {
    if (!query) { setResults([]); onHighlightNodes(null); }
  }, [query]);

  useEffect(() => {
    if (isOpen && indexState === "ready") {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen, indexState]);

  const filtered = results.filter(r => filterType === "all" || r.type === filterType);
  const maxScore = filtered.length ? filtered[0].score : 1;
  const noteCount = results.filter(r => r.type === "note").length;
  const mediaCount = results.filter(r => r.type === "media").length;
  const deckCount = results.filter(r => r.type === "deck").length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Modal popup — top-right floating panel, no backdrop so canvas stays interactive */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.93, x: 24 }}
            transition={{ type: "spring", damping: 30, stiffness: 340, mass: 0.85 }}
            className="absolute z-50 flex flex-col"
            style={{
              top: "21px",
              right: "7px",
              width: "min(94vw, 520px)",
              height: "min(calc(100vh - 160px), 680px)",
              background: "linear-gradient(160deg, rgba(14,12,26,0.99) 0%, rgba(10,8,20,0.99) 100%)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: "24px",
              boxShadow: "0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="flex-none px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Glow icon */}
                  <div className="relative flex-none">
                    <div className="absolute inset-0 rounded-2xl blur-md" style={{ background: "rgba(139,92,246,0.5)" }} />
                    <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#7C3AED,#4F46E5)", boxShadow: "0 4px 16px rgba(124,58,237,0.5)" }}>
                      <Brain className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight" style={{ fontFamily: "'SF Pro Display', system-ui, sans-serif" }}>
                      Semantic Search
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {["BM25", "Fuzzy", "LSA"].map(m => (
                        <span key={m} className="text-[9px] font-semibold tracking-widest px-1.5 py-0.5 rounded-md"
                          style={{ color: "rgba(167,139,250,0.8)", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ color: "rgba(148,163,184,0.7)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.7)"; }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* ── Index idle ── */}
              {indexState === "idle" && (
                <button
                  onClick={handleBuildIndex}
                  className="w-full h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg,#7C3AED 0%,#4F46E5 100%)", boxShadow: "0 6px 24px rgba(124,58,237,0.4), inset 0 1px 0 rgba(255,255,255,0.12)" }}
                >
                  <Zap className="w-4 h-4" />
                  Build Search Index
                </button>
              )}

              {/* ── Index building ── */}
              {indexState === "building" && (
                <div className="space-y-3 p-4 rounded-2xl" style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.15)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-violet-300">
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                      Indexing your knowledge…
                    </div>
                    <span className="font-mono text-sm font-bold text-violet-400">{indexProgress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg,#7C3AED,#818CF8,#2563EB)" }}
                      animate={{ width: `${indexProgress}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>
                    Parsing PDFs · DOCX · PPTX · XLSX · Code · Markdown
                  </p>
                </div>
              )}

              {/* ── Index error ── */}
              {indexState === "error" && (
                <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <AlertCircle className="w-5 h-5 text-red-400 flex-none" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Index build failed</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.6)" }}>Check OPFS storage permissions</p>
                  </div>
                  <button onClick={handleBuildIndex} className="ml-auto text-xs text-red-400 hover:text-red-200 transition-colors flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {/* ── Index ready: search bar ── */}
              {indexState === "ready" && (
                <div className="space-y-3">
                  {/* Status row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                      style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", color: "#6EE7B7" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {docCount.toLocaleString()} documents indexed
                    </div>
                    <button onClick={handleBuildIndex} className="flex items-center gap-1 text-[11px] transition-colors"
                      style={{ color: "rgba(148,163,184,0.5)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.9)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.5)"; }}>
                      <RotateCcw className="w-3 h-3" /> Rebuild
                    </button>
                  </div>

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "rgba(139,92,246,0.7)" }} />
                    <input
                      ref={inputRef}
                      className="w-full h-12 rounded-2xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
                      style={{
                        paddingLeft: "2.75rem", paddingRight: query ? "2.75rem" : "1rem",
                        background: "rgba(255,255,255,0.04)",
                        border: "1.5px solid rgba(139,92,246,0.25)",
                        boxShadow: "0 0 0 0 transparent",
                      }}
                      placeholder="Search across all files and notes…"
                      value={query}
                      onChange={e => handleQueryChange(e.target.value)}
                      onFocus={e => { e.currentTarget.style.border = "1.5px solid rgba(139,92,246,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.12)"; }}
                      onBlur={e => { e.currentTarget.style.border = "1.5px solid rgba(139,92,246,0.25)"; e.currentTarget.style.boxShadow = "none"; }}
                      autoFocus
                    />
                    {query && (
                      <button onClick={() => handleQueryChange("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-all"
                        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(148,163,184,0.7)" }}>
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter tabs */}
                  {results.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      {([
                        { key: "all", label: `All`, count: results.length },
                        { key: "note", label: "Notes", count: noteCount },
                        { key: "media", label: "Files", count: mediaCount },
                        { key: "deck", label: "Cards", count: deckCount },
                      ] as const).map(f => (
                        <button
                          key={f.key}
                          onClick={() => setFilterType(f.key)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                          style={filterType === f.key
                            ? { background: "rgba(139,92,246,0.2)", color: "#C4B5FD", border: "1px solid rgba(139,92,246,0.4)" }
                            : { background: "rgba(255,255,255,0.04)", color: "rgba(148,163,184,0.6)", border: "1px solid rgba(255,255,255,0.06)" }
                          }
                        >
                          {f.label}
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold"
                            style={{ background: filterType === f.key ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.08)" }}>
                            {f.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Results list ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
              style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(139,92,246,0.2) transparent" }}>

              {/* Searching spinner */}
              {isSearching && (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
                    <div className="absolute inset-1.5 rounded-full border border-violet-400/30 border-b-violet-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.6s" }} />
                  </div>
                  <p className="text-sm text-slate-500">Searching semantically…</p>
                </div>
              )}

              {/* No results */}
              {!isSearching && query && filtered.length === 0 && indexState === "ready" && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <FileSearch className="w-6 h-6" style={{ color: "rgba(148,163,184,0.3)" }} />
                  </div>
                  <div>
                    <p className="text-slate-300 text-sm font-medium">No results found</p>
                    <p className="text-xs mt-1" style={{ color: "rgba(148,163,184,0.4)" }}>Try different keywords or broader terms</p>
                  </div>
                </div>
              )}

              {/* Idle prompt */}
              {!isSearching && !query && indexState === "ready" && (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl blur-xl opacity-40" style={{ background: "rgba(139,92,246,0.4)" }} />
                    <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.2),rgba(79,70,229,0.2))", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <Sparkles className="w-6 h-6 text-violet-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-200 text-sm font-semibold">Start typing to search</p>
                    <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "rgba(148,163,184,0.5)", maxWidth: "260px" }}>
                      Searches across notes, PDFs, DOCX, PPTX, XLSX, code files & more
                    </p>
                  </div>
                </div>
              )}

              {/* Results */}
              <AnimatePresence initial={false}>
                {!isSearching && filtered.map((result, idx) => {
                  const relScore = result.score / maxScore;
                  const isExpanded = expandedId === result.id;
                  const tc = TYPE_COLORS[result.type] ?? TYPE_COLORS.media;
                  const scoreColor = relScore > 0.75 ? "#A78BFA" : relScore > 0.45 ? "#818CF8" : "#64748B";

                  return (
                    <motion.div
                      key={result.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ delay: Math.min(idx * 0.025, 0.25), duration: 0.2 }}
                      className="rounded-2xl overflow-hidden cursor-pointer transition-all"
                      style={{
                        background: isExpanded
                          ? "rgba(139,92,246,0.06)"
                          : "rgba(255,255,255,0.025)",
                        border: `1px solid ${isExpanded ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                        boxShadow: isExpanded ? "0 4px 24px rgba(139,92,246,0.12)" : "none",
                      }}
                      onClick={() => setExpandedId(isExpanded ? null : result.id)}
                    >
                      <div className="p-4">
                        {/* Top row */}
                        <div className="flex items-start gap-3">
                          {/* Node icon — solid filled */}
                          <div className="relative flex-none mt-0.5">
                            <div className="absolute inset-0 rounded-xl blur-sm opacity-60"
                              style={{ background: tc.node }} />
                            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ background: `linear-gradient(135deg, ${tc.node}33, ${tc.node}18)`, border: `1px solid ${tc.border}` }}>
                              {result.type === "note"
                                ? <FileText className="w-4 h-4" style={{ color: tc.text }} />
                                : result.type === "deck"
                                  ? <Layers className="w-4 h-4" style={{ color: tc.text }} />
                                  : getMediaIcon(result.mediaSubtype)
                              }
                            </div>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold leading-snug" style={{ color: "#F1F5F9" }}>
                                {result.type === "media" ? result.title.slice(14) : result.title}
                              </p>
                              {/* Score badge */}
                              <div className="flex-none flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-bold font-mono" style={{ color: scoreColor }}>
                                  {Math.round(relScore * 100)}%
                                </span>
                                <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200"
                                  style={{ color: "rgba(148,163,184,0.5)", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }} />
                              </div>
                            </div>

                            {/* Type badge + tags + deck name */}
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-lg"
                                style={{ color: tc.text, background: tc.bg, border: `1px solid ${tc.border}` }}>
                                {result.type === "note" ? "Note" : result.type === "deck" ? "Flashcard" : getSubtypeLabel(result.mediaSubtype)}
                              </span>
                              {result.type === "deck" && result.deckName && (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                                  style={{ color: "#86EFAC", background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.18)" }}>
                                  <Layers className="w-2.5 h-2.5" />{result.deckName}
                                </span>
                              )}
                              {result.type === "deck" && result.cardIndex !== undefined && (
                                <span className="text-[10px] px-2 py-0.5 rounded-lg"
                                  style={{ color: "rgba(134,239,172,0.6)", background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.1)" }}>
                                  Card #{result.cardIndex + 1}
                                </span>
                              )}
                              {result.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                                  style={{ color: "#FCD34D", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)" }}>
                                  <Tag className="w-2.5 h-2.5" />{tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Relevance bar */}
                        <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${relScore * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: idx * 0.03 }}
                            style={{ background: `linear-gradient(90deg, ${scoreColor}, ${relScore > 0.6 ? "#C4B5FD" : scoreColor})` }}
                          />
                        </div>

                        {/* Snippet preview */}
                        {result.snippet && (
                          <p className="mt-2.5 text-[11.5px] leading-relaxed line-clamp-2" style={{ color: "rgba(148,163,184,0.65)" }}>
                            {highlightText(result.snippet, result.matchedTerms)}
                          </p>
                        )}
                      </div>

                      {/* ── Expanded panel ── */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>

                              {/* Full snippet card */}
                              {result.snippet && (
                                <div className="rounded-xl p-3.5 text-[12px] leading-relaxed"
                                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(203,213,225,0.8)" }}>
                                  {highlightText(result.snippet, result.matchedTerms)}
                                </div>
                              )}

                              {/* Matched terms */}
                              {result.matchedTerms.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: "rgba(148,163,184,0.4)" }}>
                                    Matched terms
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {result.matchedTerms.map(t => (
                                      <span key={t} className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                                        style={{ background: "rgba(59,130,246,0.1)", color: "#93C5FD", border: "1px solid rgba(59,130,246,0.2)" }}>
                                        {t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Score breakdown */}
                              <div>
                                <p className="text-[10px] uppercase tracking-widest font-semibold mb-2.5" style={{ color: "rgba(148,163,184,0.4)" }}>
                                  Score breakdown
                                </p>
                                <div className="space-y-2">
                                  {[
                                    { label: "BM25", value: result.bm25Score / 10, color: "#60A5FA", raw: result.bm25Score.toFixed(2), desc: "Term frequency" },
                                    { label: "Fuzzy", value: result.fuzzyScore, color: "#FBBF24", raw: result.fuzzyScore.toFixed(2), desc: "Fuzzy matching" },
                                    { label: "LSA", value: result.lsaScore, color: "#A78BFA", raw: result.lsaScore.toFixed(2), desc: "Semantic similarity" },
                                  ].map(s => (
                                    <div key={s.label} className="flex items-center gap-3">
                                      <div className="w-16 flex-none">
                                        <p className="text-[10px] font-bold" style={{ color: s.color }}>{s.label}</p>
                                      </div>
                                      <ScoreBar value={s.value} color={s.color} />
                                      <span className="text-[10px] font-mono w-10 text-right flex-none" style={{ color: "rgba(148,163,184,0.5)" }}>
                                        {s.raw}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Action button */}
                              {result.type === "note" && (
                                <button
                                  onClick={ev => { ev.stopPropagation(); onSelectNote?.(result.id); }}
                                  className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                                  style={{
                                    background: "linear-gradient(135deg,#7C3AED,#4F46E5)",
                                    boxShadow: "0 4px 16px rgba(124,58,237,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
                                  }}
                                >
                                  Open Note <ChevronRight className="w-4 h-4" />
                                </button>
                              )}
                              {result.type === "deck" && result.deckName && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                                  style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.18)", color: "#86EFAC" }}>
                                  <Layers className="w-3.5 h-3.5 flex-none" />
                                  <span>From deck: <span className="font-semibold">{result.deckName}</span></span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Footer count */}
              {filtered.length > 0 && !isSearching && (
                <p className="text-center text-[11px] py-3" style={{ color: "rgba(148,163,184,0.3)" }}>
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""} · sorted by relevance
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main GraphView Component ─────────────────────────────────────────────────

export function GraphView({ onSelectNote }: { onSelectNote?: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layoutNodesRef = useRef<GraphNode[]>([]);
  const layoutEdgesRef = useRef<GraphEdge[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [rawNotesState, setRawNotesState] = useState<NoteIndex[]>([]);
  const [rawFoldersState, setRawFoldersState] = useState<Folder[]>([]);
  const [rawDecksState, setRawDecksState] = useState<FlashcardDeck[]>([]);
  const [rawEventsState, setRawEventsState] = useState<CalendarEvent[]>([]);
  const [rawMediaState, setRawMediaState] = useState<any[]>([]);

  const [renderTick, setRenderTick] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [scale, setScale] = useState(0.48);
  const [offset, setOffset] = useState({ x: 80, y: 60 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // const [isAnimating, setIsAnimating] = useState(true);

  // Semantic search state
  const [semanticPanelOpen, setSemanticPanelOpen] = useState(false);
  const [semanticHighlightIds, setSemanticHighlightIds] = useState<Set<string> | null>(null);

  const stateRef = useRef({
    scale: 0.48,
    offset: { x: 80, y: 60 },
    isPanning: false,
    panStart: { x: 0, y: 0 },
    draggedNodeId: null as string | null,
  });

  useEffect(() => {
    stateRef.current.scale = scale;
    stateRef.current.offset = offset;
  }, [scale, offset]);

  const folderMap = useMemo(() => {
    const m = new Map<string, string>();
    rawFoldersState.forEach(f => m.set(f.id, f.name));
    return m;
  }, [rawFoldersState]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    setIsLoading(true);
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.postMessage({ width: dimensions.width * 1.6, height: dimensions.height * 1.6 });
    worker.onmessage = (e) => {
      const { nodes, edges, rawNotes, rawFolders, rawDecks, rawEvents, rawMedia } = e.data;
      const nodesWithVel = nodes.map((n: GraphNode) => ({ ...n, vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08 }));
      layoutNodesRef.current = nodesWithVel;
      layoutEdgesRef.current = edges;
      setRawNotesState(rawNotes);
      setRawFoldersState(rawFolders);
      setRawDecksState(rawDecks);
      setRawEventsState(rawEvents);
      setRawMediaState(rawMedia || []);
      setIsLoading(false);
      setRenderTick(prev => prev + 1);
      worker.terminate();
    };
    return () => worker.terminate();
  }, [dimensions]);

  const anchorPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  useEffect(() => {
    if (layoutNodesRef.current.length === 0) return;
    const anchors = new Map<string, { x: number; y: number }>();
    layoutNodesRef.current.forEach(n => anchors.set(n.id, { x: n.x, y: n.y }));
    anchorPositionsRef.current = anchors;
  }, [isLoading]);

  useEffect(() => {
    let raf: number;
    const animate = (timestamp: number) => {
      // if (!isAnimating || layoutNodesRef.current.length === 0) { raf = requestAnimationFrame(animate); return; }
      if (layoutNodesRef.current.length === 0) { raf = requestAnimationFrame(animate); return; }
      const delta = Math.min((timestamp - lastTimeRef.current) / 16, 2.5);
      lastTimeRef.current = timestamp;
      const nodes = layoutNodesRef.current;
      const anchors = anchorPositionsRef.current;
      nodes.forEach(node => {
        if (node.vx === undefined || node.vy === undefined) return;
        if (Math.random() < 0.008) { node.vx! += (Math.random() - 0.5) * 0.065; node.vy! += (Math.random() - 0.5) * 0.065; }
        node.vx! *= 0.935; node.vy! *= 0.935;
        node.x += node.vx! * delta * 0.45; node.y += node.vy! * delta * 0.45;
        const anchor = anchors.get(node.id);
        if (anchor) { node.x += (anchor.x - node.x) * 0.022 * delta; node.y += (anchor.y - node.y) * 0.022 * delta; }
      });
      if (Math.round(timestamp / 16) % 2 === 0) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x - a.x, dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius + 38;
            if (distSq < minDist * minDist && distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              const push = ((minDist - dist) / dist) * 0.28;
              const fx = dx * push * 0.5, fy = dy * push * 0.5;
              a.x -= fx; a.y -= fy; b.x += fx; b.y += fy;
              const anchorA = anchors.get(a.id), anchorB = anchors.get(b.id);
              if (anchorA) { anchorA.x -= fx * 0.1; anchorA.y -= fy * 0.1; }
              if (anchorB) { anchorB.x += fx * 0.1; anchorB.y += fy * 0.1; }
            }
          }
        }
      }
      setRenderTick(t => t + 1);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [dimensions]);
  // [isAnimating, dimensions]  previously here

  // Merge basic search + semantic highlight
  const filteredNodeIds = useMemo(() => {
    // Semantic search takes priority
    if (semanticHighlightIds) return semanticHighlightIds;
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    layoutNodesRef.current.forEach(node => {
      if (node.label.toLowerCase().includes(query)) {
        matches.add(node.id);
        if (node.parentId) matches.add(node.parentId);
        layoutEdgesRef.current.filter(e => e.source === node.id || e.target === node.id)
          .forEach(conn => { matches.add(conn.source); matches.add(conn.target); });
      }
    });
    return matches.size > 0 ? matches : null;
  }, [searchQuery, semanticHighlightIds, renderTick]);

  const selectedNodeInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = layoutNodesRef.current.find(n => n.id === selectedNodeId);
    if (!node) return null;
    if (node.type === "media") return { id: node.id, title: node.label, type: "media" as const, mediaType: node.mediaType, fileName: node.label };
    const baseId = node.id.replace(/^(deck-|event-|folder-)/, "");
    if (node.type === "note") {
      const rawNote = rawNotesState.find(n => n.id === node.id);
      return { id: node.id, title: node.label, type: node.type, folderName: rawNote?.folderId ? folderMap.get(rawNote.folderId) : undefined, tags: (rawNote?.tags || []).map(t => t.label) };
    }
    if (node.type === "deck") {
      const rawDeck = rawDecksState.find(d => d.id === baseId);
      return { id: node.id, title: node.label, type: node.type, cardCount: rawDeck?.cards?.length || 0 };
    }
    if (node.type === "event") {
      const rawEvent = rawEventsState.find(ev => ev.id === baseId);
      return { id: node.id, title: node.label, type: node.type, date: rawEvent?.date ? new Date(rawEvent.date).toLocaleDateString() : undefined };
    }
    const connections = layoutEdgesRef.current.filter(e => e.source === node.id || e.target === node.id).length;
    return { id: node.id, title: node.label, type: node.type, connections };
  }, [selectedNodeId, renderTick, rawNotesState, rawDecksState, rawEventsState, folderMap]);

  // Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = PALETTE.bgCanvas;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let x = 0; x < dimensions.width; x += 48) {
      for (let y = 0; y < dimensions.height; y += 48) {
        ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const pad = 300;
    const minX = -offset.x / scale - pad, maxX = (dimensions.width - offset.x) / scale + pad;
    const minY = -offset.y / scale - pad, maxY = (dimensions.height - offset.y) / scale + pad;
    const showLabels = scale > 0.38, showEdges = scale > 0.12;

    const drawNodeIcon = (node: GraphNode) => {
      const x = node.x, y = node.y, r = node.radius;
      ctx.save();
      ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff"; ctx.lineWidth = 1.4;
      ctx.lineCap = "round"; ctx.lineJoin = "round";

      if (node.type === "note") {
        const w = r * 0.88, h = r * 1.1, rx = x - w / 2, ry = y - h / 2;
        ctx.beginPath(); ctx.roundRect(rx, ry, w, h, 1.5); ctx.stroke();
        const lx1 = rx + w * 0.18, lx2 = rx + w * 0.82;
        for (let i = 0; i < 3; i++) {
          const ly = ry + h * (0.32 + i * 0.22);
          ctx.beginPath(); ctx.moveTo(lx1, ly); ctx.lineTo(i < 2 ? lx2 : lx2 * 0.72 + lx1 * 0.28, ly); ctx.stroke();
        }
      } else if (node.type === "folder") {
        const fw = r * 1.3, fh = r * 1.0;
        ctx.beginPath();
        ctx.moveTo(x - fw / 2, y - fh * 0.2); ctx.lineTo(x - fw * 0.12, y - fh * 0.2);
        ctx.lineTo(x - fw * 0.02, y - fh * 0.52); ctx.lineTo(x + fw * 0.28, y - fh * 0.52);
        ctx.lineTo(x + fw / 2, y - fh * 0.2); ctx.lineTo(x + fw / 2, y + fh * 0.48);
        ctx.lineTo(x - fw / 2, y + fh * 0.48); ctx.closePath(); ctx.stroke();
      } else if (node.type === "tag") {
        const tw = r * 1.0, th = r * 1.0;
        ctx.beginPath();
        ctx.moveTo(x - tw * 0.1, y - th * 0.5); ctx.lineTo(x + tw * 0.5, y - th * 0.5);
        ctx.lineTo(x + tw * 0.5, y + th * 0.5); ctx.lineTo(x - tw * 0.1, y + th * 0.5);
        ctx.lineTo(x - tw * 0.5, y); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - tw * 0.22, y, r * 0.14, 0, Math.PI * 2); ctx.fill();
      } else if (node.type === "deck") {
        const dw = r * 1.0, dh = r * 0.72;
        for (let i = 2; i >= 0; i--) {
          ctx.globalAlpha = i === 0 ? 1 : 0.45;
          ctx.beginPath(); ctx.roundRect(x - dw / 2 + i * 1.8, y - dh / 2 - i * 2.2, dw, dh, 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (node.type === "event") {
        const cw = r * 1.05, ch = r * 1.05;
        ctx.beginPath(); ctx.roundRect(x - cw / 2, y - ch * 0.38, cw, ch, 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - cw / 2, y - ch * 0.05); ctx.lineTo(x + cw / 2, y - ch * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + ch * 0.22, r * 0.18, 0, Math.PI * 2); ctx.fill();
        [-0.26, 0.26].forEach(ox => {
          ctx.beginPath(); ctx.moveTo(x + ox * cw, y - ch * 0.52); ctx.lineTo(x + ox * cw, y - ch * 0.22); ctx.stroke();
        });
      } else if (node.type === "media") {
        if (node.mediaType === "image") {
          const iw = r * 1.1, ih = r * 0.9;
          ctx.beginPath(); ctx.roundRect(x - iw / 2, y - ih / 2, iw, ih, 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - iw * 0.4, y + ih * 0.3); ctx.lineTo(x - iw * 0.05, y - ih * 0.05);
          ctx.lineTo(x + iw * 0.22, y + ih * 0.15); ctx.lineTo(x + iw * 0.4, y - ih * 0.1); ctx.lineTo(x + iw * 0.5, y + ih * 0.3); ctx.stroke();
          ctx.beginPath(); ctx.arc(x - iw * 0.2, y - ih * 0.2, r * 0.16, 0, Math.PI * 2); ctx.fill();
        } else if (node.mediaType === "video") {
          ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.35); ctx.lineTo(x + r * 0.42, y); ctx.lineTo(x - r * 0.2, y + r * 0.35); ctx.closePath(); ctx.fill();
        } else if (node.mediaType === "audio") {
          ctx.beginPath(); ctx.moveTo(x + r * 0.2, y - r * 0.5); ctx.lineTo(x + r * 0.2, y + r * 0.1); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - r * 0.28, y - r * 0.2); ctx.lineTo(x - r * 0.28, y + r * 0.4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x - r * 0.28, y - r * 0.2); ctx.lineTo(x + r * 0.2, y - r * 0.5); ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x + r * 0.08, y + r * 0.18, r * 0.2, r * 0.13, -0.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.48, r * 0.18, r * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
        } else {
          const fw2 = r * 0.9, fh2 = r * 1.1, fold = r * 0.28;
          ctx.beginPath();
          ctx.moveTo(x - fw2 / 2, y - fh2 / 2); ctx.lineTo(x + fw2 / 2 - fold, y - fh2 / 2);
          ctx.lineTo(x + fw2 / 2, y - fh2 / 2 + fold); ctx.lineTo(x + fw2 / 2, y + fh2 / 2);
          ctx.lineTo(x - fw2 / 2, y + fh2 / 2); ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + fw2 / 2 - fold, y - fh2 / 2); ctx.lineTo(x + fw2 / 2 - fold, y - fh2 / 2 + fold); ctx.lineTo(x + fw2 / 2, y - fh2 / 2 + fold); ctx.stroke();
        }
      }
      ctx.restore();
    };

    if (showEdges) {
      const nodeById = new Map(layoutNodesRef.current.map(n => [n.id, n]));
      layoutEdgesRef.current.forEach(edge => {
        const src = nodeById.get(edge.source), tgt = nodeById.get(edge.target);
        if (!src || !tgt) return;
        if ((src.x < minX && tgt.x < minX) || (src.x > maxX && tgt.x > maxX) ||
          (src.y < minY && tgt.y < minY) || (src.y > maxY && tgt.y > maxY)) return;
        if (filteredNodeIds && (!filteredNodeIds.has(src.id) || !filteredNodeIds.has(tgt.id))) return;
        const isActive = hoveredNodeId === src.id || selectedNodeId === src.id || hoveredNodeId === tgt.id || selectedNodeId === tgt.id;
        const dimmed = (selectedNodeId || hoveredNodeId) && !isActive;
        ctx.save();
        ctx.globalAlpha = dimmed ? 0.06 : isActive ? 0.85 : 0.22;
        if (isActive) {
          ctx.lineWidth = 1.9; ctx.strokeStyle = "#94A3B8";
          ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
        } else {
          ctx.lineWidth = 1; ctx.strokeStyle = "rgba(148,163,184,0.28)";
          ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
        }
        ctx.restore();
      });
    }

    layoutNodesRef.current.forEach(node => {
      if (node.x < minX || node.x > maxX || node.y < minY || node.y > maxY) return;
      const isActive = hoveredNodeId === node.id || selectedNodeId === node.id;
      const isSemanticHit = semanticHighlightIds?.has(node.id);
      const isFilteredOut = filteredNodeIds && !filteredNodeIds.has(node.id);
      const dimmed = !isActive && !!(selectedNodeId || hoveredNodeId);

      ctx.save();
      // Semantic hit nodes are always clearly visible — never dimmed below 0.85
      const effectiveAlpha = isFilteredOut ? 0.06 : (dimmed && !isSemanticHit) ? 0.22 : isSemanticHit && !isActive ? 0.92 : 1;
      ctx.globalAlpha = effectiveAlpha;

      const r = node.radius;

      // Solid-filled node palette
      const solidFills: Record<string, { inner: string; outer: string }> = {
        note: { inner: "#2D5FCE", outer: "#1A3A8A" },
        tag: { inner: "#C08A10", outer: "#7A5200" },
        folder: { inner: "#4A5680", outer: "#252E4A" },
        deck: { inner: "#1B8A46", outer: "#0D4F28" },
        event: { inner: "#8B3FCC", outer: "#4D1880" },
        media: { inner: "#5C35B8", outer: "#2E1A70" },
      };
      const sf = solidFills[node.type] ?? solidFills.media;

      if (node.type === "folder") {
        const sides = 6;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2 - Math.PI / 6;
          const px = node.x + Math.cos(a) * r, py = node.y + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        const folderFill = ctx.createRadialGradient(node.x, node.y - r * 0.35, r * 0.05, node.x, node.y, r * 1.15);
        folderFill.addColorStop(0, sf.inner);
        folderFill.addColorStop(1, sf.outer);
        ctx.fillStyle = folderFill; ctx.fill();
        ctx.strokeStyle = isActive ? "#F0F4FF" : node.color;
        ctx.lineWidth = isActive ? 2.8 : 2.2; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        const fill = ctx.createRadialGradient(node.x, node.y - r * 0.4, r * 0.05, node.x, node.y, r * 1.05);
        fill.addColorStop(0, sf.inner);
        fill.addColorStop(1, sf.outer);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = isActive ? "#F0F4FF" : node.color;
        ctx.lineWidth = isActive ? 2.5 : 1.8; ctx.stroke();
      }

      // Semantic highlight ring — always shown for search hits
      if (isSemanticHit) {
        ctx.save();
        ctx.globalAlpha = isActive ? 0.9 : 0.85;
        // Outer glow
        ctx.strokeStyle = "#A78BFA";
        ctx.lineWidth = isActive ? 3 : 2.5;
        ctx.shadowColor = "#A78BFA";
        ctx.shadowBlur = 8;
        ctx.setLineDash([5, 3]);
        ctx.beginPath(); ctx.arc(node.x, node.y, r + 9, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      ctx.globalAlpha = isFilteredOut ? 0.08 : (dimmed && !isSemanticHit) ? 0.22 : (isActive ? 1 : 0.88);
      drawNodeIcon(node);

      if (isActive) {
        ctx.globalAlpha = 0.55; ctx.strokeStyle = node.color; ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(node.x, node.y, r + 13, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;
      if (showLabels || isActive || node.type === "folder") {
        const displayLabel = node.type === "media" ? node.label.slice(14) : node.label;
        const label = displayLabel.length > 26 ? displayLabel.slice(0, 23) + "…" : displayLabel;
        const fontSize = node.type === "folder" ? 13 : isActive ? 12 : 10.5;
        const yOff = r + (node.type === "folder" ? 20 : 16);
        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`;
        const tw = ctx.measureText(label).width;
        const ph = 5, pw = 9;
        ctx.globalAlpha = isFilteredOut ? 0 : (dimmed && !isSemanticHit) ? 0.18 : 0.75;
        ctx.fillStyle = "rgba(8,10,20,0.82)";
        ctx.beginPath(); ctx.roundRect(node.x - tw / 2 - pw, node.y + yOff - fontSize * 0.8 - ph, tw + pw * 2, fontSize + ph * 2, 5); ctx.fill();
        ctx.globalAlpha = isFilteredOut ? 0.08 : (dimmed && !isSemanticHit) ? 0.35 : 1;
        ctx.fillStyle = isActive ? "#F8FAFF" : node.type === "folder" ? "#E2E8F0" : "rgba(200,210,230,0.9)";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(label, node.x, node.y + yOff - fontSize * 0.8 + ph * 0.5);
      }
      ctx.restore();
    });
    ctx.restore();
  }, [dimensions, scale, offset, hoveredNodeId, selectedNodeId, filteredNodeIds, semanticHighlightIds, renderTick]);

  const getCanvasMouseCoords = useCallback((clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    return {
      worldX: (clientX - rect.left - stateRef.current.offset.x) / stateRef.current.scale,
      worldY: (clientY - rect.top - stateRef.current.offset.y) / stateRef.current.scale,
    };
  }, []);

  const findHitNode = useCallback((worldX: number, worldY: number) => {
    for (let i = layoutNodesRef.current.length - 1; i >= 0; i--) {
      const node = layoutNodesRef.current[i];
      const dist = Math.hypot(node.x - worldX, node.y - worldY);
      const range = node.type === "folder" ? node.radius + 18 : node.radius + 11;
      if (dist <= range) return node;
    }
    return null;
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { worldX, worldY } = getCanvasMouseCoords(e.clientX, e.clientY, canvas);
    const hit = findHitNode(worldX, worldY);
    if (hit) {
      stateRef.current.draggedNodeId = hit.id;
      setSelectedNodeId(hit.id);
    } else {
      stateRef.current.isPanning = true;
      stateRef.current.panStart = { x: e.clientX - stateRef.current.offset.x, y: e.clientY - stateRef.current.offset.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (stateRef.current.isPanning) {
      setOffset({ x: e.clientX - stateRef.current.panStart.x, y: e.clientY - stateRef.current.panStart.y });
      return;
    }
    if (stateRef.current.draggedNodeId) {
      const { worldX, worldY } = getCanvasMouseCoords(e.clientX, e.clientY, canvas);
      const node = layoutNodesRef.current.find(n => n.id === stateRef.current.draggedNodeId);
      if (node) { node.x = worldX; node.y = worldY; if (node.vx) node.vx = (Math.random() - 0.5) * 1.1; if (node.vy) node.vy = (Math.random() - 0.5) * 1.1; setRenderTick(t => t + 1); }
      return;
    }
    const { worldX, worldY } = getCanvasMouseCoords(e.clientX, e.clientY, canvas);
    const hit = findHitNode(worldX, worldY);
    setHoveredNodeId(hit ? hit.id : null);
    canvas.style.cursor = hit ? "pointer" : "grab";
  };

  const handleMouseUp = () => { stateRef.current.isPanning = false; stateRef.current.draggedNodeId = null; };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left, mouseY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.12;
    const newScale = Math.max(0.04, Math.min(7.5, stateRef.current.scale * factor));
    setOffset({ x: mouseX - (mouseX - stateRef.current.offset.x) * (newScale / stateRef.current.scale), y: mouseY - (mouseY - stateRef.current.offset.y) * (newScale / stateRef.current.scale) });
    setScale(newScale);
  };

  const handleZoom = (dir: "in" | "out") => {
    const factor = dir === "in" ? 1.28 : 0.78;
    setScale(s => Math.max(0.04, Math.min(7.5, s * factor)));
  };

  // const toggleAnimation = () => setIsAnimating(!isAnimating);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none font-sans rounded-2xl" style={{ background: "#0A0A0F" }}>

      {/* ── Loading overlay ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: "rgba(10,10,15,0.9)", backdropFilter: "blur(16px)" }}
          >
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border border-blue-400/30 border-b-blue-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.75s" }} />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-300">Mapping your knowledge universe</p>
                <p className="text-xs mt-1" style={{ color: "rgba(148,163,184,0.4)" }}>Building the graph layout…</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Canvas — always full width; semantic search is now a modal overlay ── */}
      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* ── Top Controls bar ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 w-[calc(100%-32px)] max-w-2xl">
        {/* Search input */}
        <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl"
          style={{ background: "rgba(10,10,18,0.88)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
          <Search className="w-4 h-4 flex-none" style={{ color: "rgba(148,163,184,0.5)" }} />
          <input
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
            style={{ color: "#E2E8F0", caretColor: "#A78BFA" }}
            placeholder="Search nodes, notes, tags…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSemanticHighlightIds(null); }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="flex-none transition-opacity hover:opacity-100 opacity-60">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>

        {/* Icon buttons */}
        {[
          {
            icon: <RotateCcw className="w-4 h-4" />,
            onClick: () => { setScale(0.48); setOffset({ x: 80, y: 60 }); setSelectedNodeId(null); setSearchQuery(""); setSemanticHighlightIds(null); },
            title: "Reset view",
            active: false,
          },
          // {
          //   icon: isAnimating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />,
          //   onClick: toggleAnimation,
          //   title: isAnimating ? "Pause" : "Play",
          //   active: false,
          // },
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.onClick}
            title={btn.title}
            className="flex-none w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
            style={{
              background: "rgba(10,10,18,0.88)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              color: "rgba(148,163,184,0.7)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.7)"; }}
          >
            {btn.icon}
          </button>
        ))}

        {/* Semantic Search Button — glowing when active */}
        <button
          onClick={() => setSemanticPanelOpen(o => !o)}
          title="Semantic Search"
          className="relative flex-none w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95"
          style={{
            background: semanticPanelOpen
              ? "linear-gradient(135deg,#7C3AED,#4F46E5)"
              : "rgba(10,10,18,0.88)",
            backdropFilter: "blur(20px)",
            border: semanticPanelOpen ? "1px solid rgba(167,139,250,0.5)" : "1px solid rgba(255,255,255,0.09)",
            boxShadow: semanticPanelOpen
              ? "0 0 20px rgba(124,58,237,0.5), 0 4px 24px rgba(0,0,0,0.4)"
              : "0 4px 24px rgba(0,0,0,0.4)",
            color: semanticPanelOpen ? "#fff" : "rgba(167,139,250,0.85)",
          }}
        >
          <Sparkles className="w-4 h-4" />
          {semanticHighlightIds && !semanticPanelOpen && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: "#A78BFA", borderColor: "#0A0A0F" }} />
          )}
        </button>
      </div>

      {/* ── Bottom Legend + Zoom ── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-2.5 rounded-2xl flex-wrap justify-center"
        style={{ background: "rgba(10,10,18,0.88)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)", maxWidth: "calc(100% - 32px)" }}>
        {[
          { color: PALETTE.folder.base, label: "Folders" },
          { color: PALETTE.note.base, label: "Notes" },
          { color: PALETTE.deck.base, label: "Decks" },
          { color: PALETTE.event.base, label: "Events" },
          { color: PALETTE.tag.base, label: "Tags" },
          { color: PALETTE.media.base, label: "Media" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            {/* Solid filled dot matching graph nodes */}
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}80` }} />
            <span className="text-[10px] font-medium tracking-wide uppercase" style={{ color: "rgba(148,163,184,0.55)" }}>{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2.5" style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: "1rem", marginLeft: "0.25rem" }}>
          <button onClick={() => handleZoom("out")} className="transition-colors" style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.5)"; }}>
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] tabular-nums w-11 text-center" style={{ color: "rgba(148,163,184,0.45)" }}>
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => handleZoom("in")} className="transition-colors" style={{ color: "rgba(148,163,184,0.5)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.5)"; }}>
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Node Inspector (bottom-right card) ── */}
      <AnimatePresence>
        {selectedNodeInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="absolute bottom-20 right-4 z-30 w-72 overflow-hidden"
            style={{
              background: "rgba(12,10,22,0.97)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: "20px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
          >
            {/* Accent strip at top */}
            <div className="h-0.5 w-full" style={{
              background: selectedNodeInfo.type === "note" ? "linear-gradient(90deg,#3B82F6,transparent)" :
                selectedNodeInfo.type === "folder" ? "linear-gradient(90deg,#E2E8F0,transparent)" :
                  selectedNodeInfo.type === "deck" ? "linear-gradient(90deg,#4ADE80,transparent)" :
                    selectedNodeInfo.type === "event" ? "linear-gradient(90deg,#C084FC,transparent)" :
                      "linear-gradient(90deg,#A78BFA,transparent)"
            }} />

            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Icon with solid fill */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-none"
                    style={{
                      background: selectedNodeInfo.type === "note" ? "rgba(59,130,246,0.15)" :
                        selectedNodeInfo.type === "folder" ? "rgba(226,232,240,0.1)" :
                          selectedNodeInfo.type === "deck" ? "rgba(74,222,128,0.12)" :
                            selectedNodeInfo.type === "event" ? "rgba(192,132,252,0.12)" :
                              "rgba(167,139,250,0.12)",
                      border: `1px solid ${selectedNodeInfo.type === "note" ? "rgba(59,130,246,0.25)" :
                        selectedNodeInfo.type === "folder" ? "rgba(226,232,240,0.15)" :
                          selectedNodeInfo.type === "deck" ? "rgba(74,222,128,0.2)" :
                            selectedNodeInfo.type === "event" ? "rgba(192,132,252,0.2)" :
                              "rgba(167,139,250,0.2)"}`,
                    }}>
                    {selectedNodeInfo.type === "note" && <FileText className="w-5 h-5 text-blue-400" />}
                    {selectedNodeInfo.type === "folder" && <FolderOpen className="w-5 h-5 text-slate-300" />}
                    {selectedNodeInfo.type === "deck" && <Layers className="w-5 h-5 text-green-400" />}
                    {selectedNodeInfo.type === "event" && <Calendar className="w-5 h-5 text-purple-400" />}
                    {selectedNodeInfo.type === "media" && (
                      <span className="text-2xl leading-none">
                        {selectedNodeInfo.mediaType === "image" ? "🖼️" : selectedNodeInfo.mediaType === "video" ? "🎥" : selectedNodeInfo.mediaType === "audio" ? "🎵" : "📎"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm leading-snug text-white truncate pr-2">{selectedNodeInfo.type === "media" ? selectedNodeInfo.title.slice(14) : selectedNodeInfo.title}</h4>

                    <p className="text-[10px] uppercase tracking-widest mt-0.5 font-medium"
                      style={{ color: selectedNodeInfo.type === "note" ? "#93C5FD" : selectedNodeInfo.type === "folder" ? "#CBD5E1" : selectedNodeInfo.type === "deck" ? "#86EFAC" : selectedNodeInfo.type === "event" ? "#D8B4FE" : "#C4B5FD" }}>
                      {selectedNodeInfo.type}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="flex-none w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                  style={{ color: "rgba(148,163,184,0.5)", background: "rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(148,163,184,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Note details */}
              {selectedNodeInfo.type === "note" && (
                <div className="space-y-3">
                  {selectedNodeInfo.folderName && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <FolderOpen className="w-4 h-4 text-slate-400 flex-none" />
                      <span className="text-slate-300 truncate">{selectedNodeInfo.folderName}</span>
                    </div>
                  )}
                  {selectedNodeInfo.tags && selectedNodeInfo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedNodeInfo.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium"
                          style={{ background: "rgba(251,191,36,0.08)", color: "#FCD34D", border: "1px solid rgba(251,191,36,0.2)" }}>
                          <Tag className="w-2.5 h-2.5" />#{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => onSelectNote?.(selectedNodeInfo.id)}
                    className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{ background: "linear-gradient(135deg,#3B82F6,#2563EB)", boxShadow: "0 4px 16px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
                    Open Note <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Media details */}
              {selectedNodeInfo.type === "media" && (
                <div className="px-3 py-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-4xl mb-2 opacity-80">
                    {selectedNodeInfo.mediaType === "image" ? "🖼️" : selectedNodeInfo.mediaType === "video" ? "🎥" : selectedNodeInfo.mediaType === "audio" ? "🎵" : "📄"}
                  </div>
                  <p className="font-mono text-xs break-all text-slate-400">{selectedNodeInfo.fileName?.slice(14)}</p>
                </div>
              )}

              {/* Deck / Event / Folder / Tag */}
              {(selectedNodeInfo.type === "deck" || selectedNodeInfo.type === "event" || selectedNodeInfo.type === "folder" || selectedNodeInfo.type === "tag") && (
                <div className="px-3 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#CBD5E1" }}>
                  {selectedNodeInfo.type === "deck" && (
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-green-400" />
                      <span>{selectedNodeInfo.cardCount} cards</span>
                    </div>
                  )}
                  {selectedNodeInfo.type === "event" && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span>{selectedNodeInfo.date}</span>
                    </div>
                  )}
                  {(selectedNodeInfo.type === "folder" || selectedNodeInfo.type === "tag") && (
                    <div className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                      <span>{selectedNodeInfo.connections} connections</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Semantic Search Modal (popup overlay) ── */}
      <SemanticSearchPanel
        isOpen={semanticPanelOpen}
        onClose={() => { setSemanticPanelOpen(false); setSemanticHighlightIds(null); }}
        onHighlightNodes={setSemanticHighlightIds}
        rawNotes={rawNotesState}
        onSelectNote={onSelectNote}
      />
    </div>
  );
}

export default GraphView;