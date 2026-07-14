const mojibakeMarkers = /[\u00c2\u00c3]/gu;

function markerCount(value: string) {
  return value.match(mojibakeMarkers)?.length ?? 0;
}

/**
 * Repairs a narrow UTF-8-as-Latin-1 failure found in a small number of public
 * source labels. A value is changed only when every code point fits in one
 * byte, UTF-8 decoding succeeds, and the decoded value has fewer mojibake
 * markers. Legitimate Unicode strings therefore pass through unchanged.
 */
export function repairPublicDataText(value: string) {
  mojibakeMarkers.lastIndex = 0;
  if (!mojibakeMarkers.test(value)) return value;
  mojibakeMarkers.lastIndex = 0;
  const codePoints = Array.from(value, (character) => character.codePointAt(0) ?? 0);
  if (codePoints.some((codePoint) => codePoint > 255)) return value;
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(codePoints));
    return markerCount(decoded) < markerCount(value) ? decoded : value;
  } catch {
    return value;
  }
}
