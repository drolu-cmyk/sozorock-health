import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.STAGING_EXPLORE_URL?.replace(/\/$/, "");
const ownerToken = process.env.STAGING_OWNER_ACCESS_TOKEN;
const contributorToken = process.env.STAGING_CONTRIBUTOR_ACCESS_TOKEN;
const viewerToken = process.env.STAGING_VIEWER_ACCESS_TOKEN;
if (!baseUrl || !ownerToken || !contributorToken || !viewerToken) {
  throw new Error("Staging URL and three scoped access tokens are required.");
}

async function request(path, token, init = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Origin: baseUrl,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
}

async function json(response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function invite(workspaceId, token, role, access) {
  return json(await request(`/api/evidence/v1/workspaces/${workspaceId}/invitations`, token, {
    method: "POST",
    body: JSON.stringify({ role, access }),
  }));
}

async function accept(token, invitationToken) {
  return json(await request("/api/evidence/v1/workspace-invitations/accept", token, {
    method: "POST",
    body: JSON.stringify({ token: invitationToken }),
  }));
}

function openSocket(session) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(session.endpoint, session.protocol);
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out.")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    }, { once: true });
    socket.addEventListener("error", () => reject(new Error("WebSocket connection failed.")), { once: true });
  });
}

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Real-time event did not arrive within two seconds.")), 2_000);
    socket.addEventListener("message", (event) => {
      clearTimeout(timeout);
      resolve(JSON.parse(String(event.data)));
    }, { once: true });
  });
}

const workspace = await json(await request("/api/evidence/v1/workspaces", ownerToken, {
  method: "POST",
  headers: { "Idempotency-Key": randomUUID() },
  body: JSON.stringify({ geoid: "36001", title: "Milestone 10 staging acceptance" }),
}));
const workspaceId = workspace.workspace.id;

const contributorInvite = await invite(
  workspaceId,
  ownerToken,
  "county_planner",
  "contributor",
);
await accept(contributorToken, contributorInvite.invitation.token);
const viewerInvite = await invite(
  workspaceId,
  ownerToken,
  "research_funder_viewer",
  "viewer",
);
await accept(viewerToken, viewerInvite.invitation.token);

const ownerSession = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/realtime-session`,
  ownerToken,
  { method: "POST", body: "{}" },
));
const contributorSession = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/realtime-session`,
  contributorToken,
  { method: "POST", body: "{}" },
));
const ownerSocket = await openSocket(ownerSession.session);
const contributorSocket = await openSocket(contributorSession.session);

const ownerMessage = nextMessage(ownerSocket);
const contributorMessage = nextMessage(contributorSocket);
const eventKey = randomUUID();
const createdEvent = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/events`,
  ownerToken,
  {
    method: "POST",
    headers: { "Idempotency-Key": eventKey },
    body: JSON.stringify({
      eventType: "question_asked",
      payload: { question: "Which evidence gaps require local review?" },
    }),
  },
));
const [receivedOwner, receivedContributor] = await Promise.all([ownerMessage, contributorMessage]);
assert.equal(receivedOwner.event.sequenceNumber, createdEvent.event.sequenceNumber);
assert.equal(receivedContributor.event.sequenceNumber, createdEvent.event.sequenceNumber);

const duplicate = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/events`,
  ownerToken,
  {
    method: "POST",
    headers: { "Idempotency-Key": eventKey },
    body: JSON.stringify({
      eventType: "question_asked",
      payload: { question: "Which evidence gaps require local review?" },
    }),
  },
));
assert.equal(duplicate.event.sequenceNumber, createdEvent.event.sequenceNumber);

const sectionKey = `planning-questions-${randomUUID()}`;
const sectionPath = `/api/evidence/v1/workspaces/${workspaceId}/sections/${sectionKey}`;
const concurrent = await Promise.all([
  request(sectionPath, ownerToken, {
    method: "PUT",
    headers: { "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ expectedVersion: 0, content: { questions: ["Owner edit"] } }),
  }),
  request(sectionPath, contributorToken, {
    method: "PUT",
    headers: { "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ expectedVersion: 0, content: { questions: ["Contributor edit"] } }),
  }),
]);
assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 409]);

const viewerWrite = await request(sectionPath, viewerToken, {
  method: "PUT",
  body: JSON.stringify({ expectedVersion: 1, content: { questions: ["Unauthorized edit"] } }),
});
assert.equal(viewerWrite.status, 403);

const scenario = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/scenarios`,
  ownerToken,
  {
    method: "POST",
    headers: { "Idempotency-Key": randomUUID() },
    body: JSON.stringify({
      name: "Staging review path",
      inputs: {
        hubLocations: [{ type: "library", count: 1 }],
        eventFrequencyPerYear: 1,
        verifiedPartnerCapacity: null,
        geographicReach: null,
        publicTransportationContext: null,
        digitalReadinessSupport: null,
        workforceAvailability: null,
        confirmedLocalPriorityIds: [],
        assumptions: [{ key: "staging", value: "Human review required", owner: "staging-owner" }],
      },
      evidenceUsed: [],
      evidenceMissing: ["Verified local delivery capacity"],
    }),
  },
));
assert.equal(scenario.scenario.output.humanReviewStatus, "not_reviewed");
const reviewedScenario = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/scenarios`,
  ownerToken,
  {
    method: "PATCH",
    headers: { "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ scenarioId: scenario.scenario.id, decision: "verified" }),
  },
));
assert.equal(reviewedScenario.result.version, 2);
assert.equal(reviewedScenario.result.humanReviewStatus, "verified");
const planAfterReview = await json(await request(`/api/evidence/v1/workspaces/${workspaceId}`, ownerToken));
const persistedScenario = planAfterReview.scenarios.find((item) => item.id === scenario.scenario.id);
assert.equal(persistedScenario.version, 2);
assert.equal(persistedScenario.humanReviewStatus, "verified");

const afterReconnect = await json(await request(
  `/api/evidence/v1/workspaces/${workspaceId}/events?after=${createdEvent.event.sequenceNumber - 1}`,
  contributorToken,
));
assert.ok(afterReconnect.events.some((event) => event.sequenceNumber === createdEvent.event.sequenceNumber));

ownerSocket.close();
contributorSocket.close();
console.log(JSON.stringify({
  contractVersion: "explore.staging-collaboration-acceptance.v1",
  workspaceId,
  realtimeUnderTwoSeconds: true,
  idempotency: "passed",
  concurrency: "passed",
  viewerAuthorization: "passed",
  immutableScenarioReview: "passed",
  resumeFromSequence: "passed",
}));
