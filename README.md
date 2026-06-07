currently since complete app is deployed on cloudflare, so middleware/proxy file is not created since they use 
node js and cloudflare deploys on edge, so instead useSession hook of auth client is being used.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function proxy(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);

    // THIS IS NOT SECURE!
    // This is the recommended approach to optimistically redirect users
    // We recommend handling auth checks in each page/route
	if (!sessionCookie) {
		return NextResponse.redirect(new URL("/", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/dashboard"], // Specify the routes the middleware applies to
};
```
this is the proxy code



```tsx
"use client";
import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw, X, ChevronRight, FileText,
  Search, Maximize2, Minimize2,
  Layers, Calendar, FolderOpen, Play, Pause
} from "lucide-react";
import { NoteIndex, Folder, CalendarEvent, FlashcardDeck } from "@/lib/types";

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

// Dark & Elegant Cyber-Neon Palette (glows removed)
const PALETTE = {
  bgCanvas: "#0A0A0F",
  nodeBg: "#111114",
  note:   { base: "#60A5FA", accent: "rgba(96, 165, 250, 0.12)" },
  tag:    { base: "#FBBF24", accent: "rgba(251, 191, 36, 0.12)" },
  folder: { base: "#E2E8F0", accent: "rgba(226, 232, 240, 0.08)" },
  deck:   { base: "#4ADE80", accent: "rgba(74, 222, 128, 0.12)" },
  event:  { base: "#C084FC", accent: "rgba(192, 132, 252, 0.12)" },
  media:  { base: "#A78BFA", accent: "rgba(167, 139, 250, 0.12)" }
};

const INDEXES_FILE = "note-indexes-nickblake.json";
const FOLDERS_FILE = "folders-nickblake.json";
const SLIDEDECK_FILE = "ploopus-flashcard-decks-nickblake.json";
const CALENDAR_FILE = "ploopus-calendar-events-nickblake.json";

// Worker Code
const workerCode = `
  const PALETTE = {
    note:   { base: "#60A5FA" },
    tag:    { base: "#FBBF24" },
    folder: { base: "#E2E8F0" },
    deck:   { base: "#4ADE80" },
    event:  { base: "#C084FC" },
    media:  { base: "#A78BFA" }
  };

  // Local, safe object-tree deep scanner replacing external JSONPath wildcards
  function deepFindFields(obj, targetKeys) {
    let results = [];
    if (!obj || typeof obj !== 'object') return results;
    
    // Check if current layer contains any target fields
    for (const key of targetKeys) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        results.push(obj[key]);
      }
    }
    
    // Scan deeper for sub-blocks, multi-column layouts, galleries, or nested items
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
    } catch (e) {
      return fallbackDefault;
    }
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
    } catch (e) {
      return [];
    }
  }

  async function readFullNote(id) {
    try {
      const root = await navigator.storage.getDirectory();
      const notesDir = await root.getDirectoryHandle("notes", { create: false });
      const fileHandle = await notesDir.getFileHandle(id + ".json");
      const file = await fileHandle.getFile();
      const content = await file.text();
      return JSON.parse(content);
    } catch (e) {
      return null;
    }
  }

  function extractMediaUrls(note) {
    if (!note) return [];
    
    const targetFields = ["audioUrl", "videoUrl", "fileUrl", "imageUrl", "fileName", "imageTextUrl", "url"];
    const foundValues = deepFindFields(note, targetFields);

    const urls = new Set();
    foundValues.forEach(val => {
      if (typeof val === 'string' && val.trim()) {
        urls.add(val.trim());
      }
    });

    return Array.from(urls);
  }

  self.onmessage = async (e) => {
    const { width, height } = e.data;
    if (!width || !height) return;

    const noteIndexes = await readOPFSFile("${INDEXES_FILE}", []);
    const folders = await readOPFSFile("${FOLDERS_FILE}", []);
    const decks = await readOPFSFile("${SLIDEDECK_FILE}", []);
    const calendarEvents = await readOPFSFile("${CALENDAR_FILE}", []);
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
    
    // Process matching configurations asynchronously 
    await Promise.all(noteIndexes.map(async (indexNote) => {
      const fullNote = await readFullNote(indexNote.id);
      if (!fullNote) return;

      const mediaUrls = extractMediaUrls(fullNote);
      mediaUrls.forEach(url => {
        let cleanName = "";
        try {
          cleanName = decodeURIComponent(url.split('/').pop()?.split('?')[0]?.trim() || "");
        } catch(err) {
          cleanName = url.split('/').pop()?.split('?')[0]?.trim() || "";
        }
        if (!cleanName) return;

        const matchingMedia = mediaFiles.find(m => {
          const targetName = m.name.toLowerCase();
          const sourceName = cleanName.toLowerCase();
          return targetName === sourceName || targetName.includes(sourceName) || sourceName.includes(targetName);
        });

        if (matchingMedia) {
          mediaToNoteLinks.push({ source: indexNote.id, target: matchingMedia.id });
        }
      });
    }));

    // 1. Folders Layout
    uniqueFolderIds.forEach((fId, index) => {
      const angle = (index / Math.max(1, uniqueFolderIds.length)) * Math.PI * 2 - Math.PI / 2;
      const orbitR = 380;
      const x = centerX + Math.cos(angle) * orbitR;
      const y = centerY + Math.sin(angle) * orbitR;
      folderPositions.set(fId, { x, y });

      generatedNodes.push({
        id: "folder-" + fId,
        label: folderMap.get(fId) || "Folder",
        x, y, radius: 22,
        type: "folder", color: PALETTE.folder.base, accent: "rgba(226,232,240,0.08)"
      });
    });

    // 2. Notes Layout
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

      generatedNodes.push({
        id: note.id,
        label: note.title || "Untitled Note",
        x, y, radius: 11,
        type: "note", color: PALETTE.note.base, accent: "rgba(96,165,250,0.12)",
        parentId: note.folderId ? "folder-" + note.folderId : undefined
      });
      if (note.folderId) linkMap.push({ source: note.id, target: "folder-" + note.folderId });
      (note.tags || []).forEach(t => linkMap.push({ source: note.id, target: "tag-" + t.label }));
    });

    // Merge media relationships directly into graph topology maps
    linkMap.push(...mediaToNoteLinks);

    // 3. Decks Layout
    decks.forEach((deck) => {
      let x = centerX + (Math.random() - 0.5) * 800;
      let y = centerY + (Math.random() - 0.5) * 700;
      const deckNameClean = (deck.name || "").toLowerCase().trim();
      let matchedNoteId = null;
      for (let [title, id] of noteTitleMap.entries()) {
        if (deckNameClean.includes(title) || title.includes(deckNameClean)) {
          matchedNoteId = id;
          break;
        }
      }
      if (matchedNoteId && notePositions.has(matchedNoteId)) {
        const nPos = notePositions.get(matchedNoteId);
        const angle = Math.random() * Math.PI * 2;
        x = nPos.x + Math.cos(angle) * 90;
        y = nPos.y + Math.sin(angle) * 90;
      }
      generatedNodes.push({
        id: "deck-" + deck.id,
        label: deck.name || "Flashcard Deck",
        x, y, radius: 10,
        type: "deck", color: PALETTE.deck.base, accent: "rgba(74,222,128,0.12)",
        parentId: matchedNoteId || undefined
      });
      if (matchedNoteId) linkMap.push({ source: "deck-" + deck.id, target: matchedNoteId });
    });

    // 4. Events Layout
    calendarEvents.forEach((event, idx) => {
      const angle = (idx / Math.max(1, calendarEvents.length)) * Math.PI * 2 + 0.3;
      const x = centerX + Math.cos(angle) * 750;
      const y = centerY + Math.sin(angle) * 600;
      generatedNodes.push({
        id: "event-" + event.id,
        label: event.title || "Calendar Event",
        x, y, radius: 10,
        type: "event", color: PALETTE.event.base, accent: "rgba(192,132,252,0.12)"
      });
    });

    // 5. Tags Layout
    uniqueTags.forEach((tag, index) => {
      const angle = (index / Math.max(1, uniqueTags.length)) * Math.PI * 2 - 0.6;
      generatedNodes.push({
        id: "tag-" + tag,
        label: tag,
        x: centerX + Math.cos(angle) * 960,
        y: centerY + Math.sin(angle) * 820,
        radius: 9,
        type: "tag", color: PALETTE.tag.base, accent: "rgba(251,191,36,0.12)"
      });
    });

    // 6. Media Layout
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
      generatedNodes.push({
        id: media.id,
        label: media.name.length > 28 ? media.name.slice(0, 25) + "..." : media.name,
        x, y, radius: 10,
        type: "media", color: PALETTE.media.base, accent: "rgba(167,139,250,0.12)",
        mediaType: media.type
      });
    });

    const nodeMap = new Map(generatedNodes.map(n => [n.id, n]));
    const idealDist = 120;
    for (let tick = 0; tick < 220; tick++) {
      for (let i = 0; i < generatedNodes.length; i++) {
        const n1 = generatedNodes[i];
        for (let j = i + 1; j < generatedNodes.length; j++) {
          const n2 = generatedNodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < 1) continue;
          const dist = Math.sqrt(distSq);
          const minDist = (n1.type === "folder" || n2.type === "folder") ? 200 : idealDist;
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.55;
            const fx = dx * force;
            const fy = dy * force;
            n1.x -= fx * 0.5; n1.y -= fy * 0.5;
            n2.x += fx * 0.5; n2.y += fy * 0.5;
          }
        }
      }

      linkMap.forEach(link => {
        const src = nodeMap.get(link.source);
        const tgt = nodeMap.get(link.target);
        if (!src || !tgt) return;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.hypot(dx, dy) || 1;
        const targetLen = (tgt.type === "folder" || src.type === "folder") ? 140 : idealDist * 1.1;
        const force = (dist - targetLen) / dist * 0.18;
        src.x += dx * force; src.y += dy * force;
        tgt.x -= dx * force; tgt.y -= dy * force;
      });

      generatedNodes.forEach(node => {
        node.x += (centerX - node.x) * 0.004;
        node.y += (centerY - node.y) * 0.004;
      });
    }

    self.postMessage({
      nodes: generatedNodes,
      edges: linkMap,
      rawNotes: noteIndexes,
      rawFolders: folders,
      rawDecks: decks,
      rawEvents: calendarEvents,
      rawMedia: mediaFiles
    });
  };
`;

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
  const [isAnimating, setIsAnimating] = useState(true);

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

  // Worker for layout
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;
    setIsLoading(true);
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob));
    worker.postMessage({ width: dimensions.width * 1.6, height: dimensions.height * 1.6 });
    worker.onmessage = (e) => {
      const { nodes, edges, rawNotes, rawFolders, rawDecks, rawEvents, rawMedia } = e.data;
      
      const nodesWithVel = nodes.map((n: GraphNode) => ({
        ...n,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08
      }));

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

  // Subtle continuous floating motion
  useEffect(() => {
    let raf: number;

    const animate = (timestamp: number) => {
      if (!isAnimating || layoutNodesRef.current.length === 0) {
        raf = requestAnimationFrame(animate);
        return;
      }

      const delta = Math.min((timestamp - lastTimeRef.current) / 16, 2.5);
      lastTimeRef.current = timestamp;

      const nodes = layoutNodesRef.current;
      const anchors = anchorPositionsRef.current;

      nodes.forEach(node => {
        if (node.vx === undefined || node.vy === undefined) return;

        // Very gentle random perturbation
        if (Math.random() < 0.008) {
          node.vx! += (Math.random() - 0.5) * 0.065;
          node.vy! += (Math.random() - 0.5) * 0.065;
        }

        // Stronger damping for subtle movement
        node.vx! *= 0.935;
        node.vy! *= 0.935;

        node.x += node.vx! * delta * 0.45;
        node.y += node.vy! * delta * 0.45;

        // Anchor spring (subtle breathing)
        const anchor = anchors.get(node.id);
        if (anchor) {
          const anchorStrength = 0.022 * delta;
          node.x += (anchor.x - node.x) * anchorStrength;
          node.y += (anchor.y - node.y) * anchorStrength;
        }
      });

      // Light repulsion (every other frame)
      if (Math.round(timestamp / 16) % 2 === 0) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius + 38;
            if (distSq < minDist * minDist && distSq > 0.01) {
              const dist = Math.sqrt(distSq);
              const push = ((minDist - dist) / dist) * 0.28;
              const fx = dx * push * 0.5;
              const fy = dy * push * 0.5;
              a.x -= fx; a.y -= fy;
              b.x += fx; b.y += fy;

              const anchorA = anchors.get(a.id);
              const anchorB = anchors.get(b.id);
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
  }, [isAnimating, dimensions]);

  const filteredNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    layoutNodesRef.current.forEach(node => {
      if (node.label.toLowerCase().includes(query)) {
        matches.add(node.id);
        if (node.parentId) matches.add(node.parentId);
        const connections = layoutEdgesRef.current.filter(e => 
          e.source === node.id || e.target === node.id
        );
        connections.forEach(conn => {
          matches.add(conn.source);
          matches.add(conn.target);
        });
      }
    });
    return matches.size > 0 ? matches : null;
  }, [searchQuery, renderTick]);

  const selectedNodeInfo = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = layoutNodesRef.current.find(n => n.id === selectedNodeId);
    if (!node) return null;

    if (node.type === "media") {
      return {
        id: node.id,
        title: node.label,
        type: "media" as const,
        mediaType: node.mediaType,
        fileName: node.label
      };
    }

    const baseId = node.id.replace(/^(deck-|event-|folder-)/, "");
    if (node.type === "note") {
      const rawNote = rawNotesState.find(n => n.id === node.id);
      return {
        id: node.id,
        title: node.label,
        type: node.type,
        folderName: rawNote?.folderId ? folderMap.get(rawNote.folderId) : undefined,
        tags: (rawNote?.tags || []).map(t => t.label)
      };
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

  // Canvas Rendering (neon glows removed)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = PALETTE.bgCanvas;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Subtle dot-grid
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let x = 0; x < dimensions.width; x += 48) {
      for (let y = 0; y < dimensions.height; y += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    const pad = 300;
    const minX = -offset.x / scale - pad;
    const maxX = (dimensions.width - offset.x) / scale + pad;
    const minY = -offset.y / scale - pad;
    const maxY = (dimensions.height - offset.y) / scale + pad;

    const showLabels = scale > 0.38;
    const showEdges = scale > 0.12;

    const drawNodeIcon = (node: GraphNode) => {
      const x = node.x, y = node.y, r = node.radius;
      ctx.save();
      ctx.strokeStyle = "#fff";
      ctx.fillStyle = "#fff";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (node.type === "note") {
        const w = r * 0.88, h = r * 1.1, rx = x - w / 2, ry = y - h / 2;
        ctx.beginPath();
        ctx.roundRect(rx, ry, w, h, 1.5);
        ctx.stroke();
        const lx1 = rx + w * 0.18, lx2 = rx + w * 0.82;
        const gaps = 3;
        for (let i = 0; i < gaps; i++) {
          const ly = ry + h * (0.32 + i * 0.22);
          ctx.beginPath(); ctx.moveTo(lx1, ly); ctx.lineTo(i < gaps - 1 ? lx2 : lx2 * 0.72 + lx1 * 0.28, ly); ctx.stroke();
        }
      } else if (node.type === "folder") {
        const fw = r * 1.3, fh = r * 1.0;
        ctx.beginPath();
        ctx.moveTo(x - fw / 2, y - fh * 0.2);
        ctx.lineTo(x - fw * 0.12, y - fh * 0.2);
        ctx.lineTo(x - fw * 0.02, y - fh * 0.52);
        ctx.lineTo(x + fw * 0.28, y - fh * 0.52);
        ctx.lineTo(x + fw / 2, y - fh * 0.2);
        ctx.lineTo(x + fw / 2, y + fh * 0.48);
        ctx.lineTo(x - fw / 2, y + fh * 0.48);
        ctx.closePath();
        ctx.stroke();
      } else if (node.type === "tag") {
        const tw = r * 1.0, th = r * 1.0;
        ctx.beginPath();
        ctx.moveTo(x - tw * 0.1, y - th * 0.5);
        ctx.lineTo(x + tw * 0.5, y - th * 0.5);
        ctx.lineTo(x + tw * 0.5, y + th * 0.5);
        ctx.lineTo(x - tw * 0.1, y + th * 0.5);
        ctx.lineTo(x - tw * 0.5, y);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x - tw * 0.22, y, r * 0.14, 0, Math.PI * 2); ctx.fill();
      } else if (node.type === "deck") {
        const dw = r * 1.0, dh = r * 0.72;
        for (let i = 2; i >= 0; i--) {
          const ox = i * 1.8, oy = -i * 2.2;
          ctx.globalAlpha = i === 0 ? 1 : 0.45;
          ctx.beginPath();
          ctx.roundRect(x - dw / 2 + ox, y - dh / 2 + oy, dw, dh, 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (node.type === "event") {
        const cw = r * 1.05, ch = r * 1.05;
        ctx.beginPath();
        ctx.roundRect(x - cw / 2, y - ch * 0.38, cw, ch, 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - cw / 2, y - ch * 0.05);
        ctx.lineTo(x + cw / 2, y - ch * 0.05);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + ch * 0.22, r * 0.18, 0, Math.PI * 2); ctx.fill();
        [-0.26, 0.26].forEach(ox => {
          ctx.beginPath();
          ctx.moveTo(x + ox * cw, y - ch * 0.52);
          ctx.lineTo(x + ox * cw, y - ch * 0.22);
          ctx.stroke();
        });
      } else if (node.type === "media") {
        if (node.mediaType === "image") {
          const iw = r * 1.1, ih = r * 0.9;
          ctx.beginPath(); ctx.roundRect(x - iw / 2, y - ih / 2, iw, ih, 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - iw * 0.4, y + ih * 0.3);
          ctx.lineTo(x - iw * 0.05, y - ih * 0.05);
          ctx.lineTo(x + iw * 0.22, y + ih * 0.15);
          ctx.lineTo(x + iw * 0.4, y - ih * 0.1);
          ctx.lineTo(x + iw * 0.5, y + ih * 0.3);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(x - iw * 0.2, y - ih * 0.2, r * 0.16, 0, Math.PI * 2); ctx.fill();
        } else if (node.mediaType === "video") {
          ctx.beginPath(); ctx.arc(x, y, r * 0.85, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - r * 0.2, y - r * 0.35);
          ctx.lineTo(x + r * 0.42, y);
          ctx.lineTo(x - r * 0.2, y + r * 0.35);
          ctx.closePath(); ctx.fill();
        } else if (node.mediaType === "audio") {
          ctx.beginPath();
          ctx.moveTo(x + r * 0.2, y - r * 0.5);
          ctx.lineTo(x + r * 0.2, y + r * 0.1);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - r * 0.28, y - r * 0.2);
          ctx.lineTo(x - r * 0.28, y + r * 0.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x - r * 0.28, y - r * 0.2);
          ctx.lineTo(x + r * 0.2, y - r * 0.5);
          ctx.stroke();
          ctx.beginPath(); ctx.ellipse(x + r * 0.08, y + r * 0.18, r * 0.2, r * 0.13, -0.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(x - r * 0.42, y + r * 0.48, r * 0.18, r * 0.12, -0.4, 0, Math.PI * 2); ctx.fill();
        } else {
          const fw2 = r * 0.9, fh2 = r * 1.1, fold = r * 0.28;
          ctx.beginPath();
          ctx.moveTo(x - fw2 / 2, y - fh2 / 2);
          ctx.lineTo(x + fw2 / 2 - fold, y - fh2 / 2);
          ctx.lineTo(x + fw2 / 2, y - fh2 / 2 + fold);
          ctx.lineTo(x + fw2 / 2, y + fh2 / 2);
          ctx.lineTo(x - fw2 / 2, y + fh2 / 2);
          ctx.closePath(); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + fw2 / 2 - fold, y - fh2 / 2);
          ctx.lineTo(x + fw2 / 2 - fold, y - fh2 / 2 + fold);
          ctx.lineTo(x + fw2 / 2, y - fh2 / 2 + fold);
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    // Edges (no neon glow)
    if (showEdges) {
      const nodeById = new Map(layoutNodesRef.current.map(n => [n.id, n]));

      layoutEdgesRef.current.forEach(edge => {
        const src = nodeById.get(edge.source);
        const tgt = nodeById.get(edge.target);
        if (!src || !tgt) return;

        if ((src.x < minX && tgt.x < minX) || (src.x > maxX && tgt.x > maxX) ||
            (src.y < minY && tgt.y < minY) || (src.y > maxY && tgt.y > maxY)) return;

        if (filteredNodeIds && (!filteredNodeIds.has(src.id) || !filteredNodeIds.has(tgt.id))) return;

        const isActive = hoveredNodeId === src.id || selectedNodeId === src.id ||
                         hoveredNodeId === tgt.id || selectedNodeId === tgt.id;
        const dimmed = (selectedNodeId || hoveredNodeId) && !isActive;

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.06 : isActive ? 0.85 : 0.22;

        if (isActive) {
          ctx.lineWidth = 1.9;
          ctx.strokeStyle = "#94A3B8";
          ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(148,163,184,0.28)";
          ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(tgt.x, tgt.y); ctx.stroke();
        }
        ctx.restore();
      });
    }

    // Nodes
    layoutNodesRef.current.forEach(node => {
      if (node.x < minX || node.x > maxX || node.y < minY || node.y > maxY) return;

      const isActive = hoveredNodeId === node.id || selectedNodeId === node.id;
      const isFilteredOut = filteredNodeIds && !filteredNodeIds.has(node.id);
      const dimmed = !isActive && !!(selectedNodeId || hoveredNodeId);

      ctx.save();
      ctx.globalAlpha = isFilteredOut ? 0.08 : dimmed ? 0.28 : 1;

      const r = node.radius;

      if (node.type === "folder") {
        const sides = 6;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2 - Math.PI / 6;
          const px = node.x + Math.cos(a) * r, py = node.y + Math.sin(a) * r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();

        const folderFill = ctx.createRadialGradient(node.x, node.y - r * 0.3, 0, node.x, node.y, r * 1.1);
        folderFill.addColorStop(0, "rgba(55,65,95,0.9)");
        folderFill.addColorStop(1, "rgba(15,18,32,0.95)");
        ctx.fillStyle = folderFill;
        ctx.fill();

        ctx.strokeStyle = isActive ? "#E0E7FF" : node.color;
        ctx.lineWidth = isActive ? 2.6 : 2.1;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);

        const fill = ctx.createRadialGradient(node.x, node.y - r * 0.35, r * 0.1, node.x, node.y, r);
        if (node.type === "note") {
          fill.addColorStop(0, "rgba(38,50,88,0.94)");
          fill.addColorStop(1, "rgba(12,16,32,0.97)");
        } else if (node.type === "tag") {
          fill.addColorStop(0, "rgba(58,48,18,0.94)");
          fill.addColorStop(1, "rgba(14,12,6,0.97)");
        } else if (node.type === "deck") {
          fill.addColorStop(0, "rgba(22,52,32,0.94)");
          fill.addColorStop(1, "rgba(6,18,12,0.97)");
        } else if (node.type === "event") {
          fill.addColorStop(0, "rgba(48,18,65,0.94)");
          fill.addColorStop(1, "rgba(14,6,20,0.97)");
        } else {
          fill.addColorStop(0, "rgba(38,22,75,0.94)");
          fill.addColorStop(1, "rgba(12,6,24,0.97)");
        }
        ctx.fillStyle = fill;
        ctx.fill();

        ctx.strokeStyle = isActive ? "#E0E7FF" : node.color;
        ctx.lineWidth = isActive ? 2.4 : 1.7;
        ctx.stroke();
      }

      ctx.globalAlpha = isFilteredOut ? 0.08 : dimmed ? 0.28 : (isActive ? 1 : 0.85);
      drawNodeIcon(node);

      if (isActive) {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1.1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 13, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;

      // Labels
      if (showLabels || isActive || node.type === "folder") {
        const label = node.label.length > 26 ? node.label.slice(0, 23) + "…" : node.label;
        const fontSize = node.type === "folder" ? 13 : isActive ? 12 : 10.5;
        const yOff = r + (node.type === "folder" ? 20 : 16);

        ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif`;
        const tw = ctx.measureText(label).width;
        const ph = 5, pw = 9;
        ctx.globalAlpha = isFilteredOut ? 0 : dimmed ? 0.18 : 0.75;
        ctx.fillStyle = "rgba(8,10,20,0.82)";
        ctx.beginPath();
        ctx.roundRect(node.x - tw / 2 - pw, node.y + yOff - fontSize * 0.8 - ph, tw + pw * 2, fontSize + ph * 2, 5);
        ctx.fill();

        ctx.globalAlpha = isFilteredOut ? 0.08 : dimmed ? 0.35 : 1;
        ctx.fillStyle = isActive ? "#F8FAFF" : node.type === "folder" ? "#E2E8F0" : "rgba(200,210,230,0.9)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, node.x, node.y + yOff - fontSize * 0.8 + ph * 0.5);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [dimensions, scale, offset, hoveredNodeId, selectedNodeId, filteredNodeIds, renderTick]);

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
      setOffset({ 
        x: e.clientX - stateRef.current.panStart.x, 
        y: e.clientY - stateRef.current.panStart.y 
      });
      return;
    }
    
    if (stateRef.current.draggedNodeId) {
      const { worldX, worldY } = getCanvasMouseCoords(e.clientX, e.clientY, canvas);
      const node = layoutNodesRef.current.find(n => n.id === stateRef.current.draggedNodeId);
      if (node) {
        node.x = worldX;
        node.y = worldY;
        if (node.vx) node.vx = (Math.random() - 0.5) * 1.1;
        if (node.vy) node.vy = (Math.random() - 0.5) * 1.1;
        setRenderTick(t => t + 1);
      }
      return;
    }
    
    const { worldX, worldY } = getCanvasMouseCoords(e.clientX, e.clientY, canvas);
    const hit = findHitNode(worldX, worldY);
    setHoveredNodeId(hit ? hit.id : null);
    canvas.style.cursor = hit ? "pointer" : "grab";
  };

  const handleMouseUp = () => {
    stateRef.current.isPanning = false;
    stateRef.current.draggedNodeId = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.12;
    const newScale = Math.max(0.04, Math.min(7.5, stateRef.current.scale * factor));
    
    setOffset({
      x: mouseX - (mouseX - stateRef.current.offset.x) * (newScale / stateRef.current.scale),
      y: mouseY - (mouseY - stateRef.current.offset.y) * (newScale / stateRef.current.scale)
    });
    setScale(newScale);
  };

  const handleZoom = (dir: "in" | "out") => {
    const factor = dir === "in" ? 1.28 : 0.78;
    setScale(s => Math.max(0.04, Math.min(7.5, s * factor)));
  };

  const toggleAnimation = () => setIsAnimating(!isAnimating);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0A0A0F] overflow-hidden select-none font-sans rounded-2xl">
      {isLoading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-3xl">
          <div className="flex flex-col items-center gap-4">
            <div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm tracking-tight text-slate-400">Mapping your knowledge universe...</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full touch-none block rounded-2xl"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Top Controls */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 w-[calc(100%-48px)] max-w-130">
        <div className="flex-1 px-6 py-3 bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
          <div className="flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              className="flex-1 bg-transparent text-sm placeholder:text-slate-500 outline-none text-slate-200"
              placeholder="Search nodes, notes, tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => { 
            setScale(0.48); 
            setOffset({ x: 80, y: 60 }); 
            setSelectedNodeId(null); 
            setSearchQuery(""); 
          }}
          className="w-12 h-12 rounded-3xl bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-xl hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5 text-slate-400" />
        </button>

        <button
          onClick={toggleAnimation}
          className="w-12 h-12 rounded-3xl bg-zinc-900/90 backdrop-blur-2xl border border-white/10 shadow-xl hover:bg-zinc-800 active:scale-95 transition-all flex items-center justify-center"
        >
          {isAnimating ? <Pause className="w-5 h-5 text-slate-400" /> : <Play className="w-5 h-5 text-slate-400" />}
        </button>
      </div>

      {/* Bottom Legend & Zoom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-6 px-7 py-3.5 bg-zinc-950/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
        {[
          { color: PALETTE.folder.base, label: "Folders" },
          { color: PALETTE.note.base, label: "Notes" },
          { color: PALETTE.deck.base, label: "Decks" },
          { color: PALETTE.event.base, label: "Events" },
          { color: PALETTE.tag.base, label: "Tags" },
          { color: PALETTE.media.base, label: "Media" },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shadow" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] font-medium tracking-[0.5px] text-slate-400 uppercase">{item.label}</span>
          </div>
        ))}

        <div className="flex items-center gap-3 ml-6 border-l border-white/10 pl-6">
          <button onClick={() => handleZoom("out")} className="hover:text-white text-slate-400 transition-colors">
            <Minimize2 className="w-4 h-4" />
          </button>
          <span className="font-mono text-xs tabular-nums w-12 text-center text-slate-500">{Math.round(scale * 100)}%</span>
          <button onClick={() => handleZoom("in")} className="hover:text-white text-slate-400 transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Inspector */}
      <AnimatePresence>
        {selectedNodeInfo && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.94 }}
            className="absolute bottom-8 right-8 z-50 w-80 bg-zinc-900/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-950 shadow-inner flex items-center justify-center border border-white/10">
                    {selectedNodeInfo.type === "note" && <FileText className="w-7 h-7 text-[#60A5FA]" />}
                    {selectedNodeInfo.type === "folder" && <FolderOpen className="w-7 h-7 text-[#E2E8F0]" />}
                    {selectedNodeInfo.type === "deck" && <Layers className="w-7 h-7 text-[#4ADE80]" />}
                    {selectedNodeInfo.type === "event" && <Calendar className="w-7 h-7 text-[#C084FC]" />}
                    {selectedNodeInfo.type === "media" && (
                      <span className="text-4xl opacity-90">
                        {selectedNodeInfo.mediaType === "image" ? "🖼️" : 
                         selectedNodeInfo.mediaType === "video" ? "🎥" : 
                         selectedNodeInfo.mediaType === "audio" ? "🎵" : "📎"}
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg leading-tight text-white pr-6 text-balance">{selectedNodeInfo.title}</h4>
                    <p className="uppercase text-xs tracking-[1px] text-slate-500 mt-1">{selectedNodeInfo.type}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-white p-1 -mr-1 -mt-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedNodeInfo.type === "note" && (
                <div className="space-y-5">
                  {selectedNodeInfo.folderName && (
                    <div className="flex items-center gap-3 bg-zinc-950 px-4 py-3.5 rounded-2xl border border-white/5">
                      <FolderOpen className="w-5 h-5 text-slate-400" />
                      <span>{selectedNodeInfo.folderName}</span>
                    </div>
                  )}
                  {selectedNodeInfo.tags && selectedNodeInfo.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedNodeInfo.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-4 py-1 bg-yellow-950/60 text-amber-300 text-xs rounded-2xl border border-amber-900/50">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={() => onSelectNote?.(selectedNodeInfo.id)} 
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-2xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-950"
                  >
                    Open Note <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {selectedNodeInfo.type === "media" && (
                <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 text-center">
                  <div className="text-7xl mb-6 opacity-80">
                    {selectedNodeInfo.mediaType === "image" ? "🖼️" : selectedNodeInfo.mediaType === "video" ? "🎥" : selectedNodeInfo.mediaType === "audio" ? "🎵" : "📄"}
                  </div>
                  <p className="font-mono text-sm break-all text-slate-300">{selectedNodeInfo.fileName}</p>
                </div>
              )}

              {(selectedNodeInfo.type === "deck" || selectedNodeInfo.type === "event" || selectedNodeInfo.type === "folder" || selectedNodeInfo.type === "tag") && (
                <div className="bg-zinc-950 border border-white/5 rounded-2xl p-5 text-sm text-slate-300">
                  {selectedNodeInfo.type === "deck" && `📚 ${selectedNodeInfo.cardCount} cards`}
                  {selectedNodeInfo.type === "event" && `🗓️ ${selectedNodeInfo.date}`}
                  {(selectedNodeInfo.type === "folder" || selectedNodeInfo.type === "tag") && `🔗 ${selectedNodeInfo.connections} connections`}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GraphView;
```