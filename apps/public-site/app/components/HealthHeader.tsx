"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";

export function HealthHeader({ spanish = false, programPage = false }: { spanish?: boolean; programPage?: boolean }) {
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
  if (programPage) return <header style={{borderBottom: "1px solid #CED7E3"}}><div className="hc-program-nav"><a href="/" aria-label="SozoRock Health home"><strong>SozoRock.</strong><span>Health</span></a><nav aria-label="Primary navigation"><a href="#program">The program</a><a href="#evidence">Evidence</a><a href="#sponsor">Sponsor</a><a href="/interest">Join the interest list</a></nav></div></header>;
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
        {!spanish && <a href="/primary-care-access">The program</a>}
        <a href="/work">{spanish ? "Nuestro trabajo" : "Our work"}</a>
        <a href="/evidence">{spanish ? "Evidencia" : "Evidence"}</a>
        <a href="/publications">{spanish ? "Publicaciones" : "Publications"}</a>
        <a href={spanish ? "/contact" : "https://www.sozorockfoundation.org/partner"}>{spanish ? "Colaborar" : "Partner"}</a>
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
