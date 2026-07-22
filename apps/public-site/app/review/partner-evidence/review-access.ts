export function partnerEvidenceReviewEnabled() {
  return process.env.NODE_ENV !== "production"
    || process.env.PARTNER_EVIDENCE_REVIEW_ENABLED === "true";
}
