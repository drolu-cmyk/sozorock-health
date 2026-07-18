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

const datasets: Record<ExploreKind, string> = {
  county: "i46a-9kgh",
  place: "vgc8-iyc4",
  zip: "kee5-23sr",
};

const idFields: Record<ExploreKind, string> = {
  county: "countyfips",
  place: "placefips",
  zip: "zcta5",
};

type SourceRow = Record<string, string | { coordinates?: number[] } | undefined>;

const baseFields: Record<ExploreKind, string[]> = {
  county: ["countyfips", "stateabbr", "statedesc", "countyname", "totalpopulation", "totalpop18plus", "geolocation"],
  place: ["placefips", "stateabbr", "statedesc", "placename", "locationname", "totalpopulation", "totalpop18plus", "geolocation"],
  zip: ["zcta5", "totalpopulation", "totalpop18plus", "geolocation"],
};

const placeUnavailableMetrics = new Set(["lacktrpt", "foodinsecu", "loneliness"]);

function metricsForKind(kind: ExploreKind) {
  return kind === "place"
    ? exploreMetrics.filter((metric) => !placeUnavailableMetrics.has(metric.key))
    : exploreMetrics;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function averageSelect(kind: ExploreKind) {
  return metricsForKind(kind)
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
  if (!response.ok) throw new Error(`CDC PLACES request failed: ${response.status}`);
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

  const dataset = datasets[kind];
  const fieldList = [
    ...baseFields[kind],
    ...metricsForKind(kind).flatMap((metric) => [
      fieldFor(kind, metric.field),
      confidenceFieldFor(kind, metric.field),
    ]),
  ];

  try {
    const rows = await cdcQuery(dataset, {
      "$select": fieldList.join(","),
      "$where": `${idFields[kind]}='${geoid}'`,
      "$limit": "1",
    });
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: "No current PLACES estimate was found for this location." }, { status: 404 });
    }

    const nationalPromise = cdcQuery(dataset, {
      "$select": averageSelect(kind),
      "$limit": "1",
    });
    const state = String(row.stateabbr ?? "");
    const statePromise =
      state && kind !== "zip"
        ? cdcQuery(dataset, {
            "$select": averageSelect(kind),
            "$where": `stateabbr='${state.replace(/[^A-Z]/g, "")}'`,
            "$limit": "1",
          })
        : Promise.resolve([] as SourceRow[]);
    const [nationalRows, stateRows] = await Promise.all([
      nationalPromise,
      statePromise,
    ]);
    const national = nationalRows[0];
    const stateAverage = stateRows[0];

    const metrics = metricsForKind(kind)
      .map((definition) => {
        const field = fieldFor(kind, definition.field);
        const value = metricValue(row, field);
        const nationalValue = metricValue(national, field);
        const stateValue = metricValue(stateAverage, field);
        return {
          ...definition,
          value,
          confidence: String(row[confidenceFieldFor(kind, definition.field)] ?? ""),
          national: nationalValue,
          state: stateValue || null,
          difference: Number((value - nationalValue).toFixed(1)),
          score: scoreMetric(value, nationalValue),
        };
      })
      .filter((metric) => metric.value > 0 && metric.national > 0);

    const priorities = [...metrics]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const localPlan = kind === "county" ? localPlans[geoid] ?? null : null;
    const location = makeLocation(kind, geoid, row);
    const top = priorities[0];

    return NextResponse.json(
      {
        location,
        summary: top
          ? `${top.label} is one of the strongest signals in the current public data for ${location.label}. Compare it with other local conditions before setting priorities or choosing a response.`
          : `Current public data is available for ${location.label}.`,
        metrics,
        priorities,
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
    });
    return NextResponse.json(
      { error: "Current public data could not be loaded. Please try again shortly." },
      { status: 503 },
    );
  }
}
