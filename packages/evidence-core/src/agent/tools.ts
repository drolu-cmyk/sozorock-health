import { geographyCaveats, resolvePlace as resolveReviewedPlace } from "../geography.ts";
import { effectiveFreshnessStatus, interpretMetricComparison } from "../quality.ts";
import type {
  EvidenceCitation,
  EvidenceClaim,
  Geography,
  MeasureDefinition,
  MetricObservation,
  PlanningDocument,
  SourceVersion,
} from "../contracts.ts";
import type {
  AgentCitation,
  AgentConfidence,
  AgentGeographicScope,
  AssessResponseFitInput,
  ComparePlacesInput,
  DraftPartnerBriefInput,
  GetLocalPlanInput,
  GetPlaceEvidenceInput,
  GroundedToolResult,
  PlaceAgentRepository,
  ResolvePlaceInput,
  ResponseFitStatus,
  ResponseType,
} from "./types.ts";
import { PLACE_AGENT_POLICY_VERSION } from "./types.ts";

const NON_CLINICAL_BOUNDARY = "SozoRock Place Intelligence provides non-clinical, population-level planning evidence. It does not diagnose, triage, recommend treatment, infer individual risk, or replace licensed professionals or local decision-makers.";

type Context = { repository: PlaceAgentRepository; now: string };

function unique<T>(items: T[], key: (item: T) => string) {
  return [...new Map(items.map((item) => [key(item), item])).values()];
}

function scope(geography: Geography | null, evidenceGeographyIds: string[] = []): AgentGeographicScope {
  return {
    geographyId: geography?.id ?? null,
    kind: geography?.kind ?? null,
    displayName: geography?.displayName ?? null,
    authority: geography?.authority ?? null,
    authorityId: geography?.authorityId ?? null,
    evidenceGeographyIds,
  };
}

function sourceDates(citations: AgentCitation[]) {
  return unique(citations.map((citation) => ({
    sourceVersionId: citation.sourceVersionId,
    releaseDate: citation.releaseDate,
    dataPeriodStart: citation.dataPeriodStart,
    dataPeriodEnd: citation.dataPeriodEnd,
    retrievedAt: citation.retrievedAt,
    freshness: citation.freshness,
  })), (item) => item.sourceVersionId);
}

function result<T>({
  tool,
  status,
  answer,
  data,
  citations = [],
  geographicScope,
  confidence,
  missingEvidence = [],
  caveats = [],
  now,
}: Omit<GroundedToolResult<T>, "citedEvidence" | "sourceAndDataDates" | "nonClinicalBoundary" | "generatedAt" | "policyVersion"> & {
  citations?: AgentCitation[];
  now: string;
}) {
  const citedEvidence = unique(citations, (citation) => citation.id);
  return {
    tool,
    status,
    answer,
    data,
    citedEvidence,
    sourceAndDataDates: sourceDates(citedEvidence),
    geographicScope,
    confidence,
    missingEvidence: [...new Set(missingEvidence)],
    caveats: [...new Set(caveats)],
    nonClinicalBoundary: NON_CLINICAL_BOUNDARY,
    generatedAt: now,
    policyVersion: PLACE_AGENT_POLICY_VERSION,
  } satisfies GroundedToolResult<T>;
}

function lowConfidence(reason: string): AgentConfidence {
  return { level: "low", rationale: reason };
}

function sourceEligibility(source: SourceVersion | null, now: string, includeStale = false) {
  if (!source || source.reviewStatus !== "verified") return { eligible: false, freshness: null } as const;
  const freshness = effectiveFreshnessStatus(source, now);
  if (freshness === "verified") return { eligible: true, freshness: "current" } as const;
  if (freshness === "stale" && includeStale) return { eligible: true, freshness: "stale" } as const;
  return { eligible: false, freshness: freshness === "stale" ? "stale" : null } as const;
}

