import { useCallback } from "react";
import { Note, NoteBlock } from "@/lib/types";

export type ExportFormat = "markdown" | "text" | "html" | "pdf" | "json";

// ─── Utility ──────────────────────────────────────────────────────────────────

const esc = (s = "") =>
  s.replace(/ /g, " ").replace(/&nbsp;/gi, " ")
   .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Tailwind class → hex color ────────────────────────────────────────────────
// The app stores colors as Tailwind class strings (e.g. "bg-blue-500", "sage", "gold")
// We map all known variants to real hex values for HTML output.
const TW: Record<string, string> = {
  // bg-{color}-{shade}
  "bg-blue-50":"#eff6ff","bg-blue-100":"#dbeafe","bg-blue-200":"#bfdbfe",
  "bg-blue-300":"#93c5fd","bg-blue-400":"#60a5fa","bg-blue-500":"#3b82f6",
  "bg-blue-600":"#2563eb","bg-blue-700":"#1d4ed8","bg-blue-800":"#1e40af",
  "bg-green-50":"#f0fdf4","bg-green-100":"#dcfce7","bg-green-200":"#bbf7d0",
  "bg-green-400":"#4ade80","bg-green-500":"#22c55e","bg-green-600":"#16a34a",
  "bg-emerald-500":"#10b981",
  "bg-teal-500":"#14b8a6",
  "bg-cyan-500":"#06b6d4",
  "bg-purple-400":"#c084fc","bg-purple-500":"#a855f7","bg-purple-600":"#9333ea",
  "bg-indigo-500":"#6366f1","bg-indigo-600":"#4f46e5",
  "bg-violet-500":"#8b5cf6",
  "bg-pink-400":"#f472b6","bg-pink-500":"#ec4899","bg-pink-600":"#db2777",
  "bg-rose-500":"#f43f5e",
  "bg-red-400":"#f87171","bg-red-500":"#ef4444","bg-red-600":"#dc2626",
  "bg-orange-400":"#fb923c","bg-orange-500":"#f97316","bg-orange-600":"#ea580c",
  "bg-amber-500":"#f59e0b","bg-yellow-400":"#facc15","bg-yellow-500":"#eab308",
  "bg-lime-500":"#84cc16",
  "bg-sky-500":"#0ea5e9",
  "bg-slate-400":"#94a3b8","bg-slate-500":"#64748b",
  "bg-gray-400":"#9ca3af","bg-gray-500":"#6b7280",
  // Named colors used in flashcards / mindmap
  "blue":"#3b82f6","green":"#22c55e","purple":"#a855f7","pink":"#ec4899",
  "orange":"#f97316","red":"#ef4444","yellow":"#eab308","teal":"#14b8a6",
  "indigo":"#6366f1","rose":"#f43f5e","amber":"#f59e0b","lime":"#84cc16",
  "cyan":"#06b6d4","sky":"#0ea5e9","violet":"#8b5cf6","emerald":"#10b981",
  // Mindmap named colors
  "sage":"#87a878","gold":"#d4af37","coral":"#ff6b6b","mint":"#98d8c8",
  "lavender":"#b39ddb","peach":"#ffb347","steel":"#708090",
};

const toHex = (c = "", fallback = "#6366f1") => {
  if (!c) return fallback;
  if (c.startsWith("#")) return c;
  return TW[c] || TW[c.replace(/^bg-/, "bg-")] || fallback;
};

// Tailwind bg class to a light tint for backgrounds
const toTint = (c = "", alpha = "18") => toHex(c) + alpha;

// ── Inline rich-text renderer ─────────────────────────────────────────────────
// block.content may contain:
//   • Raw HTML formatting: <b>, <strong>, <i>, <em>, <u>, <s>, <strike>,
//     <code>, <mark>, <font color="…" style="…">, <span style="…">, <br>
//   • Markdown shortcuts: **bold**, *italic*, ~~strike~~, `code`, [text](url)
//
// Strategy:
//   1. Process markdown patterns first (converts to HTML tags).
//   2. Then sanitize the resulting HTML — keep only safe inline tags,
//      strip everything else but keep its text content.
//
// This is intentionally NOT a full sanitizer — it's scoped to the inline
// formatting tags the note editor actually produces. No script/iframe/etc
// can survive because we explicitly allowlist tags + attributes.

const ALLOWED_TAGS: Record<string, string[]> = {
  b:      [], strong: [], i: [], em: [], u: [], s: [], strike: [], del: [],
  code:   [], mark:   [], br: [],
  font:   ["color", "style"],   // <font color="#ef4444" style="background-color:…">
  span:   ["style"],            // <span style="color:…;background:…;font-weight:…">
  a:      ["href", "target", "rel"],
  sub:    [], sup: [],
};

// Safe CSS property allowlist for style attributes
const SAFE_CSS = /^(color|background(-color)?|font-(weight|style|size)|text-decoration|border-radius|padding):/i;

const sanitizeStyle = (style: string): string =>
  style.split(";")
    .map(s => s.trim())
    .filter(s => s && SAFE_CSS.test(s))
    .join(";");

// Sanitize a single HTML tag, returning safe version or just ""
const sanitizeTag = (tag: string): string => {
  // Closing tag — keep if allowed
  const closeMatch = tag.match(/^<\/([a-z][a-z0-9]*)>$/i);
  if (closeMatch) {
    const t = closeMatch[1].toLowerCase();
    return t in ALLOWED_TAGS ? `</${t}>` : "";
  }
  // Self-closing <br>
  if (/^<br\s*\/?>$/i.test(tag)) return "<br>";
  // Opening tag
  const openMatch = tag.match(/^<([a-z][a-z0-9]*)((?:\s[^>]*)?)>$/i);
  if (!openMatch) return "";
  const tagName = openMatch[1].toLowerCase();
  if (!(tagName in ALLOWED_TAGS)) return "";
  const allowedAttrs = ALLOWED_TAGS[tagName];
  if (!allowedAttrs.length) return `<${tagName}>`;

  // Parse attributes
  const attrStr = openMatch[2];
  const attrRe = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;
  const safeAttrs: string[] = [];
  while ((m = attrRe.exec(attrStr)) !== null) {
    const attrName = m[1].toLowerCase();
    if (!allowedAttrs.includes(attrName)) continue;
    const val = m[2] ?? m[3] ?? m[4] ?? "";
    if (attrName === "style") {
      const safe = sanitizeStyle(val);
      if (safe) safeAttrs.push(`style="${safe}"`);
    } else if (attrName === "href") {
      // Only allow http/https/mailto links
      if (/^(https?:|mailto:)/i.test(val)) safeAttrs.push(`href="${val}" target="_blank" rel="noopener"`);
    } else if (attrName === "color") {
      // <font color="..."> — keep colour attribute directly
      safeAttrs.push(`color="${val}"`);
    } else if (!["target","rel"].includes(attrName)) {
      safeAttrs.push(`${attrName}="${val}"`);
    }
  }
  return `<${tagName}${safeAttrs.length ? " "+safeAttrs.join(" ") : ""}>`;
};

const renderInline = (raw: string): string => {
  if (!raw) return "";

  // Step 0 — Normalize contentEditable structural HTML into \n line breaks.
  //
  // When the user presses Enter in a contentEditable div, browsers insert:
  //   Chrome/Edge: <div>next line</div>  (or <div><br></div> for empty lines)
  //   Firefox:     <br>
  //   Safari:      <div>next line</div>
  // An &nbsp; / \xa0 is inserted to prevent empty divs from collapsing (zero height).
  // Mid-text \xa0 is just a non-breaking space → regular space.
  let s0 = raw
    // Empty-line div: <div><br></div> or <div>&nbsp;</div> → newline
    .replace(/<div[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\xa0)\s*<\/div>/gi, "\n")
    // Closing + opening div boundary → newline
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    // Lone opening <div> that starts a new line block → newline
    .replace(/<div[^>]*>/gi, "\n")
    // Closing </div> → nothing (boundary already handled above)
    .replace(/<\/div>/gi, "")
    // <br> / <br/> → newline
    .replace(/<br\s*\/?>/gi, "\n")
    // Mid-text &nbsp; / \xa0 → regular space
    .replace(/&nbsp;/gi, " ")
    .replace(/\xa0/g, " ");

  // // Step 1 — Markdown inline patterns → HTML
  // Order matters: process longer patterns first
  let s = s0
    // **bold** or __bold__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    // *italic* or _italic_  (not preceded/followed by *)
    .replace(/\*(?!\*)(.+?)(?<!\*)\*/g, "<em>$1</em>")
    .replace(/_(?!_)(.+?)(?<!_)_/g, "<em>$1</em>")
    // ~~strikethrough~~
    .replace(/~~(.+?)~~/g, "<s>$1</s>")
    // `inline code`
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // [text](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Step 2 — Sanitize the HTML (now a mix of raw HTML + converted markdown HTML)
  // Split on HTML tags, process each piece
  const parts = s.split(/(<[^>]+>)/);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // This is a tag segment — sanitize it
      return sanitizeTag(part);
    }
    // Text segment — escape HTML special chars EXCEPT what we already converted
    // (the markdown→HTML conversion above already produced safe tags, which are
    //  in the odd-index positions after splitting — so this is purely text)
    return part
      .replace(/&(?!amp;|lt;|gt;|quot;|#)/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      // Restore \n → <br> so Enter-press line breaks render in HTML
      .replace(/\n/g, "<br>");
  }).join("");
};

// ── URL helpers ───────────────────────────────────────────────────────────────
// Detect if a URL is local (blob:, file:, relative path, no http)
const isLocal = (url = "") =>
  url.startsWith("blob:") || url.startsWith("file:") ||
  (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("//"));

// ── URL host helper ────────────────────────────────────────────────────────────
const urlHost = (url = "") => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// ── Video embed resolver ───────────────────────────────────────────────────────
// NOTE: YouTube, Vimeo, Loom etc. iframes are blocked on blob:/file:/ origins
// (Error 153 / "Video unavailable" / CSP). We instead produce rich thumbnail
// cards that open the video on click — works in every context.
type VideoResult = {
  type: "yt-card"|"vimeo-card"|"loom-card"|"wistia-card"|"generic-card"|"native-video"|"link";
  videoId?: string;
  iframeSrc?: string;   // kept for served-origin contexts (future)
  thumbUrl?: string;
  watchUrl: string;
  label: string;
};
const resolveVideo = (url = ""): VideoResult => {
  // YouTube — watch, shorts, youtu.be, nocookie, embed
  const yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    const t = url.match(/[?&]t=(\d+)/);
    return {
      type: "yt-card",
      videoId: id,
      thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      iframeSrc: `https://www.youtube-nocookie.com/embed/${id}?rel=0${t?`&start=${t[1]}`:""}`,
      watchUrl: `https://www.youtube.com/watch?v=${id}${t?`&t=${t[1]}`:""}`,
      label: "YouTube",
    };
  }
  // Vimeo
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    return {
      type: "vimeo-card",
      videoId: vm[1],
      thumbUrl: `https://vumbnail.com/${vm[1]}.jpg`,
      iframeSrc: `https://player.vimeo.com/video/${vm[1]}?dnt=1`,
      watchUrl: `https://vimeo.com/${vm[1]}`,
      label: "Vimeo",
    };
  }
  // Loom
  const lm = url.match(/loom\.com\/share\/([a-f0-9]+)/);
  if (lm) return { type: "loom-card", videoId: lm[1], iframeSrc: `https://www.loom.com/embed/${lm[1]}`, watchUrl: url, label: "Loom" };
  // Wistia
  const ws = url.match(/(?:wistia\.com|wi\.st)\/(?:medias|embed)\/([A-Za-z0-9]+)/);
  if (ws) return { type: "wistia-card", videoId: ws[1], iframeSrc: `https://fast.wistia.net/embed/iframe/${ws[1]}`, watchUrl: url, label: "Wistia" };
  // Dailymotion
  const dm = url.match(/dailymotion\.com\/video\/([A-Za-z0-9]+)/);
  if (dm) return { type: "generic-card", iframeSrc: `https://www.dailymotion.com/embed/video/${dm[1]}`, watchUrl: url, label: "Dailymotion" };
  // Streamable
  const sb = url.match(/streamable\.com\/([a-z0-9]+)$/);
  if (sb) return { type: "generic-card", iframeSrc: `https://streamable.com/e/${sb[1]}`, watchUrl: url, label: "Streamable" };
  // Twitch
  const twCl = url.match(/twitch\.tv\/\w+\/clip\/([A-Za-z0-9_-]+)/);
  if (twCl) return { type: "generic-card", watchUrl: url, label: "Twitch" };
  const twVod = url.match(/twitch\.tv\/videos\/(\d+)/);
  if (twVod) return { type: "generic-card", watchUrl: url, label: "Twitch" };
  // Direct video file
  if (/\.(mp4|webm|ogg|ogv|mov)(\?|$)/i.test(url)) return { type: "native-video", watchUrl: url, label: "Video" };
  return { type: "link", watchUrl: url, label: urlHost(url) || "Video" };
};

