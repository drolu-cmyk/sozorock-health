import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getPublication } from "./publications";

const tableName = process.env.PUBLICATION_ACCESS_TABLE;
const indexName = "PublicationIntelligence";
const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "us-east-1" }),
  { marshallOptions: { removeUndefinedValues: true } },
);

type Item = Record<string, unknown>;

function requireReportingConfig() {
  if (!tableName) throw new Error("Publication intelligence is not configured");
  return tableName;
}

async function queryPartition(partition: string, limit = 1_000) {
  const table = requireReportingConfig();
  const items: Item[] = [];
  let startKey: Record<string, unknown> | undefined;
  do {
    const response = await dynamo.send(new QueryCommand({
      TableName: table,
      IndexName: indexName,
      KeyConditionExpression: "gsi1pk = :partition",
      ExpressionAttributeValues: { ":partition": partition },
      ExclusiveStartKey: startKey,
      ScanIndexForward: false,
      Limit: Math.min(250, limit - items.length),
    }));
    items.push(...(response.Items ?? []));
    startKey = response.LastEvaluatedKey;
  } while (startKey && items.length < limit);
  return items.slice(0, limit);
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function increment(target: Record<string, number>, key: string) {
  const normalized = key.trim() || "Unknown";
  target[normalized] = (target[normalized] ?? 0) + 1;
}

function sortedCounts(values: Record<string, number>) {
  return Object.entries(values)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

export async function getPublicationIntelligence(slug: string) {
  const publication = getPublication(slug);
  if (!publication) return null;

  const [requests, events] = await Promise.all([
    queryPartition(`REQUESTS#${publication.slug}`),
    queryPartition(`EVENTS#${publication.slug}`),
  ]);

  const quality: Record<string, number> = {};
  const countries: Record<string, number> = {};
  const regions: Record<string, number> = {};
  const sectors: Record<string, number> = {};
  const sources: Record<string, number> = {};
  const media: Record<string, number> = {};
  const campaigns: Record<string, number> = {};
  const devices: Record<string, number> = {};
  const browsers: Record<string, number> = {};
  const emailCategories: Record<string, number> = {};

  for (const request of requests) {
    increment(quality, text(request.qualityBand));
    increment(countries, text(request.country));
    increment(regions, [text(request.countryCode), text(request.state)].filter(Boolean).join(" / "));
    increment(sectors, text(request.sector));
    increment(sources, text(request.source) || (text(request.referrerHost) ? "referral" : "direct"));
    increment(media, text(request.medium) || (text(request.referrerHost) ? "referral" : "direct"));
    if (text(request.campaign)) increment(campaigns, text(request.campaign));
    increment(devices, text(request.deviceClass));
    increment(browsers, text(request.browserFamily));
    increment(emailCategories, text(request.emailDomainCategory));
  }

  const eventCounts: Record<string, number> = {};
  for (const event of events) increment(eventCounts, text(event.event));

  const verified = requests.filter((request) => Boolean(request.emailVerifiedAt)).length;
  const downloadLinks = events.filter((event) => text(event.event) === "download_link_issued").length;

  return {
    publication: { slug: publication.slug, title: publication.title },
    generatedAt: new Date().toISOString(),
    summary: {
      requests: requests.length,
      verifiedEmails: verified,
      unverifiedEmails: Math.max(0, requests.length - verified),
      verificationRate: requests.length ? Math.round((verified / requests.length) * 1_000) / 10 : 0,
      downloadLinksIssued: downloadLinks,
      averageQualityScore: requests.length
        ? Math.round((requests.reduce((sum, request) => sum + number(request.qualityScore), 0) / requests.length) * 10) / 10
        : 0,
    },
    breakdowns: {
      quality: sortedCounts(quality),
      countries: sortedCounts(countries),
      regions: sortedCounts(regions),
      sectors: sortedCounts(sectors),
      sources: sortedCounts(sources),
      media: sortedCounts(media),
      campaigns: sortedCounts(campaigns),
      devices: sortedCounts(devices),
      browsers: sortedCounts(browsers),
      emailCategories: sortedCounts(emailCategories),
      events: sortedCounts(eventCounts),
    },
    requests: requests.map((request) => ({
      requestId: text(request.requestId),
      createdAt: text(request.createdAt),
      firstName: text(request.firstName),
      lastName: text(request.lastName),
      email: text(request.email),
      emailVerifiedAt: text(request.emailVerifiedAt),
      organization: text(request.organization),
      sector: text(request.sector),
      cityOrRegion: text(request.cityOrRegion),
      state: text(request.state),
      country: text(request.country),
      countryCode: text(request.countryCode),
      source: text(request.source),
      medium: text(request.medium),
      campaign: text(request.campaign),
      referrerHost: text(request.referrerHost),
      landingPath: text(request.landingPath),
      deviceClass: text(request.deviceClass),
      osFamily: text(request.osFamily),
      browserFamily: text(request.browserFamily),
      language: text(request.language),
      timezone: text(request.timezone),
      networkCountry: text(request.networkCountry),
      networkRegion: text(request.networkRegion),
      qualityScore: number(request.qualityScore),
      qualityBand: text(request.qualityBand),
      qualityFlags: Array.isArray(request.qualityFlags) ? request.qualityFlags.map(String) : [],
      emailDomainCategory: text(request.emailDomainCategory),
      updatesConsent: request.updatesConsent === true,
    })),
  };
}