function geographyCitation(
  repository: PlaceAgentRepository,
  geography: Geography,
  now: string,
): AgentCitation | null {
  const sourceVersionId = repository.getGeographySourceVersionId(geography.id);
  const source = sourceVersionId ? repository.getSourceVersion(sourceVersionId) : null;
  const eligibility = sourceEligibility(source, now, true);
  if (!source || !eligibility.eligible || !eligibility.freshness) return null;
  const catalog = repository.getSourceCatalog(source.sourceId);
  if (!catalog) return null;
  return {
    id: `agent-citation:geography:${geography.id}:${source.id}`,
    evidenceId: geography.id,
    evidenceType: "geography",
    sourceId: source.sourceId,
    sourceVersionId: source.id,
    publisher: catalog.publisher,
    title: source.releaseLabel || catalog.title,
    officialUrl: source.officialUrl,
    releaseDate: source.releaseDate,
    dataPeriodStart: source.dataPeriodStart,
    dataPeriodEnd: source.dataPeriodEnd,
    retrievedAt: source.retrievedAt,
    geographyId: geography.id,
    geographyKind: geography.kind,
    geographyName: geography.displayName,
    locator: { sourceRecordId: geography.authorityId, pageNumber: null, section: null },
    reviewStatus: source.reviewStatus,
    freshness: eligibility.freshness,
  };
}

function observationCitation(
  repository: PlaceAgentRepository,
  observation: MetricObservation,
  geography: Geography,
  now: string,
  includeStale: boolean,
): AgentCitation | null {
  const source = repository.getSourceVersion(observation.sourceVersionId);
  const eligibility = sourceEligibility(source, now, includeStale);
  if (!source || !eligibility.eligible || !eligibility.freshness) return null;
  const catalog = repository.getSourceCatalog(source.sourceId);
  if (!catalog) return null;
  return {
    id: `agent-citation:observation:${observation.id}`,
    evidenceId: observation.id,
    evidenceType: "metric_observation",
    sourceId: source.sourceId,
    sourceVersionId: source.id,
    publisher: catalog.publisher,
    title: source.releaseLabel || catalog.title,
    officialUrl: observation.sourceUrl || source.officialUrl,
    releaseDate: observation.releaseDate,
    dataPeriodStart: observation.dataPeriodStart,
    dataPeriodEnd: observation.dataPeriodEnd,
    retrievedAt: observation.retrievedAt,
    geographyId: geography.id,
    geographyKind: geography.kind,
    geographyName: geography.displayName,
    locator: { sourceRecordId: observation.sourceRecordId, pageNumber: null, section: null },
    reviewStatus: observation.reviewStatus,
    freshness: eligibility.freshness,
  };
}

function planningCitation(
  repository: PlaceAgentRepository,
  document: PlanningDocument,
  geography: Geography,
  citation: EvidenceCitation | null,
  claim: EvidenceClaim | null,
  now: string,
): AgentCitation | null {
  const source = repository.getSourceVersion(document.sourceVersionId);
  const eligibility = sourceEligibility(source, now, false);
  if (!source || !eligibility.eligible || !eligibility.freshness) return null;
  const catalog = repository.getSourceCatalog(source.sourceId);
  if (!catalog) return null;
  return {
    id: `agent-citation:${claim ? "claim" : "document"}:${claim?.id ?? document.id}`,
    evidenceId: claim?.id ?? document.id,
    evidenceType: claim ? "planning_claim" : "planning_document",
    sourceId: source.sourceId,
    sourceVersionId: source.id,
    publisher: document.publisher || catalog.publisher,
    title: document.title,
    officialUrl: document.officialUrl,
    releaseDate: document.publishedAt ?? source.releaseDate,
    dataPeriodStart: document.periodStart,
    dataPeriodEnd: document.periodEnd,
    retrievedAt: source.retrievedAt,
    geographyId: geography.id,
    geographyKind: geography.kind,
    geographyName: geography.displayName,
    locator: {
      sourceRecordId: null,
      pageNumber: citation?.pageNumber ?? null,
      section: citation?.section ?? null,
    },
    reviewStatus: claim?.reviewStatus ?? document.reviewStatus,
    freshness: eligibility.freshness,
  };
}

