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
  author?: string;
  publisher?: string;
  published?: string;
  datePublished?: string;
  edition?: string;
  isbn?: string;
  evidenceCutoff?: string;
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
    title: "Health Systems Assurance, Volume 1",
    shortTitle: "Health Systems Assurance, Volume 1",
    description: "From compliance to evidence-based digital assurance.",
    relevance: "Connects obligations and risk objectives to operating evidence, monitoring, exceptions, remediation, and accountable decisions.",
    status: "Available",
    tags: ["Digital assurance", "Operating evidence", "Health infrastructure"],
    cover: "/publications/covers/health-systems-assurance-volume-1.jpg",
    assetKey: "health-systems-assurance-volume-1.pdf",
    author: "Dr. Oluwabiyi Adeyemo",
    publisher: "The SozoRock Foundation Inc.",
    published: "August 2026",
    datePublished: "2026-08",
    edition: "First edition",
    isbn: "979-8-9936477-3-9",
    evidenceCutoff: "August 12, 2026",
  },
] as const;

export function getPublication(slug: string) {
  return publications.find((publication) => publication.slug === slug);
}
