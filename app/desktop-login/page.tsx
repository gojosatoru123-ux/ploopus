// app/desktop-login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function DesktopLogin() {
  const [status, setStatus] = useState
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
    console.log("[desktop-login] fetching bearer token…");

    await authClient.getSession({
      fetchOptions: {
        onSuccess: (ctx) => {
          const token = ctx.response.headers.get("set-auth-token");
          console.log("[desktop-login] set-auth-token header:", token);

          if (!token) {
            setStatus("error");
            setErrorMsg("No token in response headers — check bearer() plugin is registered.");
            return;
          }

          const deepLink = `ploopus://auth-callback?token=${encodeURIComponent(token)}`;
          console.log("[desktop-login] redirecting to:", deepLink);
          window.location.href = deepLink;
          setStatus("done");
        },
        onError: (ctx) => {
          console.error("[desktop-login] getSession error:", ctx.error);
          setStatus("error");
          setErrorMsg(ctx.error.message ?? "Failed to fetch session");
        },
      },
    });
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
