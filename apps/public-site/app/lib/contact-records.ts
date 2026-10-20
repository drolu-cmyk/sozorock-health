export type ContactRecordType = "contact" | "program-interest";

const text = (value: unknown) => typeof value === "string" ? value : "";

export function projectContactRecords(items: Array<Record<string, unknown>>, type: ContactRecordType, now: number) {
  return items.filter((item) => {
    if (item.recordType !== type) return false;
    if (typeof item.expiresAt === "number" && (!Number.isFinite(item.expiresAt) || item.expiresAt <= now || item.expiresAt > 8640000000000)) return false;
    if (type === "program-interest" && (typeof item.expiresAt !== "number" || item.consent !== true)) return false;
    return !text(item.email).toLowerCase().endsWith("@simulator.amazonses.com");
  }).map((item) => type === "program-interest" ? {
    createdAt: text(item.createdAt),
    name: [text(item.firstName), text(item.lastName)].filter(Boolean).join(" "),
    email: text(item.email), phone: text(item.phone),
    inquiryType: "program-interest", role: "", stateOrCounty: text(item.county),
    message: text(item.heardAbout), preferredContact: text(item.preferredContact),
    consentedAt: text(item.consentedAt),
    expiresAt: new Date(Number(item.expiresAt) * 1000).toISOString(),
    notificationStatus: text(item.notificationStatus) || "unknown",
  } : {
    createdAt: text(item.createdAt), name: text(item.name), email: text(item.email),
    inquiryType: text(item.inquiryType), role: text(item.role),
    stateOrCounty: text(item.stateOrCounty), message: text(item.message),
  });
}
