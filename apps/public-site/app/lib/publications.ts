export type PublicationStatus = "Available" | "In development";

export type Publication = {
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  relevance: string;
  status: PublicationStatus;
  tags: readonly string[];
  cover: string | null;
  assetKey: string | null;
};

export const publications: readonly Publication[] = [
  {
    slug: "rural-equity-blueprint-volume-1",
    title: "Rural Equity Blueprint Series, Volume 1",
    shortTitle: "Rural Equity Blueprint, Volume 1",
    description: "A practical framework for improving rural health access through accountable local systems.",
    relevance: "Connects community readiness, health literacy, technology, workforce development, and access planning.",
    status: "Available",
    tags: ["Rural health", "Health access", "Public systems"],
    cover: "/publications/covers/rural-equity-blueprint-volume-1.png",
    assetKey: "rural-equity-blueprint-volume-1.pdf",
  },
  {
    slug: "rethinking-rural-governance-volume-1",
    title: "Rethinking Rural Governance, Volume 1",
    shortTitle: "Rethinking Rural Governance, Volume 1",
    description: "A governance framework for helping rural institutions move from fragmented responses to coordinated decision-making.",
    relevance: "Explains how public, private, and community institutions can use shared accountability and systems intelligence.",
    status: "Available",
    tags: ["Governance", "County systems", "Accountability"],
    cover: "/publications/covers/rethinking-rural-governance-volume-1.png",
    assetKey: "rethinking-rural-governance-volume-1.pdf",
  },
  {
    slug: "health-systems-assurance",
    title: "Health Systems Assurance",
    shortTitle: "Health Systems Assurance",
    description: "A forthcoming public-interest series on digital assurance, governance controls, AI-enabled health infrastructure, and accountable implementation.",
    relevance: "For public agencies, providers, researchers, and institutions preparing to use digital and AI-enabled systems responsibly.",
    status: "In development",
    tags: ["Digital assurance", "AI readiness", "Cybersecurity readiness"],
    cover: null,
    assetKey: null,
  },
] as const;

export function getPublication(slug: string) {
  return publications.find((publication) => publication.slug === slug);
}