// ── Audio embed resolver ───────────────────────────────────────────────────────
type AudioResult = {
  type: "native"|"spotify-track"|"spotify-playlist"|"soundcloud"|"apple"|"link";
  src: string;
  label?: string;
  mimeHint?: string;  // optional <source type=""> hint
};
const resolveAudio = (url = ""): AudioResult => {
  // Spotify track / episode
  const spTr = url.match(/open\.spotify\.com\/(track|episode)\/([A-Za-z0-9]+)/);
  if (spTr) return { type: "spotify-track", src: `https://open.spotify.com/embed/${spTr[1]}/${spTr[2]}?utm_source=generator`, label: "Spotify" };
  // Spotify playlist / album / show / podcast
  const spPl = url.match(/open\.spotify\.com\/(playlist|album|show|artist)\/([A-Za-z0-9]+)/);
  if (spPl) return { type: "spotify-playlist", src: `https://open.spotify.com/embed/${spPl[1]}/${spPl[2]}?utm_source=generator`, label: "Spotify" };
  // SoundCloud
  if (/soundcloud\.com/.test(url)) return {
    type: "soundcloud",
    src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%236b8f71&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=true`,
    label: "SoundCloud",
  };
  // Apple Music / Podcasts
  if (/music\.apple\.com|podcasts\.apple\.com/.test(url)) {
    const em = url.replace("music.apple.com","embed.music.apple.com").replace("podcasts.apple.com","embed.podcasts.apple.com");
    return { type: "apple", src: em, label: "Apple Music" };
  }
  // Known streaming / hosting platforms that need a link card (no embeddable player)
  if (/tidal\.com|deezer\.com|amazon\.com\/music|music\.youtube\.com/.test(url)) {
    return { type: "link", src: url, label: urlHost(url) || "Audio" };
  }
  // For everything else (including direct file URLs with or without extension,
  // CDN-hosted audio, podcast episode MP3s, etc.) — use native <audio>.
  // Detect MIME hint from extension if present so <source type> is correct.
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const mimeMap: Record<string,string> = {
    mp3:"audio/mpeg", wav:"audio/wav", ogg:"audio/ogg", oga:"audio/ogg",
    aac:"audio/aac", flac:"audio/flac", opus:"audio/ogg;codecs=opus",
    m4a:"audio/mp4", weba:"audio/webm", webm:"audio/webm",
  };
  return { type: "native", src: url, label: urlHost(url) || "Audio", mimeHint: mimeMap[ext] };
};

// ── File / embed resolver ─────────────────────────────────────────────────────
type FileResult = { type: "pdf-iframe"|"gdoc"|"gsheet"|"gslide"|"office"|"codepen"|"codesandbox"|"stackblitz"|"jsfiddle"|"replit"|"figma"|"airtable"|"notion"|"generic-iframe"|"download"|"local"; label: string; iframeSrc?: string };
const resolveFile = (url = "", name = ""): FileResult => {
  if (!url) return { type: "local", label: "File" };
  if (isLocal(url)) return { type: "local", label: name || url.split("/").pop() || "File" };
  const h = urlHost(url);
  // Google Docs/Sheets/Slides
  if (/docs\.google\.com\/document/.test(url)) {
    const em = url.replace(/\/edit.*$/, "/preview");
    return { type: "gdoc", label: "Google Doc", iframeSrc: em };
  }
  if (/docs\.google\.com\/spreadsheets/.test(url)) {
    const em = url.replace(/\/edit.*$/, "/preview");
    return { type: "gsheet", label: "Google Sheet", iframeSrc: em };
  }
  if (/docs\.google\.com\/presentation/.test(url)) {
    const em = url.replace(/\/edit.*$/, "/embed?start=false&loop=false&delayms=3000");
    return { type: "gslide", label: "Google Slides", iframeSrc: em };
  }
  // Google Drive direct file
  const gDrive = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (gDrive) return { type: "pdf-iframe", label: "Google Drive", iframeSrc: `https://drive.google.com/file/d/${gDrive[1]}/preview` };
  // Office 365 / OneDrive
  if (/sharepoint\.com|1drv\.ms|onedrive\.live\.com/.test(url)) {
    const em = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return { type: "office", label: "Office / OneDrive", iframeSrc: em };
  }
  // Direct PDF
  const ext = (name || url).split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf" || url.includes(".pdf")) return { type: "pdf-iframe", label: "PDF", iframeSrc: url };
  // CodePen
  const cpMatch = url.match(/codepen\.io\/([^/]+)\/pen\/([A-Za-z0-9]+)/);
  if (cpMatch) return { type: "codepen", label: "CodePen", iframeSrc: `https://codepen.io/${cpMatch[1]}/embed/${cpMatch[2]}?height=400&theme-id=light&default-tab=result` };
  // CodeSandbox
  const csMatch = url.match(/codesandbox\.io\/s\/([A-Za-z0-9_-]+)/);
  if (csMatch) return { type: "codesandbox", label: "CodeSandbox", iframeSrc: `https://codesandbox.io/embed/${csMatch[1]}?fontsize=14&hidenavigation=1&theme=light` };
  // StackBlitz
  const sbMatch = url.match(/stackblitz\.com\/(?:edit|github)\/([A-Za-z0-9_/-]+)/);
  if (sbMatch) return { type: "stackblitz", label: "StackBlitz", iframeSrc: `https://stackblitz.com/edit/${sbMatch[1]}?embed=1&view=preview` };
  // JSFiddle
  if (/jsfiddle\.net/.test(url)) return { type: "jsfiddle", label: "JSFiddle", iframeSrc: url.replace(/\/+$/, "") + "/embedded/result/" };
  // Replit
  if (/replit\.com/.test(url)) return { type: "replit", label: "Replit", iframeSrc: url.replace("replit.com", "replit.com") + "?embed=1" };
  // Figma
  if (/figma\.com\/(?:file|proto|design|board)/.test(url)) return { type: "figma", label: "Figma", iframeSrc: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}` };
  // Airtable
  if (/airtable\.com/.test(url)) return { type: "airtable", label: "Airtable", iframeSrc: url.includes("/embed/") ? url : url.replace("airtable.com", "airtable.com/embed") };
  // Notion
  if (/notion\.so|notion\.site/.test(url)) return { type: "notion", label: "Notion", iframeSrc: url };
  // Office file extensions
  if (["doc","docx","xls","xlsx","ppt","pptx"].includes(ext)) {
    const em = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    return { type: "office", label: ext.toUpperCase(), iframeSrc: em };
  }
  // Download fallback
  return { type: "download", label: name || url.split("/").pop() || "File" };
};

// ── Embed resolver (for dedicated embed blocks) ────────────────────────────────
type EmbedResult = { type: "iframe"|"vid-card"|"link"; src: string; label: string; tall?: boolean; thumbUrl?: string; watchUrl?: string };
const resolveEmbed = (url = ""): EmbedResult => {
  // First try file resolver for code/doc embeds
  const fr = resolveFile(url, "");
  if (fr.iframeSrc && fr.type !== "local" && fr.type !== "download") {
    const tall = ["codepen","codesandbox","stackblitz","replit","jsfiddle","figma"].includes(fr.type);
    return { type: "iframe", src: fr.iframeSrc, label: fr.label, tall };
  }
  // Then try video resolver — return as card (not iframe) to avoid origin errors
  const vr = resolveVideo(url);
  if (vr.type === "yt-card" || vr.type === "vimeo-card" || vr.type === "loom-card" || vr.type === "generic-card" || vr.type === "wistia-card") {
    return { type: "vid-card", src: vr.watchUrl, label: vr.label, thumbUrl: vr.thumbUrl, watchUrl: vr.watchUrl };
  }
  // Then try audio (spotify/soundcloud get iframes)
  const ar = resolveAudio(url);
  if (ar.type !== "native" && ar.type !== "link") {
    return { type: "iframe", src: ar.src, label: ar.label || "Audio", tall: false };
  }
  // Generic embeddable URL
  return { type: "link", src: url, label: urlHost(url) || "Embed" };
};

// ── File icon ─────────────────────────────────────────────────────────────────
const fileIcon = (name = "", url = "") => {
  const ext = (name || url).split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "📄";
  if (["doc","docx"].includes(ext)) return "📝";
  if (["xls","xlsx","csv"].includes(ext)) return "📊";
  if (["ppt","pptx"].includes(ext)) return "📋";
  if (["zip","rar","7z","tar","gz"].includes(ext)) return "🗜";
  if (["jpg","jpeg","png","gif","webp","svg","ico"].includes(ext)) return "🖼";
  if (["mp4","mov","avi","mkv","webm"].includes(ext)) return "🎬";
  if (["mp3","wav","ogg","aac","flac"].includes(ext)) return "🎵";
  if (["js","ts","jsx","tsx","html","css","py","go","rs","java","c","cpp","sh"].includes(ext)) return "💻";
  if (["md","txt"].includes(ext)) return "📃";
  if (["json","yaml","yml","xml","env"].includes(ext)) return "⚙️";
  return "📎";
};

// ── Service branding ─────────────────────────────────────────────────────────
const serviceBadge = (label: string) => {
  const badges: Record<string,{bg:string;fg:string;icon:string}> = {
    "YouTube":    { bg:"#ff0000", fg:"#fff", icon:"▶" },
    "Vimeo":      { bg:"#1ab7ea", fg:"#fff", icon:"▶" },
    "Loom":       { bg:"#625df5", fg:"#fff", icon:"▶" },
    "Spotify":    { bg:"#1db954", fg:"#fff", icon:"♫" },
    "SoundCloud": { bg:"#ff5500", fg:"#fff", icon:"♬" },
    "Apple Music":{ bg:"#fc3c44", fg:"#fff", icon:"♫" },
    "CodePen":    { bg:"#1e1f26", fg:"#fff", icon:"✏" },
    "CodeSandbox":{ bg:"#040404", fg:"#fff", icon:"⬡" },
    "StackBlitz": { bg:"#1374ef", fg:"#fff", icon:"⚡" },
    "JSFiddle":   { bg:"#0084ff", fg:"#fff", icon:"⌨" },
    "Replit":     { bg:"#f26207", fg:"#fff", icon:"▶" },
    "Figma":      { bg:"#f24e1e", fg:"#fff", icon:"◈" },
    "Google Doc": { bg:"#4285f4", fg:"#fff", icon:"📄" },
    "Google Sheet":{ bg:"#0f9d58",fg:"#fff", icon:"📊" },
    "Google Slides":{ bg:"#f4b400",fg:"#fff",icon:"📋" },
    "Airtable":   { bg:"#2d7ff9", fg:"#fff", icon:"⊞" },
  };
  const b = badges[label];
  if (!b) return `<span class="svc-badge svc-badge-default">${label}</span>`;
  return `<span class="svc-badge" style="background:${b.bg};color:${b.fg}">${b.icon} ${label}</span>`;
};

// ── Numbered list counter ─────────────────────────────────────────────────────
// We track consecutive numbered blocks to produce correct 1. 2. 3. numbering.
// Reset whenever a non-numbered block is encountered.
let _listCounter = 0;
const resetListCounter = () => { _listCounter = 0; };

// ── Per-export chart registry ─────────────────────────────────────────────────
type ChartEntry = { id: string; cfg: object };
let _charts: ChartEntry[] = [];
let _cid = 0;
const nextCid = () => `ch${++_cid}`;

// Chart.js 4 palette (same as ChartBlock.tsx defaultColors)
const PAL = ["#3b82f6","#22c55e","#a855f7","#f97316","#ec4899","#14b8a6","#eab308","#ef4444","#6366f1","#84cc16"];
const pc = (i: number) => PAL[i % PAL.length];

// ─── Chart config builder ─────────────────────────────────────────────────────

const buildChartConfig = (block: NoteBlock): object | null => {
  const type = block.chartType ?? "bar";
  let cols = block.chartColumns ?? [];
  let rows = block.chartRows ?? [];

  if (!cols.length && block.chartData?.length) {
    cols = [{ id:"cn", key:"name", type:"text" as const }, { id:"cv", key:"value", type:"number" as const }];
    rows = block.chartData.map(d => ({ id:d.id, cells:{ name:d.label, value:d.value } }));
  }
  if (!cols.length || !rows.length) return null;

  const numericCols = cols.filter(c => c.type === "number");
  if (!numericCols.length) return null;

  const xKey = block.chartXAxisKey ?? cols.find(c => c.type === "text")?.key ?? cols[0].key;
  const sColors: Record<string,string> = { ...(block.chartSeriesColors ?? {}) };
  numericCols.forEach((col, i) => { if (!sColors[col.key]) sColors[col.key] = pc(i); });

  const rawSel = block.chartSelectedSeries?.length ? block.chartSelectedSeries : numericCols.map(c => c.key);
  const active = rawSel.filter(s => numericCols.some(c => c.key === s));
  if (!active.length) return null;

  const data = rows.map(row => {
    const item: Record<string, string|number> = {};
    cols.forEach(col => { item[col.key] = row.cells[col.key] ?? (col.type === "number" ? 0 : ""); });
    return item;
  });
  const labels = data.map(d => String(d[xKey] ?? ""));

  // Hardcoded design tokens — no CSS variables (standalone HTML has no app theme)
  const GRID_COLOR  = "#e5e7eb";
  const TICK_COLOR  = "#6b7280";
  const LABEL_COLOR = "#374151";
  const FONT_FAMILY = "-apple-system,'SF Pro Text','Helvetica Neue',sans-serif";
  const FONT_SIZE   = 12;
  const baseFont = { family: FONT_FAMILY, size: FONT_SIZE };
  const gridCfg  = { color: GRID_COLOR };
  // Chart.js 4: use border object (not deprecated drawBorder)
  const borderCfg = { display: false };
  const tickCfg   = { color: TICK_COLOR, font: baseFont };

  const legend = {
    display: true,
    position: "bottom" as const,
    labels: {
      padding: 20,
      usePointStyle: true,
      pointStyleWidth: 10,
      color: LABEL_COLOR,
      font: { family: FONT_FAMILY, size: 12 },
    },
  };
  const tooltip = {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    titleColor: "#111827",
    bodyColor: "#374151",
    padding: 12,
    cornerRadius: 10,
    boxPadding: 5,
  };

  const cartScales = (horizontal = false, stacked = false) => ({
    x: {
      type: horizontal ? "linear" as const : "category" as const,
      grid: { color: GRID_COLOR, drawOnChartArea: horizontal },
      border: { display: false },
      ticks: { color: TICK_COLOR, font: baseFont, maxRotation: 45, autoSkip: true, autoSkipPadding: 12 },
      stacked: stacked || undefined,
      beginAtZero: horizontal ? true : undefined,
    },
    y: {
      type: horizontal ? "category" as const : "linear" as const,
      grid: { color: GRID_COLOR, drawOnChartArea: !horizontal },
      border: { display: false },
      ticks: { color: TICK_COLOR, font: baseFont },
      stacked: stacked || undefined,
      beginAtZero: !horizontal,
    },
  });

  switch (type) {
    case "bar": return {
      type: "bar",
      data: { labels, datasets: active.map(k => ({
        label: k, data: data.map(d => Number(d[k]??0)),
        backgroundColor: sColors[k], borderRadius: 6, borderSkipped: false, borderWidth: 0,
      }))},
      options: { responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip }, scales: cartScales() },
    };

    case "horizontalBar": return {
      type: "bar",
      data: { labels, datasets: active.map(k => ({
        label: k, data: data.map(d => Number(d[k]??0)),
        backgroundColor: sColors[k], borderRadius: 6, borderSkipped: false,
      }))},
      options: { indexAxis: "y", responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip }, scales: cartScales(true) },
    };

    case "stackedBar": return {
      type: "bar",
      data: { labels, datasets: active.map(k => ({
        label: k, data: data.map(d => Number(d[k]??0)),
        backgroundColor: sColors[k], stack: "s",
      }))},
      options: { responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip:{ ...tooltip, mode:"index" as const } },
        scales: cartScales(false, true) },
    };

    case "line": return {
      type: "line",
      data: { labels, datasets: active.map(k => ({
        label: k, data: data.map(d => Number(d[k]??0)),
        borderColor: sColors[k], backgroundColor: sColors[k],
        borderWidth: 2.5,
        pointRadius: 5, pointHoverRadius: 7,
        pointBackgroundColor: sColors[k], pointBorderColor: "#fff", pointBorderWidth: 2,
        tension: 0, fill: false,
      }))},
      options: { responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip:{ ...tooltip, mode:"index" as const } }, scales: cartScales() },
    };

    case "area": return {
      type: "line",
      data: { labels, datasets: active.map(k => ({
        label: k, data: data.map(d => Number(d[k]??0)),
        borderColor: sColors[k], backgroundColor: sColors[k]+"4d",
        borderWidth: 2.5,
        pointRadius: 4, pointHoverRadius: 6,
        pointBackgroundColor: sColors[k], pointBorderColor: "#fff", pointBorderWidth: 2,
        tension: 0, fill: true,
      }))},
      options: { responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip:{ ...tooltip, mode:"index" as const } }, scales: cartScales() },
    };

    case "pie":
    case "donut": {
      const col = numericCols.find(c => active.includes(c.key)) ?? numericCols[0];
      return {
        type: "doughnut",
        data: { labels, datasets:[{ data: data.map(d=>Number(d[col.key]??0)),
          backgroundColor: data.map((_,i)=>pc(i)), borderColor:"#fff", borderWidth:3, hoverOffset:10 }]},
        options: {
          cutout: type==="donut"?"60%":"0%",
          responsive:true, maintainAspectRatio:false, animation:{duration:400},
          plugins:{
            legend:{ display:true, position:"bottom" as const,
              labels:{ padding:16, usePointStyle:true, pointStyle:"circle" as const,
                color: LABEL_COLOR, font:{ family: FONT_FAMILY, size:12 } } },
            tooltip,
          },
        },
      };
    }

    case "scatter": {
      const xk = active[0] ?? numericCols[0]?.key;
      const yk = active[1] ?? active[0] ?? xk;
      return {
        type: "scatter",
        data: { datasets:[{
          label: "Data",
          data: data.map(d=>({x:Number(d[xk]??0),y:Number(d[yk]??0)})),
          backgroundColor: (sColors[xk]||pc(0))+"bb",
          borderColor: sColors[xk]||pc(0),
          borderWidth: 1.5,
          pointRadius: 7, pointHoverRadius: 9,
          pointBackgroundColor: sColors[xk]||pc(0),
          pointBorderColor: "#fff", pointBorderWidth: 2,
        }]},
        options: {
          responsive:true, maintainAspectRatio:false, animation:{duration:400},
          plugins:{ legend, tooltip },
          scales:{
            x:{ type:"linear" as const, grid:gridCfg, border:borderCfg, ticks:tickCfg,
              title:{ display:true, text:xk, color:LABEL_COLOR, font:baseFont } },
            y:{ grid:gridCfg, border:borderCfg, ticks:tickCfg, beginAtZero:true,
              title:{ display:true, text:yk, color:LABEL_COLOR, font:baseFont } },
          },
        },
      };
    }

    case "radar": return {
      type: "radar",
      data: { labels, datasets: active.map(k=>({
        label:k, data:data.map(d=>Number(d[k]??0)),
        backgroundColor:sColors[k]+"4d", borderColor:sColors[k],
        borderWidth:2.5,
        pointBackgroundColor:sColors[k], pointBorderColor:"#fff", pointBorderWidth:2,
        pointRadius:5, pointHoverRadius:7,
      }))},
      options:{
        responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip },
        scales:{
          r:{
            grid:{ color:GRID_COLOR },
            angleLines:{ color:GRID_COLOR, lineWidth:1 },
            pointLabels:{ display:true, color:LABEL_COLOR, font:{ family:FONT_FAMILY, size:12 } },
            ticks:{ display:true, color:TICK_COLOR, backdropColor:"transparent",
              font:{ family:FONT_FAMILY, size:10 } },
            beginAtZero:true,
          },
        },
      },
    };

    case "combo": return {
      type: "bar",
      data: { labels, datasets: active.map((k,idx)=>({
        type: idx%2===0?"bar" as const:"line" as const,
        label:k, data:data.map(d=>Number(d[k]??0)),
        backgroundColor:idx%2===0?sColors[k]:sColors[k]+"33",
        borderColor:sColors[k], borderWidth:idx%2===0?0:2.5,
        borderRadius:idx%2===0?6:0, fill:false, tension:0,
        pointRadius:idx%2===0?0:5, pointHoverRadius:idx%2===0?0:7,
        pointBackgroundColor:sColors[k], pointBorderColor:"#fff",
        pointBorderWidth:idx%2===0?0:2,
      }))},
      options:{ responsive:true, maintainAspectRatio:false, animation:{duration:400},
        plugins:{ legend, tooltip:{ ...tooltip, mode:"index" as const } }, scales:cartScales() },
    };

    default: return null;
  }
};

// ─── HTML block renderer ──────────────────────────────────────────────────────

const blockToHtml = (block: NoteBlock, depth = 0, prevType?: string, counter = {n:0}): string => {
  // Track numbered list consecutive counter
  if (block.type !== "numbered") { counter.n = 0; }

  switch (block.type) {
    // ── Text ─────────────────────────────────────────────────────────────────
    case "text":
      return block.content
        ? `<p class="prose">${renderInline(block.content)}</p>`
        : `<div class="spacer" aria-hidden="true"></div>`;

    // ── Headings ─────────────────────────────────────────────────────────────
    case "heading1": return `<h1 class="h1">${renderInline(block.content)}</h1>`;
    case "heading2": return `<h2 class="h2">${renderInline(block.content)}</h2>`;
    case "heading3": return `<h3 class="h3">${renderInline(block.content)}</h3>`;

    // ── Bullet list ───────────────────────────────────────────────────────────
    case "bullet":
      return `<ul class="ul"><li>${renderInline(block.content)}</li></ul>`;

    // ── Numbered list — auto-counter ──────────────────────────────────────────
    case "numbered": {
      counter.n++;
      return `<ol class="ol" style="--n:${counter.n}"><li><span class="ol-n">${counter.n}</span><span>${renderInline(block.content)}</span></li></ol>`;
    }

    // ── Todo ──────────────────────────────────────────────────────────────────
    case "todo":
      return `<label class="todo-item"><span class="cb${block.checked?" cb-on":""}"><svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="${block.checked?"done":""}">${renderInline(block.content)}</span></label>`;

    // ── Quote ─────────────────────────────────────────────────────────────────
    case "quote":
      return `<blockquote class="quote">${renderInline(block.content)}</blockquote>`;

    case "callout":
      return `<div class="callout"><span>${renderInline(block.content)}</span></div>`;

    // ── Code ──────────────────────────────────────────────────────────────────
    case "code":
      return `<div class="code-block"><div class="code-bar"><span class="traffic"><i></i><i></i><i></i></span><span class="code-lang">code</span></div><pre><code>${esc(block.content)}</code></pre></div>`;

    // ── Dividers ──────────────────────────────────────────────────────────────
    case "divider": return `<hr class="rule">`;
    case "labeledDivider":
      return block.dividerLabel
        ? `<div class="labeled-rule"><span>${esc(block.dividerLabel)}</span></div>`
        : `<hr class="rule">`;

    // ── Toggle — always open so PDF shows all content ────────────────────────
    case "toggle":
      return `<details class="toggle" open><summary class="toggle-summary">${renderInline(block.content)}</summary><div class="toggle-body">${renderInline(block.toggleContent||"")}</div></details>`;

    // ── Image — local shows note with download hint, external shows inline ───
    case "image": {
      if (!block.imageUrl) return "";
      const local = isLocal(block.imageUrl);
      if (local) {
        return `<div class="media-local-card"><span class="media-icon">🖼</span><div class="media-info"><span class="media-label">Image (local file)</span><span class="media-url">${esc(block.imageUrl.split("/").pop() || block.imageUrl)}</span><span class="file-note">This image is stored locally — it will appear when opened on the original device.</span></div></div>`;
      }
      return `<figure class="img-fig"><img src="${esc(block.imageUrl)}" alt="Image" loading="lazy"></figure>`;
    }

    // ── Video — local card / YT+Vimeo thumbnail card / native file ────────────
    case "video": {
      if (!block.videoUrl) return "";
      if (isLocal(block.videoUrl)) {
        const fname = block.videoUrl.split("/").pop() || "video";
        return `<div class="media-local-card">
  <div class="mlc-icon">🎬</div>
  <div class="mlc-body">
    <div class="mlc-label">Local Video</div>
    <div class="mlc-name">${esc(fname)}</div>
    <div class="mlc-hint">This video is stored on your device — it won't play in exported HTML.</div>
  </div>
</div>`;
      }
      const vr = resolveVideo(block.videoUrl);

      // YouTube — thumbnail card with play button overlay, opens on click
      if (vr.type === "yt-card") {
        return `<div class="embed-block">
  <div class="embed-bar">${serviceBadge("YouTube")}<a href="${esc(vr.watchUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Watch on YouTube ↗</a></div>
  <a class="vid-thumb-card" href="${esc(vr.watchUrl)}" target="_blank" rel="noopener" title="Watch on YouTube">
    <img class="vid-thumb-img" src="${esc(vr.thumbUrl||"")}" alt="YouTube video thumbnail" loading="lazy" onerror="this.style.display='none'">
    <div class="vid-thumb-overlay">
      <div class="vid-play-btn"><svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></div>
    </div>
  </a>
</div>`;
      }

      // Vimeo — thumbnail card
      if (vr.type === "vimeo-card") {
        return `<div class="embed-block">
  <div class="embed-bar">${serviceBadge("Vimeo")}<a href="${esc(vr.watchUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Watch on Vimeo ↗</a></div>
  <a class="vid-thumb-card" href="${esc(vr.watchUrl)}" target="_blank" rel="noopener" title="Watch on Vimeo">
    <img class="vid-thumb-img" src="${esc(vr.thumbUrl||"")}" alt="Vimeo video thumbnail" loading="lazy" onerror="this.style.display='none'">
    <div class="vid-thumb-overlay">
      <div class="vid-play-btn" style="background:#1ab7ea"><svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></div>
    </div>
  </a>
</div>`;
      }

      // Loom / Wistia / generic card services — link card with brand badge
      if (vr.type === "loom-card" || vr.type === "wistia-card" || vr.type === "generic-card") {
        return `<a class="vid-link-card" href="${esc(vr.watchUrl)}" target="_blank" rel="noopener">
  <div class="vlc-icon-wrap"><svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M8 5v14l11-7z"/></svg></div>
  <div class="media-info">
    <span class="media-label">${esc(vr.label)}</span>
    <span class="media-url">${esc(vr.watchUrl)}</span>
  </div>
  ${serviceBadge(vr.label)}
  <span class="mlc-arrow">↗</span>
</a>`;
      }

      // Native video file
      if (vr.type === "native-video") {
        return `<div class="embed-block">
  <div class="embed-bar">${serviceBadge("Video")}<a href="${esc(block.videoUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open ↗</a></div>
  <video controls class="native-video" preload="metadata" style="display:block;width:100%"><source src="${esc(block.videoUrl)}"><p class="media-fallback">Your browser cannot play this video. <a href="${esc(block.videoUrl)}" download>Download</a></p></video>
</div>`;
      }

      // Generic link fallback
      return `<a class="media-link-card" href="${esc(block.videoUrl)}" target="_blank" rel="noopener">
  <span class="media-icon">🎬</span>
  <div class="media-info"><span class="media-label">Video</span><span class="media-url">${esc(block.videoUrl)}</span></div>
  <span class="mlc-arrow">↗</span>
</a>`;
    }

    // ── Audio — local / Spotify / SoundCloud / Apple Music / native <audio> ────
    case "audio": {
      if (!block.audioUrl) return "";
      const fname = decodeURIComponent(block.audioUrl.split("?")[0].split("/").pop() || "Audio");

      // Local file
      if (isLocal(block.audioUrl)) {
        return `<div class="media-local-card">
  <div class="mlc-icon">🎵</div>
  <div class="mlc-body">
    <div class="mlc-label">Local Audio</div>
    <div class="mlc-name">${esc(fname)}</div>
    <div class="mlc-hint">This audio file is stored on your device — it won't play in exported HTML.</div>
  </div>
</div>`;
      }

      const ar = resolveAudio(block.audioUrl);

      // Spotify track / episode — compact 152px iframe
      if (ar.type === "spotify-track") {
        return `<div class="embed-block embed-block-audio">
  <div class="embed-bar">${serviceBadge("Spotify")}<a href="${esc(block.audioUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open in Spotify ↗</a></div>
  <iframe src="${esc(ar.src)}" width="100%" height="152" frameborder="0" allowtransparency="true" allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" loading="lazy" style="display:block;border-radius:0 0 var(--r14) var(--r14)"></iframe>
</div>`;
      }

      // Spotify playlist / album / show — taller iframe
      if (ar.type === "spotify-playlist") {
        return `<div class="embed-block embed-block-audio">
  <div class="embed-bar">${serviceBadge("Spotify")}<a href="${esc(block.audioUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open in Spotify ↗</a></div>
  <iframe src="${esc(ar.src)}" width="100%" height="352" frameborder="0" allowtransparency="true" allow="autoplay;clipboard-write;encrypted-media;fullscreen;picture-in-picture" loading="lazy" style="display:block;border-radius:0 0 var(--r14) var(--r14)"></iframe>
</div>`;
      }

      // SoundCloud — waveform visual player
      if (ar.type === "soundcloud") {
        return `<div class="embed-block embed-block-audio">
  <div class="embed-bar">${serviceBadge("SoundCloud")}<a href="${esc(block.audioUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open on SoundCloud ↗</a></div>
  <iframe width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay" src="${esc(ar.src)}" loading="lazy" style="display:block;border-radius:0 0 var(--r14) var(--r14)"></iframe>
</div>`;
      }

      // Apple Music / Podcasts
      if (ar.type === "apple") {
        return `<div class="embed-block embed-block-audio">
  <div class="embed-bar">${serviceBadge("Apple Music")}<a href="${esc(block.audioUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open in Apple Music ↗</a></div>
  <iframe allow="autoplay *; encrypted-media *; fullscreen *" frameborder="0" height="175" sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation" src="${esc(ar.src)}" loading="lazy" style="width:100%;display:block;border-radius:0 0 var(--r14) var(--r14)"></iframe>
</div>`;
      }

      // Native <audio> — for direct files AND any unknown external URL.
      // The browser will try to fetch & play; if it can't (wrong MIME / CORS),
      // the <a> fallback inside is shown automatically.
      if (ar.type === "native") {
        const srcTag = ar.mimeHint
          ? `<source src="${esc(block.audioUrl)}" type="${esc(ar.mimeHint)}">`
          : `<source src="${esc(block.audioUrl)}">`;
        const displayName = fname !== "Audio" ? fname : (ar.label || "Audio");
        return `<div class="audio-card">
  <div class="audio-card-icon">🎵</div>
  <div class="audio-inner">
    <span class="audio-name">${esc(displayName)}</span>
    <audio controls preload="metadata" class="audio-player">
      ${srcTag}
      <p class="media-fallback">Can't play this audio. <a href="${esc(block.audioUrl)}" target="_blank" rel="noopener">Open ↗</a></p>
    </audio>
  </div>
</div>`;
      }

      // Known-incompatible streaming service — link card
      return `<a class="media-link-card" href="${esc(block.audioUrl)}" target="_blank" rel="noopener">
  <span class="media-icon">🎵</span>
  <div class="media-info">
    <span class="media-label">Audio — ${esc(ar.label||urlHost(block.audioUrl)||"")}</span>
    <span class="media-url">${esc(block.audioUrl)}</span>
  </div>
  <span class="mlc-arrow">↗</span>
</a>`;
    }

    // ── File — local badge / PDF iframe / GDoc / Office / CodePen / Figma / etc ─
    case "file": {
      if (!block.fileUrl) return "";
      const name = block.fileName || block.fileUrl.split("/").pop() || "File";
      const icon = fileIcon(block.fileName || "", block.fileUrl);
      const fr = resolveFile(block.fileUrl, name);

      // Local file — can't display, show a clear card
      if (fr.type === "local") {
        return `<div class="media-local-card">
  <div class="mlc-icon">${icon}</div>
  <div class="mlc-body">
    <div class="mlc-label">Local File <span class="local-badge">local</span></div>
    <div class="mlc-name">${esc(name)}</div>
    <div class="mlc-hint">This file is stored on your device and can't be previewed in the export.</div>
  </div>
</div>`;
      }

      // Embeddable (PDF, GDoc, GSheet, GSlide, Office, CodePen, Figma, etc.)
      if (fr.iframeSrc) {
        const isCode  = ["codepen","codesandbox","stackblitz","jsfiddle","replit"].includes(fr.type);
        const isDesign = fr.type === "figma";
        const iframeH = isCode ? "460px" : isDesign ? "500px" : fr.type === "gslide" ? "480px" : "520px";
        return `<div class="embed-block">
  <div class="embed-bar">
    ${serviceBadge(fr.label)}
    <span class="embed-filename">${esc(name)}</span>
    <a href="${esc(block.fileUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open ↗</a>
  </div>
  <div class="embed-frame-wrap" style="height:${iframeH}">
    <iframe src="${esc(fr.iframeSrc)}" frameborder="0" allowfullscreen loading="lazy" title="${esc(fr.label)}" allow="fullscreen"></iframe>
  </div>
</div>`;
      }

      // Plain download link
      return `<div class="file-card">
  <div class="file-icon-lg">${icon}</div>
  <div class="file-info">
    <span class="file-name">${esc(name)}</span>
    <a href="${esc(block.fileUrl)}" target="_blank" rel="noopener" class="file-link" download>Download ↗</a>
  </div>
</div>`;
    }

    // ── Bookmark ──────────────────────────────────────────────────────────────
    case "bookmark":
      if (!block.bookmarkUrl) return "";
      return `<a class="bookmark-card" href="${esc(block.bookmarkUrl)}" target="_blank" rel="noopener"><div class="bm-body"><div class="bm-title">${renderInline(block.bookmarkTitle||block.bookmarkUrl)}</div>${block.bookmarkDescription?`<div class="bm-desc">${renderInline(block.bookmarkDescription)}</div>`:""}<div class="bm-url">${esc(block.bookmarkUrl)}</div></div><span class="bm-arrow">↗</span></a>`;

    // ── Embed — CodePen / CodeSandbox / StackBlitz / Figma / GDoc / YT card / etc
    case "embed": {
      if (!block.embedUrl) return "";
      const er = resolveEmbed(block.embedUrl);
      if (er.type === "vid-card") {
        // YouTube/Vimeo thumbnail card (same as video block)
        return `<div class="embed-block">
  <div class="embed-bar">${serviceBadge(er.label)}<a href="${esc(er.watchUrl||block.embedUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Watch on ${esc(er.label)} ↗</a></div>
  <a class="vid-thumb-card" href="${esc(er.watchUrl||block.embedUrl)}" target="_blank" rel="noopener">
    ${er.thumbUrl?`<img class="vid-thumb-img" src="${esc(er.thumbUrl)}" alt="Video thumbnail" loading="lazy" onerror="this.style.display='none'">`:`<div class="vid-thumb-placeholder"></div>`}
    <div class="vid-thumb-overlay"><div class="vid-play-btn"><svg viewBox="0 0 24 24" fill="white" width="28" height="28"><path d="M8 5v14l11-7z"/></svg></div></div>
  </a>
</div>`;
      }
      if (er.type === "iframe") {
        const h = er.tall ? "480px" : "360px";
        return `<div class="embed-block">
  <div class="embed-bar">${serviceBadge(er.label)}<a href="${esc(block.embedUrl)}" target="_blank" rel="noopener" class="embed-ext-link">Open ↗</a></div>
  <div class="embed-frame-wrap" style="height:${h}">
    <iframe src="${esc(er.src)}" frameborder="0" allowfullscreen loading="lazy" title="${esc(er.label)}" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture;fullscreen"></iframe>
  </div>
</div>`;
      }
      return `<a class="media-link-card" href="${esc(block.embedUrl)}" target="_blank" rel="noopener">
  <span class="media-icon">🔗</span>
  <div class="media-info"><span class="media-label">Embed</span><span class="media-url">${esc(block.embedUrl)}</span></div>
  <span class="mlc-arrow">↗</span>
</a>`;
    }

    // ── Equation — KaTeX rendered ─────────────────────────────────────────────
    case "equation":
      return `<div class="equation" data-formula="${esc(block.content)}"><div class="eq-display">${esc(block.content)}</div><div class="eq-rendered" id="eq-${Math.random().toString(36).slice(2)}"></div></div>`;

    // ── Progress — color from Tailwind class → hex ────────────────────────────
    case "progress": {
      const v = Math.min(100, Math.max(0, block.progressValue ?? 0));
      const hex = toHex(block.progressColor || "", "#22c55e");
      const pct = v;
      const label = v < 100 ? `${pct}%` : "Complete ✓";
      return `<div class="progress-card">
  <div class="progress-header">
    <span class="progress-pct">${pct}%</span>
    <span class="progress-status">${label}</span>
  </div>
  <div class="progress-track"><div class="progress-fill" style="width:${pct}%;background:${hex}"></div></div>
  <div class="progress-ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
</div>`;
    }

    // ── Rating ────────────────────────────────────────────────────────────────
    case "rating": {
      const v = block.ratingValue??0, m = block.ratingMax??5;
      return `<div class="rating">${Array.from({length:m},(_,i)=>`<span class="${i<v?"star-on":"star-off"}">★</span>`).join("")}<span class="rating-label">${v}/${m}</span></div>`;
    }

    // ── Table — with horizontal scroll + print-safe full width ───────────────
    case "table": {
      const rows = block.tableData??[]; if (!rows.length) return "";
      const head = rows[0].map(c=>`<th>${renderInline(c)}</th>`).join("");
      const body = rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${renderInline(c)}</td>`).join("")}</tr>`).join("");
      return `<div class="table-outer"><div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
    }

    // ── Kanban ────────────────────────────────────────────────────────────────
    case "kanban": {
      const cols=(block.kanbanColumns??[]).filter(c=>c.title||c.cards.length);
      return `<div class="kanban"><div class="kanban-scroll">${cols.map(col=>`<div class="kanban-col"><div class="kanban-hd"><span class="kanban-title">${esc(col.title||"Column")}</span><span class="kanban-badge">${col.cards.filter(c=>c.content).length}</span></div>${col.cards.filter(c=>c.content).map(c=>`<div class="kanban-card">${renderInline(c.content)}</div>`).join("")}</div>`).join("")}</div></div>`;
    }

    // ── Timeline — color from Tailwind class ───────────────────────────────────
    case "timeline": {
      const items=block.timelineItems??[];
      return `<div class="timeline">${items.map((item,i)=>{
        const hex=toHex(item.color,"#6366f1");
        return `<div class="tl-row${i===0?" tl-first":""}"><div class="tl-side"><div class="tl-dot" style="background:${hex};box-shadow:0 0 0 4px ${hex}22"></div><div class="tl-line" style="background:linear-gradient(${hex},${hex}44)"></div></div><div class="tl-content"><div class="tl-date">${esc(item.date)}</div><div class="tl-title">${renderInline(item.title)}</div>${item.description?`<div class="tl-desc">${renderInline(item.description)}</div>`:""}</div></div>`;
      }).join("")}</div>`;
    }

    // ── Gallery — local images show placeholder, external render inline ─────
    case "gallery": {
      const imgs = block.galleryImages ?? [];
      return `<div class="gallery">${imgs.map(img => {
        const local = isLocal(img.url);
        if (local) {
          const fname = img.url.split("/").pop() || "Image";
          return `<figure class="gal-item gal-local"><div class="gal-local-inner"><span class="gal-local-icon">🖼</span><span class="gal-local-name">${esc(fname)}</span><span class="gal-local-note">Local file</span></div>${img.caption?`<figcaption>${esc(img.caption)}</figcaption>`:""}</figure>`;
        }
        return `<figure class="gal-item"><img src="${esc(img.url)}" alt="${esc(img.caption||"")}" loading="lazy">${img.caption?`<figcaption>${renderInline(img.caption)}</figcaption>`:""}</figure>`;
      }).join("")}</div>`;
    }

    // ── Mindmap — Sugiyama layered graph, proper port routing, labels ─────────
    case "mindmap": {
      const nodes = block.mindMapNodes ?? [];
      const rawConns = block.mindMapConnections ?? [];
      if (!nodes.length) return `<div class="mindmap-empty">No mind map nodes</div>`;

      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // ── Geometry ───────────────────────────────────────────────────────────
      const NW = 148, NH = 42, LH_GAP = 100, NV_GAP = 32, PAD = 40;

      // ── Step 1: Separate floating (fully disconnected) nodes ──────────────
      const validConns = rawConns.filter(
        c => c.from !== c.to && nodeMap.has(c.from) && nodeMap.has(c.to)
      );
      const usedIds = new Set<string>();
      validConns.forEach(c => { usedIds.add(c.from); usedIds.add(c.to); });
      const graphNodes = nodes.filter(n =>  usedIds.has(n.id));
      const floatNodes = nodes.filter(n => !usedIds.has(n.id));

      // ── Step 2: Back-edge detection (iterative DFS) ────────────────────────
      const dfsCol = new Map<string, 0|1|2>();
      graphNodes.forEach(n => dfsCol.set(n.id, 0));
      const backSet = new Set<string>(); // "from→to"

      graphNodes.forEach(startN => {
        if ((dfsCol.get(startN.id) ?? 0) !== 0) return;
        const nbOf = (id: string) => validConns.filter(c => c.from === id).map(c => c.to);
        const stk: { id: string; it: Iterator<string> }[] = [];
        dfsCol.set(startN.id, 1);
        stk.push({ id: startN.id, it: nbOf(startN.id)[Symbol.iterator]() });
        while (stk.length) {
          const top = stk[stk.length - 1];
          const { value: nb, done } = top.it.next();
          if (done) { dfsCol.set(top.id, 2); stk.pop(); continue; }
          const col = dfsCol.get(nb) ?? 0;
          if (col === 1) backSet.add(`${top.id}→${nb}`);
          else if (col === 0) {
            dfsCol.set(nb, 1);
            stk.push({ id: nb, it: nbOf(nb)[Symbol.iterator]() });
          }
        }
      });
      const isBack = (f: string, t: string) => backSet.has(`${f}→${t}`);

      // ── Step 3: Longest-path layering on the DAG ──────────────────────────
      const outE = new Map<string, string[]>();
      const inD  = new Map<string, number>();
      graphNodes.forEach(n => { outE.set(n.id, []); inD.set(n.id, 0); });
      validConns.forEach(c => {
        if (isBack(c.from, c.to)) return;
        outE.get(c.from)!.push(c.to);
        inD.set(c.to, (inD.get(c.to) ?? 0) + 1);
      });
      const layerOf = new Map<string, number>();
      const kQ = graphNodes.filter(n => (inD.get(n.id) ?? 0) === 0).map(n => n.id);
      if (!kQ.length && graphNodes.length) kQ.push(graphNodes[0].id);
      while (kQ.length) {
        const id = kQ.shift()!;
        const l = layerOf.get(id) ?? 0;
        (outE.get(id) || []).forEach(to => {
          const nl = l + 1;
          if ((layerOf.get(to) ?? 0) < nl) layerOf.set(to, nl);
          const d = (inD.get(to) ?? 1) - 1;
          inD.set(to, d);
          if (d <= 0) kQ.push(to);
        });
      }
      graphNodes.forEach(n => { if (!layerOf.has(n.id)) layerOf.set(n.id, 0); });

      // ── Step 4: Group + barycentric sort within layers ─────────────────────
      const maxL = Math.max(...graphNodes.map(n => layerOf.get(n.id) ?? 0), 0);
      const layerGroups: string[][] = Array.from({ length: maxL + 1 }, () => []);
      graphNodes.forEach(n => layerGroups[layerOf.get(n.id) ?? 0].push(n.id));

      const bary = (id: string, dir: "in"|"out") => {
        const peers = dir === "out"
          ? validConns.filter(c => c.from === id && !isBack(c.from, c.to)).map(c => c.to)
          : validConns.filter(c => c.to   === id && !isBack(c.from, c.to)).map(c => c.from);
        if (!peers.length) return 999;
        return peers.reduce((s, r) => s + (layerGroups[layerOf.get(r)??0]?.indexOf(r) ?? 0), 0) / peers.length;
      };
      for (let pass = 0; pass < 3; pass++) {
        layerGroups.forEach(g => g.sort((a, b) => bary(a, pass%2===0?"in":"out") - bary(b, pass%2===0?"in":"out")));
      }

      // ── Step 5: Pixel positions ────────────────────────────────────────────
      type Pt = { x: number; y: number; cx: number; cy: number };
      const pos = new Map<string, Pt>();
      layerGroups.forEach((group, li) => {
        const x = PAD + li * (NW + LH_GAP);
        group.forEach((id, ni) => {
          const y = PAD + ni * (NH + NV_GAP);
          pos.set(id, { x, y, cx: x + NW / 2, cy: y + NH / 2 });
        });
      });

      // ── Step 6: Spread exit/entry ports per node ───────────────────────────
      // For each node, evenly divide its right edge (exit) among outgoing
      // forward edges, and its left edge (entry) among incoming forward edges.
      // This prevents all arrows from stacking on the same pixel.
      const rPortsOf = new Map<string, number[]>(); // nodeId → list of y values
      const lPortsOf = new Map<string, number[]>();
      graphNodes.forEach(n => {
        const p = pos.get(n.id);
        if (!p) return;
        const outs = validConns.filter(c => c.from === n.id && !isBack(c.from, c.to));
        const ins  = validConns.filter(c => c.to   === n.id && !isBack(c.from, c.to));
        const spread = (count: number) => {
          if (count === 0) return [];
          if (count === 1) return [p.cy];
          return Array.from({ length: count }, (_, i) =>
            p.y + NH * 0.15 + i * (NH * 0.7 / (count - 1))
          );
        };
        rPortsOf.set(n.id, spread(outs.length));
        lPortsOf.set(n.id, spread(ins.length));
      });
      const rIdxOf = new Map<string, number>();
      const lIdxOf = new Map<string, number>();

      // ── Step 7: Arrowhead markers + gradient/filter defs (one per unique color) ─
      const uniqueHex = new Set<string>();
      nodes.forEach(n => uniqueHex.add(toHex(n.color || "bg-blue-500", "#3b82f6")));

      const arrowDefs = [
        // Shared drop-shadow filter for nodes
        `<filter id="mm-shadow" x="-20%" y="-20%" width="140%" height="140%">` +
          `<feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#00000018"/>` +
        `</filter>`,
        // Subtle glow filter for source nodes
        `<filter id="mm-glow" x="-30%" y="-30%" width="160%" height="160%">` +
          `<feGaussianBlur stdDeviation="4" result="blur"/>` +
          `<feComposite in="SourceGraphic" in2="blur" operator="over"/>` +
        `</filter>`,
        // Per-color arrow markers + gradient defs
        ...[...uniqueHex].map(hex => {
          const id    = hex.replace('#', '');
          const mid   = `am${id}`;
          const gid   = `mg${id}`;
          const egid  = `eg${id}`;
          // Hex → RGB for rgba() use
          const r = parseInt(hex.slice(1,3),16), g2 = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
          return [
            // Elegant filled arrowhead — slim triangle, refX=6 so tip aligns with path endpoint
            `<marker id="${mid}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">` +
              `<path d="M0,0.5 L6,3.5 L0,6.5 Z" fill="${hex}" opacity="0.9"/>` +
            `</marker>`,
            // Radial gradient fill for source nodes
            `<radialGradient id="${gid}" cx="35%" cy="30%" r="65%">` +
              `<stop offset="0%" stop-color="${hex}" stop-opacity="1"/>` +
              `<stop offset="100%" stop-color="${hex}" stop-opacity="0.82"/>` +
            `</radialGradient>`,
            // Linear gradient for edges (color → transparent)
            `<linearGradient id="${egid}" x1="0%" y1="0%" x2="100%" y2="0%">` +
              `<stop offset="0%" stop-color="rgba(${r},${g2},${b},0.55)"/>` +
              `<stop offset="100%" stop-color="rgba(${r},${g2},${b},0.85)"/>` +
            `</linearGradient>`,
          ].join("");
        })
      ].join("");

      // ── Step 8: Draw edges ─────────────────────────────────────────────────
      const edgeGlowSvg: string[] = [];   // layer 1 — soft glow halos (drawn first / bottom)
      const edgeMainSvg: string[] = [];   // layer 2 — main strokes + arrowheads
      const labelSvg: string[] = [];      // layer 3 — edge labels (above strokes, below nodes)
      let backCount = 0;

      validConns.forEach(c => {
        if (!pos.has(c.from) || !pos.has(c.to)) return;
        const fp = pos.get(c.from)!;
        const tp = pos.get(c.to)!;
        const fHex = toHex(nodeMap.get(c.from)?.color || "bg-blue-500", "#3b82f6");
        const tHex = toHex(nodeMap.get(c.to)?.color   || "bg-blue-500", "#3b82f6");
        const markId = `am${tHex.replace('#', '')}`;
        const label  = (c as any).label as string | undefined;

        let pathD = "", lx = 0, ly = 0;

        if (isBack(c.from, c.to)) {
          // Back-edge: graceful arc below all nodes
          backCount++;
          const allMaxY = Math.max(...[...pos.values()].map(p => p.y + NH));
          const arcY = allMaxY + 36 + backCount * 38;
          // Start from bottom-center of source, end at bottom-center of target
          const sx = fp.cx, sy = fp.y + NH;
          const ex = tp.cx, ey = tp.y + NH;
          pathD = `M${sx.toFixed(1)},${sy.toFixed(1)} ` +
                  `C${sx.toFixed(1)},${arcY.toFixed(1)} ` +
                  `${ex.toFixed(1)},${arcY.toFixed(1)} ` +
                  `${ex.toFixed(1)},${ey.toFixed(1)}`;
          lx = (sx + ex) / 2;
          ly = arcY - 8;
        } else {
          // Forward edge: smooth port-routed bezier
          const ri = rIdxOf.get(c.from) ?? 0;
          const li = lIdxOf.get(c.to)   ?? 0;
          rIdxOf.set(c.from, ri + 1);
          lIdxOf.set(c.to,   li + 1);

          const fy  = (rPortsOf.get(c.from) ?? [fp.cy])[ri] ?? fp.cy;
          const ty2 = (lPortsOf.get(c.to)  ?? [tp.cy])[li] ?? tp.cy;

          // Source port: right edge of source node
          const sx  = fp.x + NW;
          // Target port: left edge of target node (arrowhead tip sits here)
          const tx2 = tp.x;
          const cpx = sx + (tx2 - sx) * 0.5;

          if (sx >= tp.x) {
            // Right-to-left: sweep arc cleanly above/below
            const arcAbove = fp.cy < tp.cy;
            const midY = arcAbove
              ? Math.min(fy, ty2) - 70
              : Math.max(fy, ty2) + 70;
            pathD = `M${sx.toFixed(1)},${fy.toFixed(1)} ` +
                    `C${(sx+60).toFixed(1)},${fy.toFixed(1)} ` +
                    `${(sx+60).toFixed(1)},${midY.toFixed(1)} ` +
                    `${((sx + tx2)/2).toFixed(1)},${midY.toFixed(1)} ` +
                    `S${(tx2-50).toFixed(1)},${ty2.toFixed(1)} ${tx2.toFixed(1)},${ty2.toFixed(1)}`;
            lx = (sx + tx2) / 2;
            ly = midY - 16;
          } else {
            pathD = `M${sx.toFixed(1)},${fy.toFixed(1)} ` +
                    `C${cpx.toFixed(1)},${fy.toFixed(1)} ` +
                    `${cpx.toFixed(1)},${ty2.toFixed(1)} ` +
                    `${tx2.toFixed(1)},${ty2.toFixed(1)}`;
            lx = sx + (tx2 - sx) * 0.5;
            ly = fy + (ty2 - fy) * 0.5 - 12;
          }
        }

        // Layer 1 — Ghost/glow halo behind the main stroke
        edgeGlowSvg.push(
          `<path d="${pathD}" stroke="${fHex}" stroke-width="5" fill="none" ` +
          `opacity=".07" stroke-linecap="round" stroke-linejoin="round"/>`
        );
        // Layer 2 — Main edge stroke + arrowhead
        edgeMainSvg.push(
          `<path d="${pathD}" stroke="${fHex}" stroke-width="2" fill="none" ` +
          `opacity=".80" stroke-linecap="round" stroke-linejoin="round" ` +
          `marker-end="url(#${markId})"/>`
        );

        if (label) {
          const lw = Math.max(label.length * 6.8 + 22, 28);
          const lh2 = 18;
          labelSvg.push(
            `<rect x="${(lx - lw/2).toFixed(1)}" y="${(ly - lh2/2).toFixed(1)}" ` +
            `width="${lw.toFixed(1)}" height="${lh2}" rx="${(lh2/2).toFixed(0)}" ` +
            `fill="white" stroke="${fHex}" stroke-width="1.2" opacity=".97" ` +
            `filter="url(#mm-shadow)"/>` +
            `<text x="${lx.toFixed(1)}" y="${(ly + 4.5).toFixed(1)}" ` +
            `text-anchor="middle" font-size="9.5" fill="${fHex}" ` +
            `font-family="-apple-system,'SF Pro Text',sans-serif" ` +
            `font-weight="700" letter-spacing=".03em">${esc(label)}</text>`
          );
        }
      });

      // ── Step 9: Draw nodes ─────────────────────────────────────────────────
      const drawN = (n: typeof nodes[0], ox: number, oy: number) => {
        const hex    = toHex(n.color || "bg-blue-500", "#3b82f6");
        const gid    = `mg${hex.replace('#', '')}`;
        const hasIn  = validConns.some(c => c.to === n.id && !isBack(c.from, c.to));
        // Source nodes: rich gradient fill; child nodes: light tinted background
        const fill   = hasIn ? hex + "1a" : `url(#${gid})`;
        const textC  = hasIn ? hex : "#ffffff";
        const sw     = hasIn ? "1.5" : "0";         // border only on tinted nodes
        const strokeC = hasIn ? hex + "60" : "none";

        // Derive a lighter shade for the inner highlight line on solid nodes
        const r3 = parseInt(hex.slice(1,3),16), g3 = parseInt(hex.slice(3,5),16), b3 = parseInt(hex.slice(5,7),16);
        const lighten = (v: number) => Math.min(255, v + 55);
        const hlHex = `#${[r3,g3,b3].map(v => lighten(v).toString(16).padStart(2,'0')).join('')}`;

        const sty = (n.bold    ? "font-weight:700;" : "font-weight:500;") +
                    (n.italic  ? "font-style:italic;" : "") +
                    (n.underline ? "text-decoration:underline;" : "") +
                    "font-family:-apple-system,'SF Pro Text','Helvetica Neue',sans-serif;";
        const cx = ox + NW / 2, cy = oy + NH / 2;

        // Word wrap at 16 chars
        const wds = (n.text || "—").split(" ");
        const lns: string[] = [];
        let cur2 = "";
        wds.forEach(w => {
          const cand = cur2 ? `${cur2} ${w}` : w;
          if (cand.length > 16 && cur2) { lns.push(cur2); cur2 = w; }
          else cur2 = cand;
        });
        if (cur2) lns.push(cur2);

        const lh = 15, th = lns.length * lh;
        const nodeH = Math.max(NH, th + 18);
        const ty0 = oy + (nodeH / 2) - (th / 2) + lh - 3;

        const textEls = lns.map((l2, i) =>
          `<text x="${cx.toFixed(1)}" y="${(ty0 + i*lh).toFixed(1)}" ` +
          `text-anchor="middle" font-size="12.5" fill="${textC}" style="${sty}">${esc(l2)}</text>`
        ).join("");

        const shape = n.shape ?? "rectangle";
        let shp = "";

        if (shape === "diamond") {
          // Diamond with shadow
          shp =
            `<polygon points="${cx},${oy-8} ${ox+NW+8},${cy} ${cx},${oy+nodeH+8} ${ox-8},${cy}" ` +
            `fill="${fill}" stroke="${strokeC}" stroke-width="${sw}" filter="url(#mm-shadow)"/>`;
          // Inner highlight line near top edge
          if (!hasIn) shp +=
            `<polygon points="${cx},${oy-2} ${ox+NW+2},${cy} ${cx},${(oy+nodeH*0.3).toFixed(1)} ${ox-2},${cy}" ` +
            `fill="${hlHex}" opacity="0.15"/>`;
        } else if (shape === "oval") {
          const rx = NW / 2, ry = nodeH / 2;
          shp =
            `<ellipse cx="${cx}" cy="${(oy+nodeH/2).toFixed(1)}" rx="${rx}" ry="${ry}" ` +
            `fill="${fill}" stroke="${strokeC}" stroke-width="${sw}" filter="url(#mm-shadow)"/>`;
          if (!hasIn) shp +=
            `<ellipse cx="${(cx - rx*0.12).toFixed(1)}" cy="${(oy+nodeH/2 - ry*0.28).toFixed(1)}" ` +
            `rx="${(rx*0.45).toFixed(1)}" ry="${(ry*0.22).toFixed(1)}" ` +
            `fill="${hlHex}" opacity="0.22"/>`;
        } else {
          // Rounded rectangle
          const rx2 = 12;
          shp =
            `<rect x="${ox}" y="${oy}" width="${NW}" height="${nodeH}" rx="${rx2}" ` +
            `fill="${fill}" stroke="${strokeC}" stroke-width="${sw}" filter="url(#mm-shadow)"/>`;
          // Subtle top-edge gloss highlight on solid nodes
          if (!hasIn) shp +=
            `<rect x="${(ox+4).toFixed(1)}" y="${(oy+3).toFixed(1)}" width="${NW-8}" height="${(nodeH*0.38).toFixed(1)}" rx="${rx2-2}" ` +
            `fill="${hlHex}" opacity="0.13"/>`;
        }

        // Port dot — small circle on the right edge (exit point) for source nodes
        const portDot = !hasIn
          ? `<circle cx="${(ox+NW).toFixed(1)}" cy="${cy.toFixed(1)}" r="3" fill="#fff" opacity=".55"/>`
          : "";

        return shp + textEls + portDot;
      };

      const nodesSvg = graphNodes.map(n => {
        const p = pos.get(n.id);
        return p ? drawN(n, p.x, p.y) : "";
      }).join("");

      // ── Step 10: Float nodes in a grid below the graph ─────────────────────
      const gMaxY = [...pos.values()].reduce((m, p) => Math.max(m, p.y + NH), PAD);
      const arcSpace = backCount > 0 ? backCount * 32 + 56 : 0;
      const floatY0 = gMaxY + arcSpace + (floatNodes.length ? 40 : 0);
      let floatSvg = "";
      let floatLbl = "";

      if (floatNodes.length) {
        const allMaxX = Math.max(...[...pos.values()].map(p => p.x + NW), PAD + NW);
        floatLbl =
          `<text x="${PAD}" y="${floatY0 - 14}" font-size="9" fill="#94a3b8" ` +
          `font-weight="800" letter-spacing=".15em" text-decoration="none" ` +
          `font-family="-apple-system,sans-serif">STANDALONE NODES</text>`;
        floatNodes.forEach((n, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          floatSvg += drawN(n, PAD + col * (NW + LH_GAP), floatY0 + row * (NH + NV_GAP));
        });
      }

      // ── SVG canvas size ────────────────────────────────────────────────────
      const allPX = [...pos.values()];
      const svgW = Math.max(
        allPX.reduce((m, p) => Math.max(m, p.x + NW), 0) + PAD,
        4 * (NW + LH_GAP) + PAD
      );
      const floatRows  = Math.ceil(floatNodes.length / 4);
      const svgH = floatY0 + (floatNodes.length ? floatRows * (NH + NV_GAP) + PAD : 0);

      // ── Node background knockout layer ─────────────────────────────────────
      // Drawn between labels and nodes. Each knockout is a white/near-white
      // filled shape matching the node's geometry — it paints over any edge
      // segment that passes through a node area before the node itself is drawn.
      const knockoutSvg = [
        ...graphNodes.map(n => {
          const p = pos.get(n.id); if (!p) return "";
          const shape = n.shape ?? "rectangle";
          const cx = p.x + NW / 2, cy = p.y + NH / 2;
          // Use a slightly larger inset so the node fill covers edge bleed
          if (shape === "diamond") {
            return `<polygon points="${cx},${p.y-10} ${p.x+NW+10},${cy} ${cx},${p.y+NH+10} ${p.x-10},${cy}" fill="#f8f9fc"/>`;
          } else if (shape === "oval") {
            return `<ellipse cx="${cx}" cy="${cy}" rx="${NW/2+2}" ry="${NH/2+2}" fill="#f8f9fc"/>`;
          } else {
            return `<rect x="${p.x-2}" y="${p.y-2}" width="${NW+4}" height="${NH+4}" rx="13" fill="#f8f9fc"/>`;
          }
        }),
        ...floatNodes.map((n, i) => {
          const col = i % 4, row = Math.floor(i / 4);
          const ox = PAD + col * (NW + LH_GAP), oy = floatY0 + row * (NH + NV_GAP);
          const shape = n.shape ?? "rectangle";
          const cx = ox + NW / 2, cy = oy + NH / 2;
          if (shape === "diamond") {
            return `<polygon points="${cx},${oy-10} ${ox+NW+10},${cy} ${cx},${oy+NH+10} ${ox-10},${cy}" fill="#f8f9fc"/>`;
          } else if (shape === "oval") {
            return `<ellipse cx="${cx}" cy="${cy}" rx="${NW/2+2}" ry="${NH/2+2}" fill="#f8f9fc"/>`;
          } else {
            return `<rect x="${ox-2}" y="${oy-2}" width="${NW+4}" height="${NH+4}" rx="13" fill="#f8f9fc"/>`;
          }
        }),
      ].join("");

      return (
        `<div class="mindmap-wrap">` +
        `<svg viewBox="0 0 ${svgW.toFixed(0)} ${Math.max(svgH, 200).toFixed(0)}" ` +
        `xmlns="http://www.w3.org/2000/svg" class="mindmap-svg" ` +
        `style="min-height:${Math.min(Math.max(svgH, 180), 600).toFixed(0)}px">` +
        `<defs>${arrowDefs}</defs>` +
        // Layer 1 — soft glow halos (bottom)
        `<g class="mm-edge-glow">${edgeGlowSvg.join("")}</g>` +
        // Layer 2 — main edge strokes + arrowheads
        `<g class="mm-edge-main">${edgeMainSvg.join("")}</g>` +
        // Layer 3 — edge labels (float above strokes)
        `<g class="mm-edge-labels">${labelSvg.join("")}</g>` +
        // Layer 4 — node background knockouts (erase edge bleed through node areas)
        `<g class="mm-node-bg">${knockoutSvg}</g>` +
        // Layer 5 — nodes and float nodes (top)
        `<g class="mm-nodes">${nodesSvg}</g>` +
        floatLbl +
        `<g class="mm-float-nodes">${floatSvg}</g>` +
        `</svg></div>`
      );
    }

    // ── Flashcards — with named color mapping ─────────────────────────────────
    case "flashcard": {
      const cards=block.flashcards??[];
      return `<div class="flashcards">${cards.map((c,i)=>{
        const hex=toHex(c.color||"blue","#3b82f6");
        return `<div class="fc-card" style="--fc:${hex}"><span class="fc-num">#${i+1}</span><p class="fc-text">${renderInline(c.content)}</p></div>`;
      }).join("")}</div>`;
    }

    // ── Tabs — interactive in browser, all panels visible in PDF ─────────────
    // For print we inject a .tab-panel-print wrapper that shows all tabs stacked.
    case "tabs": {
      const tabs=block.tabsData??[];
      const nav=tabs.map((tab,i)=>`<button class="tab-btn${i===0?" active":""}" data-tab="${i}">${esc(tab.label)}</button>`).join("");
      const panels=tabs.map((tab,i)=>{
        const inner=tab.blocks
          ? tab.blocks.map((b,j,arr)=>blockToHtml(b,depth+1,arr[j-1]?.type,counter)).join("")
          : `<p class="prose">${renderInline(tab.content||"")}</p>`;
        return `<div class="tab-panel${i===0?" active":""}" data-panel="${i}">${inner}</div>`;
      }).join("");
      // Print version: all tabs shown as labelled sections
      const printPanels=tabs.map((tab,i)=>{
        const inner=tab.blocks
          ? tab.blocks.map((b,j,arr)=>blockToHtml(b,depth+1,arr[j-1]?.type,counter)).join("")
          : `<p class="prose">${renderInline(tab.content||"")}</p>`;
        return `<div class="tab-print-section"><div class="tab-print-label">${esc(tab.label)}</div>${inner}</div>`;
      }).join("");
      return `<div class="tabs-block"><div class="tabs-nav screen-only">${nav}</div><div class="tabs-content screen-only">${panels}</div><div class="tabs-print print-only">${printPanels}</div></div>`;
    }

    // ── Chart ─────────────────────────────────────────────────────────────────
    case "chart": {
      const cfg=buildChartConfig(block);
      if (!cfg) return `<div class="chart-empty"><span class="chart-empty-icon">📊</span><p>${esc(block.chartTitle||"Chart — no data")}</p></div>`;
      const id=nextCid();
      _charts.push({id,cfg});
      const title=block.chartTitle?`<div class="chart-title">${esc(block.chartTitle)}</div>`:"";
      const badge=`<span class="chart-badge">${esc(block.chartType??"bar")}</span>`;
      return `<div class="chart-card">${title}${badge}<div class="chart-canvas-wrap"><canvas id="${id}"></canvas></div></div>`;
    }

    // ── SWOT ──────────────────────────────────────────────────────────────────
    case "swot": {
      const q=(label:string,color:string,icon:string,items:string[])=>{
        const clean=items.filter(x=>x.trim());
        return `<div class="swot-cell" style="--sc:${color}"><div class="swot-head"><span>${icon}</span><span>${label}</span></div><ul>${clean.map(x=>`<li>${renderInline(x)}</li>`).join("")||`<li class="swot-empty">None added</li>`}</ul></div>`;
      };
      return `<div class="swot">${q("Strengths","#22c55e","💪",block.swotStrengths??[])}${q("Weaknesses","#ef4444","⚠️",block.swotWeaknesses??[])}${q("Opportunities","#3b82f6","🚀",block.swotOpportunities??[])}${q("Threats","#f97316","🔥",block.swotThreats??[])}</div>`;
    }

    // ── Steps ─────────────────────────────────────────────────────────────────
    case "steps": {
      const items=(block.stepsItems??[]).filter(s=>s.title||s.description);
      return `<div class="steps">${items.map((step,i)=>`<div class="step${step.completed?" step-done":""}"><div class="step-circle">${step.completed?`<svg viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`:i+1}</div><div class="step-body">${step.title?`<div class="step-title">${renderInline(step.title)}</div>`:""}<div class="step-desc">${renderInline(step.description||"")}</div></div></div>`).join("")}</div>`;
    }

    // ── FAQ — always open so answers visible in PDF ───────────────────────────
    case "faq": {
      const items=block.faqItems??[];
      return `<div class="faq">${items.map(item=>`<details class="faq-item" open><summary class="faq-q"><span>${renderInline(item.question)}</span><span class="faq-icon"></span></summary><div class="faq-a">${renderInline(item.answer)}</div></details>`).join("")}</div>`;
    }

    // ── Comparison table ──────────────────────────────────────────────────────
    case "comparisonTable": {
      const c=block.comparisonColumns??[],r=block.comparisonRows??[];
      if (!c.length) return "";
      const val=(v:string)=>{
        if (v==="yes") return `<span class="cmp-yes"><svg viewBox="0 0 16 16" fill="none" width="18" height="18"><circle cx="8" cy="8" r="7" fill="#22c55e"/><polyline points="5,8 7,10 11,6" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`;
        if (v==="no") return `<span class="cmp-no"><svg viewBox="0 0 16 16" fill="none" width="18" height="18"><circle cx="8" cy="8" r="7" fill="#ef4444"/><line x1="5" y1="5" x2="11" y2="11" stroke="white" stroke-width="2" stroke-linecap="round"/><line x1="11" y1="5" x2="5" y2="11" stroke="white" stroke-width="2" stroke-linecap="round"/></svg></span>`;
        if (v==="partial") return `<span class="cmp-partial"><svg viewBox="0 0 16 16" fill="none" width="18" height="18"><circle cx="8" cy="8" r="7" fill="#f97316"/><line x1="5" y1="8" x2="11" y2="8" stroke="white" stroke-width="2.5" stroke-linecap="round"/></svg></span>`;
        return v?`<span class="cmp-text">${renderInline(v)}</span>`:`<span class="cmp-empty">—</span>`;
      };
      const head=`<thead><tr><th class="cmp-feature-col">Feature</th>${c.map(col=>`<th class="${col.highlighted?"cmp-hl":""}">${esc(col.name)}${col.highlighted?`<div class="cmp-popular">Popular</div>`:""}</th>`).join("")}</tr></thead>`;
      const body=`<tbody>${r.map(row=>`<tr><td class="cmp-feat">${renderInline(row.feature)}</td>${c.map(col=>`<td class="${col.highlighted?"cmp-hlc":""}">${val(row.values[col.id]??"")}</td>`).join("")}</tr>`).join("")}</tbody>`;
      return `<div class="table-outer"><div class="table-scroll"><table class="cmp-table">${head}${body}</table></div></div>`;
    }

    // ── Image + text — local image shows info card, external renders inline ──
    case "imageText": {
      const dir = block.imageTextLayout === "imageRight" ? "row-reverse" : "row";
      let imgPart = "";
      if (block.imageTextUrl) {
        const local = isLocal(block.imageTextUrl);
        if (local) {
          const fname = block.imageTextUrl.split("/").pop() || "Image";
          imgPart = `<div class="it-img it-img-local"><span class="gal-local-icon">🖼</span><span class="gal-local-name">${esc(fname)}</span><span class="gal-local-note">Local file — not visible in export</span></div>`;
        } else {
          imgPart = `<div class="it-img"><img src="${esc(block.imageTextUrl)}" alt="${esc(block.imageTextTitle||"")}" loading="lazy"></div>`;
        }
      }
      const txt = `<div class="it-body">${block.imageTextTitle?`<h3 class="it-title">${renderInline(block.imageTextTitle)}</h3>`:""}${block.imageTextDescription?`<p class="it-desc">${renderInline(block.imageTextDescription)}</p>`:""}</div>`;
      return `<div class="image-text" style="flex-direction:${dir}">${imgPart}${txt}</div>`;
    }

    // ── Columns layout ────────────────────────────────────────────────────────
    case "columns": {
      const cols=block.columns??[];
      return `<div class="col-layout" style="grid-template-columns:repeat(${cols.length},1fr)">${cols.map((col,i)=>`<div class="col-cell">${block.columnTitles?.[i]?`<div class="col-heading">${renderInline(block.columnTitles![i])}</div>`:""} ${col.map(b=>blockToHtml(b,depth+1,undefined,counter)).join("")}</div>`).join("")}</div>`;
    }

    default:
      return block.content?`<p class="prose">${renderInline(block.content)}</p>`:"";
  }
};

// ─── Render blocks array, tracking numbered list counter ──────────────────────

const renderBlocks = (blocks: NoteBlock[], depth = 0): string => {
  const counter = { n: 0 };
  return blocks.map((block, i) => {
    if (block.type !== "numbered") counter.n = 0;
    return blockToHtml(block, depth, blocks[i-1]?.type, counter);
  }).filter(Boolean).join("\n");
};

// ── Plain-text content extractor ─────────────────────────────────────────────
// Strips HTML tags from contentEditable-stored content, converting structural
// tags (<div>, <br>) into newlines and decoding common entities.
const stripHtml = (raw = ""): string =>
  raw
    .replace(/<div[^>]*>\s*(?:<br\s*\/?>|&nbsp;|\xa0)\s*<\/div>/gi, "\n")
    .replace(/<\/div>\s*<div[^>]*>/gi, "\n")
    .replace(/<div[^>]*>/gi, "\n")
    .replace(/<\/div>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")          // strip all remaining tags
    .replace(/&nbsp;/gi, " ")
    .replace(/\xa0/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .trim();


// ─── Markdown renderer (unchanged from last version) ─────────────────────────

const blockToMarkdown = (block: NoteBlock, depth = 0): string => {
  const ind = "  ".repeat(depth);
  const c = stripHtml(block.content);  // strip contentEditable HTML → plain text
  switch (block.type) {
    case "text":        return c||"";
    case "heading1":    return `# ${c}`;
    case "heading2":    return `## ${c}`;
    case "heading3":    return `### ${c}`;
    case "bullet":      return `${ind}- ${c}`;
    case "numbered":    return `${ind}1. ${c}`;
    case "todo":        return `${ind}- [${block.checked?"x":" "}] ${c}`;
    case "quote":       return c.split("\n").map((l: string)=>`> ${l}`).join("\n");
    case "callout":     return `> 💡 ${c}`;
    case "code":        return "```\n"+c+"\n```";
    case "divider":     return "---";
    case "labeledDivider": return block.dividerLabel?`\n--- ${block.dividerLabel} ---\n`:"---";
    case "toggle":      return `<details>\n<summary>${block.content}</summary>\n\n${block.toggleContent||""}\n</details>`;
    case "image":       return block.imageUrl?`![Image](${block.imageUrl})`:"";
    case "video":       return block.videoUrl?`[▶ Video](${block.videoUrl})`:"";
    case "audio":       return block.audioUrl?`[🔊 Audio](${block.audioUrl})`:"";
    case "file":        return block.fileUrl?`[📎 ${block.fileName||"File"}](${block.fileUrl})`:"";
    case "bookmark":    return block.bookmarkUrl?`[${block.bookmarkTitle||block.bookmarkUrl}](${block.bookmarkUrl})`:"";
    case "embed":       return block.embedUrl?`[🔗 ${block.embedUrl}](${block.embedUrl})`:"";
    case "equation":    return `$$\n${block.content}\n$$`;
    case "progress": {
      const v=block.progressValue??0;
      return `**Progress:** ${"█".repeat(Math.round(v/5))}${"░".repeat(20-Math.round(v/5))} ${v}%`;
    }
    case "rating": {
      const v=block.ratingValue??0,m=block.ratingMax??5;
      return `**Rating:** ${"★".repeat(v)}${"☆".repeat(Math.max(0,m-v))} (${v}/${m})`;
    }
    case "table": {
      const r=block.tableData;if(!r?.length)return"";
      return [`| ${r[0].join(" | ")} |`,`| ${r[0].map(()=>"---").join(" | ")} |`,...r.slice(1).map(row=>`| ${row.join(" | ")} |`)].join("\n");
    }
    case "kanban":      return (block.kanbanColumns??[]).map(col=>`**${col.title}**\n${col.cards.map(c=>`  - ${c.content}`).join("\n")||"  *(empty)*"}`).join("\n\n");
    case "timeline":    return (block.timelineItems??[]).map(item=>`- **${item.date}** — **${item.title}**${item.description?`\n  ${item.description}`:""}`).join("\n");
    case "gallery":     return (block.galleryImages??[]).map(img=>`![${img.caption||""}](${img.url})`).join("\n");
    case "mindmap":     return (block.mindMapNodes??[]).map(n=>`- ${n.text}`).join("\n");
    case "flashcard":   return (block.flashcards??[]).map((c,i)=>`**Card ${i+1}:** ${c.content}`).join("\n\n");
    case "tabs":        return (block.tabsData??[]).map(tab=>`### ${tab.label}\n\n${tab.blocks?tab.blocks.map(b=>blockToMarkdown(b,depth+1)).join("\n\n"):tab.content||""}`).join("\n\n");
    case "chart": {
      const title=block.chartTitle?`**${block.chartTitle}** *(${block.chartType??"bar"})*\n\n`:"";
      const c=block.chartColumns??[],r=block.chartRows??[];
      if(!c.length||!r.length)return`${title}*(chart — no data)*`;
      return title+[`| ${c.map(x=>x.key).join(" | ")} |`,`| ${c.map(()=>"---").join(" | ")} |`,...r.map(row=>`| ${c.map(x=>String(row.cells[x.id]??'')).join(" | ")} |`)].join("\n");
    }
    case "swot":        return [`**Strengths**\n${(block.swotStrengths??[]).filter(x=>x).map(x=>`  - ${x}`).join("\n")||"  —"}`,`**Weaknesses**\n${(block.swotWeaknesses??[]).filter(x=>x).map(x=>`  - ${x}`).join("\n")||"  —"}`,`**Opportunities**\n${(block.swotOpportunities??[]).filter(x=>x).map(x=>`  - ${x}`).join("\n")||"  —"}`,`**Threats**\n${(block.swotThreats??[]).filter(x=>x).map(x=>`  - ${x}`).join("\n")||"  —"}`].join("\n\n");
    case "steps":       return (block.stepsItems??[]).map((s,i)=>`${i+1}. ${s.completed?"~~":""}**${s.title}**${s.completed?"~~":""}${s.description?`\n   ${s.description}`:""}`).join("\n");
    case "faq":         return (block.faqItems??[]).map(item=>`**Q: ${item.question}**\nA: ${item.answer}`).join("\n\n");
    case "comparisonTable": {
      const c=block.comparisonColumns??[],r=block.comparisonRows??[];if(!c.length)return"";
      const v=(x:string)=>x==="yes"?"✅":x==="no"?"❌":x==="partial"?"⚠️":x||"—";
      return [`| Feature | ${c.map(x=>x.name).join(" | ")} |`,`| --- | ${c.map(()=>"---").join(" | ")} |`,...r.map(row=>`| ${row.feature} | ${c.map(x=>v(row.values[x.id]??'')).join(" | ")} |`)].join("\n");
    }
    case "imageText": { const p:string[]=[];if(block.imageTextUrl)p.push(`![${block.imageTextTitle||""}](${block.imageTextUrl})`);if(block.imageTextTitle)p.push(`**${block.imageTextTitle}**`);if(block.imageTextDescription)p.push(block.imageTextDescription);return p.join("\n\n"); }
    case "columns":     return (block.columns??[]).map((col,i)=>`${block.columnTitles?.[i]?`**${block.columnTitles[i]}**\n\n`:""}${col.map(b=>blockToMarkdown(b,depth+1)).join("\n\n")}`).join("\n\n---\n\n");
    default: return block.content||"";
  }
};

