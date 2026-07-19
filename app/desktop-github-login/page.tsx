// app/desktop-github-login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Loader2, Github, Monitor, CheckCircle2, AlertCircle } from "lucide-react";

export default function DesktopGithubLogin() {
  const [status, setStatus] = useState<
    "checking" | "linking" | "connecting" | "done" | "error"
  >("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: session } = await authClient.getSession();

      // This page assumes the user is already logged into Ploopus — GitHub
      // is being LINKED to that existing account, not signing in fresh.
      if (!session) {
        setStatus("error");
        setErrorMsg("You must be signed in to Ploopus first.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const alreadyLinked = params.get("linked") === "1";

      if (!alreadyLinked) {
        setStatus("linking");
        const { error } = await authClient.linkSocial({
          provider: "github",
          scopes: ["repo"],
          callbackURL: `/desktop-github-login?${params.toString()}&linked=1`,
        });
        if (error) {
          setStatus("error");
          setErrorMsg(error.message ?? "Failed to link GitHub account");
        }
        return; // page navigates away to GitHub, then comes back with linked=1
      }

      await handOffToken(params);
    })();
  }, []);

  const handOffToken = async (params: URLSearchParams) => {
    setStatus("connecting");
    try {
      const codeChallenge = params.get("code_challenge");
      if (!codeChallenge) throw new Error("Missing code_challenge");

      const response = await fetch("/api/auth/get-desktop-github-token");
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.error || "Failed to retrieve GitHub token");

      const exchangeCodeRes = await fetch("/api/auth/create-exchange-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token, codeChallenge }),
      });
      const { code } = await exchangeCodeRes.json();
      if (!code) throw new Error("Failed to create exchange code");

      window.location.href = `ploopus://github-callback?code=${encodeURIComponent(code)}`;
      setStatus("done");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message || "Failed to connect GitHub to desktop app");
    }
  };

  return (
   <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background selection:bg-gold-400/30 relative overflow-hidden">
      {/* Subtle organic top glow gradient imitating the main landing page aesthetic */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sage-100/40 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-card flex flex-col items-center text-center relative z-10">
        
        {/* Dynamic Theme Icon Wrapper */}
        <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-sage-50 border border-sage-100 text-primary">
          {status === "checking" && (
            <Loader2 className="w-7 h-7 animate-spin text-sage-500" />
          )}
          {status === "linking" && (
            <Github className="w-7 h-7 text-sage-600 animate-pulse" />
          )}
          {status === "connecting" && (
            <Monitor className="w-7 h-7 text-sage-600 animate-bounce" />
          )}
          {status === "done" && (
            <CheckCircle2 className="w-7 h-7 text-sage-600" />
          )}
          {status === "error" && (
            <AlertCircle className="w-7 h-7 text-destructive" />
          )}
        </div>

        {/* Dynamic Context Block */}
        <div className="w-full space-y-2">
          {status === "checking" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Checking Session</h2>
              <p className="text-sm text-muted-foreground">Verifying your active user session credentials...</p>
            </>
          )}

          {status === "linking" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">GitHub Integration</h2>
              <p className="text-sm text-muted-foreground">Redirecting securely to authorize with GitHub services...</p>
            </>
          )}

          {status === "connecting" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">App Sync</h2>
              <p className="text-sm text-muted-foreground">Establishing a secure socket to your Ploopus desktop application.</p>
            </>
          )}

          {status === "done" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Connection Complete!</h2>
              <p className="text-sm text-muted-foreground">
                Process finished. You can now safely <span className="font-medium text-sage-600">close this browser tab</span>.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h2 className="text-xl font-semibold text-destructive tracking-tight">Connection Failed</h2>
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg font-medium break-words max-w-xs mx-auto">
                {errorMsg || "An error occurred during authentication synchronization."}
              </div>
            </>
          )}
        </div>

        {/* Brand Accent Line */}
        <div className="mt-8 pt-4 border-t border-border/60 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
          Your Second Brain, Stored On Your Device.
        </div>
      </div>
    </div>
  );
}
