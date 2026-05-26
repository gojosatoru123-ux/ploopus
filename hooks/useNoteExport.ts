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

// Convert YouTube / Vimeo watch URLs → embeddable iframe src
const videoEmbedUrl = (url = ""): string | null => {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`;
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return `https://player.vimeo.com/video/${vmMatch[1]}`;
  return null;
};

// Guess icon for file type from extension / mime
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
  return "📎";
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
      return `<div class="callout">${renderInline(block.content)}</div>`;

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

    // ── Video — local native player / YouTube+Vimeo embed / external link ─────
    case "video": {
      if (!block.videoUrl) return "";
      const local = isLocal(block.videoUrl);
      if (local) {
        return `<div class="media-block"><video controls class="native-video"><source src="${esc(block.videoUrl)}"><p class="media-fallback">Your browser cannot play this video. <a href="${esc(block.videoUrl)}" download>Download file</a></p></video><div class="media-local-hint">📁 Local file — plays only on the original device</div></div>`;
      }
      const embed = videoEmbedUrl(block.videoUrl);
      if (embed) {
        return `<div class="media-block"><div class="video-embed-wrap"><iframe src="${esc(embed)}" frameborder="0" allowfullscreen loading="lazy" title="Video" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe></div></div>`;
      }
      // Generic external video link
      return `<div class="media-link-card"><span class="media-icon">▶</span><div class="media-info"><span class="media-label">Video</span><a href="${esc(block.videoUrl)}" target="_blank" rel="noopener" class="media-url">${esc(block.videoUrl)}</a></div></div>`;
    }

    // ── Audio — local native player with hint / external streaming player ─────
    case "audio": {
      if (!block.audioUrl) return "";
      const local = isLocal(block.audioUrl);
      const name = block.audioUrl.split("/").pop() || "Audio";
      if (local) {
        return `<div class="audio-card"><span class="media-icon">🎵</span><div class="audio-inner"><span class="audio-name">${esc(name)}</span><audio controls><source src="${esc(block.audioUrl)}"><span class="media-fallback">Cannot play audio.</span></audio><span class="file-note">📁 Local file — plays only on the original device</span></div></div>`;
      }
      return `<div class="audio-card"><span class="media-icon">🎵</span><div class="audio-inner"><span class="audio-name">${esc(name)}</span><audio controls src="${esc(block.audioUrl)}"></audio></div></div>`;
    }

    // ── File — download link with smart icon ──────────────────────────────────
    case "file": {
      if (!block.fileUrl) return "";
      const local = isLocal(block.fileUrl);
      const name = block.fileName || block.fileUrl.split("/").pop() || "File";
      const icon = fileIcon(block.fileName || "", block.fileUrl);
      const localBadge = local ? `<span class="local-badge">local</span>` : "";
      return `<div class="file-card"><span class="file-icon-lg">${icon}</span><div class="file-info"><span class="file-name">${esc(name)}</span>${localBadge}${local ? `<span class="file-note">Local file — open from your device</span>` : `<a href="${esc(block.fileUrl)}" target="_blank" rel="noopener" class="file-link" download>Download ↗</a>`}</div></div>`;
    }

    // ── Bookmark ──────────────────────────────────────────────────────────────
    case "bookmark":
      if (!block.bookmarkUrl) return "";
      return `<a class="bookmark-card" href="${esc(block.bookmarkUrl)}" target="_blank" rel="noopener"><div class="bm-body"><div class="bm-title">${renderInline(block.bookmarkTitle||block.bookmarkUrl)}</div>${block.bookmarkDescription?`<div class="bm-desc">${renderInline(block.bookmarkDescription)}</div>`:""}<div class="bm-url">${esc(block.bookmarkUrl)}</div></div><span class="bm-arrow">↗</span></a>`;

    // ── Embed ─────────────────────────────────────────────────────────────────
    case "embed":
      return block.embedUrl
        ? `<div class="media-link-card"><span class="media-icon">🔗</span><div class="media-info"><span class="media-label">Embed</span><a href="${esc(block.embedUrl)}" target="_blank" rel="noopener" class="media-url">${esc(block.embedUrl)}</a></div></div>` : "";

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

    // ── Countdown ─────────────────────────────────────────────────────────────
    case "countdown":
      return block.countdownDate
        ? `<div class="countdown"><div class="cd-label">${esc(block.countdownTitle||"Countdown")}</div><div class="cd-date">${esc(block.countdownDate)}</div></div>` : "";

    // ── Table — with horizontal scroll + print-safe full width ───────────────
    case "table": {
      const rows = block.tableData??[]; if (!rows.length) return "";
      const head = rows[0].map(c=>`<th>${renderInline(c)}</th>`).join("");
      const body = rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${renderInline(c)}</td>`).join("")}</tr>`).join("");
      return `<div class="table-outer"><div class="table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`;
    }

    // ── Database ──────────────────────────────────────────────────────────────
    case "database": {
      const c=block.databaseColumns??[],r=block.databaseRows??[]; if(!c.length) return "";
      const head=c.map(col=>`<th>${esc(col.name)}</th>`).join("");
      const body=r.map(row=>`<tr>${c.map(col=>`<td>${renderInline(String(row.cells[col.id]??""))}</td>`).join("")}</tr>`).join("");
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

      // ── Step 7: Arrowhead markers (one per unique node color) ──────────────
      const uniqueHex = new Set<string>();
      nodes.forEach(n => uniqueHex.add(toHex(n.color || "bg-blue-500", "#3b82f6")));
      const arrowDefs = [...uniqueHex].map(hex => {
        const mid = `am${hex.replace('#', '')}`;
        return `<marker id="${mid}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">` +
               `<path d="M0,0.5 L9,3.5 L0,6.5 Z" fill="${hex}"/>` +
               `</marker>`;
      }).join("");

      // ── Step 8: Draw edges ─────────────────────────────────────────────────
      const edgeSvg: string[] = [];
      const labelSvg: string[] = [];
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
          // Back-edge: arc along the bottom, below all nodes, staggered
          backCount++;
          const allMaxY = Math.max(...[...pos.values()].map(p => p.y + NH));
          const arcY = allMaxY + 28 + backCount * 32;
          const sx = fp.cx, sy = fp.y + NH;
          const tx2 = tp.cx, ty2 = tp.y + NH;
          pathD = `M${sx.toFixed(1)},${sy.toFixed(1)} ` +
                  `C${sx.toFixed(1)},${arcY.toFixed(1)} ` +
                  `${tx2.toFixed(1)},${arcY.toFixed(1)} ` +
                  `${tx2.toFixed(1)},${ty2.toFixed(1)}`;
          lx = (sx + tx2) / 2;
          ly = arcY - 6;
        } else {
          // Forward edge: staggered port bezier
          const ri = rIdxOf.get(c.from) ?? 0;
          const li = lIdxOf.get(c.to)   ?? 0;
          rIdxOf.set(c.from, ri + 1);
          lIdxOf.set(c.to,   li + 1);

          const fy = (rPortsOf.get(c.from) ?? [fp.cy])[ri] ?? fp.cy;
          const ty2 = (lPortsOf.get(c.to)  ?? [tp.cy])[li] ?? tp.cy;

          const sx  = fp.x + NW;
          const tx2 = tp.x - 10;         // leave 10px gap for arrowhead
          const cpx = sx + (tx2 - sx) * 0.5;

          if (sx >= tp.x) {
            // Edge going right-to-left (back in layout terms, not DFS-back)
            // Route with a big arc above or below to avoid crossing nodes
            const arcAbove = fp.cy < tp.cy;
            const midY = arcAbove
              ? Math.min(fy, ty2) - 60
              : Math.max(fy, ty2) + 60;
            pathD = `M${sx.toFixed(1)},${fy.toFixed(1)} ` +
                    `C${(sx+50).toFixed(1)},${fy.toFixed(1)} ` +
                    `${(sx+50).toFixed(1)},${midY.toFixed(1)} ` +
                    `${((sx + tx2)/2).toFixed(1)},${midY.toFixed(1)} ` +
                    `S${(tx2-40).toFixed(1)},${ty2.toFixed(1)} ${tx2.toFixed(1)},${ty2.toFixed(1)}`;
            lx = (sx + tx2) / 2;
            ly = midY - 14;
          } else {
            pathD = `M${sx.toFixed(1)},${fy.toFixed(1)} ` +
                    `C${cpx.toFixed(1)},${fy.toFixed(1)} ` +
                    `${cpx.toFixed(1)},${ty2.toFixed(1)} ` +
                    `${tx2.toFixed(1)},${ty2.toFixed(1)}`;
            // Put label at 50% along the bezier — approx midpoint
            lx = sx + (tx2 - sx) * 0.5;
            ly = fy + (ty2 - fy) * 0.5 - 11;
          }
        }

        edgeSvg.push(
          `<path d="${pathD}" stroke="${fHex}" stroke-width="1.7" fill="none" ` +
          `opacity=".7" stroke-linecap="round" stroke-linejoin="round" ` +
          `marker-end="url(#${markId})"/>`
        );

        if (label) {
          const lw = label.length * 6.5 + 18;
          labelSvg.push(
            `<rect x="${(lx - lw/2).toFixed(1)}" y="${(ly - 8).toFixed(1)}" ` +
            `width="${lw.toFixed(1)}" height="15" rx="7.5" ` +
            `fill="white" stroke="${fHex}" stroke-width="1" opacity=".95"/>` +
            `<text x="${lx.toFixed(1)}" y="${(ly + 3.5).toFixed(1)}" ` +
            `text-anchor="middle" font-size="9" fill="${fHex}" ` +
            `font-family="-apple-system,'SF Pro Text',sans-serif" ` +
            `font-weight="700" letter-spacing=".02em">${esc(label)}</text>`
          );
        }
      });

      // ── Step 9: Draw nodes ─────────────────────────────────────────────────
      const drawN = (n: typeof nodes[0], ox: number, oy: number) => {
        const hex    = toHex(n.color || "bg-blue-500", "#3b82f6");
        const hasIn  = validConns.some(c => c.to   === n.id && !isBack(c.from, c.to));
        const fill   = hasIn ? hex + "1e" : hex;   // source nodes: solid; others: tinted
        const textC  = hasIn ? hex : "#fff";
        const sw     = hasIn ? "1.5" : "2.5";
        const sty    = (n.bold?"font-weight:700;":"") + (n.italic?"font-style:italic;":"") +
                       (n.underline?"text-decoration:underline;":"") +
                       "font-family:-apple-system,'SF Pro Text',sans-serif;";
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
        const nodeH = Math.max(NH, th + 16);
        const ty0 = oy + (nodeH / 2) - (th / 2) + lh - 4;

        const textEls = lns.map((l2, i) =>
          `<text x="${cx.toFixed(1)}" y="${(ty0 + i*lh).toFixed(1)}" ` +
          `text-anchor="middle" font-size="12" fill="${textC}" style="${sty}">${esc(l2)}</text>`
        ).join("");

        const shape = n.shape ?? "rectangle";
        let shp = "";
        if (shape === "diamond") {
          shp = `<polygon points="${cx},${oy-6} ${ox+NW+6},${cy} ${cx},${oy+nodeH+6} ${ox-6},${cy}" fill="${fill}" stroke="${hex}" stroke-width="${sw}"/>`;
        } else if (shape === "oval") {
          shp = `<ellipse cx="${cx}" cy="${oy+nodeH/2}" rx="${NW/2}" ry="${nodeH/2}" fill="${fill}" stroke="${hex}" stroke-width="${sw}"/>`;
        } else {
          shp = `<rect x="${ox}" y="${oy}" width="${NW}" height="${nodeH}" rx="10" fill="${fill}" stroke="${hex}" stroke-width="${sw}"/>`;
        }
        return shp + textEls;
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
          `<text x="${PAD}" y="${floatY0 - 10}" font-size="9" fill="#aaa" ` +
          `font-weight="700" letter-spacing=".12em" ` +
          `font-family="-apple-system,sans-serif">STANDALONE</text>`;
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

      return (
        `<div class="mindmap-wrap">` +
        `<svg viewBox="0 0 ${svgW.toFixed(0)} ${Math.max(svgH, 200).toFixed(0)}" ` +
        `xmlns="http://www.w3.org/2000/svg" class="mindmap-svg" ` +
        `style="min-height:${Math.min(Math.max(svgH, 180), 600).toFixed(0)}px">` +
        `<defs>${arrowDefs}</defs>` +
        edgeSvg.join("") +
        labelSvg.join("") +
        nodesSvg +
        floatLbl + floatSvg +
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
    case "countdown":   return block.countdownDate?`**${block.countdownTitle||"Countdown"}:** ${block.countdownDate}`:"";
    case "table": {
      const r=block.tableData;if(!r?.length)return"";
      return [`| ${r[0].join(" | ")} |`,`| ${r[0].map(()=>"---").join(" | ")} |`,...r.slice(1).map(row=>`| ${row.join(" | ")} |`)].join("\n");
    }
    case "database": {
      const c=block.databaseColumns??[],r=block.databaseRows??[];if(!c.length)return"";
      return [`| ${c.map(x=>x.name).join(" | ")} |`,`| ${c.map(()=>"---").join(" | ")} |`,...r.map(row=>`| ${c.map(x=>row.cells[x.id]??"").join(" | ")} |`)].join("\n");
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
    case "countdown": return block.countdownDate?`${block.countdownTitle||"Countdown"}: ${block.countdownDate}`:"";
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

// ─── CSS — Apple Human Interface Guidelines inspired ─────────────────────────

const CSS = `
/* ── Reset ── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

/* ── Tokens ── */
:root{
  --white:#fff;
  --bg:#f5f5f7;
  --surface:#fff;
  --surface2:#f9f9f9;
  --surface3:#f3f3f3;
  --border:#e4e4e7;
  --border2:#ebebeb;
  --ink:#1d1d1f;
  --ink2:#3d3d3f;
  --ink3:#6e6e73;
  --ink4:#a1a1a6;
  --blue:#0071e3;
  --blue-l:#e8f2fd;
  --green:#34c759;
  --red:#ff3b30;
  --orange:#ff9500;
  --r4:4px; --r8:8px; --r12:12px; --r16:16px; --r20:20px; --r24:24px;
  --sh1:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --sh2:0 4px 16px rgba(0,0,0,.08),0 2px 6px rgba(0,0,0,.04);
  --sh3:0 12px 40px rgba(0,0,0,.10),0 4px 12px rgba(0,0,0,.05);
}

/* ── Base ── */
html{font-size:16px;-webkit-text-size-adjust:100%;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.72;padding-top:58px}
img{max-width:100%;height:auto;display:block}
a{color:var(--blue)}a:hover{text-decoration:underline}

/* ── Top bar ── */
.topbar{
  position:fixed;inset:0 0 auto;height:58px;
  background:rgba(245,245,247,.9);
  backdrop-filter:saturate(180%) blur(20px);
  -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:1px solid rgba(0,0,0,.1);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;z-index:1000;
}
.topbar-title{font-size:.88rem;font-weight:600;color:var(--ink);letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%}
.topbar-btns{display:flex;gap:8px}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 16px;border-radius:980px;font-size:.82rem;font-weight:600;font-family:inherit;cursor:pointer;border:none;letter-spacing:-.01em;transition:all .15s ease}
.btn-ghost{background:rgba(0,0,0,.07);color:var(--ink2)}
.btn-ghost:hover{background:rgba(0,0,0,.11)}
.btn-blue{background:var(--blue);color:#fff}
.btn-blue:hover{background:#0077ed}
.btn-blue:active{transform:scale(.97)}

/* ── Page shell ── */
.page{max-width:960px;margin:0 auto;padding:48px 36px 80px}

/* ── Screen/print visibility helpers ── */
.screen-only{display:block}
.print-only{display:none}
@media print{
  .screen-only{display:none!important}
  .print-only{display:block!important}
}

/* ── Page header ── */
.page-eyebrow{font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ink4);margin-bottom:10px}
.page-title{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",sans-serif;font-size:2.6rem;font-weight:900;letter-spacing:-.05em;line-height:1.08;color:var(--ink);margin-bottom:14px}
.page-meta{display:flex;flex-wrap:wrap;gap:14px;font-size:.8rem;color:var(--ink4);margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid var(--border)}
.meta-dot{width:7px;height:7px;border-radius:50%;display:inline-block;vertical-align:middle;margin-right:4px}

/* ── Article ── */
.article>*+*{margin-top:.85em}

/* ── Typography ── */
.h1{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;font-size:1.9rem;font-weight:800;letter-spacing:-.03em;line-height:1.15;color:var(--ink);margin:2.2em 0 .4em}
.h2{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",sans-serif;font-size:1.45rem;font-weight:700;letter-spacing:-.02em;line-height:1.22;color:var(--ink);margin:1.9em 0 .35em;padding-bottom:.3em;border-bottom:1px solid var(--border)}
.h3{font-size:1.1rem;font-weight:700;letter-spacing:-.015em;color:var(--ink);margin:1.6em 0 .28em}
.prose{color:var(--ink2);margin:.35em 0;line-height:1.7}
.spacer{height:.5em}

/* ── Bullet list ── */
.ul{list-style:none;margin:.3em 0;padding:0}
.ul li{display:flex;align-items:baseline;gap:8px;color:var(--ink2);padding:2px 0}
.ul li::before{content:"";display:block;width:5px;height:5px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:8px}

/* ── Numbered list — true counters ── */
.ol{list-style:none;margin:.2em 0;padding:0}
.ol li{display:flex;align-items:baseline;gap:10px;color:var(--ink2);padding:2px 0}
.ol-n{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--blue);color:#fff;font-size:.72rem;font-weight:800;flex-shrink:0;line-height:1}

/* ── Todo ── */
.todo-item{display:flex;align-items:center;gap:10px;padding:5px 0;cursor:default}
.cb{width:18px;height:18px;border-radius:5px;border:2px solid var(--border);background:var(--surface);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.cb-on{background:var(--blue);border-color:var(--blue)}
.cb svg{width:10px;height:10px;opacity:0}
.cb-on svg{opacity:1}
.done{text-decoration:line-through;color:var(--ink4)}

/* ── Inline rich text formatting ── */
.prose strong,.prose b,strong,b{font-weight:700}
.prose em,.prose i,em,i{font-style:italic}
.prose u,u{text-decoration:underline}
.prose s,.prose strike,.prose del,s,strike,del{text-decoration:line-through;opacity:.7}
.prose mark,mark{border-radius:3px;padding:0 2px}
/* Inline code inside prose (not code blocks) */
.prose code,li code,blockquote code,.toggle-body code,.faq-a code,.step-desc code,.step-title code{
  font-family:"SF Mono","Fira Code","JetBrains Mono",monospace;
  font-size:.85em;background:#f3f3f3;color:#d63031;
  border:1px solid #e4e4e7;border-radius:4px;padding:1px 5px;
}
/* font tag colours */
font[color]{} /* browser handles it natively */

/* ── Media local hint ── */
.media-local-card{display:flex;align-items:flex-start;gap:14px;padding:14px 18px;background:#fffbeb;border:1px solid #fde68a;border-radius:var(--r12);margin:.7em 0}
.media-local-hint{font-size:.76rem;color:var(--ink4);margin-top:8px;font-style:italic}
.media-fallback{font-size:.82rem;color:var(--ink4);margin-top:6px;font-style:italic}

/* ── Audio inner layout ── */
.audio-inner{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
.audio-name{font-size:.84rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.audio-inner audio{width:100%;height:36px}

/* ── Callout ── */
.callout{display:flex;align-items:flex-start;gap:2px;background:var(--blue-l);border:1px solid #c3d9f8;border-radius:var(--r12);padding:14px 16px;margin:.9em 0;color:var(--ink2);line-height:1.6;font-size:.93rem}

/* ── Code ── */
.code-block{border-radius:var(--r16);overflow:hidden;margin:.9em 0;box-shadow:var(--sh3)}
.code-bar{background:#1c1c1e;padding:10px 16px;display:flex;align-items:center;justify-content:space-between}
.traffic{display:flex;gap:7px}
.traffic i{display:block;width:12px;height:12px;border-radius:50%;font-style:normal}
.traffic i:nth-child(1){background:#ff5f57}.traffic i:nth-child(2){background:#febc2e}.traffic i:nth-child(3){background:#28c840}
.code-lang{font-size:.7rem;color:#555;font-family:monospace;text-transform:uppercase;letter-spacing:.05em}
pre{background:#1c1c1e;color:#e2e2e2;padding:20px 22px;font-size:.85rem;line-height:1.7;overflow-x:auto;margin:0;tab-size:2}
code{font-family:"SF Mono","Fira Code","JetBrains Mono","Cascadia Code",monospace}

/* ── Dividers ── */
.rule{border:none;height:1px;background:var(--border);margin:2em 0}
.labeled-rule{display:flex;align-items:center;gap:14px;margin:1.8em 0;color:var(--ink4);font-size:.74rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase}
.labeled-rule::before,.labeled-rule::after{content:"";flex:1;height:1px;background:var(--border)}

/* ── Toggle ── */
.toggle{background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);margin:.7em 0;overflow:hidden;box-shadow:var(--sh1)}
.toggle-summary{padding:13px 17px;cursor:pointer;font-weight:600;list-style:none;display:flex;align-items:center;gap:10px;color:var(--ink);background:var(--surface2);user-select:none}
.toggle-summary::-webkit-details-marker,.toggle-summary::marker{display:none}
.toggle-summary::before{content:"▶";font-size:.6em;transition:transform .2s;opacity:.4;flex-shrink:0}
.toggle[open] .toggle-summary::before{transform:rotate(90deg)}
.toggle-body{padding:13px 17px;border-top:1px solid var(--border);color:var(--ink3);white-space:pre-wrap;font-size:.91rem;line-height:1.65}

/* ── Media blocks ── */
.img-fig{margin:.9em 0;border-radius:var(--r16);overflow:hidden;box-shadow:var(--sh2);background:var(--surface3)}
.img-fig img{width:100%}
.media-block{margin:.9em 0}
.video-embed-wrap{position:relative;width:100%;padding-bottom:56.25%;border-radius:var(--r16);overflow:hidden;box-shadow:var(--sh2);background:#000}
.video-embed-wrap iframe{position:absolute;inset:0;width:100%;height:100%}
.native-video{width:100%;border-radius:var(--r12);box-shadow:var(--sh2)}
.audio-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);margin:.7em 0;box-shadow:var(--sh1)}
.audio-card audio{flex:1;height:36px}
.media-icon{font-size:1.3em;flex-shrink:0}
.media-link-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);margin:.7em 0;box-shadow:var(--sh1)}
.media-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.media-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--ink4)}
.media-url{font-size:.84rem;color:var(--blue);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-card{display:flex;align-items:center;gap:14px;padding:14px 18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);margin:.7em 0;box-shadow:var(--sh1)}
.file-icon-lg{font-size:1.8em;flex-shrink:0}
.file-info{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.file-name{font-weight:600;font-size:.9rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-link{font-size:.82rem;color:var(--blue);font-weight:600}
.file-note{font-size:.78rem;color:var(--ink4);font-style:italic}
.local-badge{display:inline-block;font-size:.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--orange);background:#fff8ee;border:1px solid #ffd7a3;border-radius:4px;padding:1px 6px;margin-left:6px}

/* ── Bookmark ── */
.bookmark-card{display:flex;align-items:center;gap:14px;padding:15px 18px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r16);margin:.9em 0;color:inherit;box-shadow:var(--sh1);transition:box-shadow .2s,transform .15s}
.bookmark-card:hover{box-shadow:var(--sh2);transform:translateY(-1px);text-decoration:none}
.bm-body{flex:1;min-width:0}
.bm-title{font-weight:600;font-size:.92rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bm-desc{font-size:.8rem;color:var(--ink3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bm-url{font-size:.73rem;color:var(--ink4);margin-top:5px}
.bm-arrow{font-size:1.05em;color:var(--ink4);flex-shrink:0}

/* ── Equation — KaTeX will inject here ── */
.equation{background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);padding:20px 24px;margin:.9em 0;text-align:center;overflow-x:auto;box-shadow:var(--sh1)}
.eq-display{font-family:"SF Mono","Fira Code",monospace;font-size:1.05rem;color:var(--ink2);letter-spacing:.02em}
.eq-rendered{margin-top:10px;font-size:1.1rem}
.eq-rendered .katex{font-size:1.2rem}

/* ── Progress — vivid with color ── */
.progress-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r16);padding:20px 22px;margin:.9em 0;box-shadow:var(--sh1)}
.progress-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}
.progress-pct{font-size:2rem;font-weight:900;letter-spacing:-.04em;color:var(--ink);line-height:1}
.progress-status{font-size:.8rem;font-weight:600;color:var(--ink4);text-transform:uppercase;letter-spacing:.06em}
.progress-track{height:12px;background:var(--surface3);border-radius:9999px;overflow:hidden;margin-bottom:8px;border:1px solid var(--border)}
.progress-fill{height:100%;border-radius:9999px;transition:width .6s cubic-bezier(.4,0,.2,1);min-width:4px}
.progress-ticks{display:flex;justify-content:space-between;font-size:.68rem;color:var(--ink4);font-weight:600}

/* ── Rating ── */
.rating{display:flex;align-items:center;gap:3px;margin:.6em 0;font-size:1.5rem}
.star-on{color:#ff9500}.star-off{color:var(--border)}
.rating-label{font-size:.8rem;color:var(--ink4);margin-left:8px}

/* ── Countdown ── */
.countdown{text-align:center;padding:22px;background:linear-gradient(135deg,var(--blue-l),var(--white));border:1px solid #c3d9f8;border-radius:var(--r16);margin:.8em 0}
.cd-label{font-size:.72rem;font-weight:800;color:var(--blue);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px}
.cd-date{font-size:1.3rem;font-weight:800;color:var(--ink);letter-spacing:-.02em}

/* ── Tables — scroll on mobile, full on print ── */
.table-outer{margin:.9em 0;border-radius:var(--r16);border:1px solid var(--border);box-shadow:var(--sh1);overflow:hidden;background:var(--surface)}
.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
table{border-collapse:collapse;width:100%;font-size:.86rem;min-width:400px}
thead{background:var(--surface2)}
th{font-weight:700;text-align:left;color:var(--ink2);padding:11px 15px;border-bottom:2px solid var(--border);font-size:.78rem;letter-spacing:.02em;white-space:nowrap}
td{padding:10px 15px;border-bottom:1px solid var(--border2);color:var(--ink2);vertical-align:top}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:var(--surface2)}

/* ── Comparison table ── */
.cmp-table td,.cmp-table th{text-align:center}
.cmp-feature-col,.cmp-table td:first-child,.cmp-table th:first-child{text-align:left}
.cmp-hl{background:var(--blue-l)!important;color:var(--blue)}
.cmp-hlc{background:#f0f8ff}
.cmp-popular{font-size:.58rem;background:var(--blue);color:#fff;padding:2px 7px;border-radius:9999px;margin-top:4px;display:inline-block;font-weight:800;letter-spacing:.04em}
.cmp-feat{font-weight:600;color:var(--ink)}
.cmp-yes,.cmp-no,.cmp-partial{display:inline-flex;align-items:center;justify-content:center}
.cmp-text{font-size:.84rem;font-weight:600;color:var(--ink2)}
.cmp-empty{color:var(--ink4);font-size:.8rem}

/* ── Kanban ── */
.kanban{margin:.9em 0}
.kanban-scroll{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin}
.kanban-col{flex:0 0 190px;background:var(--surface2);border-radius:var(--r16);padding:14px;border:1px solid var(--border)}
.kanban-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.kanban-title{font-weight:800;font-size:.74rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ink3)}
.kanban-badge{background:var(--surface);border:1px solid var(--border);border-radius:9999px;padding:1px 8px;font-size:.72rem;font-weight:700;color:var(--ink4)}
.kanban-card{background:var(--surface);border-radius:var(--r8);padding:10px 12px;margin-bottom:8px;box-shadow:var(--sh1);font-size:.86rem;line-height:1.5;border:1px solid var(--border2);color:var(--ink2)}
.kanban-card:empty{display:none}

/* ── Timeline ── */
.timeline{margin:.9em 0;padding:4px 0}
.tl-row{display:grid;grid-template-columns:40px 1fr;gap:0 16px;position:relative}
.tl-side{display:flex;flex-direction:column;align-items:center}
.tl-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;border:2.5px solid #fff;margin-top:3px;z-index:1;position:relative}
.tl-line{width:2px;flex:1;min-height:24px;margin-top:4px;background:var(--border);border-radius:1px}
.tl-row:last-child .tl-line{display:none}
.tl-content{padding-bottom:22px}
.tl-date{font-size:.72rem;font-weight:800;color:var(--ink4);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;margin-top:2px}
.tl-title{font-weight:700;font-size:.93rem;color:var(--ink);line-height:1.3}
.tl-desc{font-size:.84rem;color:var(--ink3);margin-top:4px;line-height:1.5}

/* ── Gallery ── */
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(185px,1fr));gap:10px;margin:.9em 0}
.gal-item{border-radius:var(--r12);overflow:hidden;box-shadow:var(--sh1);margin:0;background:var(--surface3)}
.gal-item img{width:100%;aspect-ratio:4/3;object-fit:cover}
.gal-item figcaption{padding:7px 10px;font-size:.74rem;color:var(--ink3);background:var(--surface2)}
/* Local image placeholder inside gallery */
.gal-local{background:#fffbeb;border:1px dashed #fde68a}
.gal-local-inner{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:20px 12px;min-height:110px}
.gal-local-icon{font-size:1.8em}
.gal-local-name{font-size:.76rem;font-weight:600;color:var(--ink3);text-align:center;word-break:break-all}
.gal-local-note{font-size:.68rem;color:#b45309;font-style:italic}
/* Local placeholder inside image-text */
.it-img-local{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px 16px;background:#fffbeb;border:1px dashed #fde68a;border-radius:var(--r16);flex:0 0 42%;text-align:center}

/* ── Mindmap SVG ── */
.mindmap-wrap{background:var(--surface);border:1px solid var(--border);border-radius:var(--r16);padding:16px;margin:.9em 0;overflow:auto;box-shadow:var(--sh1)}
.mindmap-svg{width:100%;height:auto;display:block;overflow:visible}
.mindmap-empty{padding:32px;text-align:center;color:var(--ink4);font-style:italic;background:var(--surface2);border-radius:var(--r12);margin:.9em 0}

/* ── Flashcards ── */
.flashcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin:.9em 0}
.fc-card{padding:20px 16px;border-radius:var(--r16);box-shadow:var(--sh1);position:relative;min-height:90px;background:color-mix(in srgb,var(--fc) 12%,#fff);border:2px solid color-mix(in srgb,var(--fc) 30%,#fff)}
.fc-num{font-size:.68rem;font-weight:800;color:var(--fc);opacity:.6;position:absolute;top:11px;right:13px}
.fc-text{font-size:.88rem;line-height:1.55;color:var(--ink2);margin-top:8px}

/* ── Tabs — screen UI ── */
.tabs-block{border:1px solid var(--border);border-radius:var(--r16);overflow:hidden;margin:.9em 0;box-shadow:var(--sh1);background:var(--surface)}
.tabs-nav{display:flex;background:var(--surface2);border-bottom:1px solid var(--border);overflow-x:auto;scrollbar-width:none}
.tabs-nav::-webkit-scrollbar{display:none}
.tab-btn{padding:11px 20px;border:none;background:none;cursor:pointer;font-size:.84rem;font-weight:600;font-family:inherit;color:var(--ink3);border-bottom:2.5px solid transparent;white-space:nowrap;transition:all .16s;letter-spacing:-.01em}
.tab-btn:hover{color:var(--ink);background:var(--surface3)}
.tab-btn.active{color:var(--blue);border-bottom-color:var(--blue);background:var(--surface)}
.tabs-content{}.tab-panel{display:none;padding:20px 22px}.tab-panel.active{display:block}

/* ── Tabs — print layout (all panels shown as labelled sections) ── */
.tabs-print{margin:.9em 0}
.tab-print-section{margin-bottom:18px;border:1px solid var(--border);border-radius:var(--r12);overflow:hidden;background:var(--surface);break-inside:avoid}
.tab-print-label{padding:9px 16px;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);background:var(--blue-l);border-bottom:1px solid #c3d9f8}
.tab-print-section>*:not(.tab-print-label){padding:14px 18px}

/* ── Chart card ── */
.chart-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r20);padding:24px;margin:.9em 0;box-shadow:var(--sh1)}
.chart-title{font-weight:700;font-size:1rem;color:var(--ink);letter-spacing:-.015em;margin-bottom:4px}
.chart-badge{display:inline-block;font-size:.66rem;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--ink4);background:var(--surface3);border:1px solid var(--border);border-radius:9999px;padding:2px 10px;margin-bottom:16px}
/* Canvas MUST have explicit height for Chart.js to render */
.chart-canvas-wrap{position:relative;width:100%;height:300px}
.chart-canvas-wrap canvas{position:absolute;inset:0;width:100%!important;height:100%!important}
.chart-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:40px;color:var(--ink4);background:var(--surface2);border:1.5px dashed var(--border);border-radius:var(--r16);margin:.9em 0;text-align:center}
.chart-empty-icon{font-size:2.5em}
.chart-empty p{font-size:.88rem;color:var(--ink4)}

/* ── SWOT ── */
.swot{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:.9em 0}
.swot-cell{background:var(--surface);border:1px solid var(--border);border-top:3px solid var(--sc,#6366f1);border-radius:0 0 var(--r12) var(--r12);padding:16px;box-shadow:var(--sh1)}
.swot-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}
.swot-head span:last-child{font-weight:800;font-size:.76rem;text-transform:uppercase;letter-spacing:.09em;color:var(--ink2)}
.swot-cell ul{padding-left:1em;font-size:.86rem;color:var(--ink3);line-height:1.6}
.swot-cell li{margin:.2em 0}
.swot-empty{color:var(--ink4);font-style:italic;list-style:none!important;padding-left:0!important}

/* ── Steps ── */
.steps{margin:.9em 0}
.step{display:flex;gap:14px;align-items:flex-start;padding:12px 0}
.step+.step{border-top:1px solid var(--border2)}
.step-circle{flex-shrink:0;width:32px;height:32px;border-radius:50%;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:800;box-shadow:0 3px 10px rgba(0,113,227,.28);margin-top:1px}
.step-circle svg{width:14px;height:14px}
.step-done .step-circle{background:var(--green);box-shadow:0 3px 10px rgba(52,199,89,.28)}
.step-done .step-title{text-decoration:line-through;color:var(--ink4)}
.step-body{min-width:0}
.step-title{font-weight:700;font-size:.92rem;color:var(--ink);line-height:1.35}
.step-desc{font-size:.84rem;color:var(--ink3);margin-top:3px;line-height:1.5}

/* ── FAQ ── */
.faq{margin:.9em 0}
.faq-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--r12);margin-bottom:8px;overflow:hidden;box-shadow:var(--sh1);transition:box-shadow .15s}
.faq-item[open]{box-shadow:var(--sh2)}
.faq-q{padding:14px 18px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;font-size:.91rem;color:var(--ink);gap:12px;user-select:none}
.faq-q::-webkit-details-marker,.faq-q::marker{display:none}
.faq-icon{width:20px;height:20px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.75rem;color:var(--ink3);transition:transform .2s,background .15s}
.faq-item[open] .faq-icon{background:var(--blue-l);color:var(--blue);transform:rotate(45deg)}
.faq-icon::before{content:"＋"}
.faq-a{padding:13px 18px;border-top:1px solid var(--border);background:var(--surface2);font-size:.88rem;color:var(--ink3);line-height:1.65;white-space:pre-wrap}

/* ── Image+text ── */
.image-text{display:flex;gap:22px;align-items:flex-start;margin:.9em 0}
.it-img{flex:0 0 42%;border-radius:var(--r16);overflow:hidden;box-shadow:var(--sh2)}
.it-img img{width:100%}
.it-body{flex:1;min-width:0}
.it-title{font-size:1.05rem;font-weight:700;color:var(--ink);margin-bottom:8px;margin-top:0}
.it-desc{font-size:.88rem;color:var(--ink3);line-height:1.65}

/* ── Columns layout ── */
.col-layout{display:grid;gap:18px;margin:.9em 0}
.col-cell{min-width:0}
.col-heading{font-weight:800;font-size:.72rem;text-transform:uppercase;letter-spacing:.1em;color:var(--ink4);margin-bottom:10px;padding-bottom:7px;border-bottom:2px solid var(--border)}

/* ── Tags ── */
.tags-row{margin-top:48px;padding-top:18px;border-top:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.tags-lbl{font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--ink4);margin-right:4px}
.tag-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:9999px;font-size:.74rem;font-weight:700;color:#fff;letter-spacing:.01em}

/* ── Footer ── */
.page-footer{margin-top:56px;padding-top:18px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-size:.77rem;color:var(--ink4)}

/* ── Print styles ── */
@media print{
  .topbar{display:none!important}
  body{padding-top:0;background:#fff}
  .page{max-width:100%;padding:0 0 20px}
  /* CRITICAL: tables must show ALL columns when printing */
  .table-outer{overflow:visible;border:1px solid #ddd;border-radius:4px}
  .table-scroll{overflow:visible}
  table{min-width:unset;width:100%}
  th,td{white-space:normal}
  /* Toggle — force open in print */
  .toggle{border:1px solid #e4e4e7}
  .toggle-summary::before{content:"▼"!important;transform:rotate(0)!important}
  .toggle-body{display:block!important}
  /* FAQ — force open in print (already has open attr, belt+suspenders) */
  .faq-a{display:block!important}
  .faq-icon::before{content:"−"!important}
  /* Charts keep their height */
  .chart-card{break-inside:avoid}
  .chart-canvas-wrap{height:260px}
  /* Other break rules */
  .step,.swot-cell,.faq-item,.tl-row,.kanban-col,.tab-print-section{break-inside:avoid}
  h1,h2,h3,.h1,.h2,.h3,.rule{break-after:avoid}
  .kanban-scroll{flex-wrap:wrap}
  /* Color accuracy */
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{size:A4;margin:18mm 16mm}
}

/* ── Responsive ── */
@media(max-width:700px){
  .topbar{padding:0 14px}
  .page{padding:28px 14px 56px}
  .page-title{font-size:2rem}
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
    .topbar{display:none!important}
    body{padding-top:0!important;background:#fff!important}
    .page{max-width:100%!important;padding:0 0 20px!important}
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
    .tab-panel{display:block!important;border-top:1px solid #e4e4e7;padding:14px 0!important}
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
<header class="topbar">
  <span class="topbar-title">${esc(note.title)}</span>
  <div class="topbar-btns">
    <button class="btn btn-ghost" onclick="window.print()">🖨 Print</button>
    <button class="btn btn-blue" id="print-btn">Save as PDF</button>
  </div>
</header>`;

  let finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${esc(note.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${hasCharts ? `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" crossorigin="anonymous"><\/script>` : ""}
  <script>window.__CHARTS=${chartsJson};<\/script>
  <style>${CSS}${pdfOverride}</style>
</head>
<body>
${topbar}
<main class="page">
  <div class="page-eyebrow">Note</div>
  <h1 class="page-title">${esc(note.title)}</h1>
  <div class="page-meta">
    ${created?`<span>📅 ${created}</span>`:""}
    ${updated?`<span>✏️ Updated ${updated}</span>`:""}
    ${note.tags.length?note.tags.map(t=>`<span><span class="meta-dot" style="background:${esc(toHex(t.color,"#6366f1"))}"></span>${esc(t.label)}</span>`).join(""):""}
  </div>
  <article class="article">
${body}
  </article>
  ${tagsHtml}
  <footer class="page-footer">
    <span>Exported from Notes</span>
    <span>${new Date().toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"})}</span>
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