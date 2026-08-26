import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nationalDir = path.join(packageRoot, "data", "national");
const defaultOutputPath = path.join(packageRoot, "generated", "national-context.json");

type JsonRecord = Record<string, unknown>;

function hash(bytes: string) {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceVersion(sourceId: string, contentHash: string) {
  return `${sourceId}:${contentHash}`;
}

function isoDate(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[1]}-${match[2]}` : value;
}

function measure(input: {
  sourceId: string;
  sourceMeasureId: string;
  name: string;
  description: string;
  unit: "percent" | "count" | "rate" | "ratio" | "index";
  universe: string;
  direction: "adverse" | "protective" | "contextual";
  value: unknown;
  marginOfError?: unknown;
  dataPeriodStart?: string | null;
  dataPeriodEnd?: string | null;
  sourceMetadata?: Record<string, string | number | boolean | null>;
}) {
  const adverse = input.direction === "adverse";
  const protective = input.direction === "protective";
  return {
    id: `measure:${input.sourceId}:${input.sourceMeasureId.toLowerCase()}`,
    sourceMeasureId: input.sourceMeasureId,
    name: input.name,
    description: input.description,
    unit: input.unit,
    universe: input.universe,
    adjustment: "not_applicable",
    direction: input.direction,
    higherValueMeaning: adverse ? "adverse" : protective ? "favorable" : "neutral",
    comparisonPolicy: adverse ? "higher_is_concern" : protective ? "lower_is_concern" : "context_only",
    value: input.value ?? null,
    numericValue: numericValue(input.value),
    marginOfError: numericValue(input.marginOfError),
    dataPeriodStart: input.dataPeriodStart ?? null,
    dataPeriodEnd: input.dataPeriodEnd ?? null,
    sourceMetadata: input.sourceMetadata ?? {},
  };
}

async function governedArtifact(fileName: string) {
  const artifactPath = path.join(nationalDir, fileName);
  const bytes = await readFile(artifactPath, "utf8");
  return { value: JSON.parse(bytes) as JsonRecord, contentHash: hash(bytes) };
}

export async function buildNationalContextArtifact() {
  const [acsFile, hrsaFile, ahrfFile, ahrqFile] = await Promise.all([
    governedArtifact("acs-county-context.v1.json"),
    governedArtifact("hrsa-county-context.v1.json"),
    governedArtifact("ahrf-county-context.v1.json"),
    governedArtifact("ahrq-clh-county-context.v1.json"),
  ]);
  const acs = acsFile.value as any;
  const hrsa = hrsaFile.value as any;
  const ahrf = ahrfFile.value as any;
  const ahrq = ahrqFile.value as any;
  const sourceArtifacts = [acs, hrsa, ahrf, ahrq];
  for (const source of sourceArtifacts) {
    if (source.countyCount !== 3_144) {
      throw new Error(`${source.schemaVersion ?? "National source"} must contain 3,144 counties.`);
    }
  }

  const countyFips = Object.keys(acs.records).sort();
  if (
    countyFips.length !== 3_144
    || countyFips.some((fips) => !hrsa.counties[fips] || !ahrf.counties[fips] || !ahrq.counties[fips])
  ) {
    throw new Error("The governed national sources do not share the same complete 3,144-county geography.");
  }

  const generatedAt = sourceArtifacts
    .map((source) => String(source.generatedAt))
    .sort()
    .at(-1) as string;
  const sources = {
    "census-acs5": {
      sourceId: "census-acs5",
      sourceVersionId: sourceVersion("census-acs5", acsFile.contentHash),
      officialUrl: acs.source.officialUrl,
      releaseLabel: acs.source.title,
      releaseDate: acs.source.releaseDate,
      dataPeriodStart: acs.source.dataPeriod.start,
      dataPeriodEnd: acs.source.dataPeriod.end,
      retrievedAt: acs.source.retrievedAt,
      staleAfter: null,
      contentHash: acsFile.contentHash,
      schemaVersion: acs.schemaVersion,
      reviewStatus: "verified",
    },
    "hrsa-workforce": {
      sourceId: "hrsa-workforce",
      sourceVersionId: sourceVersion("hrsa-workforce", hrsaFile.contentHash),
      officialUrl: hrsa.officialUrl,
      releaseLabel: `HRSA shortage-area snapshot ${String(hrsa.generatedAt).slice(0, 10)}`,
      releaseDate: String(hrsa.generatedAt).slice(0, 10),
      dataPeriodStart: null,
      dataPeriodEnd: null,
      retrievedAt: hrsa.generatedAt,
      staleAfter: null,
      contentHash: hrsaFile.contentHash,
      schemaVersion: hrsa.schemaVersion,
      reviewStatus: "verified",
    },
    "ahrf-workforce": {
      sourceId: "ahrf-workforce",
      sourceVersionId: sourceVersion("ahrf-workforce", ahrfFile.contentHash),
      officialUrl: ahrf.officialUrl,
      releaseLabel: ahrf.title,
      releaseDate: ahrf.releaseDate,
      dataPeriodStart: "2023-01-01",
      dataPeriodEnd: "2024-12-31",
      retrievedAt: ahrf.generatedAt,
      staleAfter: null,
      contentHash: ahrfFile.contentHash,
      schemaVersion: ahrf.schemaVersion,
      reviewStatus: "verified",
    },
    "ahrq-clh": {
      sourceId: "ahrq-clh",
      sourceVersionId: sourceVersion("ahrq-clh", ahrqFile.contentHash),
      officialUrl: ahrq.officialUrl,
      releaseLabel: ahrq.title,
      releaseDate: ahrq.releaseDate,
      dataPeriodStart: "2023-01-01",
      dataPeriodEnd: "2023-12-31",
      retrievedAt: ahrq.generatedAt,
      staleAfter: null,
      contentHash: ahrqFile.contentHash,
      schemaVersion: ahrq.schemaVersion,
      reviewStatus: "verified",
    },
  };

  const counties = countyFips.map((fips) => {
    const acsRecord = acs.records[fips];
    const acsMeasures = [
      measure({ sourceId: "census-acs5", sourceMeasureId: "B01001_E001", name: "Total population", description: "ACS five-year estimate of the total population.", unit: "count", universe: "Total population", direction: "contextual", value: acsRecord.population, marginOfError: acsRecord.populationMoe }),
      measure({ sourceId: "census-acs5", sourceMeasureId: "B01002_E001", name: "Median age", description: "ACS five-year estimate of median age in years.", unit: "index", universe: "Total population", direction: "contextual", value: acsRecord.medianAge, marginOfError: acsRecord.medianAgeMoe, sourceMetadata: { displayUnit: "years" } }),
      measure({ sourceId: "census-acs5", sourceMeasureId: "B17001_PERCENT_BELOW_POVERTY", name: "Population below the poverty level", description: "ACS five-year percentage of people below the poverty level.", unit: "percent", universe: "Population for whom poverty status is determined", direction: "adverse", value: acsRecord.povertyPercent, marginOfError: acsRecord.povertyPercentMoe, sourceMetadata: { numerator: acsRecord.povertyNumerator, denominator: acsRecord.povertyDenominator } }),
      measure({ sourceId: "census-acs5", sourceMeasureId: "B08201_PERCENT_NO_VEHICLE", name: "Households with no vehicle available", description: "ACS five-year percentage of households with no vehicle available.", unit: "percent", universe: "Households", direction: "adverse", value: acsRecord.noVehiclePercent, marginOfError: acsRecord.noVehiclePercentMoe, sourceMetadata: { numerator: acsRecord.noVehicleNumerator, denominator: acsRecord.noVehicleDenominator } }),
      measure({ sourceId: "census-acs5", sourceMeasureId: "B28002_PERCENT_INTERNET_SUBSCRIPTION", name: "Households with an internet subscription", description: "ACS five-year percentage of households with an internet subscription.", unit: "percent", universe: "Households", direction: "protective", value: acsRecord.internetSubscriptionPercent, marginOfError: acsRecord.internetSubscriptionPercentMoe, sourceMetadata: { numerator: acsRecord.internetSubscriptionNumerator, denominator: acsRecord.internetSubscriptionDenominator } }),
    ];
    const ahrfMeasures = ahrf.counties[fips].observations.map((observation: any) => measure({
      sourceId: "ahrf-workforce",
      sourceMeasureId: observation.variableId,
      name: observation.label,
      description: `${observation.label} from the approved AHRF county release; contextual only.`,
      unit: observation.unit === "people" || observation.unit === "professionals" || observation.unit === "facilities" || observation.unit === "sites" ? "count" : "ratio",
      universe: "County-level AHRF record",
      direction: "contextual",
      value: observation.value,
      dataPeriodStart: `${observation.year}-01-01`,
      dataPeriodEnd: `${observation.year}-12-31`,
      sourceMetadata: { sourceUnit: observation.unit, sourceYear: observation.year },
    }));
    const ahrqMeasures = ahrq.counties[fips].observations.map((observation: any) => {
      const adverse = observation.direction === "adverse";
      const unit = observation.unit === "percent" ? "percent"
        : observation.unit.includes("per 1,000") ? "rate" : "index";
      return measure({
        sourceId: "ahrq-clh",
        sourceMeasureId: observation.variableId,
        name: observation.label,
        description: `${observation.label} from the codebook-matched AHRQ Community-Level Health Database county release.`,
        unit,
        universe: "County-level AHRQ Community-Level Health Database record",
        direction: adverse ? "adverse" : "contextual",
        value: observation.value,
        dataPeriodStart: "2023-01-01",
        dataPeriodEnd: "2023-12-31",
        sourceMetadata: {
          sourceUnit: observation.unit,
          dataPeriod: observation.dataPeriod,
          originalSource: observation.originalSource,
          domain: observation.domain,
          topic: observation.topic,
        },
      });
    });
    const workforce = hrsa.counties[fips];
    const normalizeDesignation = (designation: any) => ({
      ...designation,
      designationDate: isoDate(designation.designationDate),
      lastUpdateDate: isoDate(designation.lastUpdateDate),
      sourceScope: designation.wholeCounty ? "whole_county_geographic_designation" : "source_designation",
      sourceMetadata: designation.populationType ? { populationType: designation.populationType } : {},
    });
    return {
      fips,
      acs: acsMeasures,
      hpsa: workforce.hpsa.map(normalizeDesignation),
      muaP: workforce.muaP.map(normalizeDesignation),
      ahrf: ahrfMeasures,
      ahrq: ahrqMeasures,
    };
  });

  return {
    schemaVersion: "sozorock.national-context.v1",
    generatedAt,
    countyCount: counties.length,
    sources,
    counties,
  };
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const outputPath = path.resolve(process.cwd(), process.argv[2] ?? defaultOutputPath);
  const artifact = await buildNationalContextArtifact();
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(artifact)}\n`);
  console.log(JSON.stringify({ outputPath, countyCount: artifact.countyCount, generatedAt: artifact.generatedAt }, null, 2));
}
