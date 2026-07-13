import {isDeepStrictEqual} from "node:util";

export function assertCurrentReleaseApproval({
  manifest,
  campaignSha256,
  approval,
  productionMethod,
  productionMethodSha256,
}) {
  if (manifest.status !== "final-voiced-master" || manifest.releaseApproved !== true) {
    throw new Error("Web publication blocked: the final voiced-master manifest has not passed release gates.");
  }
  if (approval.status !== "approved" || !isDeepStrictEqual(manifest.releaseApproval, approval)) {
    throw new Error("Web publication blocked: the tracked release approval is missing, revoked, or stale.");
  }
  if (
    approval.approvedCampaignSha256 !== campaignSha256 ||
    approval.approvedProductionMethodSha256 !== productionMethodSha256 ||
    productionMethod.campaignSha256 !== campaignSha256 ||
    manifest.campaignSha256 !== campaignSha256 ||
    manifest.productionMethodSha256 !== productionMethodSha256
  ) {
    throw new Error("Web publication blocked: the campaign, production method, and release approval do not match.");
  }
  const engine = productionMethod.model ?? productionMethod.engine;
  if (
    approval.approvedProvider !== productionMethod.provider ||
    approval.approvedEngine !== engine ||
    manifest.speechProduction?.provider !== productionMethod.provider ||
    manifest.speechProduction?.model !== engine
  ) {
    throw new Error("Web publication blocked: the approved voice production method has changed.");
  }
}
