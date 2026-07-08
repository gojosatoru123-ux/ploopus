"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function DesktopLogin() {
  const [status, setStatus] = useState("Signing you in…");

  useEffect(() => {
    (async () => {
      const { data: session } = await authClient.getSession();

      if (!session) {
        // Not signed in yet — kick off Google, come back to this same page.
        await authClient.signIn.social({
          provider: "google",
          callbackURL: "/desktop-login",
        });
        return;
      }

      // Already signed in on the web — re-hit getSession to grab the
      // bearer token off the response headers.
      setStatus("Connecting to Ploopus desktop app…");

      await authClient.getSession({
        fetchOptions: {
          onSuccess: (ctx) => {
            const token = ctx.response.headers.get("set-auth-token");

            if (!token) {
              setStatus("Something went wrong. Close this tab and try again.");
              return;
            }

            window.location.href = `ploopus://auth-callback?token=${encodeURIComponent(token)}`;
            setStatus("Done! You can close this tab and return to the app.");
          },
        },
      });
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-white">
      <p>{status}</p>
    </div>
  );
}
