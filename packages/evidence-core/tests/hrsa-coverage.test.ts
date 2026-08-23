import assert from "node:assert/strict";
import test from "node:test";

import type { Geography, MetricObservation, SourceVersion } from "../src/contracts.ts";
import { buildHrsaHpsaCoverageAssertions } from "../src/adapters/hrsa-coverage.ts";
import type { AdapterBatch } from "../src/ingestion/types.ts";

const NOW = "2026-08-22T22:30:00Z";

const geography: Geography = {
  id: "county:36001",
  kind: "county",
  authority: "census",
  authorityId: "36001",
  name: "Albany County, New York",
  displayName: "Albany County, New York",
  stateFips: "36",
  countyFips: "36001",
  vintage: "2025",
  validFrom: null,
  validTo: null,
  reviewStatus: "verified",
  caveat: null,
};

function sourceVersion(reviewStatus: SourceVersion["reviewStatus"] = "verified"): SourceVersion {
  return {
    id: "source-version:hrsa-primary-controlled",
    sourceId: "hrsa-workforce",
    releaseLabel: "2026-08-22",
    releaseDate: "2026-08-22",
    dataPeriodStart: null,
    dataPeriodEnd: "2026-08-22",
    retrievedAt: NOW,
    staleAfter: "2026-08-25T22:30:00Z",
    officialUrl: "https://data.hrsa.gov/DataDownload/DD_Files/BCD_HPSA_FCT_DET_PC.csv",
    contentHash: "sha256:" + "a".repeat(64),
    schemaVersion: "hrsa-hpsa.csv.v2",
    reviewStatus,
    reviewedBy: reviewStatus === "verified" ? "controlled-reviewer" : null,
    reviewedAt: reviewStatus === "verified" ? NOW : null,
  };
}

function observation(geographyId = geography.id): MetricObservation {
  return {
    id: `observation:hpsa:${geographyId}`,
    measureDefinitionId: "measure:hrsa-workforce:hpsa-designation",
    geographyId,
    sourceVersionId: sourceVersion().id,
    sourceRecordId: "hpsa:1",
    sourceUrl: sourceVersion().officialUrl,
    geographyLevel: "county",
    value: "Designated",
    numericValue: 15,
    confidenceLow: null,
    confidenceHigh: null,
    marginOfError: null,
    releaseDate: "2026-08-22",
    dataPeriodStart: "2024-01-01",
    dataPeriodEnd: null,
    retrievedAt: NOW,
    reviewStatus: "verified",
    suppressionReason: null,
    sourceMetadata: {
      discipline: "Primary Care",
      wholeCountyGeographicDesignation: true,
    },
  };
}

function batch({
  status = "available",
  observations = [],
  recordsRejected = 0,
  reviewStatus = "verified",
}: {
  status?: AdapterBatch["status"];
  observations?: MetricObservation[];
  recordsRejected?: number;
  reviewStatus?: SourceVersion["reviewStatus"];
} = {}): AdapterBatch {
  return {
    adapterId: "hrsa-hpsa-v2",
    sourceId: "hrsa-workforce",
    status,
    statusReason: status === "available" ? null : `controlled ${status}`,
    sourceVersion: sourceVersion(reviewStatus),
    measures: [],
    observations,
    recordsRead: 100,
    recordsAccepted: observations.length,
    recordsRejected,
    warnings: [],
    cacheDisposition: status === "stale" ? "stale_fallback" : "miss",
  };
}

test("clean available batch with no county records proves complete zero-record coverage", () => {
  const [assertion] = buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [{ coverageKey: "hpsa:primary_care", batch: batch() }],
  });
  assert.equal(assertion?.status, "complete_no_records");
  assert.equal(assertion?.records_matched, 0);
  assert.equal(assertion?.review_status, "verified");
});

test("clean available batch with county records proves complete record coverage", () => {
  const [assertion] = buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [{
      coverageKey: "hpsa:primary_care",
      batch: batch({ observations: [observation()] }),
    }],
  });
  assert.equal(assertion?.status, "complete_with_records");
  assert.equal(assertion?.records_matched, 1);
});

test("rejected county rows make coverage partial rather than a false negative", () => {
  const [assertion] = buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [{
      coverageKey: "hpsa:dental",
      batch: batch({ recordsRejected: 1 }),
    }],
  });
  assert.equal(assertion?.status, "partial");
  assert.match(assertion?.caveat ?? "", /absence cannot be interpreted/i);
});

test("stale source remains stale coverage even when records exist", () => {
  const [assertion] = buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [{
      coverageKey: "hpsa:mental_health",
      batch: batch({ status: "stale", observations: [observation()] }),
    }],
  });
  assert.equal(assertion?.status, "stale");
});

test("coverage review status follows source-version review state", () => {
  const [assertion] = buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [{
      coverageKey: "hpsa:primary_care",
      batch: batch({ reviewStatus: "provisional" }),
    }],
  });
  assert.equal(assertion?.review_status, "provisional");
});

test("duplicate product lanes are rejected", () => {
  assert.throws(() => buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [
      { coverageKey: "hpsa:primary_care", batch: batch() },
      { coverageKey: "hpsa:primary_care", batch: batch() },
    ],
  }), /Duplicate HPSA coverage product/);
});

test("cross-geography observations cannot enter a county coverage assertion", () => {
  assert.throws(() => buildHrsaHpsaCoverageAssertions({
    geography,
    evaluatedAt: NOW,
    batches: [{
      coverageKey: "hpsa:primary_care",
      batch: batch({ observations: [observation("county:99999")] }),
    }],
  }), /another geography/);
});
