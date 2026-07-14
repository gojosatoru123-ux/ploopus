// app/desktop-github-login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function DesktopGithubLogin() {
  const [status, setStatus] = useState
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
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-white">
      {status === "checking" && <p>Checking session…</p>}
      {status === "linking" && <p>Redirecting to GitHub…</p>}
      {status === "connecting" && <p>Connecting to Ploopus desktop app…</p>}
      {status === "done" && <p>Done — you can close this tab.</p>}
      {status === "error" && <p className="text-red-400">Something went wrong: {errorMsg}</p>}
    </div>
  );
}
