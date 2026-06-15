import { useCallback, useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { GHDeployment, GHPublishPhase, Note, NoteBlock } from "@/lib/types";
import { useNotesContext } from "@/contexts/NotesContext";

// ─── Error types ──────────────────────────────────────────────────────────────

export class GHTokenExpiredError extends Error {
  constructor() {
    super("GitHub token expired or revoked. Please reconnect.");
    this.name = "GHTokenExpiredError";
  }
}

export class GHScopeError extends Error {
  constructor(msg = "Token missing required `repo` scope.") {
    super(msg);
    this.name = "GHScopeError";
  }
}

export class GHRepoExistsError extends Error {
  constructor(name: string) {
    super(`Repository "${name}" already exists in your account.`);
    this.name = "GHRepoExistsError";
  }
}

// ─── GitHub access token fetch ────────────────────────────────────────────────
//
// Better Auth's built-in authClient.getAccessToken() reads the GitHub OAuth
// access token from the account table on the server, refreshes it if expired,
// and returns it to the client — no custom API route needed.

const fetchGitHubToken = async (): Promise<string> => {
  const result = await authClient.getAccessToken({ providerId: "github" });
  if (!result?.data?.accessToken) throw new GHTokenExpiredError();
  return result.data.accessToken;
};

// ─── Local asset helpers ──────────────────────────────────────────────────────

const isLocal = (url = "") =>
  url.startsWith("blob:") || url.startsWith("opfs://") || url.startsWith("file:") ||
  (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("//"));

const isOpfsUrl = (url: string) =>
  url.startsWith("opfs://") ||
  (!url.startsWith("blob:") && !url.startsWith("data:") &&
    !url.startsWith("http://") && !url.startsWith("https://") &&
    !url.startsWith("//") && !url.startsWith("file:"));

const opfsName = (url: string) =>
  url.startsWith("opfs://") ? url.slice(7) : url.replace(/^\/+/, "");

const readFromOpfs = async (filename: string): Promise<File | null> => {
  if (!navigator?.storage?.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    try { return await (await root.getFileHandle(filename)).getFile(); } catch { /* */ }
    const subDirs = ["images", "media", "uploads", "files", "attachments", "assets"];
    for (const dir of subDirs) {
      try {
        const dh = await root.getDirectoryHandle(dir);
        try { return await (await dh.getFileHandle(filename)).getFile(); } catch { /* */ }
      } catch { /* */ }
    }
    const base = filename.split("/").pop();
    if (base && base !== filename) {
      try { return await (await root.getFileHandle(base)).getFile(); } catch { /* */ }
      for (const dir of subDirs) {
        try {
          const dh = await root.getDirectoryHandle(dir);
          try { return await (await dh.getFileHandle(base)).getFile(); } catch { /* */ }
        } catch { /* */ }
      }
    }
    return null;
  } catch { return null; }
};

const fetchLocalBlob = async (url: string): Promise<Blob | null> => {
  if (isOpfsUrl(url)) { const f = await readFromOpfs(opfsName(url)); if (f) return f; }
  try { const r = await fetch(url); return r.ok ? r.blob() : null; } catch { return null; }
};

const assetFilename = (url: string, i: number) => {
  let name = url.split("?")[0].split("/").pop() || "";
  if (url.startsWith("opfs://")) name = url.slice(7).split("/").pop() || "";
  name = name.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80);
  if (!name || name === "_") name = `asset_${i}`;
  return `${i}_${name}`;
};

interface AssetEntry { originalUrl: string; assetPath: string; blob: Blob; }

const collectAssets = async (note: Note): Promise<AssetEntry[]> => {
  const need = (url?: string): url is string => !!url && !url.startsWith("data:") && isLocal(url);
  const urls = new Set<string>();
  const walk = (block: NoteBlock) => {
    if (need(block.imageUrl)) urls.add(block.imageUrl!);
    if (need(block.videoUrl)) urls.add(block.videoUrl!);
    if (need(block.audioUrl)) urls.add(block.audioUrl!);
    if (need(block.fileUrl)) urls.add(block.fileUrl!);
    if (need(block.imageTextUrl)) urls.add(block.imageTextUrl!);
    block.galleryImages?.forEach(img => need(img.url) && urls.add(img.url));
    block.columns?.forEach(col => col.forEach(walk));
    block.tabsData?.forEach(tab => tab.blocks?.forEach(walk));
  };
  note.blocks.forEach(walk);
  const results = await Promise.all([...urls].map(async (url, i) => {
    const blob = await fetchLocalBlob(url);
    if (!blob) return null;
    return { originalUrl: url, assetPath: `assets/${assetFilename(url, i + 1)}`, blob } as AssetEntry;
  }));
  return results.filter((e): e is AssetEntry => e !== null);
};