function geographyOrFailure(
  repository: PlaceAgentRepository,
  geographyId: string,
  tool: GroundedToolResult<unknown>["tool"],
  now: string,
) {
  const geography = repository.getGeography(geographyId);
  if (geography && geography.reviewStatus === "verified") return geography;
  return result({
    tool,
    status: "not_found",
    answer: "The selected geography is not available in the reviewed official geography catalog.",
    data: null,
    geographicScope: scope(null),
    confidence: lowConfidence("No verified official geography was resolved."),
    missingEvidence: ["A reviewed official geography record."],
    caveats: [],
    now,
  });
}

export function resolvePlaceTool(input: ResolvePlaceInput, context: Context) {
  const resolution = resolveReviewedPlace({
    raw: input.query,
    kind: input.queryKind,
    ...(input.stateHint ? { stateHint: input.stateHint } : {}),
  }, context.repository.getCatalog());
  const selected = resolution.selected;
  const citation = selected ? geographyCitation(context.repository, selected, context.now) : null;
  const status = resolution.status === "resolved"
    ? "ok"
    : resolution.status === "unsupported"
      ? "not_found"
      : resolution.status;
  return result({
    tool: "resolve_place",
    status,
    answer: resolution.status === "resolved" && selected
      ? `${input.query} resolves to ${selected.displayName} as ${selected.kind.replaceAll("_", " ")} geography.`
      : resolution.status === "ambiguous"
        ? "More than one reviewed geography matches. Select the intended place before evidence is retrieved."
        : "No reviewed official geography resolved from this query.",
    data: resolution,
    citations: citation ? [citation] : [],
    geographicScope: scope(selected, resolution.evidenceGeography ? [resolution.evidenceGeography.id] : []),
    confidence: resolution.status === "resolved" && citation
      ? { level: "high", rationale: "The match and identifier come from a reviewed official geography snapshot." }
      : lowConfidence("Resolution is absent, ambiguous, or lacks an approved stored source version."),
    missingEvidence: citation ? [] : ["A current approved Census geography source version for the resolved record."],
    caveats: resolution.caveats,
    now: context.now,
  });
}

export function getPlaceEvidenceTool(input: GetPlaceEvidenceInput, context: Context) {
  const resolved = geographyOrFailure(context.repository, input.geographyId, "get_place_evidence", context.now);
  if (!("id" in resolved)) return resolved;
  const geography = resolved;
  const requested = input.measureIds ? new Set(input.measureIds) : null;
  const missingDefinitions: string[] = [];
  const evidence = context.repository.listObservations(geography.id)
    .filter((observation) => !requested || requested.has(observation.measureDefinitionId))
    .flatMap((observation) => {
      const definition = context.repository.getMeasureDefinition(observation.measureDefinitionId);
      const citation = observationCitation(context.repository, observation, geography, context.now, input.includeStale);
      if (!definition || definition.reviewStatus !== "verified") {
        missingDefinitions.push(observation.measureDefinitionId);
        return [];
      }
      if (observation.reviewStatus !== "verified" || observation.geographyLevel !== geography.kind || !citation) return [];
      return [{ observation, definition, citation }];
    });
  const geographySource = geographyCitation(context.repository, geography, context.now);
  const citations = [
    ...(geographySource ? [geographySource] : []),
    ...evidence.map((item) => item.citation),
  ];
  const staleCount = citations.filter((citation) => citation.freshness === "stale").length;
  return result({
    tool: "get_place_evidence",
    status: evidence.length > 0 ? "ok" : "insufficient_evidence",
    answer: evidence.length > 0
      ? `${evidence.length} approved observation${evidence.length === 1 ? " is" : "s are"} available for ${geography.displayName} at the ${geography.kind.replaceAll("_", " ")} level.`
      : `No approved stored observations are available for ${geography.displayName} at this exact geography.`,
    data: {
      snapshotId: context.repository.getSnapshotId(),
      observations: evidence.map(({ observation, definition }) => ({
        observation,
        measure: definition,
        interpretationRule: definition.higherValueMeaning,
      })),
    },
    citations,
    geographicScope: scope(geography, [geography.id]),
    confidence: evidence.length > 0 && staleCount === 0
      ? { level: "high", rationale: "Every returned observation, measure definition, and source version is verified and geographically exact." }
      : evidence.length > 0
        ? { level: "low", rationale: "The returned evidence is approved but at least one source is stale." }
        : lowConfidence("No eligible exact-geography observations were retrieved."),
    missingEvidence: [
      ...(evidence.length === 0 ? ["Current approved observations at the selected geography."] : []),
      ...missingDefinitions.map((id) => `A verified measure definition for ${id}.`),
    ],
    caveats: [
      ...geographyCaveats(geography, context.repository.getCatalog().relationships, context.repository.getCatalog().geographies),
      ...(staleCount ? [`${staleCount} source${staleCount === 1 ? " is" : "s are"} stale and cannot independently support a response recommendation.`] : []),
      "Population measures describe areas and cannot establish an individual's condition or prove causation.",
    ],
    now: context.now,
  });
}

