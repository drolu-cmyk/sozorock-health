import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { getPublication } from "../app/lib/publications.ts";

const publicationPage = readFileSync(
  new URL("../app/publications/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const spanishPage = readFileSync(
  new URL("../app/es/page.tsx", import.meta.url),
  "utf8",
);

test("Health Systems Assurance Volume 1 is available with its controlled asset", () => {
  const publication = getPublication("health-systems-assurance");

  assert.ok(publication);
  assert.equal(publication.status, "Available");
  assert.equal(publication.assetKey, "health-systems-assurance-volume-1.pdf");
  assert.equal(publication.isbn, "979-8-9936477-3-9");
  assert.equal(publication.datePublished, "2026-08");
  assert.ok(
    existsSync(
      new URL(
        `../../../infrastructure/assets/publications/${publication.assetKey}`,
        import.meta.url,
      ),
    ),
  );
  assert.ok(
    existsSync(new URL(`../public${publication.cover}`, import.meta.url)),
  );
});

test("the approved 300dpi front cover remains pinned", () => {
  const publication = getPublication("health-systems-assurance");

  assert.ok(publication);
  assert.equal(publication.cover.endsWith(".jpg"), true);
  assert.equal(
    createHash("sha256")
      .update(
        readFileSync(new URL(`../public${publication.cover}`, import.meta.url)),
      )
      .digest("hex"),
    "220ed9cf4c347f9b3c28d6b63750470eaf8c3891f4f16b3815d0e6034ab5086f",
  );
});

test("the publication pages no longer present Health Systems Assurance as forthcoming", () => {
  assert.match(publicationPage, /datePublished: publication\.datePublished/);
  assert.match(publicationPage, /isbn: publication\.isbn/);
  assert.doesNotMatch(spanishPage, /En desarrollo/);
  assert.match(spanishPage, /Publicado · Agosto de 2026/);
  assert.match(spanishPage, /Acceder a la publicación/);
});
