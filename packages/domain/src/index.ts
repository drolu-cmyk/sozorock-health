export type StateReadiness =
  | "discovery"
  | "provider-verification"
  | "launch-ready"
  | "temporarily-paused"
  | "not-active";

export type UserRole =
  | "resident"
  | "hub-navigator"
  | "provider-admin"
  | "county-admin"
  | "internal-operator";

export type HubType = "Library" | "Community" | "Home";
export type SupportedLanguage = "English" | "Spanish" | "ASL" | "Other";

export type CountyAccessRecord = {
  id: string;
  fips: string;
  state: string;
  stateCode: string;
  county: string;
  zip: string;
  period: string;
  hubType: HubType;
  language: SupportedLanguage;
  sampleSize: number;
  connectionRequests: number;
  completedPathways: number;
  medianMinutes: number;
  hubs: number;
  accessIndex: number;
  barriers: {
    transportation: number;
    cost: number;
    information: number;
    digital: number;
    language: number;
  };
};

export type CountyFilters = {
  state: string;
  county: string;
  zip: string;
  period: string;
  hubType: string;
  language: string;
  barrier?: string;
  accessRange?: string;
};

export const disclosureControl = {
  minimumCellSize: 11,
  suppressSmallCells: true,
} as const;

export const cbcapSeedMetadata = {
  source: "Illustrative SozoRock Health seed data",
  status: "demonstration-only",
  refreshedAt: "July 10, 2026",
  note: "Values are synthetic and must not be used for public policy, funding, or care decisions.",
} as const;

export const countyAccessSeed: CountyAccessRecord[] = [
  {
    id: "ny-delaware-13753-library-en", fips: "36025",
    state: "New York", stateCode: "NY", county: "Delaware County", zip: "13753", period: "2026 Q2",
    hubType: "Library", language: "English", sampleSize: 148, connectionRequests: 132,
    completedPathways: 91, medianMinutes: 19, hubs: 5, accessIndex: 72,
    barriers: {transportation: 78, cost: 49, information: 63, digital: 57, language: 22},
  },
  {
    id: "ny-delaware-13856-community-es", fips: "36025",
    state: "New York", stateCode: "NY", county: "Delaware County", zip: "13856", period: "2026 Q2",
    hubType: "Community", language: "Spanish", sampleSize: 34, connectionRequests: 29,
    completedPathways: 18, medianMinutes: 24, hubs: 2, accessIndex: 58,
    barriers: {transportation: 72, cost: 55, information: 67, digital: 44, language: 61},
  },
  {
    id: "ny-schoharie-12157-home-en", fips: "36095",
    state: "New York", stateCode: "NY", county: "Schoharie County", zip: "12157", period: "2026 Q1",
    hubType: "Home", language: "English", sampleSize: 83, connectionRequests: 76,
    completedPathways: 45, medianMinutes: 27, hubs: 3, accessIndex: 54,
    barriers: {transportation: 81, cost: 62, information: 58, digital: 69, language: 18},
  },
  {
    id: "ky-wayne-42633-community-en", fips: "21231",
    state: "Kentucky", stateCode: "KY", county: "Wayne County", zip: "42633", period: "2026 Q2",
    hubType: "Community", language: "English", sampleSize: 116, connectionRequests: 104,
    completedPathways: 66, medianMinutes: 22, hubs: 4, accessIndex: 61,
    barriers: {transportation: 86, cost: 74, information: 52, digital: 63, language: 14},
  },
  {
    id: "ky-wayne-42633-library-es", fips: "21231",
    state: "Kentucky", stateCode: "KY", county: "Wayne County", zip: "42633", period: "2026 Q1",
    hubType: "Library", language: "Spanish", sampleSize: 9, connectionRequests: 8,
    completedPathways: 4, medianMinutes: 31, hubs: 1, accessIndex: 46,
    barriers: {transportation: 82, cost: 71, information: 64, digital: 58, language: 72},
  },
  {
    id: "tx-brewster-79830-library-en", fips: "48043",
    state: "Texas", stateCode: "TX", county: "Brewster County", zip: "79830", period: "2026 Q2",
    hubType: "Library", language: "English", sampleSize: 91, connectionRequests: 79,
    completedPathways: 51, medianMinutes: 26, hubs: 3, accessIndex: 57,
    barriers: {transportation: 91, cost: 68, information: 54, digital: 73, language: 39},
  },
  {
    id: "ca-imperial-92231-community-es", fips: "06025",
    state: "California", stateCode: "CA", county: "Imperial County", zip: "92231", period: "2026 Q2",
    hubType: "Community", language: "Spanish", sampleSize: 177, connectionRequests: 161,
    completedPathways: 118, medianMinutes: 16, hubs: 7, accessIndex: 77,
    barriers: {transportation: 59, cost: 64, information: 49, digital: 38, language: 70},
  },
  {
    id: "nm-mckinley-87301-home-other", fips: "35031",
    state: "New Mexico", stateCode: "NM", county: "McKinley County", zip: "87301", period: "2026 Q2",
    hubType: "Home", language: "Other", sampleSize: 68, connectionRequests: 58,
    completedPathways: 37, medianMinutes: 29, hubs: 2, accessIndex: 49,
    barriers: {transportation: 88, cost: 57, information: 76, digital: 71, language: 79},
  },
];

