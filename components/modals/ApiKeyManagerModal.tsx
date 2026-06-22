"use client"
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, KeyRound, Eye, EyeOff, Trash2, Check, AlertCircle,
    Loader2, ShieldCheck, Save, ShieldAlert, HelpCircle, ExternalLink, CreditCard, Sparkles,
} from "lucide-react";
import {
    AI_PROVIDERS, AiProviderId, loadKeys, saveKey, clearAllKeys,
    maskKey, looksValidKey, validateKey,
    loadOllamaConfig, saveOllamaConfig, OllamaConfig,
} from "@/lib/aiProviders";
import { toast } from "sonner";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

type Status = "idle" | "checking" | "valid" | "invalid";

const providerDot: Record<AiProviderId, string> = {
    openai: "bg-emerald-500",
    gemini: "bg-sky-500",
    anthropic: "bg-orange-500",
    deepseek: "bg-blue-500",
    groq: "bg-rose-500",
    xai: "bg-zinc-400",
    ollama: "bg-stone-500",
    "ollama-cloud": "bg-violet-500",
};

interface KeyGuide {
    consoleUrl: string;
    signupUrl: string;
    steps: string[];
    pricing: string;
    freeTier?: string;
    tip?: string;
}

const KEY_GUIDES: Record<AiProviderId, KeyGuide> = {
    openai: {
        consoleUrl: "https://platform.openai.com/api-keys",
        signupUrl: "https://platform.openai.com/signup",
        steps: [
            "Sign in (or sign up) at platform.openai.com",
            "Open the API keys page from your profile menu",
            "Click ‘Create new secret key’, name it and copy it once",
            "Add billing under Settings → Billing to enable requests",
        ],
        pricing: "Pay-as-you-go · ~$0.15 / 1M input tokens (gpt-4o-mini)",
        tip: "The key is shown only once. Paste it here right after creating it.",
    },
    gemini: {
        consoleUrl: "https://aistudio.google.com/apikey",
        signupUrl: "https://aistudio.google.com/",
        steps: [
            "Open Google AI Studio with your Google account",
            "Click ‘Get API key’ in the left sidebar",
            "Press ‘Create API key’ and pick a project",
            "Copy the key starting with AIza…",
        ],
        pricing: "Free tier available · Paid plans on Google Cloud",
        freeTier: "Generous free quota for personal use",
    },
    anthropic: {
        consoleUrl: "https://console.anthropic.com/settings/keys",
        signupUrl: "https://console.anthropic.com/",
        steps: [
            "Sign in at console.anthropic.com",
            "Go to Settings → API Keys",
            "Click ‘Create Key’, name it and copy it",
            "Add credit under Plans & Billing to start using it",
        ],
        pricing: "Pay-as-you-go · ~$0.80 / 1M input tokens (Haiku)",
        tip: "Browser calls need direct-access enabled — already handled by this app.",
    },
    deepseek: {
        consoleUrl: "https://platform.deepseek.com/api_keys",
        signupUrl: "https://platform.deepseek.com/",
        steps: [
            "Sign up at platform.deepseek.com",
            "Open API Keys from the left sidebar",
            "Click ‘Create new API key’ and copy it",
            "Top up a small balance under Billing",
        ],
        pricing: "Very low cost · ~$0.14 / 1M input tokens",
        tip: "One of the cheapest providers for long notes.",
    },
    groq: {
        consoleUrl: "https://console.groq.com/keys",
        signupUrl: "https://console.groq.com/",
        steps: [
            "Sign in at console.groq.com (Google or GitHub works)",
            "Open the API Keys page",
            "Click ‘Create API Key’, name it and copy it",
            "No billing required to start — free tier is generous",
        ],
        pricing: "Free tier · Pay-as-you-go for higher limits",
        freeTier: "Fastest free option — great for quick summaries",
    },
    xai: {
        consoleUrl: "https://console.x.ai/",
        signupUrl: "https://console.x.ai/",
        steps: [
            "Sign in at console.x.ai with your X account",
            "Open API Keys in the left sidebar",
            "Click ‘Create API Key’ and copy the xai-… token",
            "Add credit under Billing to enable requests",
        ],
        pricing: "Pay-as-you-go · Credits required",
    },
    ollama: {
        consoleUrl: "https://ollama.com/download",
        signupUrl: "https://ollama.com/",
        steps: [
            "Install Ollama from ollama.com/download",
            "Pull a model — e.g. `ollama pull llama3.2`",
            "Start with `OLLAMA_ORIGINS=* ollama serve` so the browser can reach it",
            "Open the AI Assistant and pick ‘Ollama Local’ — no key needed",
        ],
        pricing: "Free · Runs on your machine",
        freeTier: "100% offline · private by default",
        tip: "Use any model you've pulled. Set the model name in the AI Assistant panel.",
    },
    "ollama-cloud": {
        consoleUrl: "https://ollama.com/settings/keys",
        signupUrl: "https://ollama.com/signup",
        steps: [
            "Sign up at ollama.com and subscribe to Cloud",
            "Open Settings → API Keys",
            "Create a new key and copy it",
            "Paste it here — the model defaults to gpt-oss:120b",
        ],
        pricing: "Subscription · Hosted GPUs",
        tip: "Run massive open-source models without local hardware.",
    },
};

