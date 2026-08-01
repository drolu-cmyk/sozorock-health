import { NextRequest, NextResponse } from "next/server";
import { createPilotOnboardingRequest } from "../../../../lib/explore-workspace-runtime";
import { requireEvidenceCapability } from "../../../../lib/evidence-runtime-authority";
import { enforceEvidenceRateLimit } from "../../../../lib/evidence-rate-limit";
import { isTrustedSameOrigin, readBoundedText } from "../../../../lib/request-security";

export const runtime = "nodejs";

const roles = new Set(["county", "provider", "library", "community_host", "education_workforce", "funder", "research"]);
const sources = new Set(["explore", "funder_snapshot", "partner_referral", "direct"]);
const environments = new Set(["staging", "production", "test"]);

export async function POST(request: NextRequest) {
  try {
    const allowedHosts = (process.env.EVIDENCE_ALLOWED_HOSTS ?? process.env.ACCESS_ALLOWED_ORIGINS ?? "")
      .split(";").map((value) => value.trim()).filter(Boolean);
    if (!isTrustedSameOrigin(request, allowedHosts)) return NextResponse.json({ error: "Request origin was not accepted." }, { status: 403 });
    const limited = await enforceEvidenceRateLimit(request);
    if (!limited.allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter ?? 300) } });
    await requireEvidenceCapability("explore:pilot-onboarding");
    const bounded = await readBoundedText(request, 12_000, ["application/json"]);
    if (!bounded.ok) return NextResponse.json({ error: "The request was not accepted." }, { status: 400 });
    const body = JSON.parse(bounded.text) as Record<string, unknown>;
    const countyGeoid = typeof body.countyGeoid === "string" ? body.countyGeoid.trim() : "";
    const organization = typeof body.organization === "string" ? body.organization : "";
    const contactName = typeof body.contactName === "string" ? body.contactName : "";
    const email = typeof body.email === "string" ? body.email : "";
    const role = typeof body.role === "string" && roles.has(body.role) ? body.role as "county" | "provider" | "library" | "community_host" | "education_workforce" | "funder" | "research" : "county";
    const intendedUse = typeof body.intendedUse === "string" ? body.intendedUse : "";
    const source = typeof body.source === "string" && sources.has(body.source) ? body.source as "explore" | "funder_snapshot" | "partner_referral" | "direct" : "explore";
    const environment = typeof body.environment === "string" && environments.has(body.environment) ? body.environment as "staging" | "production" | "test" : "production";
    const consent = body.consent === true;
    const created = await createPilotOnboardingRequest({ countyGeoid, organization, contactName, email, role, intendedUse, consent, source, environment });
    return NextResponse.json({ contractVersion: "explore.pilot-onboarding.v1", request: created }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = (error as Error).message;
    const status = /required|invalid|must|consent|submit|medical|protected|GEOID/i.test(message) ? 422 : 503;
    return NextResponse.json({ error: status === 422 ? message : "Pilot onboarding is temporarily unavailable." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
