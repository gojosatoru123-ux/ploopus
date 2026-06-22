"use client"
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  KeyRound,
  Wand2,
  BookOpen,
  Layers as LayersIcon,
  HelpCircle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageSquare,
  Zap,
  Lock,
} from "lucide-react";
import { Note, NoteBlock } from "@/lib/types";
import { noteToMarkdown } from "@/lib/noteToMarkdown";
import {
  AI_PROVIDERS,
  AiProviderId,
  callAi,
  extractJson,
  loadKeys,
  saveKey,
  loadOllamaConfig,
  saveOllamaConfig,
  OllamaConfig,
} from "@/lib/aiProviders";
import ApiKeyManagerModal from "./ApiKeyManagerModal";
import { Settings2, Server, Cloud, Cpu } from "lucide-react";
import { toast } from "sonner";

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
  onAppendBlocks: (blocks: NoteBlock[]) => void;
}

type Mode = "external" | "byok";
type Task = "summary" | "flashcards" | "quiz";

const TASKS: { id: Task; label: string; icon: typeof BookOpen }[] = [
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "flashcards", label: "Flashcards", icon: LayersIcon },
  { id: "quiz", label: "Quiz", icon: HelpCircle },
];

const SYSTEM_PROMPTS: Record<Task, string> = {
  summary:
    "You are a precise study assistant. Read the provided note (in Markdown) and produce a concise, well-structured summary in Markdown. Use short paragraphs and bullet points. No preamble.",
  flashcards:
    'You are a precise study assistant. Read the provided note (in Markdown) and produce 8-15 high-quality flashcards. Respond ONLY with a JSON array of objects of the form {"question": string, "answer": string}. No prose, no markdown fences.',
  quiz:
    'You are a precise study assistant. Read the provided note (in Markdown) and produce 6-12 quiz questions in FAQ form. Respond ONLY with a JSON array of objects of the form {"question": string, "answer": string}. No prose, no markdown fences.',
};

const DEFAULT_USER_PROMPT = "Be accurate, concise, and helpful.";

const providerMeta: Record<AiProviderId, { icon: React.ReactNode; color: string; activeColor: string }> = {
  openai: { icon: <span className="text-emerald-500 text-lg">✦</span>, color: "border-emerald-500/20 hover:border-emerald-500/40", activeColor: "border-emerald-500 bg-emerald-500/5" },
  gemini: { icon: <span className="text-sky-500 text-lg">✺</span>, color: "border-sky-500/20 hover:border-sky-500/40", activeColor: "border-sky-500 bg-sky-500/5" },
  anthropic: { icon: <span className="text-orange-500 text-lg">✶</span>, color: "border-orange-500/20 hover:border-orange-500/40", activeColor: "border-orange-500 bg-orange-500/5" },
  deepseek: { icon: <span className="text-blue-500 text-lg">◈</span>, color: "border-blue-500/20 hover:border-blue-500/40", activeColor: "border-blue-500 bg-blue-500/5" },
  groq: { icon: <span className="text-rose-500 text-lg">⚡</span>, color: "border-rose-500/20 hover:border-rose-500/40", activeColor: "border-rose-500 bg-rose-500/5" },
  xai: { icon: <span className="text-zinc-400 text-lg">𝕏</span>, color: "border-zinc-500/20 hover:border-zinc-500/40", activeColor: "border-zinc-500 bg-zinc-500/5" },
  ollama: { icon: <Cpu className="w-4 h-4 text-stone-500" />, color: "border-stone-500/20 hover:border-stone-500/40", activeColor: "border-stone-500 bg-stone-500/5" },
  "ollama-cloud": { icon: <Cloud className="w-4 h-4 text-violet-500" />, color: "border-violet-500/20 hover:border-violet-500/40", activeColor: "border-violet-500 bg-violet-500/5" },
};

