"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { LogoLockup } from "./LogoLockup";

const links = [
  ["What We Do", "#model"],
  ["Health Priorities", "#priorities"],
  ["Publications", "#publications"],
  ["About", "#about"],
  ["Get Involved", "#get-involved"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    document.body.classList.toggle("menu-open", open);
    return () => {
      window.removeEventListener("keydown", close);
      document.body.classList.remove("menu-open");
    };
  }, [open]);

  return (
    <header className="site-header">
      <LogoLockup href="#top" />
      <nav id="primary-navigation" className={open ? "is-open" : ""} aria-label="Primary navigation">
        {links.map(([label, href]) => (
          <a key={label} href={href} onClick={() => setOpen(false)}>{label}</a>
        ))}
      </nav>
      <a className="header-partner" href="#model">Explore the model</a>
      <button ref={menuButton} className="menu-button" type="button" onClick={() => setOpen(!open)} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>
        {open ? <X size={25} aria-hidden="true" /> : <List size={25} aria-hidden="true" />}
      </button>
    </header>
  );
}
