import { NextRequest, NextResponse } from "next/server";
import {
  confidenceFieldFor,
  exploreMetrics,
  fieldFor,
  localPlans,
  safeGeoid,
  scoreMetric,
  type ExploreKind,
} from "../../lib/explore-health";

export const runtime = "nodejs";

const currentDatasets: Record<ExploreKind, string> = {
  county: "i46a-9kgh",
  place: "vgc8-iyc4",
  zip: "kee5-23sr",
};

const previousDatasets: Record<ExploreKind, string> = {
  county: "d3i6-k6z5",
  place: "hbpe-6r8n",
  zip: "6jwg-4k37",
};

const idFields: Record<ExploreKind, string> = {
  county: "countyfips",
  place: "placefips",
  zip: "zcta5",
};

type SourceRow = Record<string, string | { coordinates?: number[] } | undefined>;

const stateCodes: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY",
};

const baseFields: Record<ExploreKind, string[]> = {
  county: ["countyfips", "stateabbr", "statedesc", "countyname", "totalpopulation", "totalpop18plus", "geolocation"],
  place: ["placefips", "stateabbr", "statedesc", "placename", "locationname", "totalpopulation", "totalpop18plus", "geolocation"],
  zip: ["zcta5", "totalpopulation", "totalpop18plus", "geolocation"],
};

const placeUnavailableMetrics = new Set(["lacktrpt", "foodinsecu", "loneliness"]);
const previousReleaseUnavailableMetrics = new Set(["lacktrpt", "foodinsecu", "loneliness"]);

function metricsForKind(kind: ExploreKind) {
  return kind === "place"
    ? exploreMetrics.filter((metric) => !placeUnavailableMetrics.has(metric.key))
    : exploreMetrics;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function averageSelect(kind: ExploreKind, release: "2025" | "2024") {
  return metricsForRelease(kind, release)
    .map((metric) => {
      const field = fieldFor(kind, metric.field);
      return `avg(${field}) as ${field}`;
    })
    .join(",");
}

async function cdcQuery(
  dataset: string,
  parameters: Record<string, string>,
) {
  const url = new URL(`https://data.cdc.gov/resource/${dataset}.json`);
  Object.entries(parameters).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "SozoRock-Health-Place-Evidence/1.0",
    },
    next: { revalidate: 86_400 },
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").slice(0, 220);
    throw new Error(`CDC PLACES ${dataset} request failed: ${response.status} ${detail}`);
  }
  return (await response.json()) as SourceRow[];
}

function makeLocation(kind: ExploreKind, geoid: string, row: SourceRow) {
  const state = String(row.stateabbr ?? "");
  const base =
    kind === "county"
      ? `${String(row.countyname ?? "County")} County${state ? `, ${state}` : ""}`
      : kind === "place"
        ? `${String(row.locationname ?? row.placename ?? "U.S. place")}${state ? `, ${state}` : ""}`
        : geoid;
  const coordinates =
    typeof row.geolocation === "object" && row.geolocation?.coordinates
      ? row.geolocation.coordinates
      : [];
  return {
    kind,
    geoid,
    label: base,
    state,
    population: asNumber(row.totalpopulation),
    coordinates,
  };
}

function metricValue(row: SourceRow | undefined, field: string) {
  return row ? asNumber(row[field]) : 0;
}

function metricsForRelease(kind: ExploreKind, release: "2025" | "2024") {
  const metrics = metricsForKind(kind);
  return release === "2024"
    ? metrics.filter((metric) => !previousReleaseUnavailableMetrics.has(metric.key))
    : metrics;
}

