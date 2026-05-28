export interface FlashcardItem {
  id: string;
  content: string;
  color: string;
}

export interface NoteBlock {
  id: string;
  type: 
    | "text" | "heading1" | "heading2" | "heading3" 
    | "bullet" | "numbered" | "todo" | "quote" | "divider" 
    | "code" | "callout" | "table" | "toggle" 
    | "image" | "bookmark" | "equation" | "progress" | "video" | "columns"
    // New block types
    | "file" | "audio" | "timeline" | "kanban" | "rating" | "embed" | "mindmap" | "gallery"
    // Flashcard block type
    | "flashcard"
    // Tabs block type
    | "tabs"
    // Chart block type
    | "chart"
    // New creative blocks
    | "swot"
    // Layout & formatting blocks
    | "steps" | "labeledDivider" | "faq"
    // New premium blocks
    | "comparisonTable" | "imageText";
  content: string;
  checked?: boolean;
  tableData?: string[][];
  cellFormattingMap?: Record<string, { bold?: boolean; italic?: boolean; color?: string; bgColor?: string }>;
  isExpanded?: boolean; // for toggle blocks
  toggleContent?: string; // editable content inside toggle
  imageUrl?: string; // for image blocks
  bookmarkUrl?: string; // for bookmark blocks
  bookmarkTitle?: string;
  bookmarkDescription?: string;
  progressValue?: number; // for progress blocks (0-100)
  progressColor?: string;
  videoUrl?: string; // for video embeds
  columns?: NoteBlock[][]; // for column layout
  columnTitles?: string[]; // editable column headings
  // New properties
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  audioUrl?: string;
  timelineItems?: { id: string; title: string; description: string; date: string; color: string }[];
  kanbanColumns?: { id: string; title: string; cards: { id: string; content: string }[] }[];
  ratingValue?: number;
  ratingMax?: number;
  embedUrl?: string;
  embedType?: "spotify" | "twitter" | "figma" | "codepen" | "generic";
  mermaidCode?: string;
  galleryImages?: { id: string; url: string; caption?: string }[];
  // Mind map data
  mindMapNodes?: { 
    id: string; 
    text: string; 
    x: number; 
    y: number; 
    color: string; 
    shape?: 'rectangle' | 'diamond' | 'oval';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
  }[];
  mindMapConnections?: { id: string; from: string; to: string }[];
  // Tabs data
  tabsData?: { id: string; label: string; content: string; blocks?: NoteBlock[] }[];
  // Flashcard data
  flashcards?: FlashcardItem[];
  // Chart data
  chartType?: "bar" | "line" | "pie" | "area" | "donut" | "scatter" | "radar" | "stackedBar" | "horizontalBar" | "combo";
  chartTitle?: string;
  chartColumns?: { id: string; key: string; type: "text" | "number" }[];
  chartRows?: { id: string; cells: { [key: string]: string | number } }[];
  chartXAxisKey?: string;
  chartSelectedSeries?: string[];
  chartSeriesColors?: { [key: string]: string };
  linkedTableId?: string; // For charts linked to table data
  indentLevel?: number; // For nested lists (0-3)
  // Legacy support
  chartData?: { id: string; label: string; value: number; color: string }[];
  // SWOT data
  swotStrengths?: string[];
  swotWeaknesses?: string[];
  swotOpportunities?: string[];
  swotThreats?: string[];
  // Steps block
  stepsItems?: { id: string; title: string; description: string; completed: boolean }[];
  // Labeled Divider
  dividerLabel?: string;
  dividerStyle?: string;
  // FAQ block
  faqItems?: { id: string; question: string; answer: string }[];
  // Image-Text Split
  imageTextUrl?: string;
  imageTextTitle?: string;
  imageTextDescription?: string;
  imageTextLayout?: "imageLeft" | "imageRight";
  // Comparison Table
  comparisonColumns?: { id: string; name: string; highlighted?: boolean }[];
  comparisonRows?: { id: string; feature: string; values: Record<string, "yes" | "no" | "partial" | string> }[];
}

export interface Note {
  id: string;
  title: string;
  blocks: NoteBlock[];
  tags: { id: string; label: string; color: string }[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface NoteIndex {
  id: string;
  title: string;
  tags: { id: string; label: string; color: string }[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  isPinned?: boolean;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // ISO date string
  time?: string; // HH:mm format
  color: string;
  description?: string;
  createdAt: string;
}

export interface FlashcardDeck {
  id: string;
  name: string;
  cards: FlashcardItem[];
  createdAt: string;
}