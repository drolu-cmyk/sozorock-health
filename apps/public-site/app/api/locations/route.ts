import { createHash } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextRequest, NextResponse } from "next/server";
import { clientNetworkAddress } from "../../lib/request-security";

export const runtime = "nodejs";

const PLACE_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
const ZIP_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/1/query";
const COUNTY_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/9/query";
const rateTableName = process.env.CONTACT_RATE_LIMIT_TABLE ?? process.env.CONTACT_SUBMISSIONS_TABLE;
const region = process.env.AWS_REGION ?? "us-east-1";
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({region}), {marshallOptions:{removeUndefinedValues:true}});
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
  WV: "54", WI: "55", WY: "56", AS: "60", GU: "66", MP: "69",
  PR: "72", VI: "78",
};

const countyDesignation = /\s+(COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPIO|MUNICIPALITY)$/i;
const placeDesignation = /\s+(CITY|TOWN|VILLAGE|BOROUGH|CDP|COMUNIDAD|ZONA URBANA)$/i;
const anyDesignation = /\s+(COUNTY|PARISH|BOROUGH|CENSUS AREA|MUNICIPIO|MUNICIPALITY|CITY|TOWN|VILLAGE|CDP|COMUNIDAD|ZONA URBANA)$/i;

type CensusFeature = { attributes?: Record<string, string | number | null> };

async function getRateLimitSalt() {
  if (rateLimitSalt) return rateLimitSalt;
  if (!rateLimitSaltSecretArn)
    throw new Error("Location search rate-limit salt is not configured");
  resolvedRateLimitSalt ??= secrets
    .send(new GetSecretValueCommand({ SecretId: rateLimitSaltSecretArn }))
    .then((result) => {
      if (!result.SecretString)
        throw new Error("Location search rate-limit salt is empty");
      return result.SecretString;
    });
  return resolvedRateLimitSalt;
}

