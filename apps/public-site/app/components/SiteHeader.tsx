"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "@phosphor-icons/react";
import { LogoLockup } from "./LogoLockup";

type Locale = "en" | "es";

const content = {
  en: {
    links: [
      ["What We Do", "#model"],
      ["Health Priorities", "#priorities"],
      ["Publications", "#publications"],
      ["About", "#about"],
      ["Get Involved", "#get-involved"],
    ],
    action: "Explore the model",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    navigation: "Primary navigation",
    languageLabel: "Ver este sitio en español",
    languageName: "Español",
    languageHref: "/es",
    languageCode: "es",
  },
  es: {
    links: [
      ["Qué hacemos", "#model"],
      ["Prioridades de salud", "#priorities"],
      ["Publicaciones", "#publications"],
      ["Acerca de", "#about"],
      ["Participe", "#get-involved"],
    ],
    action: "Explorar el modelo",
    menuOpen: "Abrir menú",
    menuClose: "Cerrar menú",
    navigation: "Navegación principal",
    languageLabel: "View this site in English",
    languageName: "English",
    languageHref: "/",
    languageCode: "en",
  },
} satisfies Record<Locale, {
  links: string[][];
  action: string;
  menuOpen: string;
  menuClose: string;
  navigation: string;
  languageLabel: string;
  languageName: string;
  languageHref: string;
  languageCode: Locale;
}>;

export function SiteHeader({ locale = "en" }: { locale?: Locale }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const copy = content[locale];

  useEffect(() => {
    if (open) {
      navigation.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    }

    const manageKeyboard = (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        menuButton.current?.focus();
        return;
      }
      if (event.key === "Tab") {
        const links = Array.from(
          navigation.current?.querySelectorAll<HTMLAnchorElement>("a") ?? [],
        );
        const focusable = [menuButton.current, ...links].filter(
          (item): item is HTMLButtonElement | HTMLAnchorElement => item !== null,
        );
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", manageKeyboard);
    document.body.classList.toggle("menu-open", open);
    return () => {
      window.removeEventListener("keydown", manageKeyboard);
      document.body.classList.remove("menu-open");
    };
  }, [open]);

  const closeMenu = () => {
    if (!open) return;
    setOpen(false);
    window.requestAnimationFrame(() => menuButton.current?.focus());
  };

  return (
    <header className="site-header" id="top">
      <LogoLockup href="#top" />
      <button ref={menuButton} className="menu-button" type="button" onClick={() => setOpen(!open)} aria-controls="primary-navigation" aria-expanded={open} aria-label={open ? copy.menuClose : copy.menuOpen}>
        {open ? <X size={25} aria-hidden="true" /> : <List size={25} aria-hidden="true" />}
      </button>
      <nav ref={navigation} id="primary-navigation" className={open ? "is-open" : ""} aria-label={copy.navigation}>
        {copy.links.map(([label, href]) => (
          <a key={label} href={href} onClick={closeMenu}>{label}</a>
        ))}
        <a
          className="language-switch"
          href={copy.languageHref}
          hrefLang={copy.languageCode}
          lang={copy.languageCode}
          aria-label={copy.languageLabel}
          onClick={closeMenu}
        >
          {copy.languageName}
        </a>
      </nav>
      <a className="header-partner" href="#model">{copy.action}</a>
    </header>
  );
}
