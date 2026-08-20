"use client";

import { useEffect } from "react";
import { getPublicationClientContext } from "../lib/publication-client-context";

export function PublicationEvent({ event, slug }: { event: "publication_viewed" | "access_started" | "publication_opened"; slug: string }) {
  useEffect(() => {
    const context = getPublicationClientContext();
    void fetch("/api/publications/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, slug, ...context }),
      keepalive: true,
    });
  }, [event, slug]);
  return null;
}
