export type PublicWorkspaceSection = {
  sectionKey: string;
  version: number;
  content: Record<string, unknown>;
  updatedAt: string;
};

export type PublicWorkspaceScenario = {
  name: string;
  version: number;
  output: Record<string, unknown>;
  humanReviewStatus: "verified";
  createdAt: string;
};

type PublicWorkspaceScenarioInput = Omit<PublicWorkspaceScenario, "humanReviewStatus"> & {
  humanReviewStatus: string;
};

export type PublicWorkspacePlan = {
  workspace: {
    title: string;
    version: number;
    updatedAt: string;
    geoid: string;
    geographyName: string;
  };
  sections: PublicWorkspaceSection[];
  scenarios: PublicWorkspaceScenario[];
};

const PUBLIC_SECTION_KEYS = new Set([
  "summary", "context", "evidence", "action", "measurements", "plan", "response-fit", "public-summary",
]);

const PUBLIC_CONTENT_KEYS = new Set([
  "title", "summary", "statement", "description", "evidence", "sources", "source", "citations",
  "geography", "measure", "dataPeriod", "releaseDate", "officialUrl", "url", "limitations",
  "response", "status", "outcome", "assumptions", "outputs", "formula", "range", "humanReviewStatus",
  "definition", "unit", "universe", "adjustment", "confidence", "sourceField", "publisher", "dataPeriodStart",
  "dataPeriodEnd", "reviewStatus",
]);

const PUBLIC_FORBIDDEN_KEYS = new Set([
  "actorId", "assignedTo", "reviewedBy", "reviewer", "presence", "activity", "invitations", "invitation",
  "participant", "participants", "permissions", "permission", "tenantId", "principalId", "prompt", "task",
  "internal", "private", "pending", "rejected", "blocked", "agentPrompt", "executionAuditId",
]);

function projectPublicValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(projectPublicValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => PUBLIC_CONTENT_KEYS.has(key) && !PUBLIC_FORBIDDEN_KEYS.has(key))
      .map(([key, child]) => [key, projectPublicValue(child)]),
  );
}

function isApprovedPublicSection(content: Record<string, unknown>) {
  return content.public === true
    && (content.reviewStatus === "verified" || content.reviewStatus === "approved");
}

export function projectPublicWorkspacePlan(input: {
  workspace: PublicWorkspacePlan["workspace"];
  sections: Array<PublicWorkspaceSection & { content: Record<string, unknown> }>;
  scenarios: PublicWorkspaceScenarioInput[];
}): PublicWorkspacePlan {
  return {
    workspace: input.workspace,
    sections: input.sections
      .filter((section) => PUBLIC_SECTION_KEYS.has(section.sectionKey) && isApprovedPublicSection(section.content))
      .map((section) => ({
        sectionKey: section.sectionKey,
        version: section.version,
        content: projectPublicValue(section.content) as Record<string, unknown>,
        updatedAt: section.updatedAt,
      })),
    scenarios: input.scenarios
      .filter((scenario) => scenario.humanReviewStatus === "verified")
      .map((scenario) => ({
        name: scenario.name,
        version: scenario.version,
        output: projectPublicValue(scenario.output) as Record<string, unknown>,
        humanReviewStatus: "verified" as const,
        createdAt: scenario.createdAt,
      })),
  };
}
