import type {
  AgentSuggestion,
  CountyWorkspace,
  WorkspaceAccess,
  WorkspaceActor,
  WorkspaceConflict,
  WorkspaceEvent,
  WorkspaceEventType,
  WorkspaceSection,
} from "./types.ts";

export class WorkspaceAuthorizationError extends Error {}
export class WorkspaceVersionConflictError extends Error {
  readonly conflict: WorkspaceConflict;
  constructor(conflict: WorkspaceConflict) {
    super(conflict.message);
    this.conflict = conflict;
  }
}

export interface WorkspaceRepository {
  getWorkspace(workspaceId: string): CountyWorkspace | null;
  getParticipant(workspaceId: string, principalId: string): WorkspaceActor | null;
  listEvents(workspaceId: string, afterSequence: number): WorkspaceEvent[];
  appendEvent(event: Omit<WorkspaceEvent, "sequenceNumber">): WorkspaceEvent;
  getSection(workspaceId: string, sectionKey: string): WorkspaceSection | null;
  saveSection(section: WorkspaceSection, expectedVersion: number): WorkspaceSection;
  getSuggestion(workspaceId: string, suggestionId: string): AgentSuggestion | null;
  saveSuggestion(suggestion: AgentSuggestion): AgentSuggestion;
}

function requireAccess(
  repository: WorkspaceRepository,
  workspaceId: string,
  actor: WorkspaceActor,
  allowed: WorkspaceAccess[],
) {
  const participant = repository.getParticipant(workspaceId, actor.principalId);
  if (!participant || !allowed.includes(participant.access)) {
    throw new WorkspaceAuthorizationError("This participant is not authorized for the requested workspace action.");
  }
  return participant;
}

export function recordWorkspaceEvent(
  repository: WorkspaceRepository,
  input: Omit<WorkspaceEvent, "sequenceNumber">,
): WorkspaceEvent {
  const workspace = repository.getWorkspace(input.workspaceId);
  if (!workspace || workspace.tenantId !== input.tenantId) {
    throw new WorkspaceAuthorizationError("The workspace is outside the authorized tenant scope.");
  }
  return repository.appendEvent(input);
}

export function updateWorkspaceSection(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string;
    sectionKey: string;
    content: Record<string, unknown>;
    expectedVersion: number;
    actor: WorkspaceActor;
    now: string;
  },
) {
  requireAccess(repository, input.workspaceId, input.actor, ["owner", "contributor"]);
  const current = repository.getSection(input.workspaceId, input.sectionKey);
  const currentVersion = current?.version ?? 0;
  if (currentVersion !== input.expectedVersion) {
    throw new WorkspaceVersionConflictError({
      code: "version_conflict",
      expectedVersion: input.expectedVersion,
      currentVersion,
      message: "This section changed after it was opened. Review the latest version before saving.",
    });
  }
  return repository.saveSection({
    workspaceId: input.workspaceId,
    sectionKey: input.sectionKey,
    version: currentVersion + 1,
    content: input.content,
    updatedBy: input.actor.principalId,
    updatedAt: input.now,
  }, currentVersion);
}

export function reviewAgentSuggestion(
  repository: WorkspaceRepository,
  input: {
    workspaceId: string;
    suggestionId: string;
    decision: "accepted" | "rejected";
    actor: WorkspaceActor;
    now: string;
  },
) {
  requireAccess(repository, input.workspaceId, input.actor, ["owner", "contributor"]);
  if (input.actor.actorType !== "human") {
    throw new WorkspaceAuthorizationError("Agent suggestions require an explicit human decision.");
  }
  const suggestion = repository.getSuggestion(input.workspaceId, input.suggestionId);
  if (!suggestion || suggestion.status !== "pending") {
    throw new WorkspaceAuthorizationError("The agent suggestion is unavailable or already reviewed.");
  }
  return repository.saveSuggestion({
    ...suggestion,
    status: input.decision,
    reviewedBy: input.actor.principalId,
    reviewedAt: input.now,
  });
}

export function eventRequiresHumanAcceptance(eventType: WorkspaceEventType) {
  return eventType === "result_added_to_plan"
    || eventType === "scenario_modified"
    || eventType === "human_review_completed";
}
