import assert from "node:assert/strict";
import test from "node:test";
import { artifactsMatchExceptVolatileMetadata } from "../scripts/stabilize-national-artifacts.ts";

test("artifact stability ignores only volatile top-level review metadata", () => {
  const checkedIn = JSON.stringify({
    schemaVersion: "sozorock.source.v1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    retrievedAt: "2026-07-23T00:00:00.000Z",
    counties: { "01001": { value: 12 } },
  });
  const candidate = JSON.stringify({
    schemaVersion: "sozorock.source.v1",
    generatedAt: "2026-10-07T15:00:00.000Z",
    retrievedAt: "2026-10-07T15:00:00.000Z",
    counties: { "01001": { value: 12 } },
  });

  assert.equal(
    artifactsMatchExceptVolatileMetadata(
      checkedIn,
      candidate,
      ["generatedAt", "retrievedAt"],
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
      ["generatedAt"],
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
      ["generatedAt", "snapshotId", "randomStateSample"],
    ),
    true,
  );
});
