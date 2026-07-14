import type { GeographyKind } from "./types";

export function safeSearchTerm(value: string) {
  return value
    .replace(/[^\p{L}\p{N} .'-]/gu, "")
    .trim()
    .slice(0, 64)
    .toUpperCase()
    .replaceAll("'", "''");
}

export function safeProfileName(value: string) {
  return value.replace(/[^\p{L}\p{N} .,'()-]/gu, "").trim().slice(0, 120);
}

export function validGeoidForKind(kind: GeographyKind, geoid: string) {
  if (kind === "state") return /^\d{2}$/.test(geoid);
  if (kind === "county" || kind === "zcta") return /^\d{5}$/.test(geoid);
  if (kind === "place") return /^\d{7}$/.test(geoid);
  if (kind === "community") return /^\d{1,10}$/.test(geoid);
  return /^\d{7}$|^\d{10}$/.test(geoid);
}