const AiAssistantModal = ({ isOpen, onClose, note, onAppendBlocks }: AiAssistantModalProps) => {
  const [mode, setMode] = useState<Mode>("external");
  const [prompt, setPrompt] = useState(DEFAULT_USER_PROMPT);
  const [copied, setCopied] = useState<"all" | "md" | null>(null);

  // BYOK state
  const [keys, setKeys] = useState<Record<AiProviderId, string>>({} as any);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>("gemini");
  const [showKey, setShowKey] = useState(false);
  const [task, setTask] = useState<Task>("summary");
  const [running, setRunning] = useState(false);
  const [showKeyManager, setShowKeyManager] = useState(false);

  useEffect(() => {
    if (isOpen && !showKeyManager) setKeys(loadKeys());
  }, [isOpen, showKeyManager]);

  const markdown = useMemo(() => noteToMarkdown(note), [note]);
  const combined = useMemo(
    () => `${prompt}\n\n---\n\n${markdown}`,
    [prompt, markdown],
  );

  const copyToClipboard = async (value: string, kind: "all" | "md") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      toast("Copy failed", { description: "Clipboard access denied." });
    }
  };

  const openProvider = async (url: string) => {
    await copyToClipboard(combined, "all");
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSaveKey = (provider: AiProviderId, key: string) => {
    saveKey(provider, key.trim());
    setKeys((k) => ({ ...k, [provider]: key.trim() }));
  };

  const handleRun = async () => {
    const apiKey = keys[selectedProvider] || "";
    const p = AI_PROVIDERS.find((x) => x.id === selectedProvider)!;
    if (p.requiresKey !== false && !apiKey) {
      toast("Add an API key", { description: "Paste a key for the selected provider first." });
      return;
    }
    setRunning(true);
    try {
      const raw = await callAi(
        selectedProvider,
        apiKey,
        SYSTEM_PROMPTS[task],
        `${prompt}\n\n--- NOTE START ---\n${markdown}\n--- NOTE END ---`,
      );

      const newBlocks: NoteBlock[] = [];
      newBlocks.push({ id: crypto.randomUUID(), type: "divider", content: "" });
      newBlocks.push({
        id: crypto.randomUUID(),
        type: "heading2",
        content:
          task === "summary"
            ? "✨ AI Summary"
            : task === "flashcards"
              ? "✨ AI Flashcards"
              : "✨ AI Quiz",
      });

      if (task === "summary") {
        newBlocks.push({ id: crypto.randomUUID(), type: "callout", content: raw.trim() });
      } else if (task === "flashcards") {
        const items = extractJson(raw) as { question: string; answer: string }[];
        newBlocks.push({
          id: crypto.randomUUID(),
          type: "flashcard",
          content: "AI Flashcards",
          flashcards: items.map((it) => ({
            id: crypto.randomUUID(),
            content: `Q: ${it.question}\nA: ${it.answer}`,
            color: ["yellow", "blue", "pink", "green", "purple"][Math.floor(Math.random() * 5)],
          })),
        });
      } else {
        const items = extractJson(raw) as { question: string; answer: string }[];
        newBlocks.push({
          id: crypto.randomUUID(),
          type: "faq",
          content: "AI Quiz",
          faqItems: items.map((it) => ({ id: crypto.randomUUID(), question: it.question, answer: it.answer })),
        });
      }

      onAppendBlocks(newBlocks);
      toast("Added to note", { description: "AI content appended at the end." });
      onClose();
    } catch (err: any) {
      console.error(err);
      toast("Generation failed", { description: err?.message?.slice(0, 200) || "Something went wrong." });
    } finally {
      setRunning(false);
    }
  };

  const activeKey = keys[selectedProvider] || "";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-xl max-h-[90vh] bg-card border border-border/50 rounded-[28px] shadow-2xl shadow-black/10 overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[14px] bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/15">
                    <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight">AI Assistant</h2>
                    <p className="text-[11px] text-muted-foreground">Your note stays on your device.</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode Switch */}
              <div className="px-6 pt-4 shrink-0">
                <div className="inline-flex p-1 bg-muted/60 rounded-xl">
                  {(
                    [
                      { id: "external" as Mode, label: "Copy & Open", icon: ExternalLink },
                      { id: "byok" as Mode, label: "Your Key", icon: KeyRound },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setMode(opt.id)}
                      className={`relative flex items-center gap-2 px-4 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${mode === opt.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {mode === opt.id && (
                        <motion.div
                          layoutId="ai-mode-pill"
                          className="absolute inset-0 bg-card border border-border/60 rounded-lg shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <opt.icon className="w-3.5 h-3.5 relative" />
                      <span className="relative">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin min-h-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                  >
                    {mode === "external" ? (
                      <ExternalMode
                        prompt={prompt}
                        setPrompt={setPrompt}
                        markdown={markdown}
                        combined={combined}
                        copied={copied}
                        onCopy={copyToClipboard}
                        onOpenProvider={openProvider}
                      />
                    ) : (
                      <ByokMode
                        keys={keys}
                        activeKey={activeKey}
                        showKey={showKey}
                        setShowKey={setShowKey}
                        selectedProvider={selectedProvider}
                        setSelectedProvider={setSelectedProvider}
                        onSaveKey={handleSaveKey}
                        prompt={prompt}
                        setPrompt={setPrompt}
                        task={task}
                        setTask={setTask}
                        running={running}
                        onRun={handleRun}
                        onOpenManager={() => setShowKeyManager(true)}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
          <ApiKeyManagerModal isOpen={showKeyManager} onClose={() => setShowKeyManager(false)} />
        </>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------ External mode ----------------------------- */

const ExternalMode = ({
  prompt,
  setPrompt,
  markdown,
  combined,
  copied,
  onCopy,
  onOpenProvider,
}: {
  prompt: string;
  setPrompt: (v: string) => void;
  markdown: string;
  combined: string;
  copied: "all" | "md" | null;
  onCopy: (value: string, kind: "all" | "md") => void;
  onOpenProvider: (url: string) => void;
}) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">Prompt</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 rounded-2xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-sm resize-none transition-all placeholder:text-muted-foreground/40"
          placeholder="Tell the AI what to do…"
        />
      </div>

      {/* Markdown Preview (collapsible) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="text-[11px] font-medium uppercase tracking-wider">Note content</span>
            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <div className="flex items-center gap-1.5">
            <CopyButton
              copied={copied === "md"}
              onClick={() => onCopy(markdown, "md")}
              label="Markdown"
            />
            <CopyButton
              copied={copied === "all"}
              onClick={() => onCopy(combined, "all")}
              label="All"
              primary
            />
          </div>
        </div>
        <AnimatePresence>
          {showPreview && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 rounded-2xl bg-muted/30 border border-border/30 text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto scrollbar-thin">
                {markdown || "Empty note."}
              </div>
            </motion.pre>
          )}
        </AnimatePresence>
      </div>

      {/* Providers */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">Open in</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {AI_PROVIDERS.filter((p) => p.id !== "ollama" && p.id !== "ollama-cloud").map((p) => {
            const meta = providerMeta[p.id];
            return (
              <button
                key={p.id}
                onClick={() => onOpenProvider(p.webUrl)}
                className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${meta.color}`}
              >
                {meta.icon}
                <span className="text-[12px] font-medium">{p.name}</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground/50 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------- BYOK mode ------------------------------- */

const ByokMode = ({
  keys,
  activeKey,
  showKey,
  setShowKey,
  selectedProvider,
  setSelectedProvider,
  onSaveKey,
  prompt,
  setPrompt,
  task,
  setTask,
  running,
  onRun,
  onOpenManager,
}: {
  keys: Record<AiProviderId, string>;
  activeKey: string;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  selectedProvider: AiProviderId;
  setSelectedProvider: (p: AiProviderId) => void;
  onSaveKey: (p: AiProviderId, k: string) => void;
  prompt: string;
  setPrompt: (v: string) => void;
  task: Task;
  setTask: (t: Task) => void;
  running: boolean;
  onRun: () => void;
  onOpenManager: () => void;
}) => {
  const [draft, setDraft] = useState(activeKey);
  const provider = AI_PROVIDERS.find((p) => p.id === selectedProvider)!;
  const isOllama = selectedProvider === "ollama" || selectedProvider === "ollama-cloud";
  const requiresKey = provider.requiresKey !== false;
  const hasKey = !!activeKey;
  const canRun = requiresKey ? hasKey : true;

  const [ollamaCfg, setOllamaCfg] = useState<OllamaConfig>(() => loadOllamaConfig());
  const updateOllama = (patch: Partial<OllamaConfig>) => {
    const next = { ...ollamaCfg, ...patch };
    setOllamaCfg(next);
    saveOllamaConfig(next);
  };

  useEffect(() => setDraft(activeKey), [activeKey, selectedProvider]);

  return (
    <div className="space-y-4">
      {/* Provider picker */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Zap className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">Provider</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {AI_PROVIDERS.map((p) => {
            const meta = providerMeta[p.id];
            const active = selectedProvider === p.id;
            const saved = !!keys[p.id] || (p.id === "ollama");
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`relative flex flex-col items-center gap-1 rounded-xl border p-2.5 transition-all hover:scale-[1.02] active:scale-[0.98] ${active ? meta.activeColor : meta.color
                  }`}
              >
                {meta.icon}
                <span className="text-[10.5px] font-medium leading-tight text-center">{p.name}</span>
                {saved && p.id !== "ollama" && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* API Key / Ollama config */}
      {selectedProvider === "ollama" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Server className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Local Ollama</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-medium">100% offline</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={ollamaCfg.localBaseUrl}
              onChange={(e) => updateOllama({ localBaseUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="px-3 py-2 rounded-xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-[12px] font-mono"
            />
            <input
              value={ollamaCfg.localModel}
              onChange={(e) => updateOllama({ localModel: e.target.value })}
              placeholder="llama3.2"
              className="px-3 py-2 rounded-xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-[12px] font-mono"
            />
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Install Ollama and run <code className="px-1 rounded bg-muted">ollama pull {ollamaCfg.localModel}</code>.
            For browser access set <code className="px-1 rounded bg-muted">OLLAMA_ORIGINS=*</code> before starting it.
          </p>
        </div>
      ) : selectedProvider === "ollama-cloud" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Cloud className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wider">Ollama Cloud</span>
            </div>
            <button
              onClick={onOpenManager}
              className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
            >
              <Settings2 className="w-3 h-3" /> Manage
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? "text" : "password"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onSaveKey(selectedProvider, draft)}
                placeholder="Paste your Ollama Cloud key"
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-sm font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
                type="button"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {activeKey && (
              <button
                onClick={() => { onSaveKey(selectedProvider, ""); setDraft(""); }}
                className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          <input
            value={ollamaCfg.cloudModel}
            onChange={(e) => updateOllama({ cloudModel: e.target.value })}
            placeholder="gpt-oss:120b"
            className="w-full px-3 py-2 rounded-xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-[12px] font-mono"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-[11px] font-medium uppercase tracking-wider">{provider.name} Key</span>
            </div>
            <button
              onClick={onOpenManager}
              className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
            >
              <Settings2 className="w-3 h-3" /> Manage all keys
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? "text" : "password"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onSaveKey(selectedProvider, draft)}
                placeholder={provider.keyHint}
                className="w-full pl-3 pr-10 py-2 rounded-xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-sm font-mono"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
                type="button"
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {activeKey && (
              <button
                onClick={() => { onSaveKey(selectedProvider, ""); setDraft(""); }}
                className="p-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Task picker */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Wand2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">Generate</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TASKS.map((t) => {
            const Icon = t.icon;
            const active = task === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTask(t.id)}
                className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition-all hover:scale-[1.02] active:scale-[0.98] ${active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/60 hover:border-border/80 hover:bg-muted/30"
                  }`}
              >
                <Icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-[12px] font-medium">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Extra prompt */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium uppercase tracking-wider">Instructions</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 rounded-2xl bg-muted/40 border border-border/60 focus:border-primary/50 focus:outline-none text-sm resize-none transition-all placeholder:text-muted-foreground/40"
          placeholder="Optional instructions…"
        />
      </div>

      {/* Run */}
      <motion.button
        onClick={onRun}
        disabled={running || !canRun}
        whileHover={!running && canRun ? { scale: 1.01 } : {}}
        whileTap={!running && canRun ? { scale: 0.99 } : {}}
        className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground font-medium shadow-lg shadow-primary/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {running ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating…
          </>
        ) : (
          <>
            <Wand2 className="w-4 h-4" />
            Generate & append
          </>
        )}
      </motion.button>
      <p className="text-[10px] text-center text-muted-foreground/40">
        Direct from browser to {provider.name}. No servers involved.
      </p>
    </div>
  );
};

/* -------------------------------- Helpers -------------------------------- */

function CopyButton({
  copied,
  onClick,
  label,
  primary,
}: {
  copied: boolean;
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${primary
          ? copied
            ? "bg-emerald-500 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
          : copied
            ? "bg-emerald-500/10 text-emerald-600"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        }`}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default AiAssistantModal;