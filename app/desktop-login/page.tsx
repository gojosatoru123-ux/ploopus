// app/desktop-login/page.tsx
"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Loader2, Chrome, Monitor, CheckCircle2, AlertCircle } from "lucide-react";

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
      callbackURL: window.location.pathname + window.location.search, // preserve code_challenge across redirect
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
    const params = new URLSearchParams(window.location.search);
    const codeChallenge = params.get("code_challenge");
    if (!codeChallenge) throw new Error("Missing code_challenge");
    
    const response = await fetch("/api/auth/get-desktop-token");
    const data = await response.json();

    if (!response.ok || !data.token) {
      throw new Error(data.error || "Failed to retrieve token");
    }

    // const token = data.token;
    const exchangeCodeRes = await fetch("/api/auth/create-exchange-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token, codeChallenge }),
      });
    const { code } = await exchangeCodeRes.json();
    if (!code) throw new Error("Failed to create exchange code");
    
    const deepLink = `ploopus://auth-callback?code=${encodeURIComponent(code)}`;
    
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
   <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background selection:bg-gold-400/30 relative overflow-hidden">
      {/* Subtle top organic glow gradient from the landing page */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sage-100/40 via-transparent to-transparent pointer-events-none" />

      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-card flex flex-col items-center text-center relative z-10">
        
        {/* Dynamic Status Icon Circle */}
        <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-full bg-sage-50 border border-sage-100 text-primary">
          {status === "checking" && (
            <Loader2 className="w-7 h-7 animate-spin text-sage-500" />
          )}
          {status === "idle" && (
            <Chrome className="w-7 h-7 text-sage-600" />
          )}
          {status === "redirecting" && (
            <Chrome className="w-7 h-7 text-sage-600 animate-pulse" />
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

        {/* Dynamic Status Content */}
        <div className="w-full space-y-2">
          {status === "checking" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Checking Session</h2>
              <p className="text-sm text-muted-foreground">Verifying your current connection status...</p>
            </>
          )}

          {status === "idle" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Welcome to Ploopus</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Sign in to sync your local knowledge base and connect your second brain.
              </p>
              <button
                onClick={startSignIn}
                className="w-full mt-4 px-6 py-3 rounded-full bg-primary hover:bg-sage-600 text-primary-foreground font-medium shadow-soft transition-colors duration-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Chrome className="w-4 h-4" />
                Continue with Google
              </button>
            </>
          )}

          {status === "redirecting" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Authentication</h2>
              <p className="text-sm text-muted-foreground">Opening secure Google sign-in window...</p>
            </>
          )}

          {status === "connecting" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">Connecting App</h2>
              <p className="text-sm text-muted-foreground">Pairing authentication with your Ploopus desktop application.</p>
            </>
          )}

          {status === "done" && (
            <>
              <h2 className="text-xl font-semibold text-foreground tracking-tight">All Set!</h2>
              <p className="text-sm text-muted-foreground">
                Authentication completed. You can now safely <span className="font-medium text-sage-600">close this browser tab</span>.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h2 className="text-xl font-semibold text-destructive tracking-tight">An Error Occurred</h2>
              <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg font-medium break-words max-w-xs mx-auto">
                {errorMsg || "Something went wrong while signing you in."}
              </div>
              {/* Optional: Retry button when in error state */}
              <button 
                onClick={startSignIn}
                className="mt-4 text-sm font-semibold text-sage-600 hover:text-sage-700 underline underline-offset-4 cursor-pointer"
              >
                Try signing in again
              </button>
            </>
          )}
        </div>

        {/* Branding Footer */}
        <div className="mt-8 pt-4 border-t border-border/60 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
          Your Second Brain, Stored On Your Device.
        </div>
      </div>
    </div>
  );
}
