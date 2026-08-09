import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(gunzipSync(await readFile(
  path.resolve(appRoot, "../../packages/evidence-core/data/national/national-geography.v2025.json.gz"),
)).toString("utf8"));
const counties = catalog.geographies.filter((item) =>
  item.kind === "county" && item.releaseScope === "primary_50_states_dc");
if (counties.length !== 3_144) throw new Error(`Expected 3,144 counties; found ${counties.length}.`);

const baseUrl = process.env.EXPLORE_VALIDATION_BASE_URL
  ?? process.argv[2]
  ?? "http://localhost:4318";
const failures = [];
let cursor = 0;
let validated = 0;
let presentationValidated = 0;
const required = [
  "census-geography", "cdc-places", "census-acs5", "hrsa-workforce",
  "ahrf-workforce", "ahrq-clh", "local-planning-documents",
];
const roundDifference = (value) => Number(value.toFixed(1));
async function worker() {
  while (cursor < counties.length) {
    const county = counties[cursor++];
    const response = await fetch(
      `${baseUrl}/api/evidence/v1/place-brief?kind=county&geoid=${county.geoid}`,
    );
    if (!response.ok) {
      failures.push({ geoid: county.geoid, status: response.status });
      continue;
    }
    const brief = await response.json();
    const sources = new Set(brief.publicData?.sourceCoverage?.map((item) => item.sourceId) ?? []);
    const cacheKey = response.headers.get("x-evidence-cache-key") ?? "";
    const citations = new Map((brief.citations ?? []).map((item) => [item.id, item]));
    const sourceVersions = new Set((brief.publicData?.sources ?? []).map((item) => item.sourceVersionId));
    const observations = brief.publicData?.observations ?? [];
    const acsSourceIds = new Set((brief.publicData?.sources ?? []).filter((item) => item.sourceId === "census-acs5").map((item) => item.sourceVersionId));
    const populationObservation = observations.find((observation) => observation.citationIds?.some((citationId) => citations.get(citationId)?.sourceProvenance?.sourceVariableId === "B01001_001E"));
    const acsProvenanceValid = observations.filter((item) => acsSourceIds.has(item.sourceVersionId)).every((observation) => observation.citationIds?.some((citationId) => {
      const provenance = citations.get(citationId)?.sourceProvenance;
      return Boolean(provenance?.sourceVariableId || (provenance?.numeratorVariableId && provenance?.denominatorVariableId && provenance?.formula));
    }));
    const referencesValid = observations.every((observation) => sourceVersions.has(observation.sourceVersionId) && observation.citationIds.every((citationId) => citations.has(citationId)));
    const populationValid = populationObservation === undefined || (typeof populationObservation.value === "number" && populationObservation.value > 0);
    const workforce = brief.evidenceAssessment?.workforce;
    const workforceCoverage = brief.publicData?.sourceCoverage?.find((item) => item.sourceId === "hrsa-workforce");
    const workforceAssessmentValid = !workforce || !workforceCoverage || workforce.hrsa.sourceStatus === workforceCoverage.status;
    if (
      brief.contractVersion !== "explore.place-brief.v1"
      || brief.resolution?.selected?.authorityId !== county.geoid
      || !brief.resolution?.selected?.displayName
      || !brief.resolution?.selected?.stateFips
      || !brief.resolution?.selected?.stateCode
      || !brief.resolution?.selected?.stateName
      || required.some((source) => !sources.has(source))
      || !cacheKey.includes(brief.evidenceSnapshotId)
      || !referencesValid
      || !acsProvenanceValid
      || !populationValid
      || !workforceAssessmentValid
      || brief.safety?.classification !== "non_clinical_place_evidence"
      || brief.safety?.containsPhi !== false
    ) {
      failures.push({ geoid: county.geoid, status: "semantic_brief_failure", details: { cacheKey: cacheKey.slice(0, 120), referencesValid, acsProvenanceValid, populationValid, workforceAssessmentValid } });
      continue;
    }
    const presentationResponse = await fetch(`${baseUrl}/api/explore?kind=county&geoid=${county.geoid}&query=${county.geoid}&view=brief`);
    if (!presentationResponse.ok) { failures.push({ geoid: county.geoid, status: `presentation_${presentationResponse.status}` }); continue; }
    const presentation = await presentationResponse.json();
    const populationPresentationValid = presentation.location?.population === null
      ? populationObservation === undefined
      : typeof presentation.location?.population === "number" && presentation.location.population > 0
        && populationObservation?.value === presentation.location.population;
    const comparisonValid = (presentation.metrics ?? []).every((metric) => {
      const comparisons = metric.comparisons;
      if (!comparisons || !["state", "national", "unavailable"].includes(comparisons.displayedBasis)) return false;
      return [comparisons.state, comparisons.national].every((comparison) => comparison.value === null
        ? comparison.difference === null
        : comparison.difference === roundDifference(metric.value - comparison.value));
    });
    if (!populationPresentationValid || !comparisonValid) {
      failures.push({ geoid: county.geoid, status: "presentation_semantic_failure", details: { populationPresentationValid, comparisonValid } });
      continue;
    }
    validated += 1;
    presentationValidated += 1;
  }
}
await Promise.all(Array.from({ length: 24 }, () => worker()));
if (failures.length) throw new Error(`National API validation failed: ${JSON.stringify(failures.slice(0, 20))}`);
console.log(JSON.stringify({
  authoritativeCountyCount: counties.length,
  validPlaceBriefCount: validated,
  validExplorePresentationCount: presentationValidated,
  baseUrl,
}, null, 2));
