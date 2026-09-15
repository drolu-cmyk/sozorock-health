export type PublicationStatus = "Available" | "In development";

export type Publication = {
  slug: string;
  legacySlugs?: readonly string[];
  title: string;
  shortTitle: string;
  description: string;
  relevance: string;
  limitations?: string;
  status: PublicationStatus;
  tags: readonly string[];
  cover: string | null;
  previewCover?: string;
  coverWidth?: number;
  coverHeight?: number;
  assetKey: string | null;
  author?: string;
  publisher?: string;
  published?: string;
  datePublished?: string;
  edition?: string;
  isbn?: string;
  doi?: string;
  evidenceCutoff?: string;
};

export const publications: readonly Publication[] = [
  {
    slug: "rural-equity-blueprint-volume-1",
    previewCover: "/publications/previews/rural-equity-blueprint-volume-1.webp",
    doi: "10.65473/rebs-v1-2025",
    title: "Rural Equity Blueprint Series (REBS), Volume 1",
    author: "Dr. Oluwabiyi Adeyemo",
    publisher: "The SozoRock Foundation Inc.",
    published: "2025",
    datePublished: "2025",
    limitations: "This publication proposes access models. It does not establish operating services or measured health outcomes. Local delivery depends on agreements, capacity and licensed clinical responsibilities.",
    shortTitle: "Rural Equity Blueprint, Volume 1",
    description:
      "A practical framework for improving rural health access through accountable local systems.",
    relevance:
      "Connects community readiness, health literacy, technology, workforce development, and access planning.",
    status: "Available",
    tags: ["Rural health", "Health access", "Public systems"],
    cover: "/publications/covers/rural-equity-blueprint-volume-1.png",
    coverWidth: 2481,
    coverHeight: 3508,
    assetKey: "rural-equity-blueprint-volume-1.pdf",
  },
  {
    slug: "rethinking-rural-governance-volume-1",
    previewCover:
      "/publications/previews/rethinking-rural-governance-volume-1.webp",
    doi: "10.65473/rrg-v1-2025",
    title: "Rethinking Rural Governance Series (RRG), Volume 1",
    author: "Dr. Oluwabiyi Adeyemo",
    publisher: "The SozoRock Foundation Inc.",
    published: "2025",
    datePublished: "2025",
    limitations: "This is a proposed governance framework. Its use of Delaware County, New York as a reference case does not establish local adoption, independent validation or outcomes.",
    shortTitle: "Rethinking Rural Governance, Volume 1",
    description:
      "A governance framework for helping rural institutions move from fragmented responses to coordinated decision-making.",
    relevance:
      "Explains how public, private, and community institutions can use shared accountability and systems intelligence.",
    status: "Available",
    tags: ["Governance", "County systems", "Accountability"],
    cover: "/publications/covers/rethinking-rural-governance-volume-1.jpg",
    coverWidth: 2550,
    coverHeight: 3300,
    assetKey: "rethinking-rural-governance-volume-1.pdf",
  },
  {
    slug: "health-systems-assurance-volume-1",
    previewCover:
      "/publications/previews/health-systems-assurance-volume-1.webp",
    legacySlugs: ["health-systems-assurance"],
    title: "Health Systems Assurance, Volume 1",
    shortTitle: "Health Systems Assurance, Volume 1",
    description: "From compliance to evidence-based digital assurance.",
    relevance:
      "Connects obligations and risk objectives to operating evidence, monitoring, exceptions, remediation, and accountable decisions.",
    status: "Available",
    tags: ["Digital assurance", "Operating evidence", "Health infrastructure"],
    cover: "/publications/covers/health-systems-assurance-volume-1.jpg",
    coverWidth: 2550,
    coverHeight: 3300,
    assetKey: "health-systems-assurance-volume-1.pdf",
    author: "Dr. Oluwabiyi Adeyemo",
    publisher: "The SozoRock Foundation Inc.",
    published: "August 2026",
    datePublished: "2026-08",
    edition: "First edition",
    isbn: "979-8-9936477-3-9",
    evidenceCutoff: "August 12, 2026",
    limitations: "The proposed analytical tools are not validated standards, a certification scheme, an audit or clinical guidance.",
  },
] as const;

export function getPublication(slug: string) {
  return publications.find(
    (publication) =>
      publication.slug === slug || publication.legacySlugs?.includes(slug),
  );
}

export function canonicalPublicationSlug(slug: string) {
  return getPublication(slug)?.slug;
}
