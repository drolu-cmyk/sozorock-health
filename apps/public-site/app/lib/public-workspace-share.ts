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

export type PublicWorkspaceReviewQuestion = {
  sectionKey: string;
  question: string;
  status: "answered" | "closed";
  completedAt: string | null;
};

type PublicWorkspaceReviewQuestionInput = PublicWorkspaceReviewQuestion & { isPublic?: boolean };

export type PublicWorkspaceCitation = {
  citationId: string;
  publisher: string | null;
  sourceTitle: string | null;
  officialUrl: string;
  releaseDate: string | null;
  dataPeriod: { start: string | null; end: string | null } | null;
  geography: string | null;
  measureOrPassage: string | null;
  confidence: string | null;
  limitations: string[];
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
  reviewQuestions: PublicWorkspaceReviewQuestion[];
  scenarios: PublicWorkspaceScenario[];
  citations: PublicWorkspaceCitation[];
};

const PUBLIC_SECTION_KEYS = new Set([
  "summary", "context", "evidence", "action", "measurements", "plan", "response-fit", "public-summary",
]);

const PUBLIC_CONTENT_KEYS = new Set([
  "title", "summary", "statement", "description", "evidence", "sources", "source", "citations",
  "citationId", "publisher", "sourceTitle", "measureOrPassage", "geography", "measure", "dataPeriod", "releaseDate", "officialUrl", "url", "limitations",
  "response", "status", "outcome", "assumptions", "outputs", "formula", "range", "humanReviewStatus",
  "definition", "unit", "universe", "adjustment", "confidence", "sourceField", "dataPeriodStart",
  "dataPeriodEnd", "reviewStatus",
]);

const PUBLIC_FORBIDDEN_KEYS = new Set([
  "actorId", "assignedTo", "reviewedBy", "reviewer", "presence", "activity", "invitations", "invitation",
  "participant", "participants", "permissions", "permission", "tenantId", "principalId", "prompt", "task",
  "internal", "private", "pending", "rejected", "blocked", "agentPrompt", "executionAuditId",
]);

function normalizedPublicHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > 800) return null;
  try {
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    const isIpv6 = hostname.includes(":") || hostname.startsWith("[");
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== "443") ||
      !hostname.includes(".") ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      isIpv4 ||
      isIpv6
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

function projectPublicValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(projectPublicValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => PUBLIC_CONTENT_KEYS.has(key) && !PUBLIC_FORBIDDEN_KEYS.has(key))
      .flatMap(([key, child]) => {
        if (key === "officialUrl" || key === "url") {
          const safeUrl = normalizedPublicHttpsUrl(child);
          return safeUrl ? [[key, safeUrl]] : [];
        }
        return [[key, projectPublicValue(child)]];
      }),
  );
}

function isApprovedPublicSection(content: Record<string, unknown>) {
  return content.public === true
    && (content.reviewStatus === "verified" || content.reviewStatus === "approved");
}

function projectCitation(value: unknown): PublicWorkspaceCitation | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const officialUrl = normalizedPublicHttpsUrl(item.officialUrl);
  const citationId = typeof item.citationId === "string" ? item.citationId.slice(0, 160) : null;
  if (!officialUrl || !citationId) return null;
  const dataPeriod = item.dataPeriod && typeof item.dataPeriod === "object" && !Array.isArray(item.dataPeriod)
    ? {
      start: typeof (item.dataPeriod as Record<string, unknown>).start === "string" ? (item.dataPeriod as Record<string, unknown>).start as string : null,
      end: typeof (item.dataPeriod as Record<string, unknown>).end === "string" ? (item.dataPeriod as Record<string, unknown>).end as string : null,
    }
    : null;
  const limitations = Array.isArray(item.limitations)
    ? item.limitations.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.slice(0, 500)).slice(0, 8)
    : [];
  return {
    citationId,
    publisher: typeof item.publisher === "string" ? item.publisher.slice(0, 180) : null,
    sourceTitle: typeof item.sourceTitle === "string" ? item.sourceTitle.slice(0, 240) : null,
    officialUrl,
    releaseDate: typeof item.releaseDate === "string" ? item.releaseDate.slice(0, 40) : null,
    dataPeriod,
    geography: typeof item.geography === "string" ? item.geography.slice(0, 180) : null,
    measureOrPassage: typeof item.measureOrPassage === "string" ? item.measureOrPassage.slice(0, 500) : null,
    confidence: typeof item.confidence === "string" ? item.confidence.slice(0, 40) : null,
    limitations,
  };
}

function projectPublicCitations(sections: PublicWorkspaceSection[]) {
  const citations = new Map<string, PublicWorkspaceCitation>();
  for (const section of sections) {
    const values = section.content.citations;
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const citation = projectCitation(value);
      if (citation) citations.set(citation.citationId, citation);
    }
  }
  return [...citations.values()].sort((left, right) => left.citationId.localeCompare(right.citationId));
}

export function projectPublicWorkspacePlan(input: {
  workspace: PublicWorkspacePlan["workspace"];
  sections: Array<PublicWorkspaceSection & { content: Record<string, unknown> }>;
  scenarios: PublicWorkspaceScenarioInput[];
  reviewQuestions?: PublicWorkspaceReviewQuestionInput[];
}): PublicWorkspacePlan {
  const publicSections = input.sections
    .filter((section) => PUBLIC_SECTION_KEYS.has(section.sectionKey) && isApprovedPublicSection(section.content))
    .map((section) => ({
      sectionKey: section.sectionKey,
      version: section.version,
      content: projectPublicValue(section.content) as Record<string, unknown>,
      updatedAt: section.updatedAt,
    }));
  return {
    workspace: input.workspace,
    sections: publicSections,
    reviewQuestions: (input.reviewQuestions ?? [])
      .filter((question) => question.isPublic === true && ["answered", "closed"].includes(question.status))
      .map((question) => ({
        sectionKey: question.sectionKey,
        question: question.question,
        status: question.status,
        completedAt: question.completedAt,
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
    citations: projectPublicCitations(publicSections),
  };
}
