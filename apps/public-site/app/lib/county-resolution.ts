import { createRequire } from "node:module";

const resolutionIndexJson = createRequire(import.meta.url)(
  "../../../../packages/evidence-core/data/national/county-resolution-index.v2.json",
) as unknown;

type IndexedCounty = {
  countyGeoid: string;
  countyName: string;
  statePostalCode: string;
  overlapAreaPercent: number | null;
  overlapPopulationPercent: number | null;
  landAreaSquareMeters: number;
};

type ResolutionIndex = {
  censusVintage: string;
  method: string;
  zipCaveat: string;
  placeCaveat: string;
  source: {
    officialUrl: string;
  };
  places: Record<string, IndexedCounty[]>;
  zctas: Record<string, IndexedCounty[]>;
};

const resolutionIndex = resolutionIndexJson as ResolutionIndex;

export type CountyResolutionCandidate = {
  countyGeoid: string;
  label: string;
  overlapAreaPercent: number | null;
  overlapPopulationPercent: number | null;
  calculationMethod: string;
  isPrimary: boolean;
  sourceUrl: string;
  vintage: string;
};

export type CountyResolution = {
  original: {
    kind: "county" | "place" | "zip";
    geoid: string;
    label: string;
  };
  status: "resolved" | "selection_required" | "not_found";
  selectedCountyGeoid: string | null;
  counties: CountyResolutionCandidate[];
  caveats: string[];
};

function indexedResolution(input: {
  kind: "place" | "zip";
  geoid: string;
  label: string;
}): CountyResolution {
  const records = input.kind === "place"
    ? resolutionIndex.places[input.geoid] ?? []
    : resolutionIndex.zctas[input.geoid] ?? [];
  const counties = records.map((county, index) => ({
    countyGeoid: county.countyGeoid,
    label: `${county.countyName}, ${county.statePostalCode}`,
    overlapAreaPercent: county.overlapAreaPercent,
    overlapPopulationPercent: county.overlapPopulationPercent,
    calculationMethod: resolutionIndex.method,
    isPrimary: index === 0,
    sourceUrl: resolutionIndex.source.officialUrl,
    vintage: resolutionIndex.censusVintage,
  }));
  return {
    original: input,
    status: counties.length > 1 ? "selection_required" : counties.length === 1 ? "resolved" : "not_found",
    selectedCountyGeoid: counties.length === 1 ? counties[0].countyGeoid : null,
    counties,
    caveats: [
      input.kind === "place" ? resolutionIndex.placeCaveat : resolutionIndex.zipCaveat,
      "Overlap percentages use 2025 Census block land area. They do not imply population share.",
    ],
  };
}

export async function resolveEvidenceCounty(input: {
  kind: "county" | "place" | "zip";
  geoid: string;
  label: string;
  selectedCountyGeoid?: string | null;
}): Promise<CountyResolution> {
  const resolution: CountyResolution = input.kind === "county"
    ? {
        original: { kind: input.kind, geoid: input.geoid, label: input.label },
        status: "resolved" as const,
        selectedCountyGeoid: input.geoid,
        counties: [{
          countyGeoid: input.geoid,
          label: input.label,
          overlapAreaPercent: 100,
          overlapPopulationPercent: 100,
          calculationMethod: "Direct official Census county GEOID resolution",
          isPrimary: true,
          sourceUrl: "https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html",
          vintage: resolutionIndex.censusVintage,
        }],
        caveats: [] as string[],
      }
    : indexedResolution({ kind: input.kind, geoid: input.geoid, label: input.label });

  if (input.selectedCountyGeoid) {
    const selected = resolution.counties.find((county) => county.countyGeoid === input.selectedCountyGeoid);
    if (selected) return { ...resolution, status: "resolved", selectedCountyGeoid: selected.countyGeoid };
  }
  return resolution;
}
