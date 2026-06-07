// Lightweight BYO-key AI client. All keys live in localStorage on the user's device.
// Keys are stored obfuscated using a device-derived secret (random salt + userAgent),
// so they aren't readable as plaintext from a casual storage inspection.
// This is NOT end-to-end encryption — without a master password (which the user
// explicitly does not want), perfect protection is impossible in a browser.
// We never proxy through any server — calls go straight from the browser to the
// chosen provider so the system stays local-first.

export type AiProviderId =
  | "openai"
  | "gemini"
  | "anthropic"
  | "deepseek"
  | "groq"
  | "xai"
  | "ollama"
  | "ollama-cloud";

export interface AiProvider {
  id: AiProviderId;
  name: string;
  defaultModel: string;
  webUrl: string;
  keyHint: string;
  keyPrefix: string; // expected prefix for basic format validation
  accent: string;
  icon: string;
  /** When false, the provider doesn't need an API key (e.g. local Ollama). */
  requiresKey?: boolean;
}

export const AI_PROVIDERS: AiProvider[] = [
  {
    id: "openai",
    name: "ChatGPT",
    defaultModel: "gpt-4o-mini",
    webUrl: "https://chat.openai.com/",
    keyHint: "sk-...  •  platform.openai.com/api-keys",
    keyPrefix: "sk-",
    accent: "from-emerald-500 to-teal-500",
    icon: "✦",
  },
  {
    id: "gemini",
    name: "Gemini",
    defaultModel: "gemini-2.0-flash",
    webUrl: "https://gemini.google.com/",
    keyHint: "AIza...  •  aistudio.google.com/apikey",
    keyPrefix: "AIza",
    accent: "from-sky-500 to-indigo-500",
    icon: "✺",
  },
  {
    id: "anthropic",
    name: "Claude",
    defaultModel: "claude-3-5-sonnet-latest",
    webUrl: "https://claude.ai/",
    keyHint: "sk-ant-...  •  console.anthropic.com",
    keyPrefix: "sk-ant-",
    accent: "from-orange-500 to-amber-500",
    icon: "✶",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    defaultModel: "deepseek-chat",
    webUrl: "https://chat.deepseek.com/",
    keyHint: "sk-...  •  platform.deepseek.com",
    keyPrefix: "sk-",
    accent: "from-blue-500 to-cyan-500",
    icon: "◈",
  },
  {
    id: "groq",
    name: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    webUrl: "https://groq.com/",
    keyHint: "gsk_...  •  console.groq.com/keys",
    keyPrefix: "gsk_",
    accent: "from-rose-500 to-pink-500",
    icon: "⚡",
  },
  {
    id: "xai",
    name: "Grok",
    defaultModel: "grok-2-latest",
    webUrl: "https://grok.com/",
    keyHint: "xai-...  •  console.x.ai",
    keyPrefix: "xai-",
    accent: "from-zinc-700 to-zinc-900",
    icon: "𝕏",
  },
  {
    id: "ollama",
    name: "Ollama Local",
    defaultModel: "llama3.2",
    webUrl: "https://ollama.com/",
    keyHint: "No key — runs on your machine",
    keyPrefix: "",
    accent: "from-stone-500 to-stone-700",
    icon: "◉",
    requiresKey: false,
  },
  {
    id: "ollama-cloud",
    name: "Ollama Cloud",
    defaultModel: "gpt-oss:120b",
    webUrl: "https://ollama.com/cloud",
    keyHint: "Paste your Ollama Cloud key",
    keyPrefix: "",
    accent: "from-violet-500 to-fuchsia-500",
    icon: "☁",
  },
];

/* ----------------------------- Ollama config ----------------------------- */
// Ollama uses a base URL + model name instead of a pure API key. We store
// these locally so users can point at any host (LAN box, Docker, etc.) and
// switch between installed models without touching code.

const OLLAMA_CFG = "elephant.ai.ollama.cfg.v1";

export interface OllamaConfig {
  localBaseUrl: string;
  localModel: string;
  cloudBaseUrl: string;
  cloudModel: string;
}

const OLLAMA_DEFAULTS: OllamaConfig = {
  localBaseUrl: "http://localhost:11434",
  localModel: "llama3.2",
  cloudBaseUrl: "https://ollama.com",
  cloudModel: "gpt-oss:120b",
};

export const loadOllamaConfig = (): OllamaConfig => {
  try {
    const raw = localStorage.getItem(OLLAMA_CFG);
    if (!raw) return { ...OLLAMA_DEFAULTS };
    return { ...OLLAMA_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...OLLAMA_DEFAULTS };
  }
};

export const saveOllamaConfig = (cfg: Partial<OllamaConfig>) => {
  const merged = { ...loadOllamaConfig(), ...cfg };
  localStorage.setItem(OLLAMA_CFG, JSON.stringify(merged));
};

/* --------------------------- Obfuscated storage --------------------------- */
// Device-bound obfuscation. The salt is generated once per browser and combined
// with navigator.userAgent to derive a XOR key. This stops casual plaintext
// scraping while keeping the system fully passwordless.

const KEYS_STORAGE = "elephant.ai.keys.v2";
const SALT_STORAGE = "elephant.ai.salt.v1";
const LEGACY_KEYS = "elephant.ai.keys.v1"; // plaintext legacy

const getDeviceSalt = (): string => {
  try {
    let s = localStorage.getItem(SALT_STORAGE);
    if (!s) {
      const buf = new Uint8Array(24);
      crypto.getRandomValues(buf);
      s = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(SALT_STORAGE, s);
    }
    return s;
  } catch {
    return "fallback-salt";
  }
};

