import { createHash } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import {
  PLACE_AGENT_TOOL_DEFINITIONS,
  type ExplorePlaceBriefV1,
  type PlaceAgentToolName,
} from "@sozorock/evidence-core";
import {
  approvedCountyEvidenceSnapshot,
  countyRecordByFips,
  getApprovedCountyBrief,
} from "./approved-evidence-snapshot";
import { isClinicalSafetyQuestion } from "./place-agent-safety";

const secrets = new SecretsManagerClient({});
const MAX_TOOL_DEPTH = 6;
const REQUEST_TIMEOUT_MS = 22_000;
const MODEL = process.env.OPENAI_PLACE_EVIDENCE_MODEL?.trim() || "gpt-5.6-sol";
const AGENT_POLICY_VERSION = "place-evidence-agent.production.v1";
const AGENT_SCHEMA_VERSION = "place-evidence-answer.v1";

export type PlaceEvidenceAnswer = {
  schemaVersion: typeof AGENT_SCHEMA_VERSION;
  answer: string;
  status: "answered" | "evidence_gap" | "refused";
  citedEvidence: Array<{
    citationId: string;
    claim: string;
  }>;
  sourceAndDataDates: Array<{
    sourceId: string;
    releaseDate: string | null;
    dataPeriodStart: string | null;
    dataPeriodEnd: string | null;
  }>;
  geographicScope: {
    kind: string;
    geoid: string;
    displayName: string;
  };
  confidence: "high" | "moderate" | "low";
  missingEvidence: string[];
  caveats: string[];
  nonClinicalBoundary: string;
};

type OpenAIResponse = {
  id?: string;
  output?: Array<{
    type?: string;
    call_id?: string;
    name?: string;
    arguments?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

function contentHash() {
  return approvedCountyEvidenceSnapshot.snapshotId.replace(/^snapshot:/, "sha256:");
}

function approvedClaims(brief: ExplorePlaceBriefV1) {
  return [
    ...brief.publicData.observations.flatMap((observation) =>
      observation.citationIds.map((citationId) => ({
        citationId,
        claim: `${observation.label}: ${observation.value}${observation.unit === "percent" ? "%" : ` ${observation.unit}`} for ${brief.resolution.selected?.displayName ?? "the selected geography"} (${observation.dataPeriod.start ?? "period unavailable"} to ${observation.dataPeriod.end ?? "period unavailable"}).`,
      }))),
    ...brief.localPlanningEvidence.claims.flatMap((claim) =>
      claim.citationIds.map((citationId) => ({ citationId, claim: claim.statement }))),
  ];
}

async function apiKey() {
  const arn = process.env.OPENAI_SECRET_ARN?.trim();
  if (!arn) throw new Error("OpenAI secret is not configured.");
  const value = await secrets.send(new GetSecretValueCommand({ SecretId: arn }));
  const raw = value.SecretString?.trim();
  if (!raw) throw new Error("OpenAI secret is empty.");
  if (raw.startsWith("{")) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const key = parsed.OPENAI_API_KEY ?? parsed.apiKey ?? parsed.key;
    if (typeof key === "string" && key.startsWith("sk-")) return key;
  }
  if (raw.startsWith("sk-")) return raw;
  throw new Error("OpenAI secret does not contain an API key.");
}

function evidenceToolResult(name: PlaceAgentToolName, args: Record<string, unknown>) {
  if (name === "resolve_place") {
    const query = String(args.query ?? "").trim();
    const record = /^\d{5}$/.test(query)
      ? countyRecordByFips.get(query)
      : approvedCountyEvidenceSnapshot.counties.find((item) =>
        `${item.county}, ${item.stateCode}`.toLowerCase() === query.toLowerCase()
        || item.county.toLowerCase() === query.toLowerCase());
    if (!record) return { status: "not_found", answer: "No exact reviewed county match was found.", alternatives: [] };
    const brief = getApprovedCountyBrief(record.fips);
    return {
      status: "ok",
      answer: `${query} resolves to ${record.county}, ${record.stateCode} (county GEOID ${record.fips}).`,
      resolution: brief?.resolution,
    };
  }

  const geographyId = String(args.geographyId ?? "");
  const record = approvedCountyEvidenceSnapshot.counties.find((item) => {
    const brief = getApprovedCountyBrief(item.fips);
    return item.fips === geographyId || brief?.resolution.selected?.id === geographyId;
  });
  if (!record) return { status: "not_found", answer: "The requested reviewed county was not found." };
  const brief = getApprovedCountyBrief(record.fips);
  if (!brief) return { status: "not_found", answer: "No approved brief is available." };

  if (name === "get_place_evidence") return { status: "ok", brief, approvedClaims: approvedClaims(brief) };
  if (name === "get_local_plan") {
    return {
      status: brief.localPlanningEvidence.status === "verified" ? "ok" : "insufficient_evidence",
      localPlanningEvidence: brief.localPlanningEvidence,
      answer: brief.localPlanningEvidence.status === "verified"
        ? "Verified current local planning evidence is available."
        : "Current local planning evidence: not yet verified.",
    };
  }
  if (name === "assess_response_fit") {
    const requested = String(args.responseType ?? "");
    return {
      status: "ok",
      responseFit: brief.evidenceAssessment.responseFits.find((fit) => fit.response === requested)
        ?? brief.evidenceAssessment.responseFits[0],
      boundary: "Fit for local review only. This is not a final public intervention decision.",
    };
  }
  if (name === "draft_partner_brief") {
    return {
      status: "ok",
      geography: brief.resolution.selected,
      known: brief.evidenceAssessment.known,
      missing: brief.evidenceAssessment.missing,
      requiresLocalReview: brief.evidenceAssessment.requiresLocalReview,
      responseFits: brief.evidenceAssessment.responseFits,
      citations: brief.citations,
      sources: brief.publicData.sources,
      approvedClaims: approvedClaims(brief),
    };
  }
  if (name === "compare_places") {
    const ids = Array.isArray(args.geographyIds) ? args.geographyIds.map(String) : [];
    const briefs = ids.flatMap((id) => {
      const matched = approvedCountyEvidenceSnapshot.counties.find((item) => {
        const candidate = getApprovedCountyBrief(item.fips);
        return item.fips === id || candidate?.resolution.selected?.id === id;
      });
      const candidate = matched ? getApprovedCountyBrief(matched.fips) : null;
      return candidate ? [candidate] : [];
    });
    return {
      status: briefs.length >= 2 ? "ok" : "insufficient_evidence",
      places: briefs.map((item) => ({
        geography: item.resolution.selected,
        observations: item.publicData.observations,
        sources: item.publicData.sources,
      })),
      caveat: "Only identical county-level measures and compatible data periods may be compared.",
    };
  }
  return { status: "refused", answer: "Unsupported tool." };
}

const answerSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", const: AGENT_SCHEMA_VERSION },
    answer: { type: "string" },
    status: { type: "string", enum: ["answered", "evidence_gap", "refused"] },
    citedEvidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          citationId: { type: "string" },
          claim: { type: "string" },
        },
        required: ["citationId", "claim"],
      },
    },
    sourceAndDataDates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceId: { type: "string" },
          releaseDate: { type: ["string", "null"] },
          dataPeriodStart: { type: ["string", "null"] },
          dataPeriodEnd: { type: ["string", "null"] },
        },
        required: ["sourceId", "releaseDate", "dataPeriodStart", "dataPeriodEnd"],
      },
    },
    geographicScope: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string" },
        geoid: { type: "string" },
        displayName: { type: "string" },
      },
      required: ["kind", "geoid", "displayName"],
    },
    confidence: { type: "string", enum: ["high", "moderate", "low"] },
    missingEvidence: { type: "array", items: { type: "string" } },
    caveats: { type: "array", items: { type: "string" } },
    nonClinicalBoundary: { type: "string" },
  },
  required: [
    "schemaVersion", "answer", "status", "citedEvidence", "sourceAndDataDates",
    "geographicScope", "confidence", "missingEvidence", "caveats", "nonClinicalBoundary",
  ],
} as const;

