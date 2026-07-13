import assert from "node:assert/strict";
import test from "node:test";
import {assertCurrentReleaseApproval} from "../scripts/release-gate.mjs";

const campaignSha256 = "campaign";
const productionMethodSha256 = "method";
const approval = {
  status: "approved",
  approvedBy: "Oluwabiyi Adeyemo",
  approvedCampaignSha256: campaignSha256,
  approvedProductionMethodSha256: productionMethodSha256,
  approvedProvider: "provider",
  approvedEngine: "engine",
};
const productionMethod = {provider: "provider", model: "engine", campaignSha256};
const manifest = {
  status: "final-voiced-master",
  releaseApproved: true,
  releaseApproval: approval,
  campaignSha256,
  productionMethodSha256,
  speechProduction: {provider: "provider", model: "engine"},
};

test("accepts only the current tracked release approval and production method", () => {
  assert.doesNotThrow(() => assertCurrentReleaseApproval({manifest, campaignSha256, approval, productionMethod, productionMethodSha256}));
});

test("blocks a revoked or changed tracked approval even when the manifest remains approved", () => {
  const revoked = {...approval, status: "revoked"};
  assert.throws(
    () => assertCurrentReleaseApproval({manifest, campaignSha256, approval: revoked, productionMethod, productionMethodSha256}),
    /missing, revoked, or stale/,
  );
});

test("blocks a changed provider or production method", () => {
  assert.throws(
    () => assertCurrentReleaseApproval({manifest, campaignSha256, approval, productionMethod: {...productionMethod, provider: "other"}, productionMethodSha256}),
    /production method has changed/,
  );
});
