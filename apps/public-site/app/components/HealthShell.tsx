import { HealthHeader } from "./HealthHeader";

export function HealthFooter({ spanish = false }: { spanish?: boolean }) {
  return (
    <footer className="hs-footer">
      <div className="hs-footer-top">
        <a href="https://www.sozorockfoundation.org/" className="hs-foundation">
          The SozoRock
          <br />
          Foundation
        </a>
        <p>
          {spanish
            ? "Sistemas para el acceso a la salud. Una iniciativa de The SozoRock Foundation, Inc."
            : "Systems for health access. An initiative of The SozoRock Foundation, Inc."}
        </p>
        <a href="/contact">
          {spanish ? "Hablemos de una colaboración" : "Discuss a partnership"}
        </a>
      </div>
      <div className="hs-footer-bottom">
        <span>© {new Date().getFullYear()} The SozoRock Foundation, Inc.</span>
        <nav aria-label={spanish ? "Información legal" : "Legal and contact"}>
          <a href="/privacy">{spanish ? "Privacidad" : "Privacy"}</a>
          <a href="/terms">{spanish ? "Términos" : "Terms"}</a>
          <a href="/accessibility">
            {spanish ? "Accesibilidad" : "Accessibility"}
          </a>
          <a href="/nondiscrimination">
            {spanish ? "No discriminación" : "Nondiscrimination"}
          </a>
          <a href="/contact">{spanish ? "Contacto" : "Contact"}</a>
        </nav>
      </div>
    </footer>
  );
}

export function HealthShell({
  children,
  spanish = false,
}: {
  children: React.ReactNode;
  spanish?: boolean;
}) {
  return (
    <div className="health-system">
      <a className="hs-skip" href="#health-main">
        {spanish ? "Saltar al contenido" : "Skip to content"}
      </a>
      <HealthHeader spanish={spanish} />
      {children}
      <HealthFooter spanish={spanish} />
    </div>
  );
}
