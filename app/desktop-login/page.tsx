// app/desktop-login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function DesktopLogin() {
  const [status, setStatus] = useState<
    "idle" | "checking" | "redirecting" | "connecting" | "done" | "error"
  >("checking");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      console.log("[desktop-login] checking existing session…");
      const { data: session, error } = await authClient.getSession();
      console.log("[desktop-login] session:", session, "error:", error);

      if (session) {
        await handOffToken();
      } else {
        setStatus("idle"); // show the button, don't auto-redirect
      }
    })();
  }, []);

  const startSignIn = async () => {
    setStatus("redirecting");
    console.log("[desktop-login] starting Google sign-in…");
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/desktop-login",
    });
    if (error) {
      console.error("[desktop-login] signIn.social error:", error);
      setStatus("error");
      setErrorMsg(error.message ?? "Unknown error starting sign-in");
    }
    // on success this line never runs — browser navigates away to Google
  };

  const handOffToken = async () => {
  setStatus("connecting");
  console.log("[desktop-login] requesting token from exchange API…");

  try {
    const response = await fetch("/api/auth/get-desktop-token");
    const data = await response.json();

    if (!response.ok || !data.token) {
      throw new Error(data.error || "Failed to retrieve token");
    }

    const token = data.token;
    const deepLink = `ploopus://auth-callback?token=${encodeURIComponent(token)}`;
    
    console.log("[desktop-login] redirecting to:", deepLink);
    window.location.href = deepLink;
    setStatus("done");
  } catch (err: any) {
    console.error("[desktop-login] Token exchange error:", err);
    setStatus("error");
    setErrorMsg(err.message || "Failed to connect to desktop app");
  }
};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-white">
      {status === "checking" && <p>Checking session…</p>}

      {status === "idle" && (
        <button
          onClick={startSignIn}
          className="px-6 py-3 rounded-lg bg-white text-black font-medium"
        >
          Continue with Google
        </button>
      )}

      {status === "redirecting" && <p>Opening Google sign-in…</p>}
      {status === "connecting" && <p>Connecting to Ploopus desktop app…</p>}
      {status === "done" && <p>Done — you can close this tab.</p>}
      {status === "error" && (
        <p className="text-red-400">Something went wrong: {errorMsg}</p>
      )}
    </div>
  );
}
