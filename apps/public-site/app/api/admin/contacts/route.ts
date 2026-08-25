import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { requireFoundationReviewer } from "../../../lib/foundation-admin-auth";

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

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function csvExport(records: Array<Record<string, unknown>>) {
  const columns = ["createdAt", "name", "email", "inquiryType", "role", "stateOrCounty", "message"];
  return [
    columns.map(csvCell).join(","),
    ...records.map((record) => columns.map((column) => csvCell(record[column])).join(",")),
  ].join("\r\n");
}

export async function GET(request: NextRequest) {
  try {
    await requireFoundationReviewer(request);
    if (!tableName) throw new Error("Contact intelligence is not configured");
    const response = await dynamo.send(new QueryCommand({
      TableName: tableName,
      IndexName: "ContactIntelligence",
      KeyConditionExpression: "recordType = :recordType",
      ExpressionAttributeValues: { ":recordType": "contact" },
      ScanIndexForward: false,
      Limit: 250,
    }));
    const records = (response.Items ?? [])
      .filter((item) => !text(item.email).toLowerCase().endsWith("@simulator.amazonses.com"))
      .map((item) => ({
        createdAt: text(item.createdAt),
        name: text(item.name),
        email: text(item.email),
        inquiryType: text(item.inquiryType),
        role: text(item.role),
        stateOrCounty: text(item.stateOrCounty),
        message: text(item.message),
      }));

    if (request.nextUrl.searchParams.get("format") === "csv") {
      return new NextResponse(csvExport(records), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=foundation-contact-inquiries.csv",
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
