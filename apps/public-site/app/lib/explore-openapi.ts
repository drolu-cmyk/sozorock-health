export const EXPLORE_OPENAPI_VERSION = "2026-08-08";
export const EXPLORE_CONTRACT_VERSION = "explore.api.v2";

const countyGeoid = { type: "string", pattern: "^[0-9]{5}$", description: "Current Census county or county-equivalent GEOID." } as const;
const workspaceIdParameter = { name: "workspaceId", in: "path", required: true, schema: { type: "string", format: "uuid" } } as const;
const errorResponse = {
  description: "Request rejected or evidence unavailable.",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
};

function jsonPost(
  summary: string,
  requestSchema: object,
  responseSchema: object,
  security = false,
  successStatus = "200",
) {
  return {
    summary,
    security: security ? [{ cognitoAccessToken: [] }] : [],
    requestBody: { required: true, content: { "application/json": { schema: requestSchema } } },
    responses: {
      [successStatus]: { description: "Successful response.", content: { "application/json": { schema: responseSchema } } },
      "400": errorResponse,
      "403": errorResponse,
      "429": errorResponse,
      "503": errorResponse,
    },
  };
}

export const exploreOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "SozoRock Place Intelligence API",
    version: EXPLORE_OPENAPI_VERSION,
    description: "Versioned, non-clinical county evidence, planning-agent and collaboration contracts. Missing evidence remains missing; county evidence is never represented as ZIP-, city- or person-level evidence.",
  },
  servers: [{ url: "https://health.sozorockfoundation.org" }],
  tags: [
    { name: "Evidence" }, { name: "Agent" }, { name: "Voice" },
    { name: "Workspace" }, { name: "Visuals" }, { name: "Funder" }, { name: "Operations" },
  ],
  paths: {
    "/api/evidence/v1/place-brief": {
      get: {
        tags: ["Evidence"], summary: "Return the pinned county evidence brief.",
        deprecated: false,
        parameters: [
          { name: "kind", in: "query", required: true, schema: { type: "string", enum: ["county"] } },
          { name: "geoid", in: "query", required: true, schema: countyGeoid },
        ],
        responses: { "200": { description: "ExplorePlaceBriefV1." }, "400": errorResponse, "404": errorResponse, "503": errorResponse },
      },
    },
    "/api/explore": { get: { tags: ["Evidence"], summary: "Resolve county, city/place or ZIP input and return the existing Explore presentation contract.", responses: { "200": { description: "Explore response." }, "409": { description: "Transparent county selection required." } } } },
    "/api/evidence/v1/agent": { post: { tags: ["Agent"], ...jsonPost("Ask a source-grounded question about a selected county.", { $ref: "#/components/schemas/AgentRequest" }, { $ref: "#/components/schemas/AgentAnswer" }) } },
    "/api/evidence/v1/voice/transcribe": { post: { tags: ["Voice"], summary: "Transcribe an intentionally recorded planning question without retaining raw audio.", requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["geoid", "audio"], properties: { geoid: countyGeoid, audio: { type: "string", contentEncoding: "binary" } } } } } }, responses: { "200": { description: "Reviewable transcript." }, "400": errorResponse, "415": errorResponse, "429": errorResponse } } },
    "/api/evidence/v1/workspaces": { get: { tags: ["Workspace"], summary: "List authenticated workspaces.", security: [{ cognitoAccessToken: [] }], responses: { "200": { description: "Membership-scoped workspaces." } } }, post: { tags: ["Workspace"], ...jsonPost("Create a county workspace.", { type: "object" }, { type: "object" }, true) } },
    "/api/evidence/v1/workspaces/{workspaceId}": { parameters: [workspaceIdParameter], get: { tags: ["Workspace"], summary: "Load a membership-scoped county plan.", security: [{ cognitoAccessToken: [] }], responses: { "200": { description: "Workspace plan." }, "403": errorResponse } } },
    "/api/evidence/v1/workspaces/{workspaceId}/events": { parameters: [workspaceIdParameter], get: { tags: ["Workspace"], summary: "Read append-only events after a sequence.", security: [{ cognitoAccessToken: [] }], responses: { "200": { description: "Event stream." } } }, post: { tags: ["Workspace"], ...jsonPost("Append an authorized idempotent workspace event.", { type: "object" }, { type: "object" }, true) } },
    "/api/evidence/v1/workspaces/{workspaceId}/share": { parameters: [workspaceIdParameter], get: { tags: ["Workspace"], summary: "List active share-link metadata for the workspace owner.", security: [{ cognitoAccessToken: [] }], responses: { "200": { description: "Active share-link metadata; bearer tokens are never returned." }, "403": errorResponse } }, post: { tags: ["Workspace"], ...jsonPost("Create an expiring public share link.", { type: "object" }, { type: "object" }, true) }, delete: { tags: ["Workspace"], ...jsonPost("Revoke a public share link.", { type: "object", required: ["shareId"], properties: { shareId: { type: "string", format: "uuid" } } }, { type: "object" }, true) } },
    "/api/evidence/v1/workspaces/{workspaceId}/audit": { parameters: [workspaceIdParameter], get: { tags: ["Workspace"], summary: "Read append-only workspace and agent audit records as an owner or Foundation reviewer.", security: [{ cognitoAccessToken: [] }], responses: { "200": { description: "Authorized compliance audit view." }, "403": errorResponse } } },
    "/api/evidence/v1/workspace-invitations/accept": { post: { tags: ["Workspace"], ...jsonPost("Accept a valid invitation through the trusted server path.", { type: "object" }, { type: "object" }, true) } },
    "/api/evidence/v1/workspace-handoffs/accept": { post: { tags: ["Workspace"], ...jsonPost("Accept a valid handoff through the trusted server path.", { type: "object" }, { type: "object" }, true) } },
    "/api/evidence/v1/workspace-share": { get: { tags: ["Workspace"], summary: "Read the explicit no-store public projection for a scoped share token.", responses: { "200": { description: "Public share DTO." }, "403": errorResponse } } },
    "/api/evidence/v1/workspaces/{workspaceId}/scenarios": {
      parameters: [workspaceIdParameter],
      post: { tags: ["Workspace"], ...jsonPost("Create a versioned planning scenario owned by a human.", { type: "object" }, { type: "object" }, true, "201") },
      patch: { tags: ["Workspace"], ...jsonPost("Append a human review decision as a new immutable scenario version.", { type: "object", required: ["scenarioId", "decision"], properties: { scenarioId: { type: "string", format: "uuid" }, decision: { type: "string", enum: ["verified", "rejected"] } } }, { type: "object" }, true) },
    },
    "/api/evidence/v1/heat-map": { post: { tags: ["Visuals"], ...jsonPost("Return compatible multi-county values and official boundaries.", { $ref: "#/components/schemas/HeatMapCountySetRequest" }, { type: "object" }) } },
    "/api/evidence/v1/funder-snapshot": { post: { tags: ["Funder"], ...jsonPost("Build a cited multi-county evidence set for local review.", { $ref: "#/components/schemas/CountySetRequest" }, { type: "object" }) } },
    "/api/health/version": { get: { tags: ["Operations"], summary: "Return safe release and evidence identity.", responses: { "200": { description: "Release identity." } } } },
  },
  components: {
    securitySchemes: { cognitoAccessToken: { type: "http", scheme: "bearer", bearerFormat: "Cognito access token" } },
    schemas: {
      Error: { type: "object", required: ["error"], properties: { error: { type: "string" } } },
      CountySetRequest: { type: "object", required: ["geoids"], properties: { geoids: { type: "array", minItems: 1, maxItems: 25, uniqueItems: true, items: countyGeoid }, measureDefinitionId: { type: ["string", "null"] } } },
      HeatMapCountySetRequest: { type: "object", required: ["geoids"], properties: { geoids: { type: "array", minItems: 2, maxItems: 25, uniqueItems: true, items: countyGeoid }, measureDefinitionId: { type: ["string", "null"] } } },
      AgentRequest: { type: "object", required: ["geoid", "question"], properties: { geoid: countyGeoid, question: { type: "string", minLength: 3, maxLength: 1500 }, inputMode: { type: "string", enum: ["typed", "voice"] }, transcriptHash: { type: "string", pattern: "^sha256:[0-9a-f]{64}$" } } },
      AgentAnswer: { type: "object", required: ["schemaVersion", "answer", "status", "citedEvidence", "visualIntent", "nonClinicalBoundary"], properties: { schemaVersion: { type: "string" }, answer: { type: "string" }, status: { type: "string", enum: ["answered", "evidence_gap", "refused"] }, citedEvidence: { type: "array", items: { type: "object" } }, visualIntent: { type: "object" }, nonClinicalBoundary: { type: "string" } } },
    },
  },
  "x-sozorock": {
    contractVersion: EXPLORE_CONTRACT_VERSION,
    cache: "Public evidence is pinned by contract, policy and evidence snapshot. Authenticated/share responses are no-store.",
    audit: "Consequential agent, workspace, scenario, share and funder actions are append-only audited.",
    constraints: "No PHI, diagnosis, triage, treatment, individual-risk inference or unrestricted live-web evidence.",
    deprecation: "The legacy geography query alias remains accepted only where documented and returns a deprecation header.",
    rateLimits: "Public evidence, agent, voice and export routes apply server-side network/session limits.",
  },
} as const;
