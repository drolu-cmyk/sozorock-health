const sourceNames: Record<string, string> = {
  "ahrf-workforce": "Area Health Resources Files",
  "ahrq-clh": "Community-Level Health Database (AHRQ)",
  "cdc-places": "CDC PLACES",
  "census-acs5": "American Community Survey, five-year estimates",
  "census-geography": "U.S. Census geography",
  "hrsa-workforce": "HRSA designation summary",
  "local-planning-documents": "Local planning documents",
};

export function evidenceSourceLabel(source: { sourceId: string; reason: string }): string {
  if (source.sourceId === "hrsa-workforce") {
    if (source.reason.includes("hpsa:dental")) return "Dental shortage designations (HRSA)";
    if (source.reason.includes("hpsa:mental_health")) return "Mental health shortage designations (HRSA)";
    if (source.reason.includes("hpsa:primary_care")) return "Primary care shortage designations (HRSA)";
    if (source.reason.includes("MUA/P")) return "Medically underserved areas and populations (HRSA)";
  }
  return sourceNames[source.sourceId] ?? source.sourceId.replaceAll("-", " ").replace(/^./, letter => letter.toUpperCase());
}
