import type { CountyFilters } from "@sozorock/domain";

export const MAX_SAVED_VIEW_LENGTH = 2_048;
export const MAX_SAVED_REPORT_VIEWS = 8;
export const MAX_SAVED_REPORT_VIEWS_LENGTH = 24_000;
export const MAX_PLANNING_DRAFT_ITEMS = 200;

export type SavedReportView = {
  id: string;
  label: string;
  url: string;
  createdAt: string;
};

type FilterChoices = {
  [Key in keyof Required<CountyFilters>]: ReadonlySet<string>;
};

const filterKeys = [
  "state",
  "county",
  "zip",
  "period",
  "hubType",
  "language",
  "barrier",
  "accessRange",
] as const satisfies readonly (keyof Required<CountyFilters>)[];

export function restoreSavedView(
  raw: string,
  defaults: Required<CountyFilters>,
  choices: FilterChoices,
): Required<CountyFilters> | null {
  if (!raw || raw.length > MAX_SAVED_VIEW_LENGTH) return null;

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  if (Object.keys(record).some((key) => !filterKeys.includes(key as (typeof filterKeys)[number]))) {
    return null;
  }

  const restored: Required<CountyFilters> = { ...defaults };
  for (const key of filterKeys) {
    if (!(key in record)) continue;
    const value = record[key];
    if (typeof value !== "string" || !choices[key].has(value)) return null;
    restored[key] = value;
  }

  return restored;
}

export function restoreSavedReportViews(
  raw: string,
  allowedOrigin: string,
): SavedReportView[] {
  if (!raw || raw.length > MAX_SAVED_REPORT_VIEWS_LENGTH) return [];

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(candidate) || candidate.length > MAX_SAVED_REPORT_VIEWS) return [];

  const restored: SavedReportView[] = [];
  const seen = new Set<string>();
  for (const item of candidate) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    if (
      Object.keys(record).some((key) => !["id", "label", "url", "createdAt"].includes(key))
      || typeof record.id !== "string"
      || !/^[a-zA-Z0-9-]{1,80}$/.test(record.id)
      || typeof record.label !== "string"
      || record.label.trim().length === 0
      || record.label.length > 120
      || /[\u0000-\u001f\u007f]/u.test(record.label)
      || typeof record.url !== "string"
      || record.url.length > MAX_SAVED_VIEW_LENGTH
      || typeof record.createdAt !== "string"
      || !Number.isFinite(Date.parse(record.createdAt))
    ) return [];

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(record.url);
    } catch {
      return [];
    }
    if (
      parsedUrl.origin !== allowedOrigin
      || !["http:", "https:"].includes(parsedUrl.protocol)
      || parsedUrl.username
      || parsedUrl.password
      || parsedUrl.pathname !== "/"
      || seen.has(record.id)
      || seen.has(parsedUrl.href)
    ) return [];

    seen.add(record.id);
    seen.add(parsedUrl.href);
    restored.push({
      id: record.id,
      label: record.label.trim(),
      url: parsedUrl.href,
      createdAt: new Date(record.createdAt).toISOString(),
    });
  }

  return restored;
}

export function restorePlanningDraft(raw: string) {
  if (!raw || raw.length > 24_000) return [];
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return [];
  }
  if (
    !Array.isArray(candidate)
    || candidate.length > MAX_PLANNING_DRAFT_ITEMS
    || !candidate.every((item) => (
      typeof item === "string"
      && item.length <= 80
      && /^(state|county|place|locality|community|zcta):\d{1,10}:[a-zA-Z][a-zA-Z0-9]*$/u.test(item)
    ))
  ) return [];
  return [...new Set(candidate)];
}