function safePrefix(value: string) {
  return value.replace(/[^a-zA-Z0-9 .'-]/g, "").trim().slice(0, 64).toUpperCase().replaceAll("'", "''");
}

async function queryLayer(url: string, where: string, outFields: string, orderByFields = "BASENAME") {
  const params = new URLSearchParams({
    f: "json",
    where,
    outFields,
    returnGeometry: "false",
    resultRecordCount: "6",
    orderByFields,
  });
  const response = await fetch(`${url}?${params}`, {
    headers: { Accept: "application/json", "User-Agent": "SozoRock-Health-Public-Site/1.0" },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) return [] as CensusFeature[];
  const data = await response.json() as { features?: CensusFeature[] };
  return data.features ?? [];
}

async function queryPointLayer(url: string, longitude: number, latitude: number, outFields: string) {
  const params = new URLSearchParams({
    f: "json",
    geometry: JSON.stringify({ x: longitude, y: latitude, spatialReference: { wkid: 4326 } }),
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "false",
    resultRecordCount: "3",
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
  if (!rateTableName || (!rateLimitSalt && !rateLimitSaltSecretArn))
    return NextResponse.json(
      { error: "Location search is temporarily unavailable." },
      { status: 503 },
    );

  const epoch=Math.floor(Date.now()/1000);
  const bucket=Math.floor(epoch/300);
  const ip = clientNetworkAddress(request.headers);
  let clientHash: string;
  try {
    clientHash = createHash("sha256")
      .update(`${await getRateLimitSalt()}:location:${ip}`)
      .digest("hex");
  } catch {
    return NextResponse.json(
      { error: "Location search is temporarily unavailable." },
      { status: 503 },
    );
  }
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

  const isNumeric = /^\d{2,5}$/.test(term);
  const stateMatch = !isNumeric ? term.match(/\s+([A-Z]{2})$/) : null;
  const stateFips = stateMatch ? stateFipsByCode[stateMatch[1]] : undefined;
  const withoutState = stateMatch ? term.slice(0, stateMatch.index).trim() : term;
  const countyPrefix = withoutState.replace(countyDesignation, "").trim();
  const placePrefix = withoutState.replace(placeDesignation, "").trim();
  const stateClause = stateFips ? ` AND STATE='${stateFips}'` : "";
  const placeWhere = `(UPPER(BASENAME) LIKE '${placePrefix}%' OR UPPER(BASENAME) LIKE '% ${placePrefix}%')${stateClause}`;
  const countyWhere = isNumeric
    ? `GEOID LIKE '${term}%'`
    : `UPPER(BASENAME) LIKE '${countyPrefix}%'${stateClause}`;
  const placeLayers = [4, 5].map((layer) => queryLayer(`${PLACE_SERVICE}/${layer}/query`, placeWhere, "BASENAME,NAME,GEOID,STATE,AREALAND"));
  const countyPromise = queryLayer(COUNTY_SERVICE, countyWhere, "BASENAME,NAME,GEOID,STATE,COUNTY,AREALAND");
  const zipPromise = isNumeric
    ? queryLayer(ZIP_SERVICE, `ZCTA5 LIKE '${term}%'`, "ZCTA5,GEOID,NAME,CENTLAT,CENTLON,AREALAND", "ZCTA5")
    : Promise.resolve([] as CensusFeature[]);

  const [incorporated, censusDesignated, counties, zips] = await Promise.all([...placeLayers, countyPromise, zipPromise]);
  const countyResults = counties.map(({ attributes = {} }) => ({
    id: `county-${attributes.GEOID}`,
    kind: "county" as const,
    label: String(attributes.NAME ?? attributes.BASENAME ?? "U.S. county"),
    geoid: String(attributes.GEOID ?? ""),
    stateFips: String(attributes.STATE ?? "").padStart(2, "0"),
    rankArea: Number(attributes.AREALAND ?? 0),
  }));
  const places = [...incorporated, ...censusDesignated].map(({ attributes = {} }) => ({
    id: `place-${attributes.GEOID}`,
    kind: "place" as const,
    label: String(attributes.NAME ?? attributes.BASENAME ?? "U.S. place"),
    geoid: String(attributes.GEOID ?? ""),
    stateFips: String(attributes.STATE ?? "").padStart(2, "0"),
    rankArea: Number(attributes.AREALAND ?? 0),
  }));
  const zipResults = await Promise.all(zips.map(async ({ attributes = {} }) => {
    const geoid = String(attributes.GEOID ?? attributes.ZCTA5 ?? "");
    const longitude = Number(attributes.CENTLON);
    const latitude = Number(attributes.CENTLAT);
    let placeName = "";
    let containingState = "";
    if (/^\d{5}$/.test(term) && Number.isFinite(longitude) && Number.isFinite(latitude)) {
      const [incorporatedAtPoint, designatedAtPoint, countyAtPoint] = await Promise.all([
        queryPointLayer(`${PLACE_SERVICE}/4/query`, longitude, latitude, "BASENAME,NAME,STATE"),
        queryPointLayer(`${PLACE_SERVICE}/5/query`, longitude, latitude, "BASENAME,NAME,STATE"),
        queryPointLayer(COUNTY_SERVICE, longitude, latitude, "BASENAME,NAME,STATE"),
      ]);
      const containingPlace = [...incorporatedAtPoint, ...designatedAtPoint][0];
      const containingCounty = countyAtPoint[0];
      const context = containingPlace?.attributes ?? containingCounty?.attributes;
      placeName = String(context?.BASENAME ?? context?.NAME ?? "").replace(/\s+County$/i, "");
      containingState = String(context?.STATE ?? "").padStart(2, "0");
    }
    return {
      id: `zip-${geoid}`,
      kind: "zip" as const,
      label: placeName ? `${geoid} · ${placeName}` : geoid,
      geoid,
      stateFips: containingState,
      rankArea: Number(attributes.AREALAND ?? 0),
    };
  }));

  const normalizedSearch = withoutState.replace(anyDesignation, "").trim().toUpperCase();
  const fullSearch = withoutState.trim().toUpperCase();
  const asksForCounty = countyDesignation.test(withoutState) && !placeDesignation.test(withoutState);
  const asksForPlace = placeDesignation.test(withoutState) && !countyDesignation.test(withoutState);
  const score = (result: { kind: "county" | "place" | "zip"; label: string; geoid: string; rankArea: number }) => {
    const fullLabel = result.label.trim().toUpperCase();
    const normalizedLabel = result.label.replace(anyDesignation, "").trim().toUpperCase();
    const exactGeoid = result.geoid === term ? 3_000_000_000 : 0;
    const exactFullName = fullLabel === fullSearch ? 2_000_000_000 : 0;
    const exactBaseName = normalizedLabel === normalizedSearch ? 1_000_000_000 : 0;
    const requestedKind =
      (asksForCounty && result.kind === "county") || (asksForPlace && result.kind === "place")
        ? 100_000_000
        : 0;
    const naturalPlacePriority = !asksForCounty && !asksForPlace && result.kind === "place" ? 1_500_000_000 : 0;
    return exactGeoid + exactFullName + exactBaseName + requestedKind + naturalPlacePriority + Math.log10(Math.max(1, result.rankArea));
  };
  const unique = [...countyResults, ...places, ...zipResults]
    .filter((result, index, all) => all.findIndex((item) => item.id === result.id) === index)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 8)
    .map((result) => ({
      id: result.id,
      kind: result.kind,
      label: result.label,
      geoid: result.geoid,
      stateFips: result.stateFips,
    }));
  return NextResponse.json({ results: unique, source: "U.S. Census Bureau TIGERweb" }, {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