export function canRouteConnection(readiness: StateReadiness, providerVerified: boolean): boolean {
  return readiness === "launch-ready" && providerVerified;
}

export function canViewCountyIntelligence(role: UserRole, countyApproved: boolean): boolean {
  return role === "internal-operator" || (role === "county-admin" && countyApproved);
}

export function filterCountyRecords(records: CountyAccessRecord[], filters: CountyFilters) {
  return records.filter((record) =>
    (filters.state === "All states" || record.state === filters.state) &&
    (filters.county === "All counties" || record.county === filters.county) &&
    (filters.zip === "All ZIP codes" || record.zip === filters.zip) &&
    (filters.period === "All periods" || record.period === filters.period) &&
    (filters.hubType === "All hub types" || record.hubType === filters.hubType) &&
    (filters.language === "All languages" || record.language === filters.language)
    && (!filters.barrier || filters.barrier === "All barriers" || Object.entries(record.barriers).sort((a,b)=>b[1]-a[1])[0]?.[0] === filters.barrier)
    && (!filters.accessRange || filters.accessRange === "All access levels" || (filters.accessRange === "High (70-100)" ? record.accessIndex >= 70 : filters.accessRange === "Developing (50-69)" ? record.accessIndex >= 50 && record.accessIndex < 70 : record.accessIndex < 50))
  );
}

export function isSuppressed(record: CountyAccessRecord) {
  return disclosureControl.suppressSmallCells && record.sampleSize < disclosureControl.minimumCellSize;
}

export function discloseCountyRecords(records: CountyAccessRecord[]) {
  return records.filter((record) => !isSuppressed(record));
}

export function aggregateCountyRecords(records: CountyAccessRecord[]) {
  const visible = discloseCountyRecords(records);
  const totalRequests = visible.reduce((sum, item) => sum + item.connectionRequests, 0);
  const completedPathways = visible.reduce((sum, item) => sum + item.completedPathways, 0);
  const sampleSize = visible.reduce((sum, item) => sum + item.sampleSize, 0);
  const weighted = (key: "medianMinutes" | "accessIndex") => sampleSize
    ? Math.round(visible.reduce((sum, item) => sum + item[key] * item.sampleSize, 0) / sampleSize)
    : 0;

  return {
    visible,
    suppressedCount: records.length - visible.length,
    sampleSize,
    totalRequests,
    completedPathways,
    completionRate: totalRequests ? Math.round((completedPathways / totalRequests) * 100) : 0,
    medianMinutes: weighted("medianMinutes"),
    accessIndex: weighted("accessIndex"),
    hubs: visible.reduce((sum, item) => sum + item.hubs, 0),
  };
}

export function countyRecordsToCsv(records: CountyAccessRecord[]) {
  const header = ["State", "County", "ZIP", "Period", "Hub type", "Language", "Sample size", "Requests", "Completed pathways", "Median minutes", "Hubs", "Access index"];
  const rows = discloseCountyRecords(records).map((record) => [
    record.state, record.county, record.zip, record.period, record.hubType, record.language,
    record.sampleSize, record.connectionRequests, record.completedPathways, record.medianMinutes,
    record.hubs, record.accessIndex,
  ]);
  return [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
}

export type CountyInsightContext = {
  filters: CountyFilters;
  visibleRecords: CountyAccessRecord[];
  suppressedCount: number;
};

export type CountyInsight = {
  headline: string;
  evidence: string[];
  nonClinicalActions: string[];
  generatedAt: string;
};

/** Server implementations may provide AI-assisted synthesis without coupling the UI to a model vendor. */
export interface CountyInsightAdapter {
  generate(context: CountyInsightContext): Promise<CountyInsight>;
}
