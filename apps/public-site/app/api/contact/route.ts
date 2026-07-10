import { NextRequest, NextResponse } from "next/server";

const limit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 5;

function requestAllowed(key: string): boolean {
  const now = Date.now();
  const record = limit.get(key);
  if (!record || record.resetAt < now) { limit.set(key, { count: 1, resetAt: now + WINDOW_MS }); return true; }
  if (record.count >= MAX_REQUESTS) return false;
  record.count += 1;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!requestAllowed(ip)) return NextResponse.json({ error: "Please wait before sending another message." }, { status: 429 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || body.website) return NextResponse.json({ accepted: true }, { status: 202 });
  const fields = ["name", "organization", "email", "role", "stateOrCounty", "inquiryType", "message"] as const;
  const submission = Object.fromEntries(fields.map(field => [field, typeof body[field] === "string" ? body[field].trim().slice(0, field === "message" ? 2000 : 180) : ""]));
  if (!submission.name || !submission.email || !submission.message || body.consent !== true) return NextResponse.json({ error: "Please complete the required fields and acknowledge the privacy notice." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submission.email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  // Production adapter: persist encrypted submission, emit a minimal audit event, and notify contact@sozorockfoundation.org through the approved mail service.
  // Never log the message body or place mail credentials in the client.
  return NextResponse.json({ accepted: true, message: "Thank you. A SozoRock Health team member will respond through the contact information you provided." }, { status: 202 });
}
