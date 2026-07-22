import type {
  GroundedToolResult,
  PlaceAgentQuestionData,
  PlaceAgentQuestionInput,
  PlaceAgentRepository,
  PlaceAgentToolInputs,
  PlaceAgentToolName,
  ResponseType,
} from "./types.ts";
import {
  assessResponseFitTool,
  comparePlacesTool,
  draftPartnerBriefTool,
  getLocalPlanTool,
  getPlaceEvidenceTool,
  resolvePlaceTool,
} from "./tools.ts";

type AgentContext = { repository: PlaceAgentRepository; now: string };

const ALLOWED_KEYS: Record<PlaceAgentToolName, readonly string[]> = {
  resolve_place: ["query", "queryKind", "stateHint"],
  get_place_evidence: ["geographyId", "measureIds", "includeStale"],
  get_local_plan: ["geographyId", "documentTypes"],
  compare_places: ["geographyIds", "measureIds"],
  assess_response_fit: ["geographyId", "responseType"],
  draft_partner_brief: ["geographyId", "audience", "responseType"],
};

function strictRecord(name: PlaceAgentToolName, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${name} input must be an object.`);
  const record = input as Record<string, unknown>;
  const allowed = new Set(ALLOWED_KEYS[name]);
  const unexpected = Object.keys(record).filter((key) => !allowed.has(key));
  const missing = ALLOWED_KEYS[name].filter((key) => !(key in record));
  if (unexpected.length > 0) throw new Error(`${name} received unsupported fields: ${unexpected.join(", ")}.`);
  if (missing.length > 0) throw new Error(`${name} is missing required fields: ${missing.join(", ")}.`);
  return record;
}

function validateInput<T extends PlaceAgentToolName>(name: T, input: unknown): PlaceAgentToolInputs[T] {
  const record = strictRecord(name, input);
  const requiredString = (key: string) => {
    if (typeof record[key] !== "string" || !(record[key] as string).trim()) throw new Error(`${name}.${key} must be a non-empty string.`);
  };
  if (name === "resolve_place") {
    requiredString("query");
    requiredString("queryKind");
    if (record.stateHint !== null && typeof record.stateHint !== "string") throw new Error("resolve_place.stateHint must be a string or null.");
    if (!["zip_input", "zcta", "place", "county_fips", "state", "planning_region"].includes(String(record.queryKind))) {
      throw new Error("resolve_place.queryKind is unsupported.");
    }
  } else {
    requiredString("geographyId");
  }
  if (name === "get_place_evidence") {
    if (record.measureIds !== null && (!Array.isArray(record.measureIds) || record.measureIds.some((item) => typeof item !== "string"))) {
      throw new Error("get_place_evidence.measureIds must be a string array or null.");
    }
    if (typeof record.includeStale !== "boolean") throw new Error("get_place_evidence.includeStale must be boolean.");
  }
  if (name === "compare_places") {
    if (!Array.isArray(record.geographyIds) || record.geographyIds.length < 2 || record.geographyIds.length > 5) {
      throw new Error("compare_places.geographyIds must contain two to five places.");
    }
    if (!Array.isArray(record.measureIds) || record.measureIds.length < 1) throw new Error("compare_places.measureIds must not be empty.");
  }
  if (name === "get_local_plan" && record.documentTypes !== null) {
    const allowed = new Set(["cha", "chip", "chna", "csp", "implementation_strategy", "supporting_report"]);
    if (!Array.isArray(record.documentTypes) || record.documentTypes.some((item) => typeof item !== "string" || !allowed.has(item))) {
      throw new Error("get_local_plan.documentTypes contains an unsupported document type.");
    }
  }
  if (name === "assess_response_fit" || name === "draft_partner_brief") {
    const allowed = new Set(["health_equity_hub", "health_access_day", "provider_led_pathway", "workforce_conversation"]);
    if (record.responseType !== null && (typeof record.responseType !== "string" || !allowed.has(record.responseType))) {
      throw new Error(`${name}.responseType is unsupported.`);
    }
  }
  if (name === "draft_partner_brief") {
    const allowed = new Set(["community_partner", "county_or_state", "funder", "licensed_provider", "education_or_workforce"]);
    if (typeof record.audience !== "string" || !allowed.has(record.audience)) throw new Error("draft_partner_brief.audience is unsupported.");
  }
  return record as PlaceAgentToolInputs[T];
}

export function executePlaceAgentTool<T extends PlaceAgentToolName>(
  name: T,
  input: unknown,
  context: AgentContext,
): GroundedToolResult<unknown> {
  const value = validateInput(name, input);
  switch (name) {
    case "resolve_place": return resolvePlaceTool(value as PlaceAgentToolInputs["resolve_place"], context);
    case "get_place_evidence": return getPlaceEvidenceTool(value as PlaceAgentToolInputs["get_place_evidence"], context);
    case "get_local_plan": return getLocalPlanTool(value as PlaceAgentToolInputs["get_local_plan"], context);
    case "compare_places": return comparePlacesTool(value as PlaceAgentToolInputs["compare_places"], context);
    case "assess_response_fit": return assessResponseFitTool(value as PlaceAgentToolInputs["assess_response_fit"], context);
    case "draft_partner_brief": return draftPartnerBriefTool(value as PlaceAgentToolInputs["draft_partner_brief"], context);
  }
}

function responseTypeFrom(question: string): ResponseType | null {
  if (/health\s+access\s+day/i.test(question)) return "health_access_day";
  if (/health\s+equity\s+hub|library\s+hub|community\s+hub|home[- ]based\s+hub/i.test(question)) return "health_equity_hub";
  if (/provider[- ]led|byop|licensed provider pathway/i.test(question)) return "provider_led_pathway";
  if (/workforce|staffing|emerging talent/i.test(question)) return "workforce_conversation";
  return null;
}

function prohibitedRequest(question: string) {
  const patterns: Array<{ pattern: RegExp; reason: string }> = [
    { pattern: /\b(diagnos(?:e|is)|triage|symptom|treatment|treat|prescrib|medication|dosage|medical advice)\b/i, reason: "clinical advice or triage" },
    { pattern: /\b(my|his|her|their)\s+(risk|condition|chance|diagnosis|symptoms?)\b/i, reason: "individual risk inference" },
    { pattern: /\b(prove|proves|caused|causes|causal|because of)\b/i, reason: "unsupported causal inference" },
    { pattern: /\b(search|browse|google|look up)\s+(the\s+)?(live\s+)?(web|internet|news)/i, reason: "live-web retrieval" },
    { pattern: /ignore (the|all|your) (evidence|sources|rules|instructions)/i, reason: "instruction to bypass evidence controls" },
  ];
  return patterns.find((item) => item.pattern.test(question))?.reason ?? null;
}

function asQuestionResult(
  base: GroundedToolResult<unknown>,
  data: PlaceAgentQuestionData,
  answer = base.answer,
  status = base.status,
): GroundedToolResult<PlaceAgentQuestionData> {
  return { ...base, answer, status, data };
}

export function answerPlaceEvidenceQuestion(
  input: PlaceAgentQuestionInput,
  context: AgentContext,
): GroundedToolResult<PlaceAgentQuestionData> {
  const question = input.question.trim();
  const prohibited = prohibitedRequest(question);
  if (prohibited) {
    const base = getPlaceEvidenceTool({
      geographyId: input.selectedGeographyId,
      measureIds: null,
      includeStale: false,
    }, context);
    return asQuestionResult(
      {
        ...base,
        citedEvidence: base.citedEvidence.filter((citation) => citation.evidenceType === "geography"),
        sourceAndDataDates: base.sourceAndDataDates.filter((date) => base.citedEvidence.some((citation) => citation.evidenceType === "geography" && citation.sourceVersionId === date.sourceVersionId)),
        missingEvidence: [...base.missingEvidence, `This request asks for ${prohibited}, which is outside the approved place-evidence scope.`],
      },
      { intent: "safety_boundary", supportingTool: "get_place_evidence", responseFit: null },
      `I cannot provide ${prohibited}. I can summarize approved, population-level evidence for the selected place, with sources and geographic caveats.`,
      "refused",
    );
  }

  if (/\b(cha|chip|chna|community health (assessment|improvement plan)|local plan)\b/i.test(question)) {
    const base = getLocalPlanTool({ geographyId: input.selectedGeographyId, documentTypes: null }, context);
    return asQuestionResult(base, { intent: "local_plan", supportingTool: "get_local_plan", responseFit: null });
  }

  const responseType = responseTypeFrom(question);
  if (responseType && /\b(recommend|support|fit|justify|should|appropriate|fund)\b/i.test(question)) {
    const base = assessResponseFitTool({ geographyId: input.selectedGeographyId, responseType }, context);
    const fit = base.data && "fit" in base.data ? base.data.fit : null;
    return asQuestionResult(base, { intent: "response_fit", supportingTool: "assess_response_fit", responseFit: fit });
  }

  if (/\b(partner brief|funding brief|case for partnership|partner case)\b/i.test(question)) {
    const base = draftPartnerBriefTool({
      geographyId: input.selectedGeographyId,
      audience: "community_partner",
      responseType,
    }, context);
    const fit = base.data && "responseFit" in base.data ? base.data.responseFit : null;
    return asQuestionResult(base, { intent: "partner_brief", supportingTool: "draft_partner_brief", responseFit: fit });
  }

  const base = getPlaceEvidenceTool({ geographyId: input.selectedGeographyId, measureIds: null, includeStale: false }, context);
  return asQuestionResult(base, { intent: "place_evidence", supportingTool: "get_place_evidence", responseFit: null });
}
