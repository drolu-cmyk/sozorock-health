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
    return new URL(document.referrer).hostname.toLowerCase().slice(0, 160);
  } catch {
    return "";
  }
}

export function getPublicationClientContext(startedAt = new Date().toISOString()): PublicationClientContext {
  if (typeof window === "undefined") {
    return {
      visitorId: "", landingPath: "", referrerHost: "", utmSource: "", utmMedium: "",
      utmCampaign: "", utmContent: "", utmTerm: "", timezone: "", language: "", formStartedAt: startedAt,
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
    visitorId: visitorId(),
    landingPath: safe(window.location.pathname, 240),
    referrerHost: referrerHost(),
    utmSource: safe(params.get("utm_source"), 100),
    utmMedium: safe(params.get("utm_medium"), 100),
    utmCampaign: safe(params.get("utm_campaign"), 160),
    utmContent: safe(params.get("utm_content"), 160),
    utmTerm: safe(params.get("utm_term"), 160),
    timezone: safe(timezone, 100),
    language: safe(navigator.language, 40),
    formStartedAt: startedAt,
  };
}