const blockToText = (block: NoteBlock, depth = 0): string => {
  const c = stripHtml(block.content);  // strip contentEditable HTML → plain text
  switch (block.type) {
    case "text":     return c||"";
    case "heading1": return `\n${c}\n${"═".repeat(c.length||1)}`;
    case "heading2": return `\n${c}\n${"─".repeat(c.length||1)}`;
    case "heading3": return `\n${c}`;
    case "bullet":   return `${"  ".repeat(depth)}• ${c}`;
    case "numbered": return `${"  ".repeat(depth)}1. ${c}`;
    case "todo":     return `[${block.checked?"✓":" "}] ${c}`;
    case "quote":    return block.content.split("\n").map(l=>`  "${l}"`).join("\n");
    case "callout":  return `💡 ${block.content}`;
    case "code":     return block.content.split("\n").map(l=>`    ${l}`).join("\n");
    case "divider":  return "────────────────────────────";
    case "labeledDivider": return block.dividerLabel?`──── ${block.dividerLabel} ────`:"────────────────────────────";
    case "toggle":   return `▶ ${block.content}\n${(block.toggleContent||"").split("\n").map(l=>`  ${l}`).join("\n")}`;
    case "image":    return block.imageUrl?`[Image: ${block.imageUrl}]`:"";
    case "video":    return block.videoUrl?`[Video: ${block.videoUrl}]`:"";
    case "audio":    return block.audioUrl?`[Audio: ${block.audioUrl}]`:"";
    case "file":     return block.fileUrl?`[File: ${block.fileName||block.fileUrl}]`:"";
    case "bookmark": return block.bookmarkUrl?`${block.bookmarkTitle||block.bookmarkUrl}\n  ${block.bookmarkUrl}`:"";
    case "equation": return `∫ ${block.content}`;
    case "progress": { const v=block.progressValue??0; return `Progress: [${"█".repeat(Math.round(v/5))}${"░".repeat(20-Math.round(v/5))}] ${v}%`; }
    case "rating":   { const v=block.ratingValue??0,m=block.ratingMax??5; return `Rating: ${"★".repeat(v)}${"☆".repeat(Math.max(0,m-v))} (${v}/${m})`; }
    case "table":    { const r=block.tableData??[];if(!r.length)return"";const w=r[0].map((_,ci)=>Math.max(...r.map(row=>(row[ci]??"").length)));return r.map(row=>row.map((c,ci)=>c.padEnd(w[ci])).join("  │  ")).join("\n"); }
    case "kanban":   return (block.kanbanColumns??[]).map(col=>`[ ${col.title} ]\n${col.cards.map(c=>`  • ${c.content}`).join("\n")||"  (empty)"}`).join("\n\n");
    case "timeline": return (block.timelineItems??[]).map(item=>`◆ ${item.date}  ${item.title}${item.description?`\n  ${item.description}`:""}`).join("\n");
    case "gallery":  return (block.galleryImages??[]).map(img=>`[Image: ${img.caption||img.url}]`).join("\n");
    case "mindmap":  return (block.mindMapNodes??[]).map(n=>`  ○ ${n.text}`).join("\n");
    case "flashcard": return (block.flashcards??[]).map((c,i)=>`Card ${i+1}: ${c.content}`).join("\n");
    case "chart":    { const title=block.chartTitle?`${block.chartTitle}\n`:"";const c=block.chartColumns??[],r=block.chartRows??[];if(!c.length||!r.length)return`${title}(no chart data)`;const w=c.map(col=>Math.max(col.key.length,...r.map(row=>String(row.cells[col.id]??"").length)));return title+[c.map((col,i)=>col.key.padEnd(w[i])).join("  │  "),w.map(x=>"─".repeat(x)).join("──┼──"),...r.map(row=>c.map((col,i)=>String(row.cells[col.id]??"").padEnd(w[i])).join("  │  "))].join("\n"); }
    case "swot":     return [`STRENGTHS\n${(block.swotStrengths??[]).filter(x=>x).map(x=>`  + ${x}`).join("\n")||"  —"}`,`WEAKNESSES\n${(block.swotWeaknesses??[]).filter(x=>x).map(x=>`  - ${x}`).join("\n")||"  —"}`,`OPPORTUNITIES\n${(block.swotOpportunities??[]).filter(x=>x).map(x=>`  + ${x}`).join("\n")||"  —"}`,`THREATS\n${(block.swotThreats??[]).filter(x=>x).map(x=>`  - ${x}`).join("\n")||"  —"}`].join("\n\n");
    case "steps":    return (block.stepsItems??[]).map((s,i)=>`${i+1}. [${s.completed?"✓":" "}] ${s.title||""}${s.description?`\n   ${s.description}`:""}`).join("\n");
    case "faq":      return (block.faqItems??[]).map(item=>`Q: ${item.question}\nA: ${item.answer}`).join("\n\n");
    case "comparisonTable": { const c=block.comparisonColumns??[],r=block.comparisonRows??[];if(!c.length)return"";const v=(x:string)=>x==="yes"?"Yes":x==="no"?"No":x==="partial"?"Partial":x||"—";const allC=["Feature",...c.map(x=>x.name)];const w=allC.map((h,ci)=>Math.max(h.length,...r.map(row=>ci===0?row.feature.length:v(row.values[c[ci-1].id]??"").length)));return[allC.map((h,i)=>h.padEnd(w[i])).join("  │  "),w.map(x=>"─".repeat(x)).join("──┼──"),...r.map(row=>[row.feature,...c.map(x=>v(row.values[x.id]??""))].map((cell,i)=>cell.padEnd(w[i])).join("  │  "))].join("\n"); }
    case "imageText": { const p:string[]=[];if(block.imageTextTitle)p.push(block.imageTextTitle);if(block.imageTextDescription)p.push(block.imageTextDescription);if(block.imageTextUrl)p.push(`[Image: ${block.imageTextUrl}]`);return p.join("\n"); }
    case "tabs":     return (block.tabsData??[]).map(tab=>`[ ${tab.label} ]\n${tab.blocks?tab.blocks.map(b=>blockToText(b,depth+1)).join("\n"):tab.content||""}`).join("\n\n");
    case "columns":  return (block.columns??[]).map((col,i)=>`${block.columnTitles?.[i]?`${block.columnTitles[i]}\n`:""}${col.map(b=>blockToText(b,depth+1)).join("\n")}`).join("\n\n");
    default: return block.content||"";
  }
};