function verifiedCurrentPlanningEvidence(repository: PlaceAgentRepository, geography: Geography, now: string) {
  const documents = repository.listPlanningDocuments(geography.id).filter((document) => {
    const source = repository.getSourceVersion(document.sourceVersionId);
    return document.coverageScope === "county_specific"
      && document.geographyIds.length === 1
      && document.currentPlanStatus === "verified_current"
      && document.reviewStatus === "verified"
      && Boolean(document.reviewedBy && document.reviewedAt)
      && sourceEligibility(source, now, false).eligible;
  });
  const claims = repository.listClaims(documents.map((document) => document.id))
    .filter((claim) => claim.reviewStatus === "verified" && Boolean(claim.reviewedBy && claim.reviewedAt));
  const rawCitations = repository.listCitations(claims.map((claim) => claim.id));
  const approvedClaims = claims.flatMap((claim) => {
    const document = documents.find((item) => item.id === claim.documentId);
    const claimCitations = rawCitations.filter((citation) => citation.claimId === claim.id
      && citation.reviewStatus === "verified"
      && (citation.pageNumber !== null || Boolean(citation.section?.trim())));
    if (!document || claimCitations.length === 0) return [];
    return [{ claim, document, citations: claimCitations }];
  });
  return { documents, approvedClaims };
}

export function getLocalPlanTool(input: GetLocalPlanInput, context: Context) {
  const resolved = geographyOrFailure(context.repository, input.geographyId, "get_local_plan", context.now);
  if (!("id" in resolved)) return resolved;
  const geography = resolved;
  const evidence = verifiedCurrentPlanningEvidence(context.repository, geography, context.now);
  const requested = input.documentTypes ? new Set(input.documentTypes) : null;
  const documents = evidence.documents.filter((document) => !requested || requested.has(document.documentType));
  const documentIds = new Set(documents.map((document) => document.id));
  const claims = evidence.approvedClaims.filter((item) => documentIds.has(item.document.id));
  const geographySource = geographyCitation(context.repository, geography, context.now);
  const citations = [
    ...(geographySource ? [geographySource] : []),
    ...documents.map((document) => planningCitation(context.repository, document, geography, null, null, context.now)),
    ...claims.flatMap((item) => item.citations.map((citation) => planningCitation(
      context.repository,
      item.document,
      geography,
      citation,
      item.claim,
      context.now,
    ))),
  ].filter((item): item is AgentCitation => Boolean(item));
  return result({
    tool: "get_local_plan",
    status: documents.length > 0 ? "ok" : "insufficient_evidence",
    answer: documents.length > 0
      ? `${documents.length} verified current county planning document${documents.length === 1 ? " is" : "s are"} available for ${geography.displayName}. Only explicitly cited, human-verified claims are returned.`
      : `A current local CHA, CHIP, CHNA, or implementation plan has not yet been verified for ${geography.displayName}.`,
    data: {
      documents,
      claims: claims.map((item) => item.claim),
    },
    citations,
    geographicScope: scope(geography, [geography.id]),
    confidence: documents.length > 0
      ? { level: claims.length > 0 ? "high" : "moderate", rationale: claims.length > 0 ? "The current document and returned claims completed human review with exact citations." : "The document is verified current, but no claim-level evidence passed the requested filters." }
      : lowConfidence("No verified current county-specific planning document was retrieved."),
    missingEvidence: documents.length > 0 ? [] : ["A human-verified, current, county-specific local planning document and claim-level citations."],
    caveats: [
      ...geographyCaveats(geography, context.repository.getCatalog().relationships, context.repository.getCatalog().geographies),
      "Regional and hospital-specific documents are not presented as the county's current plan.",
    ],
    now: context.now,
  });
}

