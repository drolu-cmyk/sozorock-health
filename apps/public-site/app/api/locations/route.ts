import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const PLACE_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
const ZIP_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query";
const COUNTY_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/9/query";
const rateTableName = process.env.CONTACT_RATE_LIMIT_TABLE ?? process.env.CONTACT_SUBMISSIONS_TABLE;
const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({region}), {marshallOptions:{removeUndefinedValues:true}});
const MAX_SEARCHES_PER_FIVE_MINUTES = 60;

type CensusFeature = { attributes?: Record<string, string | number | null> };

function safePrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9 .'-]/g, "").trim().slice(0, 64).toUpperCase().replaceAll("'", "''");
}

async function queryLayer(url: string, where: string, outFields: string) {
  const params = new URLSearchParams({
    f: "json",
    where,
    outFields,
    returnGeometry: "false",
    resultRecordCount: "6",
    orderByFields: "BASENAME",
  });
  const response = await fetch(`${url}?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "SozoRock-Health-Public-Site/1.0" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) return [] as CensusFeature[];
  const data = await response.json() as { features?: CensusFeature[] };
  return data.features ?? [];
}

export async function GET(request: NextRequest) {
  const term = safePrefix(request.nextUrl.searchParams.get("q") ?? "");
  if (term.length < 2) return NextResponse.json({ results: [], source: "U.S. Census Bureau TIGERweb" });
  if (!rateTableName) return NextResponse.json({error:"Location search is temporarily unavailable."},{status:503});

  const epoch=Math.floor(Date.now()/1000);
  const bucket=Math.floor(epoch/300);
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const clientHash=createHash("sha256").update(`${process.env.CONTACT_RATE_LIMIT_SALT ?? "sozorock-health"}:location:${ip}`).digest("hex");
  try {
    await dynamo.send(new UpdateCommand({
      TableName:rateTableName,
      Key:{submissionId:`location-rate#${clientHash}#${bucket}`},
      UpdateExpression:"ADD requestCount :one SET expiresAt = :expiresAt, recordType = :recordType",
      ConditionExpression:"attribute_not_exists(requestCount) OR requestCount < :maximum",
      ExpressionAttributeValues:{":one":1,":maximum":MAX_SEARCHES_PER_FIVE_MINUTES,":expiresAt":epoch+600,":recordType":"location-rate-limit"},
    }));
  } catch (error) {
    if ((error as {name?:string}).name === "ConditionalCheckFailedException") return NextResponse.json({error:"Please wait before searching again."},{status:429,headers:{"Retry-After":"300"}});
    console.error("location-rate-limit-failed",{name:(error as {name?:string}).name ?? "UnknownError"});
    return NextResponse.json({error:"Location search is temporarily unavailable."},{status:503});
  }

  const placeWhere = `UPPER(BASENAME) LIKE '${term}%'`;
  const countyWhere = /^\d{2,5}$/.test(term) ? `GEOID LIKE '${term}%'` : placeWhere;
  const placeLayers = [4, 5].map((layer) => queryLayer(`${PLACE_SERVICE}/${layer}/query`, placeWhere, "BASENAME,NAME,GEOID,STATE"));
  const countyPromise = queryLayer(COUNTY_SERVICE, countyWhere, "BASENAME,NAME,GEOID,STATE,COUNTY");
  const zipPromise = /^\d{2,5}$/.test(term)
    ? queryLayer(ZIP_SERVICE, `ZCTA5 LIKE '${term}%'`, "ZCTA5,GEOID,NAME")
    : Promise.resolve([] as CensusFeature[]);

  const [incorporated, censusDesignated, counties, zips] = await Promise.all([...placeLayers, countyPromise, zipPromise]);
  const countyResults = counties.map(({ attributes = {} }) => ({
    id: `county-${attributes.GEOID}`,
    kind: "county" as const,
    label: String(attributes.NAME ?? attributes.BASENAME ?? "U.S. county"),
    geoid: String(attributes.GEOID ?? ""),
    stateFips: String(attributes.STATE ?? "").padStart(2, "0"),
  }));
  const places = [...incorporated, ...censusDesignated].map(({ attributes = {} }) => ({
    id: `place-${attributes.GEOID}`,
    kind: "place" as const,
    label: String(attributes.NAME ?? attributes.BASENAME ?? "U.S. place"),
    geoid: String(attributes.GEOID ?? ""),
    stateFips: String(attributes.STATE ?? "").padStart(2, "0"),
  }));
  const zipResults = zips.map(({ attributes = {} }) => ({
    id: `zip-${attributes.ZCTA5 ?? attributes.GEOID}`,
    kind: "zip" as const,
    label: `ZIP ${attributes.ZCTA5 ?? attributes.GEOID}`,
    geoid: String(attributes.GEOID ?? attributes.ZCTA5 ?? ""),
    stateFips: "",
  }));

  const unique = [...countyResults, ...places, ...zipResults].filter((result, index, all) => all.findIndex((item) => item.id === result.id) === index).slice(0, 8);
  return NextResponse.json({ results: unique, source: "U.S. Census Bureau TIGERweb" }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
