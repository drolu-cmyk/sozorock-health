"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeCognitoCallback } from "../../lib/agentic-auth";
import { agenticRuntimeConfig } from "../../lib/agentic-runtime";

export default function CognitoCallbackPage() {
  const router = useRouter();
  const config = useMemo(() => agenticRuntimeConfig(), []);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!config.enabled) {
      setError("Institutional sign-in is not configured for this deployment.");
      return;
    }
    void completeCognitoCallback(config).then((completed) => {
      if (cancelled) return;
      if (!completed) {
        setError("The sign-in callback did not contain a valid authorization response.");
        return;
      }
      // App Router navigation preserves the module-scoped in-memory token set.
      // A document redirect would discard it before the workspace can use it.
      router.replace("/#agentic-workspace");
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Institutional sign-in could not be completed.");
    });
    return () => { cancelled = true; };
  }, [config, router]);

  return (
    <main className="auth-callback" aria-labelledby="auth-callback-heading">
      <section>
        <span>CB-CAP institutional access</span>
        <h1 id="auth-callback-heading">{error ? "Sign-in was not completed" : "Completing secure sign-in…"}</h1>
        <p role={error ? "alert" : "status"}>{error || "Verifying the authorization code and returning to the governed workspace."}</p>
        {error && <a href="/#agentic-workspace">Return to the public dashboard</a>}
      </section>
    </main>
  );
}
