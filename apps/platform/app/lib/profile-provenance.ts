import { cdcProfileSources } from "./cdc-profile-contract.ts";
import {
  committedIndicatorSnapshot,
  committedCountySource,
  TIGERWEB_CURRENT_SOURCE,
  USGS_GNIS_SOURCE,
} from "./geography-provenance.ts";
import type {
  GeographyKind,
  GeographyProfile,
  GeographySourceReference,
  ProfileResponse,
  SourceManifest,
} from "./types";

function committedCdcSource(
  manifest: SourceManifest,
  kind: "county" | "state",
): GeographySourceReference {
  const source = committedIndicatorSnapshot(manifest);
  return {
    ...source,
    method: kind === "state"
      ? "Population-weighted state summary derived from committed county-level CDC PLACES estimates."
      : "Exact county FIPS match in the committed CDC PLACES snapshot.",
  };
}

function onDemandCdcSource(kind: "place" | "zcta"): GeographySourceReference {
  const source = cdcProfileSources[kind];
  return {
    agency: "Centers for Disease Control and Prevention",
    dataset: source.label,
    vintage: source.released,
    url: source.url,
    method: `On-demand exact ${kind === "zcta" ? "ZCTA" : "place"} GEOID query; cached for up to one day.`,
    freshness: `Queried on demand from the ${source.released} release; cache may be up to one day old.`,
    refreshedAt: null,
  };
}

export function buildProfileProvenance({
  kind,
  profile,
  manifest,
  censusSourceUrl,
  gnisSourceUrl,
}: {
  kind: GeographyKind;
  profile: GeographyProfile;
  manifest: SourceManifest;
  censusSourceUrl?: string | null;
  gnisSourceUrl?: string | null;
}): ProfileResponse["provenance"] {
  const geography = kind === "state" || kind === "county"
    ? committedCountySource(manifest)
    : kind === "community"
      ? {
          ...USGS_GNIS_SOURCE,
          url: gnisSourceUrl || USGS_GNIS_SOURCE.url,
        }
      : {
        ...TIGERWEB_CURRENT_SOURCE,
        url: censusSourceUrl || TIGERWEB_CURRENT_SOURCE.url,
      };
  const indicators = profile.sourceStatus !== "available"
    ? null
    : kind === "place" || kind === "zcta"
      ? onDemandCdcSource(kind)
      : kind === "state" || kind === "county"
        ? committedCdcSource(manifest, kind)
        : null;
  const limitations = [
    ...(indicators
      ? ["Health indicators are area-level model-based estimates; they are not diagnoses or facts about any individual."]
      : ["This response verifies the geography only; compatible health indicators are not available and have not been inferred."]),
    "CB-CAP planning attention is a transparent demonstration model, not an official designation, health-equity score, clinical measure, or prediction.",
  ];
  if (kind === "zcta") {
    limitations.push("A ZCTA is a Census statistical area, not a USPS delivery route, and not every ZIP Code has a ZCTA.");
  }
  if (kind === "place") {
    limitations.push("A Census place may cross county boundaries and may differ from a postal city name.");
  }
  if (kind === "locality") {
    limitations.push("County subdivisions and consolidated cities are searchable geography only in the current public-data release.");
  }
  if (kind === "community") {
    limitations.push("GNIS verifies an official populated-place name and point location; it does not define a Census statistical boundary or support a compatible PLACES profile in this release.");
  }
  return {
    evidenceStatus: kind === "state" && indicators
      ? "derived-official-source-estimates"
      : indicators
        ? "official-source-estimates"
        : "official-geography-only",
    geography,
    indicators,
    planning: {
      classification: "demonstration-model",
      available: profile.planning.planningPressure !== null,
      label: manifest.demonstrationIndex.label,
      method: manifest.demonstrationIndex.formula,
      boundary: manifest.demonstrationIndex.boundary,
    },
    limitations,
  };
}
