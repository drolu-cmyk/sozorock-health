import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const validation = readFileSync(new URL("../app/lib/publication-validation.ts", import.meta.url), "utf8");
const locations = readFileSync(new URL("../app/lib/publication-locations.ts", import.meta.url), "utf8");
const intelligence = readFileSync(new URL("../app/lib/publication-intelligence.ts", import.meta.url), "utf8");
const clientContext = readFileSync(new URL("../app/lib/publication-client-context.ts", import.meta.url), "utf8");
const access = readFileSync(new URL("../app/lib/publication-access.ts", import.meta.url), "utf8");
const reporting = readFileSync(new URL("../app/lib/publication-reporting.ts", import.meta.url), "utf8");
const form = readFileSync(new URL("../app/components/PublicationAccessForm.tsx", import.meta.url), "utf8");
const eventRoute = readFileSync(new URL("../app/api/publications/events/route.ts", import.meta.url), "utf8");
const intelligenceRoute = readFileSync(new URL("../app/api/publications/intelligence/[slug]/route.ts", import.meta.url), "utf8");
const infrastructure = readFileSync(new URL("../../../infrastructure/cloudformation/publication-access.yml", import.meta.url), "utf8");
const deployWorkflow = readFileSync(new URL("../../../.github/workflows/deploy.yml", import.meta.url), "utf8");
const privacy = readFileSync(new URL("../app/privacy/page.tsx", import.meta.url), "utf8");

test("publication form uses global country selection and country-aware subdivisions", () => {
  assert.match(locations, /PUBLICATION_COUNTRIES/);
  for (const country of ["United States", "Canada", "Nigeria", "Australia", "United Kingdom", "South Africa", "India", "Brazil", "Mexico"]) {
    assert.match(locations, new RegExp(country.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(form, /<select id="publication-country"/);
  assert.match(form, /getPublicationSubdivisions\(country\)/);
  assert.match(form, /publicationSubdivisionLabel\(country\)/);
  assert.match(validation, /getPublicationCountry\(input\.country\)/);
  assert.match(validation, /isValidPublicationSubdivision/);
});

test("publication access rejects obvious placeholder and gibberish records", () => {
  assert.match(validation, /meaningfulName/);
  assert.match(validation, /meaningfulReason/);
  assert.match(validation, /repeatedPattern/);
  assert.match(validation, /RESERVED_EMAIL_DOMAIN/);
  assert.match(validation, /Enter a real first name rather than placeholder text/);
  assert.match(validation, /Enter a meaningful organization or affiliation/);
  assert.match(validation, /meaningful characters to explain your interest/);
});

test("access intelligence scores confidence without treating verification as identity proof", () => {
  assert.match(intelligence, /email_unverified/);
  assert.match(intelligence, /email_verified/);
  assert.match(intelligence, /consumer_email/);
  assert.match(intelligence, /disposable_email/);
  assert.match(intelligence, /organization_domain_match/);
  assert.match(intelligence, /organization_domain_unmatched/);
  assert.match(intelligence, /declared_network_country_mismatch/);
  assert.match(intelligence, /rapid_submission/);
  assert.match(intelligence, /automation_suspected/);
  assert.match(intelligence, /band: score >= 75 \? "high" : score >= 50 \? "medium" : "low"/);
});

test("first-touch attribution survives the separate publication access page", () => {
  assert.match(clientContext, /sessionStorage\.getItem\(ATTRIBUTION_KEY\)/);
  assert.match(clientContext, /sessionStorage\.setItem\(ATTRIBUTION_KEY/);
  assert.match(clientContext, /localStorage\.getItem\(VISITOR_KEY\)/);
  assert.match(clientContext, /utm_source/);
  assert.match(clientContext, /utm_medium/);
  assert.match(clientContext, /utm_campaign/);
  assert.match(clientContext, /referrerHost/);
  assert.match(eventRoute, /recordAttributedEvent/);
});

test("publication abuse controls use overlapping hourly and daily pseudonymous limits", () => {
  assert.match(access, /MAX_NETWORK_REQUESTS_PER_DAY = 80/);
  assert.match(access, /MAX_RECIPIENT_REQUESTS_PER_DAY = 12/);
  assert.match(access, /MAX_VISITOR_REQUESTS_PER_DAY = 12/);
  assert.match(access, /network-day:/);
  assert.match(access, /recipient-day:/);
  assert.match(access, /visitor-day:/);
  assert.match(access, /hash\(`network:\$\{clientNetworkAddress\(request\.headers\)\}`\)/);
  assert.doesNotMatch(access, /rawNetworkAddress/);
});

test("publication intelligence is queryable only through the protected index and reviewer endpoint", () => {
  assert.match(infrastructure, /IndexName: PublicationIntelligence/);
  assert.match(infrastructure, /dynamodb:Query/);
  assert.match(infrastructure, /\/index\/PublicationIntelligence/);
  assert.match(reporting, /QueryCommand/);
  assert.match(reporting, /REQUESTS#/);
  assert.match(reporting, /EVENTS#/);
  assert.match(reporting, /verifiedEmails/);
  assert.match(reporting, /sources: sortedCounts\(sources\)/);
  assert.match(reporting, /media: sortedCounts\(media\)/);
  assert.match(reporting, /syntheticReleaseChecksExcluded/);
  assert.match(reporting, /@simulator\.amazonses\.com/);
  assert.doesNotMatch(reporting, /networkIdentifier/);
  assert.doesNotMatch(reporting, /visitorIdentifier/);
  assert.match(intelligenceRoute, /requireFoundationReviewer\(request\)/);
  assert.ok(intelligenceRoute.includes('request.nextUrl.searchParams.get("format") === "csv"'));
  assert.match(intelligenceRoute, /Cache-Control": "private, no-store"/);
});

test("production release proves the intelligence index and valid structured location", () => {
  assert.match(deployWorkflow, /PublicationIntelligenceQuery/);
  assert.match(deployWorkflow, /index\(\"dynamodb:Query\"\)/);
  assert.match(deployWorkflow, /PublicationIntelligence'\]\.IndexStatus/);
  assert.match(deployWorkflow, /publication_intelligence_index_status/);
  assert.match(deployWorkflow, /\"cityOrRegion\":\"Albany\"/);
  assert.match(deployWorkflow, /\"state\":\"New York\"/);
  assert.doesNotMatch(deployWorkflow, /\"state\":\"Synthetic State\"/);
});

test("privacy notice discloses publication attribution and quality indicators", () => {
  assert.match(privacy, /Publication access and attribution/);
  assert.match(privacy, /campaign parameters/);
  assert.match(privacy, /quality indicators/);
  assert.match(privacy, /not identity proof/);
  assert.match(privacy, /180 days/);
});
