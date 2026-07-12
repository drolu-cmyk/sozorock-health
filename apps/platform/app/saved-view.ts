import type { CountyFilters } from "@sozorock/domain";

export const MAX_SAVED_VIEW_LENGTH = 2_048;

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
