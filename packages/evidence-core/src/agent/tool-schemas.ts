import type { PlaceAgentToolDefinition, PlaceAgentToolName } from "./types.ts";

const strictObject = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const geographyId = {
  type: "string",
  minLength: 1,
  description: "Stable reviewed geography identifier from resolve_place; never a free-form place name.",
};

export const PLACE_AGENT_TOOL_DEFINITIONS: readonly PlaceAgentToolDefinition[] = [
  {
    type: "function",
    name: "resolve_place",
    description: "Resolve a ZIP input, ZCTA, Census place, county FIPS, state, or planning region using the stored official geography catalog. Does not search the live web.",
    strict: true,
    parameters: strictObject({
      query: { type: "string", minLength: 1, description: "The user's exact place query." },
      queryKind: {
        type: "string",
        enum: ["zip_input", "zcta", "place", "county_fips", "state", "planning_region"],
      },
      stateHint: {
        type: ["string", "null"],
        description: "Two-digit state FIPS when known, otherwise null.",
      },
    }, ["query", "queryKind", "stateHint"]),
  },
  {
    type: "function",
    name: "get_place_evidence",
    description: "Return approved stored metric evidence for exactly one reviewed geography, with provenance and geographic caveats.",
    strict: true,
    parameters: strictObject({
      geographyId,
      measureIds: {
        type: ["array", "null"],
        items: { type: "string", minLength: 1 },
        description: "Optional reviewed measure definition identifiers; null returns all eligible measures.",
      },
      includeStale: {
        type: "boolean",
        description: "Whether stale approved evidence may be returned with an explicit stale label. It cannot independently support a response-fit conclusion.",
      },
    }, ["geographyId", "measureIds", "includeStale"]),
  },
  {
    type: "function",
    name: "get_local_plan",
    description: "Return only verified current local planning documents and verified page- or section-cited claims for the selected geography.",
    strict: true,
    parameters: strictObject({
      geographyId,
      documentTypes: {
        type: ["array", "null"],
        items: {
          type: "string",
          enum: ["cha", "chip", "chna", "csp", "implementation_strategy", "supporting_report"],
        },
      },
    }, ["geographyId", "documentTypes"]),
  },
  {
    type: "function",
    name: "compare_places",
    description: "Compare reviewed measures only when observations use compatible geography levels, measure definitions, and data periods. It never silently converts county evidence into ZIP evidence.",
    strict: true,
    parameters: strictObject({
      geographyIds: { type: "array", minItems: 2, maxItems: 5, items: geographyId },
      measureIds: { type: "array", minItems: 1, maxItems: 20, items: { type: "string", minLength: 1 } },
    }, ["geographyIds", "measureIds"]),
  },
  {
    type: "function",
    name: "assess_response_fit",
    description: "Assess whether stored place evidence may support a bounded, non-clinical SozoRock response. Always preserves local partner review and may return insufficient or not appropriate.",
    strict: true,
    parameters: strictObject({
      geographyId,
      responseType: {
        type: "string",
        enum: ["health_equity_hub", "health_access_day", "provider_led_pathway", "workforce_conversation"],
      },
    }, ["geographyId", "responseType"]),
  },
  {
    type: "function",
    name: "draft_partner_brief",
    description: "Draft a source-traceable partner brief from approved stored evidence. It does not invent outcomes, commitments, priorities, or causal claims.",
    strict: true,
    parameters: strictObject({
      geographyId,
      audience: {
        type: "string",
        enum: ["community_partner", "county_or_state", "funder", "licensed_provider", "education_or_workforce"],
      },
      responseType: {
        type: ["string", "null"],
        enum: ["health_equity_hub", "health_access_day", "provider_led_pathway", "workforce_conversation", null],
      },
    }, ["geographyId", "audience", "responseType"]),
  },
] as const;

export function placeAgentToolDefinition(name: PlaceAgentToolName) {
  const definition = PLACE_AGENT_TOOL_DEFINITIONS.find((item) => item.name === name);
  if (!definition) throw new Error(`Unknown place-evidence tool: ${name}.`);
  return definition;
}
