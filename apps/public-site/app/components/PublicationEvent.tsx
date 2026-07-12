"use client";

import { useEffect } from "react";

export function PublicationEvent({ event, slug }: { event: "publication_viewed" | "access_started" | "publication_opened"; slug: string }) {
  useEffect(() => {
    void fetch("/api/publications/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, slug }), keepalive: true });
  }, [event, slug]);
  return null;
}