const rewriteAssetUrls = (html: string, assets: AssetEntry[]): string => {
  let out = html;
  for (const { originalUrl, assetPath } of assets) {
    const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const enc = originalUrl
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    out = out.replace(new RegExp(`(src|href)="${re(originalUrl)}"`, "g"), `$1="${assetPath}"`);
    if (enc !== originalUrl)
      out = out.replace(new RegExp(`(src|href)="${re(enc)}"`, "g"), `$1="${assetPath}"`);
  }
  return out;
};

// ─── Base64 helpers ───────────────────────────────────────────────────────────

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(",")[1]);
    r.onerror = () => rej(new Error("FileReader failed"));
    r.readAsDataURL(blob);
  });

const strToBase64 = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

// ─── GitHub REST API ──────────────────────────────────────────────────────────

const GH = "https://api.github.com";

const ghHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
});

const ghFetch = async (
  token: string,
  method: string,
  path: string,
  body?: object,
  repoNameHint?: string,
) => {
  const res = await fetch(`${GH}${path}`, {
    method,
    headers: ghHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  if (!res.ok) {
    let ghMsg = "";
    try { ghMsg = (await res.json()).message || ""; } catch { /* */ }
    if (res.status === 401) throw new GHTokenExpiredError();
    if (res.status === 403) throw new GHScopeError(ghMsg || undefined);
    if (res.status === 422 && repoNameHint) throw new GHRepoExistsError(repoNameHint);
    throw new Error(ghMsg || `GitHub API error ${res.status}`);
  }

  return res.json();
};

const getUser = (t: string) => ghFetch(t, "GET", "/user");
const createRepo = (t: string, name: string, desc: string) => ghFetch(t, "POST", "/user/repos", { name, description: desc, private: false, auto_init: false, has_issues: false, has_projects: false, has_wiki: false }, name);
const enablePages = (t: string, o: string, r: string) => ghFetch(t, "POST", `/repos/${o}/${r}/pages`, { source: { branch: "main", path: "/" } }).catch(() => { /* 409 = already enabled */ });
const getFileSha = async (t: string, o: string, r: string, p: string) => { try { return (await ghFetch(t, "GET", `/repos/${o}/${r}/contents/${p}`) as { sha: string })?.sha ?? null; } catch { return null; } };
const putFile = (t: string, o: string, r: string, p: string, b64: string, msg: string, sha?: string | null) =>
  ghFetch(t, "PUT", `/repos/${o}/${r}/contents/${p}`, { message: msg, content: b64, ...(sha ? { sha } : {}) });

// ─── Repo slug ────────────────────────────────────────────────────────────────

const repoSlug = (title: string, noteId: string) => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "note";
  const suffix = noteId.replace(/[^a-z0-9]/gi, "").slice(0, 6).toLowerCase();
  return `${slug}-${suffix}`;
};

// ─── File builder ─────────────────────────────────────────────────────────────

interface DeployFile { path: string; contentBase64: string; }

const buildDeployFiles = async (
  note: Note,
  buildHtmlFn: (note: Note, forPdf: boolean, mediaMap: Map<string, string>) => string,
): Promise<DeployFile[]> => {
  const assets = await collectAssets(note);
  const html = rewriteAssetUrls(buildHtmlFn(note, false, new Map()), assets);
  const files: DeployFile[] = [{ path: "index.html", contentBase64: strToBase64(html) }];
  for (const a of assets) {
    files.push({ path: a.assetPath, contentBase64: await blobToBase64(a.blob) });
  }
  return files;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type GHTokenState =
  | { status: "loading" }
  | { status: "connected"; ghLogin: string }
  | { status: "disconnected" };

export const useGitHubPublish = ({
  buildHtmlFn,
}: {
  buildHtmlFn: (note: Note, forPdf: boolean, mediaMap: Map<string, string>) => string;
}) => {
  const { data: sessionData, isPending: sessionPending } = authClient.useSession();
  const { updateNoteIndex } = useNotesContext();
  // Resolved GitHub login confirmed via /user ping. Null until confirmed.
  const [tokenState, setTokenState] = useState<GHTokenState>({ status: "loading" });
  const didInit = useRef(false);

  // On mount (and when session becomes available): hit /api/github-token, then
  // silently confirm with GitHub /user. This is the single source of truth for
  // whether the user is "connected".
  useEffect(() => {
    // Wait for Better Auth session to settle before doing anything.
    if (sessionPending) return;
    // No session at all → not connected, no need to check the token.
    if (!sessionData?.user) { setTokenState({ status: "disconnected" }); return; }
    // Only run once per mount (avoids re-running on unrelated session updates).
    if (didInit.current) return;
    didInit.current = true;

    setTokenState({ status: "loading" });
    fetchGitHubToken()
      .then(token => getUser(token) as Promise<{ login: string }>)
      .then(user => setTokenState({ status: "connected", ghLogin: user.login }))
      .catch(() => setTokenState({ status: "disconnected" }));
  }, [sessionPending, sessionData]);

  // Reset when the user signs out (sessionData goes null).
  useEffect(() => {
    if (!sessionPending && !sessionData?.user) {
      didInit.current = false;
      setTokenState({ status: "disconnected" });
    }
  }, [sessionPending, sessionData]);

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Re-validate the stored token against GitHub. Returns the login on success. */
  const validateToken = useCallback(async (): Promise<string> => {
    const token = await fetchGitHubToken();
    const user = await getUser(token) as { login: string };
    return user.login;
  }, []);

  /** First-time publish: create repo, push files, enable Pages. */
  const publish = useCallback(async (
    note: Note,
    onPhase: (p: GHPublishPhase) => void,
  ): Promise<GHDeployment> => {
    try {
      onPhase({ phase: "collecting" });
      const token = await fetchGitHubToken();
      const user = await getUser(token) as { login: string };
      const owner = user.login;

      onPhase({ phase: "building" });
      const files = await buildDeployFiles(note, buildHtmlFn);

      onPhase({ phase: "creating_repo" });
      const slug = repoSlug(note.title, note.id);
      await createRepo(token, slug, `Published note: ${note.title}`);

      onPhase({ phase: "uploading", done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        await putFile(token, owner, slug, f.path, f.contentBase64, `Publish: ${f.path}`);
        onPhase({ phase: "uploading", done: i + 1, total: files.length });
      }

      onPhase({ phase: "enabling_pages" });
      await enablePages(token, owner, slug);

      const pagesUrl = `https://${owner}.github.io/${slug}`;
      const deployment: GHDeployment = {
        repoName: slug,
        repoFullName: `${owner}/${slug}`,
        pagesUrl,
        deployedAt: new Date().toISOString(),
        noteTitle: note.title,
      };
      // saveDeployment(note.id, deployment);
      updateNoteIndex(note.id, { githubDeployment: deployment });
      onPhase({ phase: "done", url: pagesUrl, isNew: true });
      return deployment;
    } catch (err) {
      const tokenExpired = err instanceof GHTokenExpiredError;
      onPhase({ phase: "error", message: (err as Error).message, tokenExpired });
      throw err;
    }
  }, [buildHtmlFn]);

  /** Redeploy: update existing repo in-place, same URL. */
  const redeploy = useCallback(async (
    note: Note,
    existing: GHDeployment,
    onPhase: (p: GHPublishPhase) => void,
  ): Promise<GHDeployment> => {
    try {
      const token = await fetchGitHubToken();
      const [owner, repoName] = existing.repoFullName.split("/");

      onPhase({ phase: "building" });
      const files = await buildDeployFiles(note, buildHtmlFn);

      onPhase({ phase: "redeploying", done: 0, total: files.length });
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const sha = await getFileSha(token, owner, repoName, f.path);
        await putFile(token, owner, repoName, f.path, f.contentBase64, `Redeploy: ${f.path}`, sha);
        onPhase({ phase: "redeploying", done: i + 1, total: files.length });
      }

      const updated: GHDeployment = {
        ...existing,
        deployedAt: new Date().toISOString(),
        noteTitle: note.title,
      };
      // saveDeployment(note.id, updated);
      updateNoteIndex(note.id, { githubDeployment: updated });
      onPhase({ phase: "done", url: existing.pagesUrl, isNew: false });
      return updated;
    } catch (err) {
      const tokenExpired = err instanceof GHTokenExpiredError;
      onPhase({ phase: "error", message: (err as Error).message, tokenExpired });
      throw err;
    }
  }, [buildHtmlFn]);

  return { publish, redeploy, validateToken, tokenState };
};