// ─── CSS — Warm pastel editorial design ──────────────────────────────────────

const CSS = `
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── Design Tokens ── */
:root{
  --white:#ffffff;
  --bg:#faf8f5;
  --bg2:#f5f1ec;
  --surface:#ffffff;
  --surface2:#fdf9f6;
  --surface3:#f8f4ef;
  --surface4:#f0ebe4;
  --border:#e8e0d8;
  --border2:#ede7df;
  --ink:#2d2926;
  --ink2:#4a3f38;
  --ink3:#7a6e67;
  --ink4:#b0a49c;
  --sage:#6b8f71;
  --sage-l:#edf4ee;
  --sage-m:#c8deca;
  --rose:#c2666a;
  --rose-l:#fdeeed;
  --rose-m:#f5c4c5;
  --amber:#c48b3a;
  --amber-l:#fef6e4;
  --amber-m:#f5dba8;
  --blue:#5b86c4;
  --blue-d:#3a65a4;
  --blue-l:#edf2fb;
  --blue-m:#c5d7f0;
  --teal:#4a8fa3;
  --teal-l:#eaf4f7;
  --mauve:#8b6fa8;
  --green:#5a9469;
  --green-l:#edf6f0;
  --red:#c0524f;
  --orange:#c47843;
  --r4:4px;--r6:6px;--r8:8px;--r10:10px;--r12:12px;--r14:14px;--r16:16px;--r20:20px;--r24:24px;--r32:32px;
  --sh0:0 1px 3px rgba(45,41,38,.05);
  --sh1:0 2px 8px rgba(45,41,38,.07),0 1px 3px rgba(45,41,38,.04);
  --sh2:0 6px 24px rgba(45,41,38,.09),0 2px 8px rgba(45,41,38,.05);
  --sh3:0 12px 40px rgba(45,41,38,.11),0 4px 14px rgba(45,41,38,.06);
  --sh-sage:0 4px 20px rgba(107,143,113,.22);
  --font-sans:"Nunito Sans",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
  --font-display:"Nunito Sans",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
  --font-serif:"Playfair Display","Georgia","Times New Roman",serif;
  --font-mono:"SF Mono","Fira Code","JetBrains Mono",monospace;
}

/* ── Base ── */
html{font-size:16px;-webkit-text-size-adjust:100%;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{font-family:var(--font-sans);color:var(--ink);background:var(--bg);line-height:1.75;padding-top:0}
img{max-width:100%;height:auto;display:block}
a{color:var(--sage)}a:hover{text-decoration:underline}

/* ── Floating action bar (replaces topbar) ── */
.action-bar{
  position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
  display:inline-flex;align-items:center;gap:2px;
  background:rgba(30,27,24,.82);
  backdrop-filter:saturate(180%) blur(20px);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  border:1px solid rgba(255,255,255,.09);
  border-radius:9999px;padding:5px 6px;
  box-shadow:0 8px 32px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.12);
  z-index:1000;white-space:nowrap;
}
.ab-divider{width:1px;height:22px;background:rgba(255,255,255,.12);margin:0 2px;flex-shrink:0}
.ab-title{
  font-size:.76rem;font-weight:600;color:rgba(255,255,255,.55);
  padding:0 12px 0 10px;max-width:200px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  font-family:var(--font-sans);letter-spacing:.01em;
}
.ab-btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:7px 15px;border-radius:9999px;
  font-size:.76rem;font-weight:700;font-family:var(--font-sans);
  cursor:pointer;border:none;letter-spacing:.02em;
  transition:all .16s ease;line-height:1;
}
.ab-btn-ghost{
  background:rgba(255,255,255,.07);color:rgba(255,255,255,.7);
}
.ab-btn-ghost:hover{background:rgba(255,255,255,.14);color:#fff}
.ab-btn-ghost:active{transform:scale(.96)}
.ab-btn-primary{
  background:linear-gradient(135deg,var(--sage),#3e6344);
  color:#fff;
  box-shadow:0 2px 10px rgba(107,143,113,.4);
}
.ab-btn-primary:hover{
  background:linear-gradient(135deg,#5a7d60,#355439);
  box-shadow:0 4px 16px rgba(107,143,113,.5);
  transform:translateY(-1px);
}
.ab-btn-primary:active{transform:scale(.96) translateY(0)}
.ab-btn svg{flex-shrink:0;opacity:.85}

/* ── Page shell ── */
.page{max-width:760px;margin:0 auto;padding:48px 36px 120px}

/* ── Screen/print visibility helpers ── */
.screen-only{display:block}
.print-only{display:none}
@media print{
  .screen-only{display:none!important}
  .print-only{display:block!important}
}

/* ── Document header ── */
.doc-header{
  padding:56px 0 40px;
  border-bottom:1px solid var(--border);
  margin-bottom:44px;
  position:relative;
}
.doc-header::before{
  content:"";position:absolute;top:0;left:-36px;right:-36px;height:3px;
  background:linear-gradient(90deg,var(--sage),var(--rose-m),var(--amber-m),var(--sage));
  background-size:200% 100%;
  animation:shimmer 6s linear infinite;
}
@keyframes shimmer{0%{background-position:0% 0%}100%{background-position:200% 0%}}
.page-eyebrow{
  display:inline-flex;align-items:center;gap:7px;
  font-size:.67rem;font-weight:800;letter-spacing:.14em;
  text-transform:uppercase;color:var(--sage);margin-bottom:16px;
  background:var(--sage-l);border:1px solid var(--sage-m);
  padding:4px 12px;border-radius:9999px;
}
.page-eyebrow-dot{width:5px;height:5px;border-radius:50%;background:var(--sage);display:inline-block}
.page-title{
  font-family:var(--font-serif);
  font-size:2.85rem;font-weight:700;letter-spacing:-.02em;line-height:1.1;
  color:var(--ink);margin-bottom:22px;
}
.page-meta{
  display:flex;flex-wrap:wrap;gap:0;
  font-size:.77rem;color:var(--ink4);margin-bottom:0;
}
.meta-item{
  display:flex;align-items:center;gap:5px;
  padding-right:16px;margin-right:16px;
  border-right:1px solid var(--border);
}
.meta-item:last-child{border-right:none;padding-right:0;margin-right:0}
.meta-icon{opacity:.65}
.meta-dot{width:7px;height:7px;border-radius:50%;display:inline-block;vertical-align:middle;flex-shrink:0}

/* ── Article ── */
.article>*+*{margin-top:.9em}

/* ── Typography ── */
.h1{
  font-family:var(--font-serif);font-size:1.95rem;font-weight:700;
  letter-spacing:-.02em;line-height:1.18;color:var(--ink);
  margin:2.4em 0 .5em;
  padding-bottom:.5em;border-bottom:1px solid var(--border);
}
.h2{
  font-size:1.25rem;font-weight:700;
  letter-spacing:-.01em;line-height:1.25;color:var(--ink2);
  margin:2em 0 .42em;
  display:flex;align-items:center;gap:8px;
}
.h2::before{
  content:"";display:inline-block;width:4px;height:1.1em;
  background:linear-gradient(180deg,var(--sage),var(--teal));
  border-radius:2px;flex-shrink:0;vertical-align:-.1em;
}
.h3{font-size:1.05rem;font-weight:700;letter-spacing:-.01em;color:var(--ink2);margin:1.7em 0 .32em}
.prose{color:var(--ink2);margin:.35em 0;line-height:1.78}
.spacer{height:.5em}

/* ── Bullet list ── */
.ul{list-style:none;margin:.35em 0;padding:0}
.ul li{display:flex;align-items:baseline;gap:10px;color:var(--ink2);padding:3px 0;line-height:1.68}
.ul li::before{content:"";display:block;width:6px;height:6px;border-radius:50%;background:var(--sage);flex-shrink:0;margin-top:8px;opacity:.85}

/* ── Numbered list ── */
.ol{list-style:none;margin:.25em 0;padding:0}
.ol li{display:flex;align-items:baseline;gap:11px;color:var(--ink2);padding:3px 0;line-height:1.68}
.ol-n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;min-width:22px;border-radius:50%;background:linear-gradient(135deg,var(--sage),#4a7450);color:#fff;font-size:.7rem;font-weight:800;flex-shrink:0;line-height:1}

/* ── Todo ── */
.todo-item{display:flex;align-items:center;gap:11px;padding:5px 0;cursor:default}
.cb{width:18px;height:18px;min-width:18px;border-radius:5px;border:1.5px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cb-on{background:var(--sage);border-color:var(--sage)}
.cb svg{width:10px;height:10px;opacity:0}
.cb-on svg{opacity:1}
.done{text-decoration:line-through;color:var(--ink4)}

/* ── Inline rich text ── */
.prose strong,.prose b,strong,b{font-weight:700}
.prose em,.prose i,em,i{font-style:italic}
.prose u,u{text-decoration:underline}
.prose s,.prose strike,.prose del,s,strike,del{text-decoration:line-through;opacity:.6}
.prose mark,mark{background:#fef3c7;border-radius:3px;padding:0 2px}
.prose code,li code,blockquote code,.toggle-body code,.faq-a code,.step-desc code,.step-title code{
  font-family:var(--font-mono);font-size:.82em;
  background:#f5f0ea;color:var(--rose);
  border:1px solid var(--border2);border-radius:4px;padding:1px 5px;
}
font[color]{}

/* ── Quote & Callout ── */
.quote{
  border-left:3px solid var(--sage-m);
  padding:12px 0 12px 20px;
  margin:.9em 0;color:var(--ink3);
  font-style:italic;font-size:.95rem;line-height:1.72;
  background:linear-gradient(90deg,rgba(107,143,113,.04),transparent);
}
.callout{
  display:flex;align-items:flex-start;gap:12px;
  background:linear-gradient(135deg,var(--amber-l),#fffcf5);
  border:1px solid var(--amber-m);border-left:3px solid var(--amber);
  border-radius:var(--r12);padding:14px 18px;margin:.9em 0;
  color:var(--ink2);line-height:1.65;font-size:.93rem;
}
.callout::before{content:"💡";flex-shrink:0;font-style:normal;font-size:1em}

/* ── Code ── */
.code-block{border-radius:var(--r16);overflow:hidden;margin:.9em 0;box-shadow:var(--sh3)}
.code-bar{
  background:#1e1b18;padding:9px 16px;
  display:flex;align-items:center;justify-content:space-between;
  border-bottom:1px solid rgba(255,255,255,.05);
}
.traffic{display:flex;gap:7px}
.traffic i{display:block;width:11px;height:11px;border-radius:50%;font-style:normal}
.traffic i:nth-child(1){background:#ff5f57}.traffic i:nth-child(2){background:#febc2e}.traffic i:nth-child(3){background:#28c840}
.code-lang{font-size:.67rem;color:#6b635c;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.08em}
pre{background:#1e1b18;color:#e8e0d8;padding:20px 22px;font-size:.84rem;line-height:1.72;overflow-x:auto;margin:0;tab-size:2}
code{font-family:var(--font-mono)}

/* ── Dividers ── */
.rule{border:none;height:1px;background:var(--border);margin:2em 0}
.labeled-rule{display:flex;align-items:center;gap:14px;margin:1.8em 0;color:var(--ink4);font-size:.71rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.labeled-rule::before,.labeled-rule::after{content:"";flex:1;height:1px;background:var(--border)}

/* ── Toggle ── */
.toggle{
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin:.7em 0;overflow:hidden;box-shadow:var(--sh0);
}
.toggle-summary{
  padding:12px 16px;cursor:pointer;font-weight:700;list-style:none;
  display:flex;align-items:center;gap:10px;color:var(--ink);
  background:var(--surface2);user-select:none;font-size:.91rem;
}
.toggle-summary::-webkit-details-marker,.toggle-summary::marker{display:none}
.toggle-summary::before{
  content:"";width:18px;height:18px;flex-shrink:0;
  background:var(--sage-l);border:1px solid var(--sage-m);border-radius:5px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none'%3E%3Cpath d='M3 4l2 2 2-2' stroke='%236b8f71' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E");
  background-position:center;background-repeat:no-repeat;background-size:11px;
  transition:transform .2s;
}
.toggle[open] .toggle-summary::before{transform:rotate(180deg)}
.toggle-body{padding:14px 18px;border-top:1px solid var(--border2);color:var(--ink3);white-space:pre-wrap;font-size:.91rem;line-height:1.68}

/* ── Media blocks ── */
.img-fig{margin:.9em 0;border-radius:var(--r20);overflow:hidden;box-shadow:var(--sh2);background:var(--surface3)}
.img-fig img{width:100%}
.media-block{margin:.9em 0}
.video-embed-wrap{position:relative;width:100%;padding-bottom:56.25%;border-radius:var(--r20);overflow:hidden;box-shadow:var(--sh2);background:#1e1b18}
.video-embed-wrap iframe{position:absolute;inset:0;width:100%;height:100%}
.native-video{width:100%;border-radius:var(--r14);box-shadow:var(--sh2)}
.audio-card{
  display:flex;align-items:center;gap:14px;padding:14px 18px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin:.7em 0;box-shadow:var(--sh0);
}
.audio-card audio{flex:1;height:34px}
.media-icon{
  font-size:1.1em;flex-shrink:0;width:38px;height:38px;border-radius:var(--r10);
  background:var(--sage-l);border:1px solid var(--sage-m);
  display:flex;align-items:center;justify-content:center;
}
.media-link-card{
  display:flex;align-items:center;gap:14px;padding:14px 18px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin:.7em 0;box-shadow:var(--sh0);
}
.media-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.media-label{font-size:.69rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink4)}
.media-url{font-size:.83rem;color:var(--sage);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-card{
  display:flex;align-items:center;gap:16px;padding:14px 18px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin:.7em 0;box-shadow:var(--sh0);
}
.file-icon-lg{
  font-size:1.5em;flex-shrink:0;width:46px;height:46px;border-radius:var(--r12);
  background:var(--amber-l);border:1px solid var(--amber-m);
  display:flex;align-items:center;justify-content:center;
}
.file-info{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.file-name{font-weight:700;font-size:.9rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-link{font-size:.8rem;color:var(--sage);font-weight:700}
.file-note{font-size:.76rem;color:var(--ink4);font-style:italic}
.local-badge{display:inline-block;font-size:.63rem;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--amber);background:var(--amber-l);border:1px solid var(--amber-m);border-radius:4px;padding:1px 6px;margin-left:6px}

/* ── Local media card — clear "not available" state ── */
.media-local-card{
  display:flex;align-items:flex-start;gap:16px;padding:16px 20px;
  background:linear-gradient(135deg,#fffcf5,#fffaf0);
  border:1px solid var(--amber-m);border-left:3px solid var(--amber);
  border-radius:var(--r14);margin:.7em 0;
}
.mlc-icon{
  font-size:1.5em;flex-shrink:0;width:44px;height:44px;border-radius:var(--r10);
  background:var(--amber-l);border:1px solid var(--amber-m);
  display:flex;align-items:center;justify-content:center;
}
.mlc-body{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
.mlc-label{font-size:.71rem;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--amber)}
.mlc-name{font-size:.88rem;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mlc-hint{font-size:.76rem;color:var(--ink4);font-style:italic;line-height:1.5}
.mlc-arrow{font-size:.9em;color:var(--sage);flex-shrink:0;width:28px;height:28px;border-radius:50%;background:var(--sage-l);border:1px solid var(--sage-m);display:flex;align-items:center;justify-content:center}

/* ── Embed block — iframe container ── */
.embed-block{
  margin:.9em 0;border-radius:var(--r16);overflow:hidden;
  border:1px solid var(--border2);box-shadow:var(--sh2);background:var(--surface);
}
.embed-bar{
  display:flex;align-items:center;gap:8px;padding:9px 14px;
  background:var(--surface2);border-bottom:1px solid var(--border2);
  min-height:40px;
}
.embed-filename{
  font-size:.78rem;color:var(--ink3);flex:1;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;min-width:0;
}
.embed-ext-link{
  margin-left:auto;font-size:.74rem;font-weight:700;color:var(--sage);
  text-decoration:none;white-space:nowrap;flex-shrink:0;
  background:var(--sage-l);border:1px solid var(--sage-m);
  padding:3px 10px;border-radius:9999px;
}
.embed-ext-link:hover{background:var(--sage-m);text-decoration:none}
.embed-ratio-16-9{position:relative;width:100%;padding-bottom:56.25%}
.embed-ratio-16-9 iframe{position:absolute;inset:0;width:100%;height:100%;display:block}
.embed-frame-wrap{width:100%;position:relative;overflow:hidden}
.embed-frame-wrap iframe{width:100%;height:100%;display:block;border:none}
.embed-block-audio{border-radius:var(--r14)}
.embed-block-audio .embed-frame-wrap{border-radius:0 0 var(--r14) var(--r14);overflow:hidden}

/* ── Service badge ── */
.svc-badge{
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 10px;border-radius:9999px;
  font-size:.69rem;font-weight:800;letter-spacing:.03em;
  flex-shrink:0;line-height:1.4;
}
.svc-badge-default{background:var(--surface4);color:var(--ink3);border:1px solid var(--border)}

/* ── Video thumbnail card (YouTube / Vimeo click-to-watch) ── */
.vid-thumb-card{
  display:block;position:relative;width:100%;aspect-ratio:16/9;
  overflow:hidden;text-decoration:none;cursor:pointer;
  background:#1a1a1a;
}
.vid-thumb-img{
  width:100%;height:100%;object-fit:cover;display:block;
  transition:transform .3s ease,filter .3s ease;
  filter:brightness(.88);
}
.vid-thumb-card:hover .vid-thumb-img{transform:scale(1.025);filter:brightness(.72)}
.vid-thumb-overlay{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.18);transition:background .2s;
}
.vid-thumb-card:hover .vid-thumb-overlay{background:rgba(0,0,0,.32)}
.vid-play-btn{
  width:60px;height:60px;border-radius:50%;
  background:#ff0000;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 24px rgba(0,0,0,.45);
  transition:transform .18s ease,box-shadow .18s ease;
}
.vid-thumb-card:hover .vid-play-btn{transform:scale(1.1);box-shadow:0 8px 32px rgba(0,0,0,.55)}
.vid-play-btn svg{margin-left:3px}
.vid-thumb-placeholder{width:100%;height:100%;background:linear-gradient(135deg,#2a2a2a,#1a1a1a)}

/* ── Video link card (Loom / Wistia / generic) ── */
.vid-link-card{
  display:flex;align-items:center;gap:14px;padding:14px 18px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin:.7em 0;box-shadow:var(--sh0);
  text-decoration:none;color:inherit;transition:box-shadow .15s,transform .15s;
}
.vid-link-card:hover{box-shadow:var(--sh1);transform:translateY(-1px);text-decoration:none}
.vlc-icon-wrap{
  width:40px;height:40px;border-radius:var(--r10);flex-shrink:0;
  background:linear-gradient(135deg,#2a2a2a,#1a1a1a);
  color:#fff;display:flex;align-items:center;justify-content:center;
}
  display:flex;align-items:center;gap:14px;padding:14px 18px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin:.7em 0;box-shadow:var(--sh0);
  text-decoration:none;color:inherit;transition:box-shadow .15s,transform .15s;
}
.media-link-card:hover{box-shadow:var(--sh1);transform:translateY(-1px);text-decoration:none}

/* ── Audio card (native file player) ── */
.audio-inner{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.audio-name{font-size:.84rem;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.media-fallback{font-size:.78rem;color:var(--ink4);margin-top:4px;font-style:italic}

/* ── Bookmark ── */
.bookmark-card{
  display:flex;align-items:center;gap:16px;padding:16px 20px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r16);margin:.9em 0;color:inherit;
  box-shadow:var(--sh1);transition:box-shadow .2s,transform .18s;text-decoration:none;
}
.bookmark-card:hover{box-shadow:var(--sh2);transform:translateY(-2px);text-decoration:none}
.bm-favicon{
  width:34px;height:34px;border-radius:var(--r8);
  background:var(--blue-l);border:1px solid var(--blue-m);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:.9em;
}
.bm-body{flex:1;min-width:0}
.bm-title{font-weight:700;font-size:.9rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-desc{font-size:.79rem;color:var(--ink3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bm-url{font-size:.71rem;color:var(--ink4);margin-top:4px}
.bm-arrow{
  font-size:.9em;color:var(--sage);flex-shrink:0;
  width:30px;height:30px;border-radius:50%;
  background:var(--sage-l);border:1px solid var(--sage-m);
  display:flex;align-items:center;justify-content:center;
}

/* ── Equation ── */
.equation{
  background:linear-gradient(135deg,var(--blue-l),#f0f5ff);
  border:1px solid var(--blue-m);border-radius:var(--r14);
  padding:22px 26px;margin:.9em 0;text-align:center;overflow-x:auto;box-shadow:var(--sh0);
}
.eq-display{font-family:var(--font-mono);font-size:1rem;color:var(--ink2);letter-spacing:.02em}
.eq-rendered{margin-top:12px;font-size:1.1rem}
.eq-rendered .katex{font-size:1.25rem}

/* ── Progress ── */
.progress-card{
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r20);padding:22px 24px;margin:.9em 0;box-shadow:var(--sh1);
}
.progress-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px}
.progress-pct{font-family:var(--font-serif);font-size:2.4rem;font-weight:700;letter-spacing:-.04em;color:var(--ink);line-height:1}
.progress-status{font-size:.73rem;font-weight:800;color:var(--ink4);text-transform:uppercase;letter-spacing:.1em}
.progress-track{height:10px;background:var(--surface4);border-radius:9999px;overflow:hidden;margin-bottom:10px}
.progress-fill{height:100%;border-radius:9999px;min-width:4px}
.progress-ticks{display:flex;justify-content:space-between;font-size:.66rem;color:var(--ink4);font-weight:700;letter-spacing:.02em}

/* ── Rating ── */
.rating{display:flex;align-items:center;gap:2px;margin:.6em 0;font-size:1.4rem}
.star-on{color:#d4954a}.star-off{color:var(--border)}
.rating-label{font-size:.79rem;color:var(--ink4);margin-left:8px;font-weight:600}

/* ── Tables ── */
.table-outer{margin:.9em 0;border-radius:var(--r16);border:1px solid var(--border2);box-shadow:var(--sh1);overflow:hidden;background:var(--surface)}
.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:.855rem;min-width:400px}
thead{background:linear-gradient(180deg,var(--sage-l),rgba(237,244,238,.5))}
th{font-weight:800;text-align:left;color:var(--sage);padding:12px 16px;border-bottom:1.5px solid var(--sage-m);font-size:.73rem;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}
td{padding:11px 16px;border-bottom:1px solid var(--border2);color:var(--ink2);vertical-align:top;line-height:1.55}
tr:last-child td{border-bottom:none}
tbody tr:nth-child(even) td{background:rgba(107,143,113,.025)}
tbody tr:hover td{background:var(--sage-l)}

/* ── Comparison table ── */
.cmp-table td,.cmp-table th{text-align:center}
.cmp-feature-col,.cmp-table td:first-child,.cmp-table th:first-child{text-align:left}
.cmp-hl{background:var(--sage-l)!important;color:var(--sage)}
.cmp-hlc{background:rgba(107,143,113,.04)}
.cmp-popular{font-size:.57rem;background:var(--sage);color:#fff;padding:2px 8px;border-radius:9999px;margin-top:4px;display:inline-block;font-weight:800;letter-spacing:.04em}
.cmp-feat{font-weight:700;color:var(--ink)}
.cmp-yes,.cmp-no,.cmp-partial{display:inline-flex;align-items:center;justify-content:center}
.cmp-text{font-size:.84rem;font-weight:600;color:var(--ink2)}
.cmp-empty{color:var(--ink4);font-size:.8rem}

/* ── Kanban ── */
.kanban{margin:.9em 0}
.kanban-scroll{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.kanban-col{flex:0 0 195px;background:var(--surface2);border-radius:var(--r16);padding:14px;border:1px solid var(--border2)}
.kanban-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.kanban-title{font-weight:800;font-size:.69rem;text-transform:uppercase;letter-spacing:.11em;color:var(--ink3)}
.kanban-badge{background:var(--surface);border:1px solid var(--border);border-radius:9999px;padding:1px 8px;font-size:.7rem;font-weight:700;color:var(--ink4)}
.kanban-card{
  background:var(--surface);border-radius:var(--r10);padding:10px 12px;
  margin-bottom:8px;box-shadow:var(--sh0);font-size:.85rem;line-height:1.52;
  border:1px solid var(--border2);color:var(--ink2);
  transition:box-shadow .15s;
}
.kanban-card:hover{box-shadow:var(--sh1)}
.kanban-card:empty{display:none}

/* ── Timeline ── */
.timeline{margin:.9em 0;padding:4px 0}
.tl-row{display:grid;grid-template-columns:36px 1fr;gap:0 16px;position:relative}
.tl-side{display:flex;flex-direction:column;align-items:center}
.tl-dot{width:13px;height:13px;border-radius:50%;flex-shrink:0;border:2px solid #fff;margin-top:4px;z-index:1;position:relative;box-shadow:0 0 0 1.5px var(--border)}
.tl-line{width:2px;flex:1;min-height:24px;margin-top:4px;background:linear-gradient(180deg,var(--border),transparent);border-radius:1px}
.tl-row:last-child .tl-line{display:none}
.tl-content{padding-bottom:24px}
.tl-date{font-size:.67rem;font-weight:800;color:var(--ink4);text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px;margin-top:4px}
.tl-title{font-weight:700;font-size:.91rem;color:var(--ink);line-height:1.35}
.tl-desc{font-size:.83rem;color:var(--ink3);margin-top:4px;line-height:1.55}

/* ── Gallery ── */
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:10px;margin:.9em 0}
.gal-item{border-radius:var(--r14);overflow:hidden;box-shadow:var(--sh1);margin:0;background:var(--surface3)}
.gal-item img{width:100%;aspect-ratio:4/3;object-fit:cover}
.gal-item figcaption{padding:7px 10px;font-size:.73rem;color:var(--ink3);background:var(--surface2)}
.gal-local{background:var(--amber-l);border:1px dashed var(--amber-m)}
.gal-local-inner{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:20px 12px;min-height:110px}
.gal-local-icon{font-size:1.8em}
.gal-local-name{font-size:.75rem;font-weight:700;color:var(--ink3);text-align:center;word-break:break-all}
.gal-local-note{font-size:.67rem;color:var(--amber);font-style:italic}
.it-img-local{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px 16px;background:var(--amber-l);border:1px dashed var(--amber-m);border-radius:var(--r16);flex:0 0 42%;text-align:center}

/* ── Mindmap SVG ── */
.mindmap-wrap{
  background:#f9f7f4;
  background-image:
    linear-gradient(rgba(107,143,113,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(107,143,113,.05) 1px, transparent 1px);
  background-size:28px 28px;
  border:1px solid var(--border2);border-radius:var(--r20);
  padding:24px 20px;margin:.9em 0;overflow:auto;box-shadow:var(--sh1);
}
.mindmap-svg{width:100%;height:auto;display:block;overflow:visible}
.mindmap-empty{padding:40px;text-align:center;color:var(--ink4);font-style:italic;background:var(--surface2);border-radius:var(--r14);margin:.9em 0}

/* ── Flashcards ── */
.flashcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:12px;margin:.9em 0}
.fc-card{padding:20px 17px;border-radius:var(--r16);box-shadow:var(--sh1);position:relative;min-height:90px;background:color-mix(in srgb,var(--fc) 10%,#fff);border:1.5px solid color-mix(in srgb,var(--fc) 22%,#e8e0d8)}
.fc-num{font-size:.65rem;font-weight:800;color:var(--fc);opacity:.5;position:absolute;top:12px;right:14px;letter-spacing:.06em}
.fc-text{font-size:.87rem;line-height:1.55;color:var(--ink2);margin-top:8px}

/* ── Tabs ── */
.tabs-block{
  border:1px solid var(--border2);border-radius:var(--r20);
  overflow:hidden;margin:.9em 0;box-shadow:var(--sh1);background:var(--surface);
}
.tabs-nav{display:flex;background:var(--surface3);border-bottom:1px solid var(--border2);overflow-x:auto;scrollbar-width:none}
.tabs-nav::-webkit-scrollbar{display:none}
.tab-btn{
  padding:11px 20px;border:none;background:none;cursor:pointer;
  font-size:.82rem;font-weight:700;font-family:var(--font-sans);color:var(--ink4);
  border-bottom:2.5px solid transparent;white-space:nowrap;transition:all .16s;letter-spacing:.01em;
}
.tab-btn:hover{color:var(--ink2);background:var(--surface4)}
.tab-btn.active{color:var(--sage);border-bottom-color:var(--sage);background:var(--surface)}
.tabs-content{}.tab-panel{display:none;padding:20px 22px}.tab-panel.active{display:block}
.tabs-print{margin:.9em 0}
.tab-print-section{margin-bottom:18px;border:1px solid var(--border2);border-radius:var(--r12);overflow:hidden;background:var(--surface);break-inside:avoid}
.tab-print-label{
  padding:9px 16px;font-size:.71rem;font-weight:800;text-transform:uppercase;
  letter-spacing:.1em;color:var(--sage);background:var(--sage-l);
  border-bottom:1px solid var(--sage-m);
}
.tab-print-section>*:not(.tab-print-label){padding:14px 18px}

/* ── Chart card ── */
.chart-card{background:var(--surface2);border:1px solid var(--border2);border-radius:var(--r20);padding:24px;margin:.9em 0;box-shadow:var(--sh1)}
.chart-title{font-family:var(--font-serif);font-weight:700;font-size:1rem;color:var(--ink);letter-spacing:-.01em;margin-bottom:4px}
.chart-badge{display:inline-block;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--sage);background:var(--sage-l);border:1px solid var(--sage-m);border-radius:9999px;padding:2px 10px;margin-bottom:16px}
.chart-canvas-wrap{position:relative;width:100%;height:300px}
.chart-canvas-wrap canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
.chart-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px;color:var(--ink4);background:var(--surface3);border:1.5px dashed var(--border);border-radius:var(--r16);margin:.9em 0;text-align:center}
.chart-empty-icon{font-size:2.5em}
.chart-empty p{font-size:.87rem;color:var(--ink4)}

/* ── SWOT ── */
.swot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:.9em 0}
.swot-cell{
  background:var(--surface2);border:1px solid var(--border2);
  border-top:3px solid var(--sc,var(--sage));
  border-radius:0 0 var(--r14) var(--r14);padding:18px;box-shadow:var(--sh0);
}
.swot-head{display:flex;align-items:center;gap:8px;margin-bottom:11px}
.swot-head span:last-child{font-weight:800;font-size:.71rem;text-transform:uppercase;letter-spacing:.11em;color:var(--ink2)}
.swot-cell ul{padding-left:1.1em;font-size:.86rem;color:var(--ink3);line-height:1.65}
.swot-cell li{margin:.25em 0}
.swot-empty{color:var(--ink4);font-style:italic;list-style:none!important;padding-left:0!important}

/* ── Steps ── */
.steps{margin:.9em 0}
.step{display:flex;gap:14px;align-items:flex-start;padding:14px 0}
.step+.step{border-top:1px solid var(--border2)}
.step-circle{
  flex-shrink:0;width:32px;height:32px;border-radius:50%;
  background:linear-gradient(135deg,var(--sage),#4a7450);color:#fff;
  display:flex;align-items:center;justify-content:center;
  font-size:.78rem;font-weight:800;
  box-shadow:0 3px 10px rgba(107,143,113,.3);margin-top:1px;
}
.step-circle svg{width:14px;height:14px}
.step-done .step-circle{background:linear-gradient(135deg,#4a9494,#357070);box-shadow:0 3px 10px rgba(74,148,148,.3)}
.step-done .step-title{text-decoration:line-through;color:var(--ink4)}
.step-body{min-width:0}
.step-title{font-weight:700;font-size:.92rem;color:var(--ink);line-height:1.35}
.step-desc{font-size:.84rem;color:var(--ink3);margin-top:3px;line-height:1.55}

/* ── FAQ ── */
.faq{margin:.9em 0}
.faq-item{
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r14);margin-bottom:8px;overflow:hidden;
  box-shadow:var(--sh0);transition:box-shadow .18s;
}
.faq-item[open]{box-shadow:var(--sh1)}
.faq-q{
  padding:14px 18px;font-weight:700;cursor:pointer;list-style:none;
  display:flex;justify-content:space-between;align-items:center;
  font-size:.9rem;color:var(--ink);gap:12px;user-select:none;
}
.faq-q::-webkit-details-marker,.faq-q::marker{display:none}
.faq-icon{
  width:20px;height:20px;border-radius:50%;background:var(--surface4);
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:.73rem;color:var(--ink4);
  transition:transform .2s,background .18s;
}
.faq-item[open] .faq-icon{background:var(--sage-l);color:var(--sage);transform:rotate(45deg)}
.faq-icon::before{content:"＋"}
.faq-a{
  padding:13px 18px;border-top:1px solid var(--border2);
  background:var(--surface3);font-size:.87rem;color:var(--ink3);
  line-height:1.7;white-space:pre-wrap;
}

/* ── Image+text ── */
.image-text{display:flex;gap:24px;align-items:flex-start;margin:.9em 0}
.it-img{flex:0 0 42%;border-radius:var(--r16);overflow:hidden;box-shadow:var(--sh2)}
.it-img img{width:100%}
.it-body{flex:1;min-width:0}
.it-title{font-family:var(--font-serif);font-size:1rem;font-weight:700;color:var(--ink);margin-bottom:8px;margin-top:0}
.it-desc{font-size:.87rem;color:var(--ink3);line-height:1.68}

/* ── Columns layout ── */
.col-layout{display:grid;gap:18px;margin:.9em 0}
.col-cell{min-width:0}
.col-heading{
  font-weight:800;font-size:.67rem;text-transform:uppercase;letter-spacing:.13em;
  color:var(--sage);margin-bottom:10px;padding-bottom:8px;
  border-bottom:1.5px solid var(--sage-m);
}

/* ── Tags ── */
.tags-row{
  margin-top:52px;padding:22px 28px;
  background:var(--surface2);border:1px solid var(--border2);
  border-radius:var(--r20);
  display:flex;flex-wrap:wrap;gap:8px;align-items:center;
}
.tags-lbl{font-size:.67rem;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ink4);margin-right:4px}
.tag-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 14px;border-radius:9999px;font-size:.72rem;font-weight:800;color:#fff;letter-spacing:.02em}

/* ── Footer ── */
.page-footer{
  margin-top:64px;padding-top:22px;border-top:1px solid var(--border2);
  display:flex;justify-content:space-between;align-items:center;
  font-size:.74rem;color:var(--ink4);
}
.footer-brand{display:flex;align-items:center;gap:7px}
.footer-brand-dot{width:5px;height:5px;border-radius:50%;background:var(--sage);opacity:.6}

/* ── Print styles ── */
@media print{
  .action-bar{display:none!important}
  body{padding-top:0;background:#fff}
  .page{max-width:100%;padding:0 0 20px}
  .doc-header{padding:20px 0 28px;margin-bottom:28px}
  .doc-header::before{display:none}
  /* Embed iframes — show as link cards in print */
  .embed-block{break-inside:avoid}
  .embed-ratio-16-9,.embed-frame-wrap{display:none!important}
  .embed-bar .embed-ext-link::after{content:" (open link to view)";font-style:italic;font-weight:400}
  /* Video thumbnail — keep the image, hide overlay details */
  .vid-thumb-card{aspect-ratio:16/9;max-height:220px}
  .vid-thumb-overlay{display:none}
  .table-outer{overflow:visible;border:1px solid var(--border2);border-radius:4px}
  .table-scroll{overflow:visible}
  table{min-width:unset;width:100%}
  th,td{white-space:normal}
  .toggle{border:1px solid var(--border2)}
  .toggle-body{display:block!important}
  .faq-a{display:block!important}
  .faq-icon::before{content:"−"!important}
  .chart-card{break-inside:avoid}
  .chart-canvas-wrap{height:260px}
  .mindmap-wrap{
    background:#f9f7f4!important;
    background-image:
      linear-gradient(rgba(107,143,113,.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(107,143,113,.04) 1px, transparent 1px)!important;
    background-size:28px 28px!important;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
    page-break-inside:avoid;break-inside:avoid;overflow:visible!important;
  }
  .mindmap-svg{overflow:visible!important;width:100%!important}
  .step,.swot-cell,.faq-item,.tl-row,.kanban-col,.tab-print-section{break-inside:avoid}
  h1,h2,h3,.h1,.h2,.h3,.rule{break-after:avoid}
  .kanban-scroll{flex-wrap:wrap}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:18mm 16mm}
}

/* ── Responsive ── */
@media(max-width:700px){
  .action-bar{bottom:20px;max-width:calc(100vw - 32px)}
  .ab-title{display:none}
  .ab-divider:first-of-type{display:none}
  .page{padding:36px 18px 100px}
  .page-title{font-size:2.1rem}
  .doc-header{padding:36px 0 28px}
  .swot{grid-template-columns:1fr}
  .image-text{flex-direction:column}
  .it-img{flex:unset;width:100%}
  .col-layout{grid-template-columns:1fr!important}
  .chart-canvas-wrap{height:220px}
  .gallery{grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
  pre{font-size:.8rem}
}
`;

