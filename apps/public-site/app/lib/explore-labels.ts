export function canonicalCountyLabel(county: string, stateCode: string) {
  const cleanCounty = county.trim();
  const cleanState = stateCode.trim().toUpperCase();
  if (!cleanState) return cleanCounty;
  const suffix = new RegExp(`,\\s*${cleanState}$`, "i");
  return suffix.test(cleanCounty) ? cleanCounty : `${cleanCounty}, ${cleanState}`;
}
