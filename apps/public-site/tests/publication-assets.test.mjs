import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const assets = [
  {
    path: "../public/publications/covers/rural-equity-blueprint-volume-1.png",
    sha256: "47456d3294eec1c021b0b49b92d474fcb39c0fb80ffd3f4c6f4c96b1522c3cd2",
  },
  {
    path: "../public/publications/covers/rethinking-rural-governance-volume-1.jpg",
    sha256: "68384ecb600a36d10609826b69fb1bac6b65726470572f933293f42bb1b0764f",
  },
  {
    path: "../public/publications/covers/health-systems-assurance-volume-1.jpg",
    sha256: "220ed9cf4c347f9b3c28d6b63750470eaf8c3891f4f16b3815d0e6034ab5086f",
  },
  {
    path: "../../../infrastructure/assets/publications/rural-equity-blueprint-volume-1.pdf",
    sha256: "3bfe2203a47248bdf349982bce6c1d18c9faf7f404ec64d0ed09513de5704362",
  },
];

test("approved high-resolution covers and the complete rural publication remain pinned", () => {
  for (const asset of assets) {
    const contents = readFileSync(new URL(asset.path, import.meta.url));
    assert.equal(createHash("sha256").update(contents).digest("hex"), asset.sha256);
  }

  assert.equal(
    existsSync(
      new URL(
        "../public/publications/covers/rethinking-rural-governance-volume-1.png",
        import.meta.url,
      ),
    ),
    false,
  );
});