function refusal(brief: ExplorePlaceBriefV1): PlaceEvidenceAnswer {
  return {
    schemaVersion: AGENT_SCHEMA_VERSION,
    answer: "I can explain reviewed, population-level place evidence, but I cannot provide medical advice, diagnose, triage, recommend treatment, or infer individual risk.",
    status: "refused",
    citedEvidence: [],
    sourceAndDataDates: [],
    geographicScope: {
      kind: brief.resolution.selected?.kind ?? "county",
      geoid: brief.resolution.selected?.authorityId ?? "",
      displayName: brief.resolution.selected?.displayName ?? "",
    },
    confidence: "high",
    missingEvidence: [],
    caveats: brief.safety.limitations,
    nonClinicalBoundary: brief.safety.limitations[0],
  };
}

function extractText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

function validateAnswer(answer: PlaceEvidenceAnswer, briefs: ExplorePlaceBriefV1[]) {
  if (answer.schemaVersion !== AGENT_SCHEMA_VERSION) throw new Error("Agent schema mismatch.");
  const citations = new Set(briefs.flatMap((brief) => brief.citations.map((item) => item.id)));
  const allowedClaims = new Map<string, Set<string>>();
  for (const brief of briefs) {
    for (const observation of brief.publicData.observations) {
      for (const citationId of observation.citationIds) {
        const claims = allowedClaims.get(citationId) ?? new Set<string>();
        claims.add(`${observation.label}: ${observation.value}${observation.unit === "percent" ? "%" : ` ${observation.unit}`} for ${brief.resolution.selected?.displayName ?? "the selected geography"} (${observation.dataPeriod.start ?? "period unavailable"} to ${observation.dataPeriod.end ?? "period unavailable"}).`);
        allowedClaims.set(citationId, claims);
      }
    }
    for (const claim of brief.localPlanningEvidence.claims) {
      for (const citationId of claim.citationIds) {
        const claims = allowedClaims.get(citationId) ?? new Set<string>();
        claims.add(claim.statement);
        allowedClaims.set(citationId, claims);
      }
    }
  }
  for (const cited of answer.citedEvidence) {
    if (!citations.has(cited.citationId)) throw new Error("Agent returned a citation outside the approved evidence package.");
    if (!allowedClaims.get(cited.citationId)?.has(cited.claim)) {
      throw new Error("Agent claim does not exactly match the approved evidence package.");
    }
  }
  if (answer.status === "answered" && answer.citedEvidence.length === 0) {
    throw new Error("A substantive answer requires at least one approved citation.");
  }
  return answer;
}