export function comparePlacesTool(input: ComparePlacesInput, context: Context) {
  const geographies = input.geographyIds.map((id) => context.repository.getGeography(id));
  if (geographies.some((item) => !item || item.reviewStatus !== "verified")) {
    return result({
      tool: "compare_places",
      status: "not_found",
      answer: "Every comparison place must resolve to a reviewed official geography.",
      data: { comparisons: [] },
      geographicScope: scope(null, []),
      confidence: lowConfidence("At least one comparison geography was unresolved."),
      missingEvidence: ["Reviewed official geography records for every comparison place."],
      caveats: [],
      now: context.now,
    });
  }
  const places = geographies as Geography[];
  const geographyCitations = places.flatMap((place) => {
    const citation = geographyCitation(context.repository, place, context.now);
    return citation ? [citation] : [];
  });
  const kinds = new Set(places.map((item) => item.kind));
  if (kinds.size !== 1) {
    return result({
      tool: "compare_places",
      status: "insufficient_evidence",
      answer: "The requested places use different geography levels and cannot be compared as though they were equivalent.",
      data: { comparisons: [] },
      citations: geographyCitations,
      geographicScope: scope(null, places.map((item) => item.id)),
      confidence: { level: "high", rationale: "The comparison was blocked by an explicit geography-grain mismatch." },
      missingEvidence: ["Observations at one compatible geography level for every selected place."],
      caveats: ["County, Census place, ZCTA, state, and planning-region observations are not interchangeable."],
      now: context.now,
    });
  }
  const comparisons = input.measureIds.flatMap((measureId) => {
    const definition = context.repository.getMeasureDefinition(measureId);
    if (!definition || definition.reviewStatus !== "verified") return [];
    const entries = places.map((place) => {
      const observation = context.repository.listObservations(place.id).find((item) => (
        item.measureDefinitionId === measureId
        && item.reviewStatus === "verified"
        && item.geographyLevel === place.kind
        && Boolean(observationCitation(context.repository, item, place, context.now, false))
      ));
      return { place, observation: observation ?? null };
    });
    if (entries.some((entry) => !entry.observation)) return [];
    const periods = new Set(entries.map((entry) => `${entry.observation?.dataPeriodStart}/${entry.observation?.dataPeriodEnd}`));
    if (periods.size !== 1) return [];
    return [{ definition, entries }];
  });
  const citations = [...geographyCitations, ...comparisons.flatMap((comparison) => comparison.entries.flatMap((entry) => {
    if (!entry.observation) return [];
    const citation = observationCitation(context.repository, entry.observation, entry.place, context.now, false);
    return citation ? [citation] : [];
  }))];
  return result({
    tool: "compare_places",
    status: comparisons.length > 0 ? "ok" : "insufficient_evidence",
    answer: comparisons.length > 0
      ? `${comparisons.length} measure${comparisons.length === 1 ? " is" : "s are"} comparable across ${places.length} ${places[0].kind.replaceAll("_", " ")} geographies.`
      : "No requested measure had approved, same-period observations at the same geography level for every place.",
    data: { comparisons },
    citations,
    geographicScope: scope(null, places.map((item) => item.id)),
    confidence: comparisons.length > 0
      ? { level: "high", rationale: "The comparison uses identical measure definitions, geography levels, and data periods." }
      : lowConfidence("Comparable evidence was incomplete or incompatible."),
    missingEvidence: comparisons.length > 0 ? [] : ["Same-measure, same-period, same-geography-level observations for every selected place."],
    caveats: ["Differences are associations in area-level estimates; they do not prove causation or individual risk."],
    now: context.now,
  });
}