const ApiKeyManagerModal = ({ isOpen, onClose }: Props) => {
    const [keys, setKeys] = useState<Record<AiProviderId, string>>({} as any);
    const [drafts, setDrafts] = useState<Record<AiProviderId, string>>({} as any);
    const [reveal, setReveal] = useState<Record<AiProviderId, boolean>>({} as any);
    const [status, setStatus] = useState<Record<AiProviderId, { state: Status; message?: string }>>({} as any);
    const [guideOpen, setGuideOpen] = useState<Record<AiProviderId, boolean>>({} as any);
    const [confirmClear, setConfirmClear] = useState(false);
    const [ollamaCfg, setOllamaCfg] = useState<OllamaConfig>(() => loadOllamaConfig());
    const updateOllama = (patch: Partial<OllamaConfig>) => {
        const next = { ...ollamaCfg, ...patch };
        setOllamaCfg(next);
        saveOllamaConfig(next);
    };

    useEffect(() => {
        if (isOpen) {
            const k = loadKeys();
            setKeys(k);
            setDrafts(k);
            setReveal({} as any);
            setStatus({} as any);
            setGuideOpen({} as any);
            setConfirmClear(false);
            setOllamaCfg(loadOllamaConfig());
        }
    }, [isOpen]);

    const savedCount = useMemo(() => Object.values(keys).filter(Boolean).length, [keys]);

    const handleSave = (id: AiProviderId) => {
        const v = (drafts[id] || "").trim();
        saveKey(id, v);
        setKeys((k) => ({ ...k, [id]: v }));
        setStatus((s) => ({ ...s, [id]: { state: "idle" } }));
        toast(v ? "Key saved" : "Key cleared", { description: AI_PROVIDERS.find(p => p.id === id)!.name });
    };

    const handleDelete = (id: AiProviderId) => {
        saveKey(id, "");
        setKeys((k) => { const n = { ...k }; delete n[id]; return n; });
        setDrafts((d) => ({ ...d, [id]: "" }));
        setStatus((s) => ({ ...s, [id]: { state: "idle" } }));
    };

    const handleValidate = async (id: AiProviderId) => {
        const key = (drafts[id] || keys[id] || "").trim();
        if (!key) return;
        setStatus((s) => ({ ...s, [id]: { state: "checking" } }));
        const res = await validateKey(id, key);
        setStatus((s) => ({
            ...s,
            [id]: { state: res.ok ? "valid" : "invalid", message: res.message },
        }));
    };

    const handleClearAll = () => {
        clearAllKeys();
        setKeys({} as any);
        setDrafts({} as any);
        setStatus({} as any);
        setConfirmClear(false);
        toast("All keys cleared", { description: "Local storage wiped." });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
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
                                        <KeyRound className="w-4.5 h-4.5 text-primary-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-[15px] font-semibold tracking-tight">API Keys</h2>
                                        <p className="text-[11px] text-muted-foreground">
                                            {savedCount} of {AI_PROVIDERS.length} saved · device-bound, no password
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Security note */}
                            <div className="mx-6 mt-4 flex items-start gap-2.5 p-3 rounded-2xl bg-muted/40 border border-border/40">
                                <ShieldCheck className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                <div className="text-[11.5px] leading-relaxed text-muted-foreground">
                                    Keys are scrambled with a per-device secret before being written to local storage —
                                    not plaintext, no master password to forget. Clearing browser data removes them.
                                </div>
                            </div>

                            {/* Provider list */}
                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin min-h-0">
                                {AI_PROVIDERS.map((p) => {
                                    const saved = keys[p.id] || "";
                                    const draft = drafts[p.id] ?? saved;
                                    const isRevealed = !!reveal[p.id];
                                    const st = status[p.id] || { state: "idle" as Status };
                                    const dirty = draft.trim() !== (saved || "");
                                    const formatOk = !draft || looksValidKey(p.id, draft.trim());

                                    const isLocalOllama = p.id === "ollama";

                                    return (
                                        <div key={p.id} className="rounded-2xl border border-border/50 bg-background/40 p-3.5">
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2 h-2 rounded-full ${(saved || isLocalOllama) ? providerDot[p.id] : "bg-muted-foreground/30"}`} />
                                                    <span className="text-[13.5px] font-medium">{p.name}</span>
                                                    {isLocalOllama && (
                                                        <span className="text-[10px] text-emerald-600 font-medium ml-1">no key needed</span>
                                                    )}
                                                    {!isLocalOllama && saved && !dirty && (
                                                        <span className="text-[10px] font-mono text-muted-foreground/70 ml-1">
                                                            {maskKey(saved)}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <StatusBadge st={st} />
                                                </div>
                                            </div>

                                            {isLocalOllama ? (
                                                <div className="space-y-2">
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
                                                    <button
                                                        onClick={() => handleValidate(p.id)}
                                                        disabled={st.state === "checking"}
                                                        className="px-3 py-1.5 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[11px] font-medium disabled:opacity-40"
                                                    >
                                                        {st.state === "checking" ? (
                                                            <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Testing…</span>
                                                        ) : "Test connection"}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 relative">
                                                        <input
                                                            type={isRevealed ? "text" : "password"}
                                                            value={draft}
                                                            onChange={(e) => {
                                                                const v = e.target.value;
                                                                setDrafts((d) => ({ ...d, [p.id]: v }));
                                                                setStatus((s) => ({ ...s, [p.id]: { state: "idle" } }));
                                                            }}
                                                            placeholder={p.keyHint}
                                                            className={`w-full pl-3 pr-9 py-2 rounded-xl bg-muted/40 border text-sm font-mono focus:outline-none transition-colors ${!formatOk ? "border-amber-500/50" : "border-border/60 focus:border-primary/50"
                                                                }`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setReveal((r) => ({ ...r, [p.id]: !r[p.id] }))}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted text-muted-foreground"
                                                        >
                                                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleValidate(p.id)}
                                                        disabled={!draft.trim() || st.state === "checking"}
                                                        className="px-2.5 py-2 rounded-xl border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                                                        title="Test against provider"
                                                    >
                                                        {st.state === "checking" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Test"}
                                                    </button>
                                                    <button
                                                        onClick={() => handleSave(p.id)}
                                                        disabled={!dirty}
                                                        className="p-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                        title="Save"
                                                    >
                                                        <Save className="w-3.5 h-3.5" />
                                                    </button>
                                                    {saved && (
                                                        <button
                                                            onClick={() => handleDelete(p.id)}
                                                            className="p-2 rounded-xl border border-border/60 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                            title="Delete saved key"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <div className="mt-2 flex items-center justify-between">
                                                {!formatOk ? (
                                                    <p className="text-[10.5px] text-amber-600 flex items-center gap-1">
                                                        <AlertCircle className="w-3 h-3" />
                                                        Expected prefix <span className="font-mono">{p.keyPrefix}</span>
                                                    </p>
                                                ) : <span />}
                                                <button
                                                    onClick={() => setGuideOpen((g) => ({ ...g, [p.id]: !g[p.id] }))}
                                                    className="text-[10.5px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-auto"
                                                >
                                                    <HelpCircle className="w-3 h-3" />
                                                    {guideOpen[p.id] ? "Hide guide" : "How to get a key"}
                                                </button>
                                            </div>

                                            {st.message && st.state !== "idle" && st.state !== "checking" && (
                                                <p className={`mt-2 text-[10.5px] ${st.state === "valid" ? "text-emerald-600" : "text-destructive"}`}>
                                                    {st.message}
                                                </p>
                                            )}

                                            <AnimatePresence initial={false}>
                                                {guideOpen[p.id] && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                                                        className="overflow-hidden"
                                                    >
                                                        <KeyGuidePanel providerId={p.id} providerName={p.name} />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })}
                            </div>


                            {/* Footer */}
                            <div className="px-6 py-3 border-t border-border/40 flex items-center justify-between shrink-0">
                                {confirmClear ? (
                                    <div className="flex items-center gap-2 text-[12px]">
                                        <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                                        <span className="text-muted-foreground">Wipe all stored keys?</span>
                                        <button onClick={handleClearAll} className="px-2.5 py-1 rounded-md bg-destructive text-destructive-foreground text-[11px] font-medium">
                                            Yes, wipe
                                        </button>
                                        <button onClick={() => setConfirmClear(false)} className="px-2.5 py-1 rounded-md hover:bg-muted text-[11px]">
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmClear(true)}
                                        disabled={savedCount === 0}
                                        className="text-[12px] text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        <Trash2 className="w-3 h-3" /> Clear all
                                    </button>
                                )}
                                <button
                                    onClick={onClose}
                                    className="px-4 py-1.5 rounded-xl bg-muted hover:bg-muted/70 text-[12px] font-medium"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

function KeyGuidePanel({ providerId, providerName }: { providerId: AiProviderId; providerName: string }) {
    const guide = KEY_GUIDES[providerId];
    return (
        <div className="mt-3 rounded-2xl bg-linear-to-br from-muted/50 to-muted/20 border border-border/40 p-4">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-primary" />
                </div>
                <span className="text-[12px] font-semibold tracking-tight">Get a {providerName} key</span>
            </div>

            <ol className="space-y-1.5 mb-3">
                {guide.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[11.5px] leading-relaxed text-foreground/80">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-background border border-border/60 text-[9px] font-semibold flex items-center justify-center text-muted-foreground mt-0.5">
                            {i + 1}
                        </span>
                        <span>{step}</span>
                    </li>
                ))}
            </ol>

            <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border/50 text-[10px] text-muted-foreground">
                    <CreditCard className="w-2.5 h-2.5" /> {guide.pricing}
                </span>
                {guide.freeTier && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium">
                        <Sparkles className="w-2.5 h-2.5" /> {guide.freeTier}
                    </span>
                )}
            </div>

            {guide.tip && (
                <p className="text-[10.5px] text-muted-foreground italic mb-3 leading-relaxed">
                    💡 {guide.tip}
                </p>
            )}

            <div className="flex items-center gap-2">
                <a
                    href={guide.consoleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-[11.5px] font-medium"
                >
                    <ExternalLink className="w-3 h-3" /> Open key console
                </a>
                <a
                    href={guide.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 rounded-xl border border-border/60 hover:bg-background text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Sign up
                </a>
            </div>
        </div>
    );
}


function StatusBadge({ st }: { st: { state: Status; message?: string } }) {
    if (st.state === "valid")
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-medium">
                <Check className="w-2.5 h-2.5" /> Valid
            </span>
        );
    if (st.state === "invalid")
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-medium">
                <AlertCircle className="w-2.5 h-2.5" /> Invalid
            </span>
        );
    if (st.state === "checking")
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-medium">
                <Loader2 className="w-2.5 h-2.5 animate-spin" /> Testing
            </span>
        );
    return null;
}

export default ApiKeyManagerModal;