export async function answerWithOpenAI(input: {
  geoid: string;
  question: string;
}): Promise<{
  answer: PlaceEvidenceAnswer;
  model: string;
  responseId: string | null;
  usage: OpenAIResponse["usage"];
  toolCalls: number;
  inputHash: string;
  outputHash: string;
  snapshotContentHash: string;
}> {
  const brief = getApprovedCountyBrief(input.geoid);
  if (!brief) throw new Error("County GEOID not found.");
  const inputHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  if (isClinicalSafetyQuestion(input.question)) {
    const answer = refusal(brief);
    return {
      answer,
      model: "deterministic-safety-boundary",
      responseId: null,
      usage: undefined,
      toolCalls: 0,
      inputHash,
      outputHash: createHash("sha256").update(JSON.stringify(answer)).digest("hex"),
      snapshotContentHash: contentHash(),
    };
  }

  const key = await apiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const inputItems: unknown[] = [{
    role: "user",
    content: `Selected county GEOID: ${input.geoid}\nQuestion: ${input.question}`,
  }];
  const usedBriefs = new Map<string, ExplorePlaceBriefV1>([[input.geoid, brief]]);
  let responseId: string | null = null;
  let usage: OpenAIResponse["usage"];
  let toolCalls = 0;
  try {
    for (let depth = 0; depth <= MAX_TOOL_DEPTH; depth += 1) {
      const http = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          store: false,
          input: inputItems,
          tools: PLACE_AGENT_TOOL_DEFINITIONS,
          tool_choice: "auto",
          max_output_tokens: 1_600,
          text: {
            format: {
              type: "json_schema",
              name: "place_evidence_answer",
              strict: true,
              schema: answerSchema,
            },
          },
          instructions: [
            "You are SozoRock Place Intelligence, a non-clinical place-evidence assistant.",
            "Answer only from results returned by the approved tools. You have no live-web access.",
            "Retrieve exact place evidence before answering. Never convert missing evidence to zero.",
            "Never inherit county evidence into a ZIP, ZCTA, city, neighborhood, or person.",
            "Refuse diagnosis, triage, treatment, medical advice, or individual-risk inference.",
            "Response fit means fit for local review only, never a final intervention decision.",
            "Every citedEvidence item must copy both citationId and claim exactly from a tool's approvedClaims list.",
            "If evidence is insufficient, return evidence_gap and say what is missing.",
          ].join("\n"),
        }),
        signal: controller.signal,
      });
      if (!http.ok) throw new Error(`OpenAI Responses request failed with ${http.status}.`);
      const response = await http.json() as OpenAIResponse;
      responseId = response.id ?? responseId;
      usage = response.usage ?? usage;
      const calls = (response.output ?? []).filter((item) => item.type === "function_call");
      if (calls.length === 0) {
        const text = extractText(response);
        if (!text) throw new Error("OpenAI Responses returned no structured answer.");
        const answer = validateAnswer(JSON.parse(text) as PlaceEvidenceAnswer, [...usedBriefs.values()]);
        return {
          answer,
          model: MODEL,
          responseId,
          usage,
          toolCalls,
          inputHash,
          outputHash: createHash("sha256").update(JSON.stringify(answer)).digest("hex"),
          snapshotContentHash: contentHash(),
        };
      }
      if (depth === MAX_TOOL_DEPTH) throw new Error("Agent tool depth exceeded.");
      inputItems.push(...calls);
      for (const call of calls) {
        if (!call.call_id || !call.name || !call.arguments) throw new Error("Malformed function call.");
        const name = call.name as PlaceAgentToolName;
        if (!PLACE_AGENT_TOOL_DEFINITIONS.some((tool) => tool.name === name)) {
          throw new Error("Agent requested a tool outside the allowlist.");
        }
        const args = JSON.parse(call.arguments) as Record<string, unknown>;
        const geoid = String(args.geographyId ?? "");
        if (/^\d{5}$/.test(geoid)) {
          const other = getApprovedCountyBrief(geoid);
          if (other) usedBriefs.set(geoid, other);
        }
        const output = evidenceToolResult(name, args);
        toolCalls += 1;
        inputItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(output),
        });
      }
    }
    throw new Error("Agent loop ended without a response.");
  } finally {
    clearTimeout(timer);
  }
}

export const placeAgentRuntimeVersions = {
  model: MODEL,
  policyVersion: AGENT_POLICY_VERSION,
  schemaVersion: AGENT_SCHEMA_VERSION,
  snapshotContentHash: contentHash(),
};
