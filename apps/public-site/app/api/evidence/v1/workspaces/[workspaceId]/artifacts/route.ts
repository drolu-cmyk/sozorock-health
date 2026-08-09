import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceActor } from "../../../../../../lib/explore-workspace-auth";
import { addWorkspaceComment, addWorkspaceReviewQuestion, completeWorkspaceReviewQuestion, requireCollaborationCapability, reviewWorkspaceAgentSuggestion } from "../../../../../../lib/explore-workspace-runtime";
import { isTrustedSameOrigin, readBoundedText } from "../../../../../../lib/request-security";

export const runtime = "nodejs";
type Context = { params: Promise<{ workspaceId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "").split(";").map((item) => item.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    await requireCollaborationCapability();
    const actor = await requireWorkspaceActor(request);
    const { workspaceId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return NextResponse.json({ error: "Workspace identifier is invalid." }, { status: 400 });
    const bounded = await readBoundedText(request, 16_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const action = String(body.action ?? "");
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() || randomUUID();
    let result: unknown;
    if (action === "comment") {
      result = await addWorkspaceComment({ workspaceId, tenantId: actor.tenantId, actor, sectionKey: String(body.sectionKey ?? "plan"), body: String(body.body ?? ""), idempotencyKey });
    } else if (action === "review_question") {
      result = await addWorkspaceReviewQuestion({ workspaceId, tenantId: actor.tenantId, actor, sectionKey: String(body.sectionKey ?? "plan"), question: String(body.question ?? ""), assignedTo: typeof body.assignedTo === "string" && body.assignedTo ? body.assignedTo : null, isPublic: body.isPublic === true, idempotencyKey });
    } else if (action === "review_suggestion") {
      if (body.decision !== "accepted" && body.decision !== "rejected") {
        return NextResponse.json({ error: "Suggestion review decision is invalid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
      }
      result = await reviewWorkspaceAgentSuggestion({ workspaceId, tenantId: actor.tenantId, actor, suggestionId: String(body.suggestionId ?? ""), decision: body.decision, expectedSectionVersion: Number(body.expectedSectionVersion ?? 0), idempotencyKey });
    } else if (action === "complete_review_question") {
      if (body.status !== "answered" && body.status !== "closed") {
        return NextResponse.json({ error: "Review question completion status is invalid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
      }
      result = await completeWorkspaceReviewQuestion({
        workspaceId,
        tenantId: actor.tenantId,
        actor,
        reviewQuestionId: String(body.reviewQuestionId ?? ""),
        status: body.status,
        idempotencyKey,
      });
    } else {
      return NextResponse.json({ error: "Artifact action is invalid." }, { status: 400 });
    }
    return NextResponse.json({ contractVersion: "explore.workspace-artifact.v1", result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: message }, { status: /authorized|authenticated|human|changed/i.test(message) ? 403 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
