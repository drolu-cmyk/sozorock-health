export type PublicPlanningDocument = {
  id: string;
  title: string;
  publisher: string;
  officialUrl: string;
  publishedAt: string;
  documentType: "CHA" | "CHNA" | "CHIP" | "Implementation strategy";
  coverage: "County" | "Regional" | "Hospital service area";
  status: "not_yet_verified";
  reviewStatus: "provisional";
};

// Public-safe metadata only. Milestone 3 claims remain withheld until a named
// human reviewer changes their status to verified in the evidence pipeline.
export const planningDocumentsByCounty: Record<string, PublicPlanningDocument> = {
  "36001": {
    id: "candidate:albany-capital-region-chna-2025",
    title: "2025 Capital Region Community Health Needs Assessment",
    publisher: "Healthy Capital District",
    officialUrl: "https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf",
    publishedAt: "2025-10-01",
    documentType: "CHNA",
    coverage: "Regional",
    status: "not_yet_verified",
    reviewStatus: "provisional",
  },
  "36093": {
    id: "candidate:schenectady-capital-region-chna-2025",
    title: "2025 Capital Region Community Health Needs Assessment",
    publisher: "Healthy Capital District",
    officialUrl: "https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf",
    publishedAt: "2025-10-01",
    documentType: "CHNA",
    coverage: "Regional",
    status: "not_yet_verified",
    reviewStatus: "provisional",
  },
  "36057": {
    id: "candidate:st-marys-chna-2024",
    title: "2024 St. Mary's Healthcare Community Health Needs Assessment",
    publisher: "St. Mary's Healthcare",
    officialUrl: "https://www.smha.org/wp-content/uploads/2025/05/2024-PRC-CHNA-Report-St-Marys-Healthcare-Amsterdam_compressed-2.pdf",
    publishedAt: "2024-08-01",
    documentType: "CHNA",
    coverage: "Hospital service area",
    status: "not_yet_verified",
    reviewStatus: "provisional",
  },
  "42029": {
    id: "candidate:chester-county-cha-2025",
    title: "2025 Chester County Community Health Assessment",
    publisher: "Chester County Health Department",
    officialUrl: "https://www.chesco.org/DocumentCenter/View/79811/Chester-County-CHA--2025",
    publishedAt: "2025-05-27",
    documentType: "CHA",
    coverage: "County",
    status: "not_yet_verified",
    reviewStatus: "provisional",
  },
  "48029": {
    id: "candidate:university-health-bexar-implementation-2026",
    title: "University Health Community Health Needs Assessment and Implementation Strategy for Bexar County, 2026–2028",
    publisher: "University Health",
    officialUrl: "https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx",
    publishedAt: "2026-03-01",
    documentType: "Implementation strategy",
    coverage: "Hospital service area",
    status: "not_yet_verified",
    reviewStatus: "provisional",
  },
};

