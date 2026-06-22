'use client'

import { GHDeployment, Note, GHPublishPhase } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  CloudUploadIcon, Github, X, Download, FileArchive,
  CheckCircle2, Loader2, AlertCircle, FolderOpen, Globe,
  ExternalLink, RefreshCw, Copy, Check,
  Rocket, ArrowRight, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { useState, useCallback, useContext } from "react";
import { toast } from "sonner";
import { useNotePublish, PublishProgress, PublishResult } from "@/hooks/useNotePublish";
import {
  useGitHubPublish,
  GHTokenExpiredError,
} from "@/hooks/useGithubPublish";
import { buildHtml } from "@/hooks/useNoteExport";
import { authClient } from "@/lib/auth-client";
import { useNotesContext } from "@/contexts/NotesContext";

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = "self" | "github";

interface PublishSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  note: Note;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

// ─── Self-publish panel ───────────────────────────────────────────────────────

const SelfPublishPanel = ({ note }: { note: Note }) => {
  const { publishZip } = useNotePublish(buildHtml);
  const [progress, setProgress] = useState<PublishProgress>({ phase: "idle" });
  const [result, setResult] = useState<PublishResult | null>(null);

  const busy = ["collecting", "building", "zipping"].includes(progress.phase);
  const done = progress.phase === "done";
  const errored = progress.phase === "error";

  const label = (p: PublishProgress) => {
    if (p.phase === "collecting") return "Collecting media files…";
    if (p.phase === "building") return "Building HTML…";
    if (p.phase === "zipping") return `Packing ${(p as { total: number }).total} files…`;
    return "";
  };

  const handleBuild = useCallback(async () => {
    setResult(null);
    try { const r = await publishZip(note, setProgress); setResult(r); } catch { /* handled by hook */ }
  }, [note, publishZip]);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-3">
        <p className="text-[13px] text-foreground/80 leading-relaxed">
          Download your note as a complete, self-contained website you can host anywhere —
          GitHub Pages, Netlify, Vercel, or just open locally.
        </p>
        <div className="space-y-2">
          {[
            { icon: <FileArchive className="w-3.5 h-3.5" />, text: "index.html — your full note rendered as a webpage" },
            { icon: <FolderOpen className="w-3.5 h-3.5" />, text: "assets/ — all local images, audio & files bundled in" },
            { icon: <Globe className="w-3.5 h-3.5" />, text: "Public URLs (YouTube, Spotify…) stay linked as-is" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[12px] text-muted-foreground">
              <span className="mt-0.5 text-primary/70 shrink-0">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background border border-border/40">
        <div className="w-8 h-8 rounded-[10px] bg-primary/10 flex items-center justify-center text-base shrink-0">📄</div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium truncate">{note.title || "Untitled"}</p>
          <p className="text-[11px] text-muted-foreground">
            {note.blocks.length} block{note.blocks.length !== 1 ? "s" : ""}
            {note.tags.length ? ` · ${note.tags.length} tag${note.tags.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {busy && (
          <motion.div key="busy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-muted/20">
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            <span className="text-[12.5px] text-muted-foreground">{label(progress)}</span>
          </motion.div>
        )}
        {errored && (
          <motion.div key="err" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[12.5px] font-medium text-destructive">Build failed</p>
              <p className="text-[11.5px] text-destructive/70 mt-0.5">
                {"message" in progress ? (progress as { message: string }).message : "Unknown error"}
              </p>
            </div>
          </motion.div>
        )}
        {done && result && (
          <motion.div key="done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded-xl border border-green-500/20 bg-green-500/5 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-green-700 dark:text-green-400">ZIP ready</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBytes(result.zipSize)}
                  {result.assetCount > 0 ? ` · ${result.assetCount} asset${result.assetCount !== 1 ? "s" : ""} bundled` : " · no local assets"}
                </p>
              </div>
            </div>
            <div className="px-4 pb-3">
              <button onClick={result.download}
                className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-700 dark:text-green-400 text-[13px] font-medium transition-colors">
                <Download className="w-3.5 h-3.5" /> Download ZIP
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!done && (
        <button onClick={handleBuild} disabled={busy}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-primary text-primary-foreground text-[13.5px] font-medium transition-opacity disabled:opacity-60 hover:opacity-90">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Building…</> : <><FileArchive className="w-4 h-4" /> Build &amp; Download ZIP</>}
        </button>
      )}
      {done && (
        <button onClick={handleBuild}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground text-[12.5px] transition-colors">
          Rebuild
        </button>
      )}
      <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
        Unzip and drop into any static host. For GitHub Pages, push to a repo and enable Pages in Settings.
      </p>
    </div>
  );
};

// ─── GitHub panel ─────────────────────────────────────────────────────────────

const PUBLISH_STEPS = [
  { phase: "collecting", label: "Collecting media files" },
  { phase: "building", label: "Building HTML" },
  { phase: "creating_repo", label: "Creating GitHub repository" },
  { phase: "uploading", label: "Uploading files" },
  { phase: "enabling_pages", label: "Enabling GitHub Pages" },
];

const REDEPLOY_STEPS = [
  { phase: "building", label: "Building HTML" },
  { phase: "redeploying", label: "Uploading updated files" },
];

const GitHubPanel = ({ note }: { note: Note }) => {
  const { publish, redeploy, tokenState } = useGitHubPublish({ buildHtmlFn: buildHtml });

  // ── Auth state ────────────────────────────────────────────────────────────
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState("");

  // ── Deploy state ──────────────────────────────────────────────────────────
  const { noteIndexes } = useNotesContext();
  const currentNoteIndex = noteIndexes.find(item => item.id === note.id);
  const initialDeployment = currentNoteIndex?.githubDeployment ?? null;

  const [deployment, setDeployment] = useState<GHDeployment | null>(initialDeployment);
  const [phase, setPhase] = useState<GHPublishPhase>({ phase: "idle" });
  const [copied, setCopied] = useState(false);

  const busy = ["collecting", "building", "creating_repo", "uploading", "enabling_pages", "redeploying"].includes(phase.phase);
  const isDone = phase.phase === "done";
  const isError = phase.phase === "error";

  // ── OAuth connect ─────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setOauthError("");
    setOauthPending(true);
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: window.location.href,
        scopes: ["repo"],
      });
      // Page will redirect; if it somehow returns (popup mode), pending stays true.
    } catch {
      setOauthError("OAuth sign-in failed. Please try again.");
      setOauthPending(false);
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const handleDisconnect = useCallback(async () => {
    await authClient.signOut();
    setPhase({ phase: "idle" });
    toast("Disconnected from GitHub", { duration: 2500 });
  }, []);

  // ── Token expiry ──────────────────────────────────────────────────────────
  const handleTokenExpiry = useCallback(() => {
    authClient.signOut();
    setPhase({ phase: "idle" });
    toast.error("GitHub session expired", {
      description: "Please reconnect your GitHub account.",
      duration: 7000,
      icon: <ShieldAlert className="w-4 h-4" />,
    });
  }, []);

  // ── Publish / redeploy ────────────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    setPhase({ phase: "idle" });
    try {
      const d = await publish(note, setPhase);
      setDeployment(d);
    } catch (err) {
      if (err instanceof GHTokenExpiredError) handleTokenExpiry();
    }
  }, [note, publish, handleTokenExpiry]);

  const handleRedeploy = useCallback(async () => {
    if (!deployment) return;
    setPhase({ phase: "idle" });
    try {
      const d = await redeploy(note, deployment, setPhase);
      setDeployment(d);
    } catch (err) {
      if (err instanceof GHTokenExpiredError) handleTokenExpiry();
    }
  }, [note, deployment, redeploy, handleTokenExpiry]);

  // ── Copy URL ──────────────────────────────────────────────────────────────
  const liveUrl = (isDone ? (phase as { url: string }).url : null) || deployment?.pagesUrl || null;
  const handleCopy = () => {
    if (!liveUrl) return;
    navigator.clipboard.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Progress helpers ──────────────────────────────────────────────────────
  const activeSteps = deployment ? REDEPLOY_STEPS : PUBLISH_STEPS;
  const currentStepIdx = activeSteps.findIndex(s => s.phase === phase.phase);
  const uploadLabel = (phase.phase === "uploading" || phase.phase === "redeploying")
    ? `Uploading files (${(phase as { done: number; total: number }).done}/${(phase as { done: number; total: number }).total})`
    : "";

  const ghLogin = tokenState.status === "connected" ? tokenState.ghLogin : null;

  // ────────────────────────────────────────────────────────────────────────────
  // Render: loading (session or token fetch in flight)
  if (tokenState.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <p className="text-[12.5px]">Checking GitHub connection…</p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Shared sub-components

  const ConnectedBadge = () => (
    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-background border border-border/40">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-[#24292f] flex items-center justify-center shrink-0">
          <Github className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-[12.5px] font-medium">@{ghLogin}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5 text-green-500" /> Connected via OAuth
          </p>
        </div>
      </div>
      <button onClick={handleDisconnect}
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted">
        Disconnect
      </button>
    </div>
  );

  const StepsProgress = () => (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
        <span className="text-[12.5px] font-medium">
          {deployment ? "Redeploying…" : "Publishing to GitHub Pages…"}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {activeSteps.map((s, i) => {
          const done = i < currentStepIdx;
          const active = i === currentStepIdx;
          const lbl = active && uploadLabel ? uploadLabel : s.label;
          return (
            <div key={s.phase} className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all ${done ? "bg-green-500" : active ? "bg-primary" : "bg-border"}`}>
                {done && <Check className="w-2.5 h-2.5 text-white" />}
                {active && <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />}
              </div>
              <span className={`text-[12px] ${done ? "text-muted-foreground line-through" : active ? "text-foreground font-medium" : "text-muted-foreground/50"}`}>
                {lbl}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );

  const ErrorCard = () => (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5">
      <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="text-[12.5px] font-medium text-destructive">
          {(phase as { tokenExpired?: boolean }).tokenExpired ? "Session expired" : "Publish failed"}
        </p>
        <p className="text-[11.5px] text-destructive/70 mt-0.5">
          {"message" in phase ? (phase as { message: string }).message : "Unknown error"}
        </p>
      </div>
    </motion.div>
  );

  const LiveUrlCard = ({ url, isNew }: { url: string; isNew?: boolean }) => (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-green-500/25 bg-green-500/5 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3 border-b border-green-500/15">
        <div className="w-7 h-7 rounded-full bg-green-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-green-700 dark:text-green-400">
            {isNew ? "Published!" : "Redeployed!"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {isNew ? "Live in ~30–60 s while Pages activates." : "Your site is updated at the same URL."}
          </p>
        </div>
      </div>
      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/80 border border-border/30">
          <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-[12px] font-mono text-foreground truncate flex-1">{url}</span>
          <button onClick={handleCopy}
            className="shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Copy URL">
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full h-8 rounded-lg bg-green-500/15 hover:bg-green-500/25 text-green-700 dark:text-green-400 text-[12.5px] font-medium transition-colors">
          <ExternalLink className="w-3 h-3" /> Open site
        </a>
      </div>
    </motion.div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Render: not connected → OAuth prompt
  if (tokenState.status === "disconnected") {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-3">
          <p className="text-[13px] text-foreground/80 leading-relaxed">
            Connect your GitHub account via OAuth to publish this note directly to a
            public repository with one click. No tokens to copy — just sign in.
          </p>
          <div className="space-y-2">
            {[
              { icon: <ShieldCheck className="w-3.5 h-3.5" />, text: "Secure OAuth — no personal access tokens needed" },
              { icon: <Globe className="w-3.5 h-3.5" />, text: "Creates a public repo + GitHub Pages site automatically" },
              { icon: <RefreshCw className="w-3.5 h-3.5" />, text: "Redeploy anytime to the same permanent URL" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[12px] text-muted-foreground">
                <span className="mt-0.5 text-primary/70 shrink-0">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {oauthError && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-[12px] text-destructive">{oauthError}</p>
          </div>
        )}

        <button onClick={handleConnect} disabled={oauthPending}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#24292f] hover:bg-[#1a1f24] text-white text-[13.5px] font-medium transition-colors disabled:opacity-60">
          {oauthPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</>
            : <><Github className="w-4 h-4" /> Continue with GitHub</>
          }
        </button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
          You'll be redirected to GitHub to authorize. We request the{" "}
          <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10.5px]">repo</code>{" "}
          scope to create and push to repositories.
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render: connected, first publish
  if (!deployment) {
    return (
      <div className="space-y-4">
        <ConnectedBadge />

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-background border border-border/40">
          <div className="w-8 h-8 rounded-[10px] bg-primary/10 flex items-center justify-center text-base shrink-0">📄</div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium truncate">{note.title || "Untitled"}</p>
            <p className="text-[11px] text-muted-foreground">{note.blocks.length} blocks</p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="text-right shrink-0">
            <p className="text-[11px] font-mono text-muted-foreground truncate max-w-32.5">
              {ghLogin}/{note.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}…
            </p>
            <p className="text-[10px] text-muted-foreground/60">new repo</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {busy && <StepsProgress key="steps" />}
          {isError && <ErrorCard key="err" />}
          {isDone && liveUrl && <LiveUrlCard key="live" url={liveUrl} isNew={(phase as { isNew?: boolean }).isNew} />}
        </AnimatePresence>

        {!isDone && (
          <button onClick={handlePublish} disabled={busy}
            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#24292f] hover:bg-[#1a1f24] text-white text-[13.5px] font-medium transition-colors disabled:opacity-50">
            {busy
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</>
              : <><Rocket className="w-4 h-4" /> Publish to GitHub Pages</>
            }
          </button>
        )}
        {isError && (
          <button onClick={handlePublish}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground text-[12.5px] transition-colors">
            Try again
          </button>
        )}
        <p className="text-[11px] text-muted-foreground text-center px-2 leading-relaxed">
          A public GitHub repository will be created in your account.
        </p>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Render: already deployed
  return (
    <div className="space-y-4">
      <ConnectedBadge />

      <AnimatePresence mode="wait">
        {!busy && liveUrl && (
          isDone
            ? <LiveUrlCard key="live-done" url={liveUrl} isNew={(phase as { isNew?: boolean }).isNew} />
            : (
              <motion.div key="live-idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/40 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-3 border-b border-border/30">
                  <Globe className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium truncate">{deployment.pagesUrl}</p>
                    <p className="text-[11px] text-muted-foreground">Last deployed {fmtDate(deployment.deployedAt)}</p>
                  </div>
                </div>
                <div className="px-4 py-3 flex gap-2">
                  <button onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground text-[12px] transition-colors">
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy URL"}
                  </button>
                  <a href={deployment.pagesUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground text-[12px] transition-colors">
                    <ExternalLink className="w-3 h-3" /> Open
                  </a>
                </div>
              </motion.div>
            )
        )}
        {busy && <StepsProgress key="steps" />}
        {isError && <ErrorCard key="err" />}
      </AnimatePresence>

      {!isDone && (
        <button onClick={handleRedeploy} disabled={busy}
          className="w-full flex items-center justify-center gap-2 h-10 rounded-xl bg-[#24292f] hover:bg-[#1a1f24] text-white text-[13.5px] font-medium transition-colors disabled:opacity-50">
          {busy
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Redeploying…</>
            : <><RefreshCw className="w-4 h-4" /> Redeploy (update site)</>
          }
        </button>
      )}
      {isDone && (
        <button onClick={handleRedeploy}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground text-[12.5px] transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Redeploy again
        </button>
      )}
      {isError && (
        <button onClick={handleRedeploy}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground text-[12.5px] transition-colors">
          Try again
        </button>
      )}
      <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-2">
        Redeploying updates the same URL — your link stays permanent.
      </p>
    </div>
  );
};

// ─── Root modal ───────────────────────────────────────────────────────────────

const PublishSiteModal = ({ isOpen, onClose, note }: PublishSiteModalProps) => {
  const [mode, setMode] = useState<Mode>("self");
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-xl max-h-[90vh] bg-card border border-border/50 rounded-[28px] shadow-2xl shadow-black/10 overflow-hidden flex flex-col">

              {/* Header */}
              <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[14px] bg-linear-to-br from-primary to-primary/60 flex items-center justify-center shadow-md shadow-primary/15">
                    <CloudUploadIcon className="w-4.5 h-4.5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold tracking-tight">Publish site</h2>
                    <p className="text-[11px] text-muted-foreground">Your data stays on your device</p>
                  </div>
                </div>
                <button onClick={onClose}
                  className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mode switcher */}
              <div className="px-6 pt-4 shrink-0">
                <div className="inline-flex p-1 bg-muted/60 rounded-xl gap-0.5">
                  {([
                    ["self", "Self Publish", <Download className="w-3 h-3" />],
                    ["github", "GitHub Pages", <Github className="w-3 h-3" />],
                  ] as const).map(([m, label, icon]) => (
                    <button key={m} onClick={() => setMode(m as Mode)}
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all ${mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin min-h-0">
                <AnimatePresence mode="wait">
                  {mode === "self"
                    ? <motion.div key="self" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}><SelfPublishPanel note={note} /></motion.div>
                    : <motion.div key="github" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}><GitHubPanel note={note} /></motion.div>
                  }
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PublishSiteModal;