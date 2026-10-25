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
  plainTitle: string;
  takeaway: string;
  listFinding: string;
  findings: readonly { value: string; text: string }[];
  findingsSource: string;
  ideasTitle: string;
  ideas: readonly string[];
  previewWidth: number;
  previewHeight: number;
};

export const publications: readonly Publication[] = [
  {
    slug: "rural-equity-blueprint-volume-1",
    plainTitle: "Rural Equity Blueprint",
    takeaway: "Rural access improves fastest when care, training and local reporting work as one system.",
    listFinding: "Fix rural access through how services are organized, not only by adding more of them.",
    findings: [
      { value: "4", text: "parts that work together: digital access, a local health workforce pipeline, outreach in plain language and more than one language, and county health planning." },
      { value: "30–40%", text: "lower administrative overhead than traditional outreach programs of a similar scale, in the report’s modeled projection." },
      { value: "Health Access Day", text: "is the working prototype. Each cycle produces data counties can use in their community health assessments and improvement plans." },
    ],
    findingsSource: "Figures are modeled projections prepared before any pilot. They are not measured outcomes.",
    ideasTitle: "Three ideas for rural health leaders.",
    ideas: ["Organize first: shared data, scheduling and reporting come before new services.", "Train locally: connect students and providers to the places that need them.", "Report what counties already track, so every visit improves the next plan."],
    previewWidth: 900,
    previewHeight: 1273,
    previewCover: "/publications/previews/rural-equity-blueprint-volume-1.webp",
    doi: "10.65473/rebs-v1-2025",
    title: "Rural Equity Blueprint Series (REBS), Volume 1",
    author: "Dr. Oluwabiyi Adeyemo",
    publisher: "The SozoRock Foundation Inc.",
    published: "2025",
    datePublished: "2025",
    limitations: "This report sets out access models. It does not report operating services or measured health outcomes. Local delivery depends on agreements, capacity and licensed clinical responsibilities.",
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
    plainTitle: "Rethinking Rural Governance",
    takeaway: "Rural counties already hold the data to plan health. Connecting it is the work.",
    listFinding: "In one rural county, 58% of public health spending depends on state and federal aid.",
    findings: [
      { value: "58%", text: "of Delaware County, New York State’s 2024 public health spending came from state and federal aid, which limits how freely the county can shift resources." },
      { value: "12%", text: "of the county’s health budget went to keeping its public health workforce in place." },
      { value: "Missing", text: "a link between staffing data and expected demand for services, so workforce plans rely on past reports." },
    ],
    findingsSource: "Delaware County Public Health Services, 2024 Annual Report; SozoRock Foundation analysis. One county, used as a reference case.",
    ideasTitle: "Three ideas for county leaders.",
    ideas: ["Counties already collect the data needed to plan health. The gap is connecting it.", "Move from reporting to the state toward planning for residents, using the same data.", "Start with workforce, chronic disease and maternal and child health, where local data is strongest."],
    previewWidth: 900,
    previewHeight: 1165,
    previewCover:
      "/publications/previews/rethinking-rural-governance-volume-1.webp",
    doi: "10.65473/rrg-v1-2025",
    title: "Rethinking Rural Governance Series (RRG), Volume 1",
    author: "Dr. Oluwabiyi Adeyemo",
    publisher: "The SozoRock Foundation Inc.",
    published: "2025",
    datePublished: "2025",
    limitations: "This governance framework uses Delaware County, New York State as a reference case. That does not establish local adoption, independent validation or outcomes.",
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
    plainTitle: "Health Systems Assurance",
    takeaway: "Digital health earns trust when it is tested, not assumed.",
    listFinding: "Only 6 of 19 health-system AI governance frameworks were built on primary studies.",
    findings: [
      { value: "76%", text: "of U.S. hospitals took part in all four kinds of electronic health information exchange in 2025, up from 23% in 2014." },
      { value: "6 of 19", text: "health-system AI governance frameworks in a 2026 review were built on primary studies." },
      { value: "10 of 77", text: "governance frameworks for health care organizations in a second 2026 review covered principles, assessment, lifecycle and oversight together." },
    ],
    findingsSource: "ASTP/ONC Health IT Quick Stats; Alami and colleagues, 2026; Wang and colleagues, 2026.",
    ideasTitle: "Three ideas for health system leaders.",
    ideas: ["Focus deeper checks on systems whose failure would affect care, privacy or access.", "Ask for proof that a system works today, not only a policy or a certificate.", "Give smaller and rural organizations shared services instead of enterprise-scale requirements."],
    previewWidth: 900,
    previewHeight: 1165,
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
    limitations: "The analytical tools in this report are not validated standards, a certification scheme, an audit or clinical guidance.",
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
