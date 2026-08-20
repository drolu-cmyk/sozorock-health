import type { AccessInput } from "./publication-validation";
import {
  getPublicationCountry,
  isStructuredSubdivision,
} from "./publication-locations";

export type PublicationAttribution = {
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

export type PublicationRequestTechnicalContext = {
  deviceClass: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
  osFamily: string;
  browserFamily: string;
  networkCountry: string;
  networkRegion: string;
};

export type PublicationQualityAssessment = {
  score: number;
  band: "high" | "medium" | "low";
  flags: string[];
  emailDomainCategory: "consumer" | "organizational" | "disposable" | "unknown";
};

const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com",
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com", "guerrillamail.com", "mailinator.com", "tempmail.com", "temp-mail.org",
  "yopmail.com", "trashmail.com", "sharklasers.com", "guerrillamailblock.com", "getnada.com",
]);

const SUSPICIOUS_LOCAL_PART = /^(?:test|testing|fake|dummy|asdf|qwerty|none|unknown|sample|user|email|admin)\d*$/i;

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().replace(/[\u0000-\u001F\u007F]/g, "").slice(0, max)
    : "";
}

export function parsePublicationAttribution(body: Record<string, unknown>): PublicationAttribution {
  const visitor = clean(body.visitorId, 80);
  const formStartedAt = clean(body.formStartedAt, 40);
  return {
    visitorId: /^[A-Za-z0-9_-]{16,80}$/.test(visitor) ? visitor : "",
    landingPath: clean(body.landingPath, 240),
    referrerHost: clean(body.referrerHost, 160).toLowerCase(),
    utmSource: clean(body.utmSource, 100),
    utmMedium: clean(body.utmMedium, 100),
    utmCampaign: clean(body.utmCampaign, 160),
    utmContent: clean(body.utmContent, 160),
    utmTerm: clean(body.utmTerm, 160),
    timezone: clean(body.timezone, 100),
    language: clean(body.language, 40),
    formStartedAt: Number.isFinite(Date.parse(formStartedAt)) ? formStartedAt : "",
  };
}

export function classifyPublicationUserAgent(userAgent: string): Pick<PublicationRequestTechnicalContext, "deviceClass" | "osFamily" | "browserFamily"> {
  const ua = userAgent.toLowerCase();
  const deviceClass: PublicationRequestTechnicalContext["deviceClass"] =
    /bot|crawler|spider|headless|curl|wget/.test(ua) ? "bot" :
    /ipad|tablet|kindle/.test(ua) ? "tablet" :
    /mobi|iphone|android/.test(ua) ? "mobile" :
    ua ? "desktop" : "unknown";
  const osFamily = /iphone|ipad|ios/.test(ua) ? "iOS" :
    /android/.test(ua) ? "Android" :
    /windows/.test(ua) ? "Windows" :
    /mac os|macintosh/.test(ua) ? "macOS" :
    /linux/.test(ua) ? "Linux" : "Other";
  const browserFamily = /edg\//.test(ua) ? "Edge" :
    /firefox\//.test(ua) ? "Firefox" :
    /chrome\//.test(ua) && !/edg\//.test(ua) ? "Chrome" :
    /safari\//.test(ua) && !/chrome\//.test(ua) ? "Safari" : "Other";
  return { deviceClass, osFamily, browserFamily };
}

function emailCategory(email: string): PublicationQualityAssessment["emailDomainCategory"] {
  const domain = email.split("@").at(-1)?.toLowerCase() ?? "";
  if (!domain) return "unknown";
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return "disposable";
  if (CONSUMER_EMAIL_DOMAINS.has(domain)) return "consumer";
  return "organizational";
}

function organizationDomainMatch(organization: string, email: string) {
  const domain = email.split("@").at(-1)?.toLowerCase() ?? "";
  const root = domain.split(".")[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  const normalizedOrganization = organization.toLowerCase().replace(/[^a-z0-9]/g, "");
  return root.length >= 4 && normalizedOrganization.includes(root);
}

function rapidSubmission(formStartedAt: string) {
  if (!formStartedAt) return false;
  const elapsed = Date.now() - Date.parse(formStartedAt);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 2_000;
}

export function assessPublicationAccessQuality(
  input: AccessInput,
  attribution: PublicationAttribution,
  technical: PublicationRequestTechnicalContext,
): PublicationQualityAssessment {
  let score = 50;
  const flags = ["email_unverified"];
  const category = emailCategory(input.email);
  const localPart = input.email.split("@", 1)[0] ?? "";
  const country = getPublicationCountry(input.country);

  if (category === "organizational") {
    score += 10;
    if (organizationDomainMatch(input.organization, input.email)) {
      score += 5;
      flags.push("organization_domain_match");
    } else {
      flags.push("organization_domain_unmatched");
    }
  }
  if (category === "consumer") flags.push("consumer_email");
  if (category === "disposable") {
    score -= 25;
    flags.push("disposable_email");
  }
  if (SUSPICIOUS_LOCAL_PART.test(localPart)) {
    score -= 15;
    flags.push("suspicious_email_local_part");
  }
  if (input.reason.length >= 80) score += 10;
  else flags.push("short_reason");

  if (country && isStructuredSubdivision(country.code)) {
    score += 5;
    flags.push("structured_subdivision");
  } else {
    flags.push("unstructured_subdivision");
  }

  if (technical.networkCountry && country) {
    if (technical.networkCountry.toUpperCase() === country.code) score += 5;
    else {
      score -= 8;
      flags.push("declared_network_country_mismatch");
    }
  }

  if (rapidSubmission(attribution.formStartedAt)) {
    score -= 10;
    flags.push("rapid_submission");
  }
  if (technical.deviceClass === "bot") {
    score -= 30;
    flags.push("automation_suspected");
  }
  if (attribution.utmSource || attribution.utmMedium || attribution.utmCampaign) flags.push("campaign_attributed");
  if (attribution.referrerHost) flags.push("referrer_attributed");

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    band: score >= 75 ? "high" : score >= 50 ? "medium" : "low",
    flags: [...new Set(flags)].sort(),
    emailDomainCategory: category,
  };
}

export function scoreAfterEmailVerification(score: number, flags: readonly string[]) {
  const nextScore = Math.max(0, Math.min(100, score + 20));
  return {
    score: nextScore,
    band: nextScore >= 75 ? "high" : nextScore >= 50 ? "medium" : "low",
    flags: [...new Set(flags.filter((flag) => flag !== "email_unverified").concat("email_verified"))].sort(),
  } as const;
}