function responseFitEvidence(responseType: ResponseType, claims: EvidenceClaim[]) {
  const relevantTypes: Record<ResponseType, Set<EvidenceClaim["claimType"]>> = {
    health_access_day: new Set(["priority", "barrier", "finding", "disparity", "objective", "intervention"]),
    health_equity_hub: new Set(["barrier", "priority", "finding", "disparity", "intervention"]),
    provider_led_pathway: new Set(["barrier", "priority", "objective", "intervention"]),
    workforce_conversation: new Set(["barrier", "priority", "objective", "responsible_partner", "intervention"]),
  };
  return claims.filter((claim) => relevantTypes[responseType].has(claim.claimType));
}

export function assessResponseFitTool(input: AssessResponseFitInput, context: Context) {
  const resolved = geographyOrFailure(context.repository, input.geographyId, "assess_response_fit", context.now);
  if (!("id" in resolved)) return resolved;
  const geography = resolved;
  const plan = verifiedCurrentPlanningEvidence(context.repository, geography, context.now);
  const relevantClaims = responseFitEvidence(input.responseType, plan.approvedClaims.map((item) => item.claim));
  const currentEvidence = getPlaceEvidenceTool({ geographyId: geography.id, measureIds: null, includeStale: false }, context);
  const observations = currentEvidence.status === "ok" && currentEvidence.data
    ? currentEvidence.data.observations
    : [];
  const adverseSignals = observations.filter((item) => item.observation.sourceMetadata.comparisonInterpretation === "adverse_signal");
  const favorableSignals = observations.filter((item) => item.observation.sourceMetadata.comparisonInterpretation === "favorable_signal");
  let fit: ResponseFitStatus;
  if (relevantClaims.length > 0 && adverseSignals.length > 0) fit = "potentially supported";
  else if (relevantClaims.length > 0 || adverseSignals.length > 0) fit = "requires local partner review";
  else if (observations.length === 0) fit = "insufficient evidence";
  else if (favorableSignals.length === observations.length) fit = "not appropriate based on available evidence";
  else fit = "insufficient evidence";
  const claimEvidence = plan.approvedClaims.filter((item) => relevantClaims.some((claim) => claim.id === item.claim.id));
  const claimCitations = claimEvidence.flatMap((item) => item.citations.flatMap((citation) => {
    const built = planningCitation(context.repository, item.document, geography, citation, item.claim, context.now);
    return built ? [built] : [];
  }));
  const caveats = [
    "A potentially supported finding is a planning signal, not authorization to launch an intervention.",
    "Local partners must confirm fit, capacity, scope, duplication risk, implementation design, and measures of progress.",
    "Population measures do not prove that a response will cause an outcome.",
  ];
  return result({
    tool: "assess_response_fit",
    status: fit === "insufficient evidence" ? "insufficient_evidence" : "ok",
    answer: `${input.responseType.replaceAll("_", " ")} is ${fit} for ${geography.displayName}. ${fit === "potentially supported" ? "Verified local planning evidence and approved area-level context support a partner conversation." : fit === "requires local partner review" ? "Available evidence is not sufficient for an automatic recommendation." : fit === "not appropriate based on available evidence" ? "The approved evidence retrieved does not identify a compatible concern." : "More verified local evidence is required before assessing fit."}`,
    data: {
      responseType: input.responseType,
      fit,
      supportingClaimIds: relevantClaims.map((claim) => claim.id),
      approvedObservationIds: observations.map((item) => item.observation.id),
      safeguards: {
        humanReviewRequired: true,
        causalClaimAllowed: false,
        clinicalRecommendationAllowed: false,
      },
    },
    citations: [...currentEvidence.citedEvidence, ...claimCitations],
    geographicScope: scope(geography, [geography.id]),
    confidence: fit === "potentially supported"
      ? { level: "moderate", rationale: "Verified local claims and approved population context align, but response design still requires local review." }
      : fit === "not appropriate based on available evidence"
        ? { level: "moderate", rationale: "The approved evidence retrieved contains no compatible adverse or local planning signal." }
        : lowConfidence("Verified local and contextual evidence is incomplete for a response-fit conclusion."),
    missingEvidence: fit === "potentially supported" ? ["Local confirmation of fit, capacity, existing services, and implementation measures."] : [
      ...(relevantClaims.length === 0 ? ["A verified local planning claim relevant to the proposed response."] : []),
      ...(adverseSignals.length === 0 ? ["Approved contextual evidence with a reviewed benchmark interpretation that establishes a compatible area-level concern."] : []),
    ],
    caveats,
    now: context.now,
  });
}