// ─── Runtime JavaScript ───────────────────────────────────────────────────────

const makeJS = (forPdf: boolean, hasCharts: boolean, hasEquations: boolean) => `
// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    var root=btn.closest('.tabs-block');
    root.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
    root.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
    btn.classList.add('active');
    root.querySelector('.tab-panel[data-panel="'+btn.dataset.tab+'"]').classList.add('active');
  });
});

// ── Readiness flags (always declared so the PDF poller can read them) ─────────
window.__chartsReady=${hasCharts ? "false" : "true"};
window.__katexReady=${hasEquations ? "false" : "true"};
window.__imagesReady=false;

// ── Track all images loading (including external URLs) ────────────────────────
(function(){
  function checkImages(){
    var imgs=Array.from(document.querySelectorAll('img'));
    if(!imgs.length){window.__imagesReady=true;return;}
    var pending=imgs.length;
    function oneDone(){pending--;if(pending<=0)window.__imagesReady=true;}
    imgs.forEach(function(img){
      if(img.complete){
        oneDone();
      } else {
        img.addEventListener('load',oneDone,{once:true});
        img.addEventListener('error',oneDone,{once:true}); // broken img still counts as done
      }
    });
  }
  // Run after DOM is parsed
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',checkImages);
  } else {
    checkImages();
  }
})();

${hasEquations ? `
// ── KaTeX equations ───────────────────────────────────────────────────────────
(function(){
  var link=document.createElement('link');
  link.rel='stylesheet';
  link.href='https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
  document.head.appendChild(link);
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
  s.onload=function(){
    document.querySelectorAll('.equation').forEach(function(el){
      var formula=el.dataset.formula||'';
      var target=el.querySelector('.eq-rendered');
      if(!target)return;
      try{
        katex.render(formula,target,{throwOnError:false,displayMode:true});
        el.querySelector('.eq-display').style.display='none';
      }catch(e){target.textContent=formula;}
    });
    window.__katexReady=true;
  };
  s.onerror=function(){window.__katexReady=true;};
  document.head.appendChild(s);
})();
` : ""}

${hasCharts ? `
// ── Charts via Chart.js 4 ─────────────────────────────────────────────────────
(function(){
  var configs=window.__CHARTS||[];
  if(!configs.length){window.__chartsReady=true;return;}
  var pending=configs.length;
  function oneDone(){pending--;if(pending<=0)window.__chartsReady=true;}
  function renderCharts(){
    Chart.defaults.font.family="-apple-system,'SF Pro Text','Helvetica Neue',sans-serif";
    Chart.defaults.color='#374151';
    Chart.defaults.borderColor='#e5e7eb';
    configs.forEach(function(item){
      var el=document.getElementById(item.id);
      if(!el){oneDone();return;}
      try{
        var cfg=JSON.parse(JSON.stringify(item.cfg));
        // Disable animation for PDF so canvas is fully painted synchronously
        cfg.options=cfg.options||{};
        cfg.options.animation=${forPdf ? "{duration:0}" : "cfg.options.animation||{}"};
        cfg.options.responsive=true;
        cfg.options.maintainAspectRatio=false;
        var ch=new Chart(el,cfg);
        if(${forPdf ? "true" : "false"}){
          // PDF: animation disabled — use rAF to let browser flush canvas paint
          requestAnimationFrame(function(){ requestAnimationFrame(function(){ oneDone(); }); });
        } else {
          if(ch.options && ch.options.animation){
            ch.options.animation.onComplete=function(){oneDone();};
          }
          ch.update('none');
        }
      }catch(e){console.error('Chart['+item.id+']:',e);oneDone();}
    });
  }
  if(typeof Chart!=='undefined'){
    renderCharts();
  }else{
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    s.crossOrigin='anonymous';
    s.onload=renderCharts;
    s.onerror=function(){window.__chartsReady=true;};
    document.head.appendChild(s);
  }
})();
` : ""}

${forPdf ? `
// ── PDF auto-print: poll until charts+KaTeX+images are ready, then print ──────
(function(){
  var MAX=20000, STEP=250, elapsed=0;
  function attempt(){
    elapsed+=STEP;
    var allReady=window.__chartsReady&&window.__katexReady&&window.__imagesReady;
    if(allReady||elapsed>=MAX){
      // Double rAF — ensures browser has painted the final frame before print dialog
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          setTimeout(function(){window.print();},300);
        });
      });
    }else{
      setTimeout(attempt,STEP);
    }
  }
  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(function(){setTimeout(attempt,200);});
  }else{
    setTimeout(attempt,800);
  }
})();
` : `
// ── Print / Save PDF button ───────────────────────────────────────────────────
var pb=document.getElementById('print-btn');
if(pb)pb.addEventListener('click',function(){window.print();});
`}
`;

