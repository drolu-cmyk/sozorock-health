"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";

export function HealthHeader({ spanish = false }: { spanish?: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open]);
  return (
    <header className="hs-header">
      <a
        className="hs-brand"
        href={spanish ? "/es" : "/"}
        aria-label={
          spanish ? "Inicio de SozoRock Health" : "SozoRock Health home"
        }
      >
        <span>
          <strong>SozoRock</strong> Health
        </span>
        <small>
          {spanish ? "Una iniciativa de" : "An initiative of"} The SozoRock
          Foundation
        </small>
      </a>
      <button
        ref={toggle}
        className="hs-menu"
        aria-expanded={open}
        aria-controls="health-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <X size={24} aria-hidden="true" />
        ) : (
          <List size={24} aria-hidden="true" />
        )}
        {spanish ? "Menú" : "Menu"}
      </button>
      <nav
        id="health-navigation"
        aria-label={spanish ? "Navegación principal" : "Primary navigation"}
        className={open ? "hs-nav is-open" : "hs-nav"}
      >
        <a href="/work">{spanish ? "Nuestro trabajo" : "Our work"}</a>
        <a href="/evidence">{spanish ? "Evidencia" : "Evidence"}</a>
        <a href="/publications">{spanish ? "Publicaciones" : "Publications"}</a>
        <a href="/contact">{spanish ? "Colaborar" : "Partner"}</a>
        <a
          className="hs-language"
          href={spanish ? "/" : "/es"}
          lang={spanish ? "en" : "es"}
        >
          {spanish ? "English" : "Español"}
        </a>
      </nav>
    </header>
  );
}