async function zipPlaceContext(row: SourceRow) {
  const coordinates = typeof row.geolocation === "object" ? row.geolocation?.coordinates : undefined;
  if (!coordinates || coordinates.length < 2) return null;
  const [longitude, latitude] = coordinates;
  const query = async (url: string) => {
    const parameters = new URLSearchParams({
      f: "json",
      geometry: JSON.stringify({ x: longitude, y: latitude, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: "BASENAME,NAME,STATE",
      returnGeometry: "false",
      resultRecordCount: "3",
    });
    const response = await fetch(`${url}?${parameters}`, {
      headers: { Accept: "application/json", "User-Agent": "SozoRock-Health-Place-Evidence/1.0" },
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return [] as Array<{ attributes?: Record<string, string | number> }>;
    const payload = await response.json() as { features?: Array<{ attributes?: Record<string, string | number> }> };
    return payload.features ?? [];
  };
  const placeBase = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
  const countyUrl = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/9/query";
  const [incorporated, designated, counties] = await Promise.all([
    query(`${placeBase}/4/query`),
    query(`${placeBase}/5/query`),
    query(countyUrl),
  ]);
  const place = [...incorporated, ...designated][0];
  const context = place?.attributes ?? counties[0]?.attributes;
  if (!context) return null;
  return {
    name: String(context.BASENAME ?? context.NAME ?? "").replace(/\s+County$/i, ""),
    state: stateCodes[String(context.STATE ?? "").padStart(2, "0")] ?? "",
  };
}

function sourceForRelease(kind: ExploreKind, release: "2025" | "2024") {
  const dataset = release === "2025" ? currentDatasets[kind] : previousDatasets[kind];
  return {
    name: `CDC PLACES, ${release} release`,
    url: `https://data.cdc.gov/d/${dataset}`,
    release: release === "2025" ? "December 4, 2025" : "September 11, 2025",
    period:
      release === "2025"
        ? "BRFSS 2023 and 2022; ACS 2019–2023 and 2018–2022"
        : "BRFSS 2022 and 2021; ACS 2018–2022",
    note:
      kind === "zip"
        ? "Crude prevalence estimates"
        : "Age-adjusted prevalence estimates",
  };
}

function buildOfferings(
  priorities: Array<{ key: string; label: string; value: number }>,
  hasLocalPlan: boolean,
) {
  const find = (...keys: string[]) =>
    priorities.find((metric) => keys.includes(metric.key));
  const chronic = find("diabetes", "bphigh", "obesity", "copd", "csmoking");
  const access = find("lacktrpt", "mobility", "disability", "access2");
  const connection = find("depression", "loneliness", "foodinsecu");
  return [
    {
      name: "Health Access Day",
      status: "Open for partnership",
      evidence: chronic?.label ?? priorities[0]?.label ?? "Local health priorities",
      text: chronic
        ? `${chronic.label} is one of the stronger local signals. A targeted event can bring health literacy, prevention, digital readiness and licensed professionals together around the needs shown in the data.`
        : "A targeted event can connect public education, prevention and digital readiness to the priorities shown in local data.",
    },
    {
      name: "Health Equity Hub formats",
      status: "Open for partnership",
      evidence: access?.label ?? connection?.label ?? "Place-based barriers",
      text: access
        ? `${access.label} supports considering library, community or home-based access formats that bring practical support closer to where people live.`
        : "Library, community and home-based formats can be considered where distance, technology or mobility complicate the next step.",
    },
    {
      name: "Provider-led pathways",
      status: "Open for partnership",
      evidence: find("access2", "lacktrpt")?.label ?? "Readiness for existing services",
      text: "The Bring Your Own Platform model helps people prepare for existing licensed services while providers retain their platforms, records, clinical judgment and follow-up.",
    },
    {
      name: "Community health planning",
      status: hasLocalPlan ? "Current local plan included" : "National public data included",
      evidence: hasLocalPlan ? "CHA/CHIP priorities" : "CDC PLACES measures",
      text: "The evidence view can support CHA/CHIP priority setting, partnership design, implementation planning and measurable follow-through without using individual medical records.",
    },
  ];
}

export async function GET(request: NextRequest) {
  const kindValue = request.nextUrl.searchParams.get("kind");
  const kind =
    kindValue === "county" || kindValue === "place" || kindValue === "zip"
      ? kindValue
      : null;
  if (!kind) {
    return NextResponse.json({ error: "Choose a ZIP Code, city or county." }, { status: 400 });
  }
  const geoid = safeGeoid(kind, request.nextUrl.searchParams.get("geoid") ?? "");
  if (!geoid) {
    return NextResponse.json({ error: "Choose a valid U.S. place." }, { status: 400 });
  }

  const dataset = currentDatasets[kind];
  const fieldList = (release: "2025" | "2024") => [
    ...baseFields[kind],
    ...metricsForRelease(kind, release).flatMap((metric) => [
      fieldFor(kind, metric.field),
      confidenceFieldFor(kind, metric.field),
    ]),
  ];

  try {
    const locationParameters = (release: "2025" | "2024") => ({
      "$select": fieldList(release).join(","),
      "$where": `${idFields[kind]}='${geoid}'`,
      "$limit": "1",
    });
    const [currentRows, previousRows] = await Promise.all([
      cdcQuery(currentDatasets[kind], locationParameters("2025")),
      cdcQuery(previousDatasets[kind], locationParameters("2024")),
    ]);
    const currentRow = currentRows[0];
    const previousRow = previousRows[0];
    const row = currentRow ?? previousRow;
    if (!row) {
      return NextResponse.json({ error: "No current PLACES estimate was found for this location." }, { status: 404 });
    }

    const averageParameters = (release: "2025" | "2024") => ({ "$select": averageSelect(kind, release), "$limit": "1" });
    const state = String(row.stateabbr ?? "");
    const stateParameters = (release: "2025" | "2024") => state && kind !== "zip"
      ? {
          "$select": averageSelect(kind, release),
          "$where": `stateabbr='${state.replace(/[^A-Z]/g, "")}'`,
          "$limit": "1",
        }
      : null;
    const currentStateParameters = stateParameters("2025");
    const previousStateParameters = stateParameters("2024");
    const [currentNationalRows, previousNationalRows, currentStateRows, previousStateRows] = await Promise.all([
      cdcQuery(currentDatasets[kind], averageParameters("2025")),
      cdcQuery(previousDatasets[kind], averageParameters("2024")),
      currentStateParameters ? cdcQuery(currentDatasets[kind], currentStateParameters) : Promise.resolve([] as SourceRow[]),
      previousStateParameters ? cdcQuery(previousDatasets[kind], previousStateParameters) : Promise.resolve([] as SourceRow[]),
    ]);

    const metrics = metricsForKind(kind)
      .map((definition) => {
        const field = fieldFor(kind, definition.field);
        const currentValue = metricValue(currentRow, field);
        const release = currentValue > 0 ? "2025" as const : "2024" as const;
        const releaseRow = release === "2025" ? currentRow : previousRow;
        const releaseNational = release === "2025" ? currentNationalRows[0] : previousNationalRows[0];
        const releaseState = release === "2025" ? currentStateRows[0] : previousStateRows[0];
        const value = metricValue(releaseRow, field);
        const nationalValue = metricValue(releaseNational, field);
        const stateValue = metricValue(releaseState, field);
        return {
          ...definition,
          value,
          confidence: String(releaseRow?.[confidenceFieldFor(kind, definition.field)] ?? ""),
          national: nationalValue,
          state: stateValue || null,
          difference: Number((value - nationalValue).toFixed(1)),
          score: scoreMetric(value, nationalValue),
          release,
        };
      })
      .filter((metric) => metric.value > 0 && metric.national > 0);

    const priorities = [...metrics]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const localPlan = kind === "county" ? localPlans[geoid] ?? null : null;
    const baseLocation = makeLocation(kind, geoid, row);
    const zipContext = kind === "zip" ? await zipPlaceContext(row) : null;
    const location = zipContext
      ? {
          ...baseLocation,
          label: `${geoid} · ${zipContext.name}${zipContext.state ? `, ${zipContext.state}` : ""}`,
          state: zipContext.state,
        }
      : baseLocation;
    const top = priorities[0];
    const currentMeasureCount = metrics.filter((metric) => metric.release === "2025").length;
    const previousMeasureCount = metrics.length - currentMeasureCount;

    return NextResponse.json(
      {
        location,
        summary: top
          ? `${top.label} is one of the strongest signals in the current public data for ${location.label}. Compare it with other local conditions before setting priorities or choosing a response.`
          : `Current public data is available for ${location.label}.`,
        metrics,
        priorities,
        dataCoverage: {
          measureCount: metrics.length,
          currentMeasureCount,
          previousMeasureCount,
        },
        offerings: buildOfferings(priorities, Boolean(localPlan)),
        localPlan,
        sources: [
          {
            name: "CDC PLACES, 2025 release",
            url: `https://data.cdc.gov/d/${dataset}`,
            release: "December 4, 2025",
            period: kind === "zip" ? "BRFSS 2023 and 2022; ACS 2019–2023 and 2018–2022" : "BRFSS 2023 and 2022; ACS 2019–2023 and 2018–2022",
            note: kind === "zip" ? "Crude prevalence estimates" : "Age-adjusted prevalence estimates",
          },
          ...(previousMeasureCount > 0 ? [sourceForRelease(kind, "2024")] : []),
          {
            name: "HRSA Health Workforce Shortage Areas",
            url: "https://data.hrsa.gov/topics/health-workforce/shortage-areas/dashboard",
            release: "Updated July 16, 2026",
            period: "Daily designation data",
            note: "Workforce and shortage-area planning source",
          },
          {
            name: "AHRQ Community-Level Health Database",
            url: "https://www.ahrq.gov/data/innovations/clh-data.html",
            release: "September 2025 release; page reviewed May 2026",
            period: "Data through 2023",
            note: "County, ZIP Code, tract and block-group context",
          },
          ...(localPlan
            ? [
                {
                  name: localPlan.title,
                  url: localPlan.url,
                  release: localPlan.published,
                  period: localPlan.period,
                  note: "Local CHA/CHIP source",
                },
              ]
            : []),
        ],
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    console.error("explore-health-data-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
      message: String((error as { message?: string }).message ?? "Source request failed").slice(0, 160),
    });
    return NextResponse.json(
      { error: "Current public data could not be loaded. Please try again shortly." },
      { status: 503 },
    );
  }
}
