export type PublicationClientContext = {
  visitorId: string;
  landingPath: string;
  referrerHost: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  timezone: string;
  language: string;
  formStartedAt: string;
};

const VISITOR_KEY = "srh_publication_visitor_id";
const ATTRIBUTION_KEY = "srh_publication_first_touch";

type StoredAttribution = Omit<PublicationClientContext, "visitorId" | "formStartedAt">;

function safe(value: string | null, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function visitorId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY)?.trim();
    if (existing && /^[A-Za-z0-9_-]{16,80}$/.test(existing)) return existing;
    const next = typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_KEY, next);
    return next;
  } catch {
    return "";
  }
}

function referrerHost() {
  if (typeof document === "undefined" || !document.referrer) return "";
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    return host === window.location.hostname.toLowerCase() ? "" : host.slice(0, 160);
  } catch {
    return "";
  }
}

function currentAttribution(): StoredAttribution {
  if (typeof window === "undefined") {
    return {
      landingPath: "", referrerHost: "", utmSource: "", utmMedium: "", utmCampaign: "",
      utmContent: "", utmTerm: "", timezone: "", language: "",
    };
  }
  const params = new URLSearchParams(window.location.search);
  let timezone = "";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    timezone = "";
  }
  return {
    landingPath: safe(`${window.location.pathname}${window.location.search}`, 240),
    referrerHost: referrerHost(),
    utmSource: safe(params.get("utm_source"), 100),
    utmMedium: safe(params.get("utm_medium"), 100),
    utmCampaign: safe(params.get("utm_campaign"), 160),
    utmContent: safe(params.get("utm_content"), 160),
    utmTerm: safe(params.get("utm_term"), 160),
    timezone: safe(timezone, 100),
    language: safe(navigator.language, 40),
  };
}

function storedAttribution() {
  const current = currentAttribution();
  if (typeof window === "undefined") return current;
  try {
    const raw = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredAttribution>;
      return {
        landingPath: safe(parsed.landingPath ?? "", 240),
        referrerHost: safe(parsed.referrerHost ?? "", 160).toLowerCase(),
        utmSource: safe(parsed.utmSource ?? "", 100),
        utmMedium: safe(parsed.utmMedium ?? "", 100),
        utmCampaign: safe(parsed.utmCampaign ?? "", 160),
        utmContent: safe(parsed.utmContent ?? "", 160),
        utmTerm: safe(parsed.utmTerm ?? "", 160),
        timezone: safe(parsed.timezone ?? current.timezone, 100),
        language: safe(parsed.language ?? current.language, 40),
      };
    }
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(current));
  } catch {
    return current;
  }
  return current;
}

export function getPublicationClientContext(startedAt = new Date().toISOString()): PublicationClientContext {
  const attribution = storedAttribution();
  return {
    visitorId: visitorId(),
    ...attribution,
    formStartedAt: startedAt,
  };
}