// ─── HTML document builder ────────────────────────────────────────────────────

const buildHtml = (note: Note, forPdf = false, mediaMap: MediaMap = new Map()): string => {
  _charts = [];
  _cid = 0;

  const body = renderBlocks(note.blocks);
  const hasCharts = _charts.length > 0;
  const hasEquations = note.blocks.some(b => b.type === "equation");

  // Serialize chart configs — safe JSON, no inline scripts in body
  const chartsJson = JSON.stringify(_charts);

  const tagsHtml = note.tags.length
    ? `<div class="tags-row"><span class="tags-lbl">Tags</span>${note.tags.map(t=>`<span class="tag-chip" style="background:${esc(toHex(t.color,"#6366f1"))}">${esc(t.label)}</span>`).join("")}</div>`
    : "";

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"}); }
    catch { return iso; }
  };
  const created = note.createdAt ? fmtDate(note.createdAt) : "";
  const updated = note.updatedAt && note.updatedAt !== note.createdAt ? fmtDate(note.updatedAt) : "";

  const pdfOverride = forPdf ? `
    /* ── PDF layout overrides ── */
    .action-bar{display:none!important}
    body{padding-top:0!important;background:#fff!important}
    .page{max-width:100%!important;padding:0 0 20px!important}
    .doc-header{padding:16px 0 24px!important;margin-bottom:24px!important}
    /* Tables: show all columns */
    .table-outer,.table-scroll{overflow:visible!important}
    table{min-width:unset!important;width:100%!important}
    th,td{white-space:normal!important}
    /* Charts: fixed height so canvas is visible */
    .chart-canvas-wrap{height:300px!important;position:relative!important;overflow:hidden!important}
    .chart-canvas-wrap canvas{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important}
    .chart-card{break-inside:avoid!important}
    /* Force all details open */
    details{display:block!important}
    details>summary~*{display:block!important}
    .toggle-body,.faq-a{display:block!important;visibility:visible!important;height:auto!important;overflow:visible!important}
    /* Tabs: show all panels stacked */
    .tabs-nav,.screen-only{display:none!important}
    .tab-panel{display:block!important;border-top:1px solid #e5e5ea;padding:14px 0!important}
    .tab-panel[data-panel]::before{content:attr(data-panel);display:none}
    .print-only{display:block!important}
    /* Kanban: wrap columns */
    .kanban-scroll{flex-wrap:wrap!important;overflow:visible!important}
    /* Page settings */
    @page{size:A4;margin:18mm 16mm}
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    /* Page breaks */
    .step,.swot-cell,.tl-row,.faq-item,.toggle{break-inside:avoid}
    h1,h2,h3,.h1,.h2,.h3{break-after:avoid}
  ` : "";

  const topbar = forPdf ? "" : `
<div class="action-bar" role="toolbar" aria-label="Document actions">
  <span class="ab-title">${esc(note.title)}</span>
  <div class="ab-divider"></div>
  <button class="ab-btn ab-btn-ghost" onclick="window.print()" title="Print document">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="7" width="10" height="7" rx="1.2"/>
      <path d="M5 7V4.5a1 1 0 011-1h4a1 1 0 011 1V7"/>
      <circle cx="11.5" cy="10.5" r=".8" fill="currentColor" stroke="none"/>
    </svg>
    Print
  </button>
  <button class="ab-btn ab-btn-primary" id="print-btn" title="Save as PDF">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 2v8M5 7l3 3 3-3"/>
      <path d="M2.5 13h11"/>
    </svg>
    Save as PDF
  </button>
</div>`;

  let finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(note.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  ${hasCharts ? `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" crossorigin="anonymous"><\/script>` : ""}
  <script>window.__CHARTS=${chartsJson};<\/script>
  <style>
  /* ── Override font stack with loaded web fonts ── */
  :root{
    --font-sans:"DM Sans",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
    --font-display:"DM Sans",-apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif;
    --font-serif:"Lora","Georgia",serif;
  }
  body{font-family:var(--font-sans)}
  .page-title{font-family:var(--font-serif);font-weight:700;letter-spacing:-.02em}
  ${CSS}${pdfOverride}</style>
</head>
<body>
${topbar}
<main class="page">
  <div class="doc-header">
    <div class="page-eyebrow"><span class="page-eyebrow-dot"></span>Note</div>
    <h1 class="page-title">${esc(note.title)}</h1>
    <div class="page-meta">
      ${created?`<span class="meta-item"><span class="meta-icon">📅</span>${created}</span>`:""}
      ${updated?`<span class="meta-item"><span class="meta-icon">✏️</span>Updated ${updated}</span>`:""}
      ${note.tags.length?note.tags.map(t=>`<span class="meta-item"><span class="meta-dot" style="background:${esc(toHex(t.color,"#4c6ef5"))}"></span>${esc(t.label)}</span>`).join(""):""}
    </div>
  </div>
  <article class="article">
${body}
  </article>
  ${tagsHtml}
  <footer class="page-footer">
    <span class="footer-brand"><span class="footer-brand-dot"></span>Exported from Notes</span>
    <span>${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</span>
  </footer>
</main>
<script>${makeJS(forPdf, hasCharts, hasEquations)}<\/script>
</body>
</html>`;

  // ── Inline media: swap every local URL in src/href attributes with its data URI ──
  // This is done on the raw HTML string so it catches ALL blocks including
  // nested ones inside columns, tabs, gallery, imageText etc.
  if (mediaMap.size > 0) {
    mediaMap.forEach((dataUri, originalUrl) => {
      if (dataUri === originalUrl) return; // fetch failed — leave as-is
      // Escape the URL for use in a regex (handles blob:, ?query=, etc.)
      const escaped = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Replace in src="..." and href="..." attributes
      finalHtml = finalHtml.replace(
        new RegExp(`(src|href)="${escaped}"`, "g"),
        `$1="${dataUri}"`
      );
    });
  }

  // For PDF: replace lazy loading with eager so images load immediately
  if (forPdf) {
    finalHtml = finalHtml.replace(/loading="lazy"/g, 'loading="eager"');
  }

  return finalHtml;
};

// ─── Download helper ──────────────────────────────────────────────────────────

const dl = (content: string, name: string, mime: string) => {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([content], {type:mime})),
    download: name,
  });
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 200);
};

const safeName = (t: string) => t.replace(/[^a-z0-9]/gi,"_").slice(0,50)||"note";

// ─── Media inlining for PDF ───────────────────────────────────────────────────
//
// The PDF opens as a blob: URL which is a different origin from the app.
// Any image/audio/video with a relative path, blob: URL, or localhost URL
// becomes a cross-origin request and fails to load.
//
// Solution: before building the PDF HTML, fetch every media URL that could
// be "local" (relative, blob:, or same-origin http://localhost) and convert
// it to a base64 data URI. Those get embedded directly in the HTML so the
// blob: document has no external dependencies for media.

type MediaMap = Map<string, string>; // original URL → data URI (or original if fetch fails)

/** Fetch a URL and return a base64 data URI. Returns the original URL on failure. */
const urlToDataUri = async (url: string): Promise<string> => {
  if (!url) return url;
  // Already a data URI — nothing to do
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // Network error or CORS — keep original, may not show but won't crash
  }
};

/**
 * Collect every media URL from all blocks that needs inlining
 * (local/blob/relative/localhost), fetch them all in parallel,
 * return a Map from original URL → data URI.
 */
const inlineNoteMedia = async (note: Note): Promise<MediaMap> => {
  const map: MediaMap = new Map();

  // Decide if a URL needs inlining: local files, blob: URLs, and same-host URLs
  const needsInline = (url: string | undefined): url is string => {
    if (!url) return false;
    if (url.startsWith("data:")) return false; // already inlined
    if (url.startsWith("blob:")) return true;
    if (url.startsWith("file:")) return true;
    // Relative paths (no protocol)
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("//")) return true;
    // Same host as the app (e.g. http://localhost:3000/uploads/…)
    try {
      const parsed = new URL(url);
      if (parsed.hostname === window.location.hostname) return true;
    } catch { /* not a valid absolute URL — treat as relative */ return true; }
    return false;
  };

  // Walk every block and collect URLs that need inlining
  const urls = new Set<string>();
  const collectFromBlock = (block: NoteBlock) => {
    if (needsInline(block.imageUrl))       urls.add(block.imageUrl!);
    if (needsInline(block.videoUrl))       urls.add(block.videoUrl!);
    if (needsInline(block.audioUrl))       urls.add(block.audioUrl!);
    if (needsInline(block.fileUrl))        urls.add(block.fileUrl!);
    if (needsInline(block.imageTextUrl))   urls.add(block.imageTextUrl!);
    block.galleryImages?.forEach(img => { if (needsInline(img.url)) urls.add(img.url); });
    block.columns?.forEach(col => col.forEach(collectFromBlock));
    block.tabsData?.forEach(tab => tab.blocks?.forEach(collectFromBlock));
  };
  note.blocks.forEach(collectFromBlock);

  if (!urls.size) return map;

  // Fetch all in parallel
  const entries = await Promise.all(
    [...urls].map(async url => [url, await urlToDataUri(url)] as [string, string])
  );
  entries.forEach(([url, dataUri]) => map.set(url, dataUri));
  return map;
};

// ─── PDF export ───────────────────────────────────────────────────────────────
//
// 1. Fetch every local/blob/relative media URL → base64 data URI (parallel)
// 2. Build self-contained HTML with all media inlined
// 3. Open as blob: URL via programmatic <a> click (never popup-blocked)
// 4. The opened page auto-calls window.print() once charts+KaTeX are ready

const exportPdf = async (note: Note): Promise<void> => {
  // Step 1 — convert all local media to data URIs so the blob: doc is self-contained
  const mediaMap = await inlineNoteMedia(note);

  // Step 2 — build full print-ready HTML with inlined media
  const html = buildHtml(note, true, mediaMap);

  // Step 3 — Blob URL + programmatic <a> click (never blocked as popup)
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url; a.target = "_blank"; a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);

  try {
    a.click();
    // Keep Blob URL alive 2 min — enough for tab load + print dialog
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
  } catch {
    URL.revokeObjectURL(url);
    dl(html, `${safeName(note.title)}_print.html`, "text/html");
  } finally {
    document.body.removeChild(a);
  }
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useNoteExport = () => {
  const exportNote = useCallback(async (note: Note, format: ExportFormat) => {
    const name = safeName(note.title);
    switch (format) {
      case "markdown": {
        const body = note.blocks.map(b=>blockToMarkdown(b)).filter(Boolean).join("\n\n");
        const tags = note.tags.length?`\n\n---\n**Tags:** ${note.tags.map(t=>`\`${t.label}\``).join(", ")}`:"";
        dl(`# ${note.title}\n\n${body}${tags}`, `${name}.md`, "text/markdown");
        break;
      }
      case "text": {
        const body = note.blocks.map(b=>blockToText(b)).filter(Boolean).join("\n\n");
        const tags = note.tags.length?`\n\nTags: ${note.tags.map(t=>t.label).join(", ")}`:"";
        dl(`${note.title}\n${"═".repeat(note.title.length||1)}\n\n${body}${tags}`, `${name}.txt`, "text/plain");
        break;
      }
      case "html":
        dl(buildHtml(note, false), `${name}.html`, "text/html");
        break;
      case "pdf":
        await exportPdf(note);
        break;
      case "json":
        dl(JSON.stringify(note, null, 2), `${name}.json`, "application/json");
        break;
    }
  }, []);
  return { exportNote };
};