export function draftPartnerBriefTool(input: DraftPartnerBriefInput, context: Context) {
  const resolved = geographyOrFailure(context.repository, input.geographyId, "draft_partner_brief", context.now);
  if (!("id" in resolved)) return resolved;
  const geography = resolved;
  const evidence = getPlaceEvidenceTool({ geographyId: geography.id, measureIds: null, includeStale: false }, context);
  const localPlan = getLocalPlanTool({ geographyId: geography.id, documentTypes: null }, context);
  const fit = input.responseType
    ? assessResponseFitTool({ geographyId: geography.id, responseType: input.responseType }, context)
    : null;
  const available = evidence.status === "ok" || localPlan.status === "ok";
  const fitStatus = fit?.data && "fit" in fit.data ? fit.data.fit : null;
  const sections = {
    place: `${geography.displayName} (${geography.kind.replaceAll("_", " ")}; ${geography.authority} ${geography.authorityId}).`,
    evidence: evidence.answer,
    localPlanningContext: localPlan.answer,
    responseFit: fit?.answer ?? "No SozoRock response was selected for assessment.",
    partnerNextStep: fitStatus === "potentially supported"
      ? "Convene local partners to validate the evidence, identify existing work, define roles, and agree on measurable non-clinical next steps."
      : "Close the named evidence gaps and complete local partner review before proposing an intervention.",
  };
  return result({
    tool: "draft_partner_brief",
    status: available ? "ok" : "insufficient_evidence",
    answer: available
      ? `A source-traceable ${input.audience.replaceAll("_", " ")} brief is ready for ${geography.displayName}. It separates verified evidence, missing evidence, and decisions requiring local review.`
      : `A partner brief cannot yet make an evidence-based case for ${geography.displayName}; approved stored evidence is insufficient.`,
    data: {
      audience: input.audience,
      responseType: input.responseType,
      responseFit: fitStatus,
      sections,
      prohibitedClaims: ["clinical advice", "individual risk", "causation", "guaranteed outcomes", "unverified local priorities"],
    },
    citations: [...evidence.citedEvidence, ...localPlan.citedEvidence, ...(fit?.citedEvidence ?? [])],
    geographicScope: scope(geography, [geography.id]),
    confidence: available
      ? { level: localPlan.status === "ok" ? "moderate" : "low", rationale: localPlan.status === "ok" ? "The brief includes verified local planning evidence and approved public-data context." : "The brief is limited to approved public-data context because no current local plan was verified." }
      : lowConfidence("The repository returned no approved place evidence."),
    missingEvidence: unique([
      ...evidence.missingEvidence,
      ...localPlan.missingEvidence,
      ...(fit?.missingEvidence ?? []),
    ].map((value) => ({ value })), (item) => item.value).map((item) => item.value),
    caveats: unique([
      ...evidence.caveats,
      ...localPlan.caveats,
      ...(fit?.caveats ?? []),
    ].map((value) => ({ value })), (item) => item.value).map((item) => item.value),
    now: context.now,
  });
}

export function comparisonSignal(
  definition: MeasureDefinition,
  observation: MetricObservation,
  benchmark: MetricObservation,
) {
  return interpretMetricComparison(definition, observation.numericValue, benchmark.numericValue);
}
