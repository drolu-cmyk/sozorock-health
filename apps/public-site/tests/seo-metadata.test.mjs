import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nextConfig from "../next.config.ts";
import { createLegalMetadata } from "../app/lib/legal-metadata.ts";

const legalPages = [
  ["Privacy notice", "/privacy"],
  ["Terms of use", "/terms"],
  ["Accessibility", "/accessibility"],
  ["Nondiscrimination", "/nondiscrimination"],
];

for (const [title, path] of legalPages) {
  test(`${path} has self-referential canonical and social metadata`, () => {
    const metadata = createLegalMetadata({
      title,
      description: `${title} description`,
      path,
    });

    assert.equal(metadata.alternates?.canonical, path);
    assert.equal(metadata.openGraph?.url, path);
    assert.equal(metadata.openGraph?.title, `${title} | SozoRock Health`);
    assert.equal(metadata.twitter?.title, `${title} | SozoRock Health`);
  });
}

test("the Spanish route emits a server-side Content-Language header", async () => {
  const headers = await nextConfig.headers?.();
  const spanishRoute = headers?.find((entry) => entry.source === "/es");

  assert.deepEqual(spanishRoute?.headers, [
    { key: "Content-Language", value: "es-US" },
  ]);
});

test("the sitemap source declares reciprocal English and Spanish alternatives", async () => {
  const source = await readFile(
    new URL("../app/sitemap.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /url: `\$\{base\}\/es`/);
  assert.match(
    source,
    /alternates: \{ languages: \{ en: base, es: `\$\{base\}\/es` \} \}/,
  );
});
