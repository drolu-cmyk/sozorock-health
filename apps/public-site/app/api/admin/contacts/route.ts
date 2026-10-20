import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { requireFoundationReviewer } from "../../../lib/foundation-admin-auth";
import { csvCell } from "../../../lib/csv";
import { projectContactRecords, type ContactRecordType } from "../../../lib/contact-records";

export const runtime = "nodejs";

const tableName = process.env.CONTACT_SUBMISSIONS_TABLE;
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
  { marshallOptions: { removeUndefinedValues: true } },
);

function protectedJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function csvExport(records: Array<Record<string, unknown>>, type: ContactRecordType) {
  const columns = type === "program-interest"
    ? ["createdAt", "name", "email", "phone", "preferredContact", "stateOrCounty", "message", "consentedAt", "expiresAt", "notificationStatus"]
    : ["createdAt", "name", "email", "inquiryType", "role", "stateOrCounty", "message"];
  return [
    columns.map(csvCell).join(","),
    ...records.map((record) => columns.map((column) => csvCell(record[column])).join(",")),
  ].join("\r\n");
}

export async function GET(request: NextRequest) {
  try {
    await requireFoundationReviewer(request);
    if (!tableName) throw new Error("Contact intelligence is not configured");
    const requestedType = request.nextUrl.searchParams.get("type") ?? "contact";
    if (requestedType !== "contact" && requestedType !== "program-interest") return protectedJson({ error: "Choose a supported inquiry type." }, 400);
    const type: ContactRecordType = requestedType;
    const now = Math.floor(Date.now() / 1000);
    let cursor: Record<string, string> | undefined;
    const suppliedCursor = request.nextUrl.searchParams.get("cursor");
    if (suppliedCursor) {
      try {
        if (suppliedCursor.length > 2000) throw new Error("Invalid cursor");
        const value = JSON.parse(Buffer.from(suppliedCursor, "base64url").toString("utf8"));
        if (!value || value.recordType !== type || typeof value.submissionId !== "string" || typeof value.createdAt !== "string" || value.submissionId.length > 300 || value.createdAt.length > 40) throw new Error("Invalid cursor");
        cursor = { recordType: type, submissionId: value.submissionId, createdAt: value.createdAt };
      } catch { return protectedJson({ error: "The page reference is invalid. Refresh this view." }, 400); }
    }
    const exporting = request.nextUrl.searchParams.get("format") === "csv";
    const records: Array<Record<string, unknown>> = [];
    let pages = 0;
    do {
      const response = await dynamo.send(new QueryCommand({
      TableName: tableName,
      IndexName: "ContactIntelligence",
      KeyConditionExpression: "recordType = :recordType",
      FilterExpression: "attribute_not_exists(expiresAt) OR expiresAt > :now",
      ExpressionAttributeValues: { ":recordType": type, ":now": now },
      ScanIndexForward: false,
      Limit: 250,
      ExclusiveStartKey: cursor,
    }));
      records.push(...projectContactRecords(response.Items ?? [], type, now));
      cursor = response.LastEvaluatedKey as Record<string, string> | undefined;
      pages += 1;
    } while (exporting && cursor && pages < 20);
    if (exporting && cursor) return protectedJson({ error: "This export exceeds the safe size limit. Contact the data custodian for a complete export." }, 409);

    if (exporting) {
      return new NextResponse(csvExport(records, type), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=${type === "program-interest" ? "primary-care-interest-list" : "foundation-contact-inquiries"}.csv`,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return protectedJson({
      contractVersion: "foundation.contacts.v1",
      generatedAt: new Date().toISOString(),
      records,
      nextCursor: cursor ? Buffer.from(JSON.stringify(cursor)).toString("base64url") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status = /administration session|reviewer access/i.test(message) ? 403 : 503;
    console.error("foundation-contact-intelligence-failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return protectedJson(
      { error: status === 403 ? "Foundation reviewer access is required." : "Contact intelligence is temporarily unavailable." },
      status,
    );
  }
}
