import assert from "node:assert/strict";
import test from "node:test";
import {
  artifactGroupMatchesExceptVolatileMetadata,
  artifactsMatchExceptVolatileMetadata,
} from "../scripts/stabilize-national-artifacts.ts";

test("artifact stability ignores only configured volatile metadata paths", () => {
  const checkedIn = JSON.stringify({
    schemaVersion: "sozorock.source.v1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    source: {
      retrievedAt: "2026-07-23T00:00:00.000Z",
      releaseDate: "2026-01-29",
    },
    counties: { "01001": { value: 12 } },
  });
  const candidate = JSON.stringify({
    schemaVersion: "sozorock.source.v1",
    generatedAt: "2026-10-07T15:00:00.000Z",
    source: {
      retrievedAt: "2026-10-07T15:00:00.000Z",
      releaseDate: "2026-01-29",
    },
    counties: { "01001": { value: 12 } },
  });

  assert.equal(
    artifactsMatchExceptVolatileMetadata(
      checkedIn,
      candidate,
      [["generatedAt"], ["source", "retrievedAt"]],
    ),
    true,
  );
});

test("artifact stability preserves substantive source changes for human review", () => {
  const checkedIn = JSON.stringify({
    generatedAt: "2026-07-23T00:00:00.000Z",
    manifests: { data: { sha256: "old" } },
    counties: { "01001": { value: 12 } },
  });
  const candidate = JSON.stringify({
    generatedAt: "2026-10-07T15:00:00.000Z",
    manifests: { data: { sha256: "new" } },
    counties: { "01001": { value: 12 } },
  });

  assert.equal(
    artifactsMatchExceptVolatileMetadata(
      checkedIn,
      candidate,
      [["generatedAt"]],
    ),
    false,
  );
});

test("coverage sampling churn cannot create a false governed candidate", () => {
  const checkedIn = JSON.stringify({
    generatedAt: "2026-07-23T00:00:00.000Z",
    snapshotId: "snapshot:old",
    randomStateSample: [{ state: "AL", geoid: "01109" }],
    loadedCountyCount: 3144,
    failures: [],
  });
  const candidate = JSON.stringify({
    generatedAt: "2026-10-07T15:00:00.000Z",
    snapshotId: "snapshot:new",
    randomStateSample: [{ state: "AL", geoid: "01075" }],
    loadedCountyCount: 3144,
    failures: [],
  });

  assert.equal(
    artifactsMatchExceptVolatileMetadata(
      checkedIn,
      candidate,
      [["generatedAt"], ["snapshotId"], ["randomStateSample"]],
    ),
    true,
  );
});

test("paired coverage artifacts remain together when either changes substantively", () => {
  const stableSnapshot = {
    checkedInRaw: JSON.stringify({
      generatedAt: "old",
      snapshotId: "snapshot:old",
      counties: [{ fips: "01001", value: 12 }],
    }),
    candidateRaw: JSON.stringify({
      generatedAt: "new",
      snapshotId: "snapshot:new",
      counties: [{ fips: "01001", value: 12 }],
    }),
    volatilePaths: [["generatedAt"], ["snapshotId"]],
  };
  const changedReport = {
    checkedInRaw: JSON.stringify({
      generatedAt: "old",
      snapshotId: "snapshot:old",
      sourceCoverageCounts: { "hrsa-workforce": { available: 3125 } },
    }),
    candidateRaw: JSON.stringify({
      generatedAt: "new",
      snapshotId: "snapshot:new",
      sourceCoverageCounts: { "hrsa-workforce": { available: 3126 } },
    }),
    volatilePaths: [["generatedAt"], ["snapshotId"], ["randomStateSample"]],
  };

  assert.equal(
    artifactGroupMatchesExceptVolatileMetadata([stableSnapshot, changedReport]),
    false,
  );
});
