"use client";

import { useEffect, useState } from "react";
import { List, X } from "@phosphor-icons/react";

const links = [
  ["How it works", "#how-it-works"],
  ["For residents", "#resident"],
  ["For providers", "#providers"],
  ["For counties", "#counties"],
  ["Impact & publications", "#publications"],
  ["About SozoRock", "#about"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);

  return <header className="site-header">
    <a className="brand-lockup" href="#top" aria-label="SozoRock Health home"><span className="wordmark-image"><img src="/brand/sozorock-wordmark-clean-v2.png" alt="SozoRock"/><sup aria-label="registered trademark">®</sup></span><span>HEALTH</span></a>
    <nav id="primary-navigation" className={open ? "is-open" : ""} aria-label="Primary navigation">{links.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)}>{label}</a>)}<a className="mobile-partner" href="#partner" onClick={() => setOpen(false)}>Get involved</a></nav>
    <a className="header-partner" href="#partner">Get involved</a>
    <button className="menu-button" type="button" onClick={() => setOpen(!open)} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={24} aria-hidden="true"/> : <List size={24} aria-hidden="true"/>}</button>
  </header>;
}
