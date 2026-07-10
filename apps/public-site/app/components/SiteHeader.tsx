"use client";

import { useState } from "react";
import { List, X } from "@phosphor-icons/react";

const links = [["How it works", "#how-it-works"], ["Find access", "#find-access"], ["Providers", "#providers"], ["Counties", "#counties"], ["Publications", "#publications"], ["About", "#about"]];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return <header className="site-header">
    <a className="brand-lockup" href="#top" aria-label="SozoRock Health home"><span className="wordmark-image"><img src="/brand/sozorock-wordmark-source.png" alt="SozoRock"/><sup>®</sup></span><span>HEALTH</span></a>
    <nav className={open ? "is-open" : ""} aria-label="Primary navigation">{links.map(([label, href]) => <a key={label} href={href} onClick={() => setOpen(false)}>{label}</a>)}<a className="mobile-partner" href="#partner" onClick={() => setOpen(false)}>Partner with us</a></nav>
    <a className="header-partner" href="#partner">Partner with us</a>
    <button className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"}>{open ? <X size={24}/> : <List size={24}/>}</button>
  </header>;
}