const getCipherSeed = (): string => {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "node";
  return `${getDeviceSalt()}::${ua}`;
};

const xorTransform = (text: string, seed: string): string => {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    out += String.fromCharCode(text.charCodeAt(i) ^ seed.charCodeAt(i % seed.length));
  }
  return out;
};

const obfuscate = (plain: string): string => {
  try {
    return btoa(unescape(encodeURIComponent(xorTransform(plain, getCipherSeed()))));
  } catch {
    return plain;
  }
};

const deobfuscate = (encoded: string): string => {
  try {
    return xorTransform(decodeURIComponent(escape(atob(encoded))), getCipherSeed());
  } catch {
    return "";
  }
};

export const loadKeys = (): Record<AiProviderId, string> => {
  try {
    // Migrate legacy plaintext store if present.
    const legacy = localStorage.getItem(LEGACY_KEYS);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy) as Record<string, string>;
        const enc: Record<string, string> = {};
        for (const [k, v] of Object.entries(parsed)) if (v) enc[k] = obfuscate(v);
        localStorage.setItem(KEYS_STORAGE, JSON.stringify(enc));
      } catch {/* ignore */ }
      localStorage.removeItem(LEGACY_KEYS);
    }
    const raw = localStorage.getItem(KEYS_STORAGE);
    if (!raw) return {} as Record<AiProviderId, string>;
    const enc = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(enc)) {
      const dec = deobfuscate(v);
      if (dec) out[k] = dec;
    }
    return out as Record<AiProviderId, string>;
  } catch {
    return {} as Record<AiProviderId, string>;
  }
};

export const saveKey = (provider: AiProviderId, key: string) => {
  const all = loadKeys();
  if (key) all[provider] = key;
  else delete all[provider];
  const enc: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) enc[k] = obfuscate(v);
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(enc));
};

export const clearAllKeys = () => {
  localStorage.removeItem(KEYS_STORAGE);
};

/* ------------------------------ Key helpers ------------------------------ */

export const maskKey = (key: string): string => {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 8, 16))}${key.slice(-4)}`;
};

export const looksValidKey = (provider: AiProviderId, key: string): boolean => {
  const p = AI_PROVIDERS.find((x) => x.id === provider);
  if (!p) return false;
  if (p.requiresKey === false) return true; // local Ollama needs no key
  if (!key) return false;
  if (!p.keyPrefix) return key.length >= 8;
  return key.startsWith(p.keyPrefix) && key.length >= p.keyPrefix.length + 8;
};

/** Live ping against the provider to verify a key actually works. */
export const validateKey = async (
  provider: AiProviderId,
  apiKey: string,
): Promise<{ ok: boolean; message: string }> => {
  try {
    if (provider === "ollama") {
      const cfg = loadOllamaConfig();
      const r = await fetch(`${cfg.localBaseUrl.replace(/\/$/, "")}/api/tags`);
      return r.ok
        ? { ok: true, message: "Ollama is reachable." }
        : { ok: false, message: `Ollama responded ${r.status}.` };
    }
    if (provider === "ollama-cloud") {
      if (!apiKey) return { ok: false, message: "No key provided." };
      const cfg = loadOllamaConfig();
      const r = await fetch(`${cfg.cloudBaseUrl.replace(/\/$/, "")}/api/tags`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return r.ok
        ? { ok: true, message: "Key is valid." }
        : { ok: false, message: `Ollama Cloud rejected the key (${r.status}).` };
    }

    if (!apiKey) return { ok: false, message: "No key provided." };

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return r.ok
        ? { ok: true, message: "Key is valid." }
        : { ok: false, message: `OpenAI rejected the key (${r.status}).` };
    }
    if (provider === "gemini") {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      );
      return r.ok
        ? { ok: true, message: "Key is valid." }
        : { ok: false, message: `Gemini rejected the key (${r.status}).` };
    }
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-latest",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });
      if (r.ok) return { ok: true, message: "Key is valid." };
      if (r.status === 401 || r.status === 403)
        return { ok: false, message: "Claude rejected the key." };
      return { ok: true, message: "Key looks active." };
    }
    const endpoints: Record<string, string> = {
      deepseek: "https://api.deepseek.com/models",
      groq: "https://api.groq.com/openai/v1/models",
      xai: "https://api.x.ai/v1/models",
    };
    const r = await fetch(endpoints[provider], {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return r.ok
      ? { ok: true, message: "Key is valid." }
      : { ok: false, message: `Provider rejected the key (${r.status}).` };
  } catch (e: any) {
    return { ok: false, message: e?.message?.slice(0, 160) || "Network error." };
  }
};

/* ----------------------------- AI invocation ----------------------------- */

export const callAi = async (
  provider: AiProviderId,
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> => {
  const p = AI_PROVIDERS.find((x) => x.id === provider)!;
  const model = p.defaultModel;

  if (provider === "ollama" || provider === "ollama-cloud") {
    const cfg = loadOllamaConfig();
    const isLocal = provider === "ollama";
    const baseUrl = (isLocal ? cfg.localBaseUrl : cfg.cloudBaseUrl).replace(/\/$/, "");
    const useModel = isLocal ? cfg.localModel : cfg.cloudModel;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isLocal && apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: useModel,
        stream: false,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  }

  const endpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    deepseek: "https://api.deepseek.com/chat/completions",
    groq: "https://api.groq.com/openai/v1/chat/completions",
    xai: "https://api.x.ai/v1/chat/completions",
  };
  const res = await fetch(endpoints[provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
};

export const extractJson = (text: string): any => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.search(/[\[{]/);
  if (start < 0) throw new Error("No JSON found in response");
  return JSON.parse(candidate.slice(start));
};