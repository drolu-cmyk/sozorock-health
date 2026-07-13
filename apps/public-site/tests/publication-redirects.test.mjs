import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { publicSiteUrl } from "../app/lib/request-security.ts";
import { publicationRedirects } from "../app/lib/publication-redirects.ts";

const canonicalOrigin = "https://health.sozorockfoundation.org";
const verifyRoute = readFileSync(
  new URL("../app/api/publications/verify/route.ts", import.meta.url),
  "utf8",
);
const downloadRoute = readFileSync(
  new URL("../app/api/publications/download/[slug]/route.ts", import.meta.url),
  "utf8",
);

test("builds public redirects from a validated configured origin", () => {
  assert.equal(
    publicSiteUrl("/publications?verification=missing", canonicalOrigin).href,
    `${canonicalOrigin}/publications?verification=missing`,
  );
  assert.equal(
    publicSiteUrl("/publications", "http://attacker.example", true).href,
    `${canonicalOrigin}/publications`,
  );
  assert.equal(
    publicSiteUrl(
      "/publications",
      `${canonicalOrigin}/ignored/path?query=yes#fragment`,
      true,
    ).href,
    `${canonicalOrigin}/publications`,
  );
  assert.equal(
    publicSiteUrl(
      "/publications",
      "https://user:password@attacker.example",
      true,
    ).href,
    `${canonicalOrigin}/publications`,
  );
  assert.equal(
    publicSiteUrl("/publications", "http://localhost:3000", true).href,
    `${canonicalOrigin}/publications`,
  );
  assert.equal(
    publicSiteUrl("/publications", "https://localhost:3000", true).href,
    `${canonicalOrigin}/publications`,
  );
  assert.equal(
    publicSiteUrl("/publications", "http://localhost:3000", false).href,
    "http://localhost:3000/publications",
  );
  assert.throws(() => publicSiteUrl("//attacker.example/redirect", canonicalOrigin));
  assert.throws(() => publicSiteUrl("/\\attacker.example/redirect", canonicalOrigin));
  assert.throws(() => publicSiteUrl("/publications\n//attacker.example", canonicalOrigin));
  assert.throws(() => publicSiteUrl("/publications\u007f", canonicalOrigin));
});

test("maps every local publication redirect to the public origin and status", () => {
  const previous = process.env.PUBLIC_SITE_URL;
  process.env.PUBLIC_SITE_URL = canonicalOrigin;
  const cases = [
    [publicationRedirects.beginVerification(""), "/publications?verification=missing", 307],
    [publicationRedirects.beginVerification("token/value"), "/publications/verify?token=token%2Fvalue", 307],
    [publicationRedirects.missingVerification(), "/publications?verification=missing", 303],
    [publicationRedirects.expiredVerification(), "/publications?verification=expired", 303],
    [publicationRedirects.completedVerification("publication/slug"), "/publications/publication%2Fslug/verified", 303],
    [publicationRedirects.failedVerification(), "/publications?verification=failed", 303],
    [publicationRedirects.sessionRequired("publication/slug"), "/publications/publication%2Fslug/access?session=required", 307],
    [publicationRedirects.sessionExpired("publication/slug"), "/publications/publication%2Fslug/access?session=expired", 307],
    [publicationRedirects.downloadFailed("publication/slug"), "/publications/publication%2Fslug/access?download=failed", 307],
  ];
  try {
    for (const [target, path, status] of cases) {
      assert.equal(target.location.href, `${canonicalOrigin}${path}`);
      assert.equal(target.status, status);
    }
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = previous;
  }
});

test("proxy localhost and signed-download redirect regressions stay closed", () => {
  const proxyRequestUrl = new URL(
    "https://localhost:3000/api/publications/verify?token=test-token",
  );
  const redirect = publicSiteUrl(
    "/publications/verify?token=test-token",
    canonicalOrigin,
  );
  assert.notEqual(redirect.origin, proxyRequestUrl.origin);
  assert.equal(
    redirect.href,
    `${canonicalOrigin}/publications/verify?token=test-token`,
  );
  assert.doesNotMatch(verifyRoute, /new URL\([^\n]*request\.url/);
  assert.doesNotMatch(downloadRoute, /new URL\([^\n]*request\.url/);
  assert.match(verifyRoute, /publicationRedirects\.beginVerification\(token\)/);
  assert.match(downloadRoute, /publicationRedirects\.sessionRequired\(slug\)/);
  assert.match(downloadRoute, /return NextResponse\.redirect\(url\);/);
});
