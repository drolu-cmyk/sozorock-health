import {
  InMemoryPlaceAgentRepository,
  MILESTONE_2_EVALUATION_COUNTIES,
  PILOT_PLANNING_REVIEW_BUNDLES,
  PLACE_AGENT_EVALUATION_SNAPSHOT,
  buildNationalOperationsReport,
  getPlaceEvidenceTool,
  validateOperationalControl,
  type OperationalControl,
  type PlaceAcceptanceResult,
} from "../src/index.ts";

const evaluatedAt = new Date().toISOString();
const repository = new InMemoryPlaceAgentRepository(PLACE_AGENT_EVALUATION_SNAPSHOT);
const agentContext = { repository, now: evaluatedAt };

const controls: OperationalControl[] = [
  validateOperationalControl({
    id: "source-adapters",
    domain: "source_resilience",
    title: "Approved-source adapters preserve provenance and fail closed",
    status: "pass",
    releaseBlocking: true,
    evidence: ["CDC PLACES, ACS, HRSA, and AHRQ adapters retain source version, dates, geography, and failure state."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "cache-and-retry-policy",
    domain: "source_resilience",
    title: "Source requests use conditional caching, bounded retries, and stale fallback labels",
    status: "pass",
    releaseBlocking: true,
    evidence: ["ETag and Last-Modified revalidation, three bounded attempts, timeouts, cache disposition, and visible stale state are implemented and tested."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "source-schedule-execution",
    domain: "data_freshness",
    title: "Evidence refresh schedules execute against a persistent repository",
    status: "fail",
    releaseBlocking: true,
    evidence: ["Refresh cadence is defined in code, but there is no production evidence-store job runner or immutable run ledger."],
    requiredAction: "Provision the persistent repository, scheduled jobs, alerts, and immutable import audit trail.",
  }),
  validateOperationalControl({
    id: "geography-integrity",
    domain: "geography_integrity",
    title: "ZIP, ZCTA, city, county, state, and planning-region evidence remains distinct",
    status: "pass",
    releaseBlocking: true,
    evidence: ["Typed geography contracts and automated tests reject county evidence presented as ZCTA evidence."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "audited-evidence-store",
    domain: "evidence_governance",
    title: "Public Explore consumes a reviewed, versioned evidence store",
    status: "fail",
    releaseBlocking: true,
    evidence: ["The public Explore API still queries a live public endpoint directly rather than the evidence-core repository."],
    requiredAction: "Replace the direct public-source path with a production repository adapter and reviewed publication snapshots.",
  }),
  validateOperationalControl({
    id: "public-rate-limits",
    domain: "public_delivery",
    title: "Public evidence endpoints have enforced rate and request-cost limits",
    status: "fail",
    releaseBlocking: true,
    evidence: ["No route-level rate limiter or upstream request budget is enforced on the public Explore API."],
    requiredAction: "Add per-client limits, upstream concurrency limits, payload caps, and abuse monitoring before public release.",
  }),
  validateOperationalControl({
    id: "agent-safety",
    domain: "agent_safety",
    title: "The planning assistant answers only from approved stored evidence",
    status: "pass",
    releaseBlocking: true,
    evidence: ["Strict tool schemas, no live-web client, exact-geography checks, source citations, and adversarial tests are implemented."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "agent-execution-audit",
    domain: "agent_safety",
    title: "Agent executions are authenticated and immutably logged",
    status: "fail",
    releaseBlocking: true,
    evidence: ["The agent is internal-only, but a production repository, authentication boundary, and immutable execution log are not configured."],
    requiredAction: "Implement authenticated tool access, immutable request/output audit records, retention, and incident correlation.",
  }),
  validateOperationalControl({
    id: "human-review-queue",
    domain: "human_review",
    title: "Ambiguous documents and claims are withheld for human review",
    status: "pass",
    releaseBlocking: true,
    evidence: ["Planning candidates, citations, verification status, review reasons, and blocking review tasks are modeled and tested."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "accessibility-acceptance",
    domain: "accessibility",
    title: "Explore passes desktop and mobile accessibility acceptance",
    status: "pass",
    releaseBlocking: true,
    evidence: ["Interactive checks found one H1, one main landmark, no unlabeled inputs, no overflow, 44px mobile controls, and no console errors; ten desktop/mobile place tests passed."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "performance-acceptance",
    domain: "performance",
    title: "Explore and map pass mobile and low-bandwidth budgets",
    status: "pass",
    releaseBlocking: true,
    evidence: ["The optimized build completed; Explore is 15 kB route code and 122 kB first-load JavaScript; all five official county boundaries and MapLibre canvases rendered on desktop and mobile."],
    requiredAction: null,
  }),
  validateOperationalControl({
    id: "security-review",
    domain: "security_privacy",
    title: "Full release security review is complete",
    status: "fail",
    releaseBlocking: true,
    evidence: ["The production dependency audit reports three unresolved high-severity findings across the Sharp and fast-uri chains; the whole-repository security scan is still pending."],
    requiredAction: "Resolve or formally accept supported upstream dependency fixes and complete the whole-repository security review before release approval.",
  }),
  validateOperationalControl({
    id: "production-monitoring",
    domain: "public_delivery",
    title: "Production source, route, map, agent, and review-queue monitoring is configured",
    status: "fail",
    releaseBlocking: true,
    evidence: ["The runbook defines signals and escalation, but production alerts, dashboards, and incident correlation are not provisioned."],
    requiredAction: "Provision source-age, failure, latency, cache, abuse, citation, review-age, and wrong-claim alerts before release.",
  }),
  validateOperationalControl({
    id: "cost-guardrails",
    domain: "cost_control",
    title: "Source and future model usage has enforceable budgets",
    status: "fail",
    releaseBlocking: true,
    evidence: ["HTTP caching exists, but per-job request ceilings, concurrency caps, spend alarms, and model-token budgets are not enforced."],
    requiredAction: "Set source request budgets, concurrency limits, alert thresholds, and a fail-closed model budget before enabling agent traffic.",
  }),
];

const places: PlaceAcceptanceResult[] = MILESTONE_2_EVALUATION_COUNTIES.map((place) => {
  const geographyId = `county:${place.countyFips}`;
  const evidence = getPlaceEvidenceTool({ geographyId, measureIds: null, includeStale: false }, agentContext);
  const localPlanStatus = PILOT_PLANNING_REVIEW_BUNDLES.some(
    (bundle) => bundle.candidate.coveredGeographyIds.includes(geographyId),
  )
    ? "awaiting_review"
    : "not_yet_verified";
  const limitations = [...new Set([...evidence.missingEvidence, ...evidence.caveats])];
  return {
    place: place.name,
    countyFips: place.countyFips,
    geographyResolved: repository.getGeography(geographyId) !== null,
    publicDataStatus: evidence.status === "ok" ? "limited" : "unavailable",
    localPlanStatus,
    agentSafetyStatus: "pass",
    publicReleaseStatus: "blocked",
    limitations,
  };
});

console.log(JSON.stringify(buildNationalOperationsReport({ evaluatedAt, controls, places }), null, 2));
