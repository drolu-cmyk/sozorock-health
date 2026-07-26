import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { clientNetworkAddress } from "../../lib/request-security";

export const runtime = "nodejs";

type SearchRecord = {
  kind: "county" | "place" | "zip";
  geoid: string;
  label: string;
  name: string;
  stateFips: string | null;
  statePostalCode: string | null;
  geographyTypeLabel: string;
  landAreaSquareMeters: number | null;
};

const searchIndex = createRequire(import.meta.url)(
  "../../../../../packages/evidence-core/data/national/geography-search-index.v1.json",
) as {
  censusVintage: string;
  sourceUrl: string;
  records: SearchRecord[];
};

const rateTableName = process.env.CONTACT_RATE_LIMIT_TABLE ?? process.env.CONTACT_SUBMISSIONS_TABLE;
const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
  marshallOptions: { removeUndefinedValues: true },
});
const secrets = new SecretsManagerClient({ region });
const MAX_SEARCHES_PER_FIVE_MINUTES = 60;
const rateLimitSalt = process.env.CONTACT_RATE_LIMIT_SALT;
const rateLimitSaltSecretArn = process.env.CONTACT_RATE_LIMIT_SALT_SECRET_ARN;
let resolvedRateLimitSalt: Promise<string> | undefined;

const stateFipsByCode: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08",
  CT: "09", DE: "10", DC: "11", FL: "12", GA: "13", HI: "15",
  ID: "16", IL: "17", IN: "18", IA: "19", KS: "20", KY: "21",
  LA: "22", ME: "23", MD: "24", MA: "25", MI: "26", MN: "27",
  MS: "28", MO: "29", MT: "30", NE: "31", NV: "32", NH: "33",
  NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
  OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46",
  TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56",
};
const countyDesignation = /\s+(COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPALITY)$/i;
const placeDesignation = /\s+(CITY|TOWN|VILLAGE|BOROUGH|CDP)$/i;
const anyDesignation = /\s+(COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPALITY|CITY|TOWN|VILLAGE|CDP)$/i;

async function getRateLimitSalt() {
  if (rateLimitSalt) return rateLimitSalt;
  if (!rateLimitSaltSecretArn) throw new Error("Location search rate-limit salt is not configured");
  resolvedRateLimitSalt ??= secrets
    .send(new GetSecretValueCommand({ SecretId: rateLimitSaltSecretArn }))
    .then((result) => {
      if (!result.SecretString) throw new Error("Location search rate-limit salt is empty");
      return result.SecretString;
    });
  return resolvedRateLimitSalt;
}

function safePrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9 .'-]/g, "").trim().slice(0, 64).toUpperCase();
}

function normalized(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(anyDesignation, "")
    .replace(/[^A-Z0-9]+/gi, " ")
    .trim()
    .toUpperCase();
}

export async function GET(request: NextRequest) {
  const term = safePrefix(request.nextUrl.searchParams.get("q") ?? "");
  if (term.length < 2) {
    return NextResponse.json({
      results: [],
      source: `U.S. Census Bureau ${searchIndex.censusVintage} Gazetteer`,
    });
  }
  const shouldRateLimit = Boolean(rateTableName);
  if (process.env.NODE_ENV === "production" && (!rateTableName || (!rateLimitSalt && !rateLimitSaltSecretArn))) {
    return NextResponse.json({ error: "Location search is temporarily unavailable." }, { status: 503 });
  }
  if (shouldRateLimit) {
    const epoch = Math.floor(Date.now() / 1000);
    const bucket = Math.floor(epoch / 300);
    const ip = clientNetworkAddress(request.headers);
    let clientHash: string;
    try {
      clientHash = createHash("sha256")
        .update(`${await getRateLimitSalt()}:location:${ip}`)
        .digest("hex");
    } catch {
      return NextResponse.json({ error: "Location search is temporarily unavailable." }, { status: 503 });
    }
    try {
      await dynamo.send(new UpdateCommand({
        TableName: rateTableName,
        Key: { submissionId: `location-rate#${clientHash}#${bucket}` },
        UpdateExpression: "ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
        ConditionExpression: "attribute_not_exists(requestCount) OR requestCount < :maximum",
        ExpressionAttributeValues: {
          ":one": 1,
          ":maximum": MAX_SEARCHES_PER_FIVE_MINUTES,
          ":expiresAt": epoch + 600,
          ":recordType": "location-rate-limit",
        },
      }));
    } catch (error) {
      if ((error as { name?: string }).name === "ConditionalCheckFailedException") {
        return NextResponse.json(
          { error: "Please wait before searching again." },
          { status: 429, headers: { "Retry-After": "300" } },
        );
      }
      console.error("location-rate-limit-failed", {
        name: (error as { name?: string }).name ?? "UnknownError",
      });
      return NextResponse.json({ error: "Location search is temporarily unavailable." }, { status: 503 });
    }
  }

  const isNumeric = /^\d{2,5}$/.test(term);
  const stateMatch = !isNumeric ? term.match(/(?:,\s*|\s+)([A-Z]{2})$/) : null;
  const stateFips = stateMatch ? stateFipsByCode[stateMatch[1]] : undefined;
  const withoutState = stateMatch ? term.slice(0, stateMatch.index).trim() : term;
  const normalizedSearch = normalized(withoutState);
  const fullSearch = withoutState.trim().toUpperCase();
  const asksForCounty = countyDesignation.test(withoutState) && !placeDesignation.test(withoutState);
  const asksForPlace = placeDesignation.test(withoutState) && !countyDesignation.test(withoutState);

  const candidates = searchIndex.records.filter((record) => {
    if (stateFips && record.stateFips !== stateFips) return false;
    if (isNumeric) return record.geoid.startsWith(term);
    const normalizedName = normalized(record.name);
    const normalizedLabel = normalized(record.label);
    return normalizedName.startsWith(normalizedSearch)
      || normalizedLabel.startsWith(normalizedSearch)
      || normalizedName.includes(` ${normalizedSearch}`);
  });
  const score = (result: SearchRecord) => {
    const fullLabel = result.label.trim().toUpperCase();
    const normalizedLabel = normalized(result.label);
    const normalizedName = normalized(result.name);
    const exactGeoid = result.geoid === term ? 3_000_000_000 : 0;
    const exactFullName = fullLabel === fullSearch ? 2_000_000_000 : 0;
    const exactBaseName = normalizedLabel === normalizedSearch || normalizedName === normalizedSearch
      ? 1_000_000_000
      : 0;
    const requestedKind =
      (asksForCounty && result.kind === "county") || (asksForPlace && result.kind === "place")
        ? 100_000_000
        : 0;
    const naturalPlacePriority = !asksForCounty && !asksForPlace && result.kind === "place"
      ? 1_500_000_000
      : 0;
    return exactGeoid + exactFullName + exactBaseName + requestedKind + naturalPlacePriority
      + Math.log10(Math.max(1, result.landAreaSquareMeters ?? 0));
  };

  const results = candidates
    .sort((left, right) => score(right) - score(left))
    .slice(0, 8)
    .map((record) => ({
      id: `${record.kind}-${record.geoid}`,
      kind: record.kind,
      label: record.label,
      geoid: record.geoid,
      stateFips: record.stateFips ?? "",
    }));

  return NextResponse.json({
    results,
    source: `U.S. Census Bureau ${searchIndex.censusVintage} Gazetteer`,
    sourceUrl: searchIndex.sourceUrl,
  }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=2592000" },
  });
}
