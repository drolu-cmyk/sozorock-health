# Milestone 6 — Funder and partner decision support

Status: review-only. This work is not linked from public navigation, is excluded from search indexing, and returns `404` in production unless `PARTNER_EVIDENCE_REVIEW_ENABLED=true` is deliberately set for an approved review environment.

## What was built

Milestone 6 turns one selected county evidence package into three coordinated review outputs:

- an external-facing partnership preview;
- a downloadable PDF evidence brief generated from the same data contract;
- an internal detail view that exposes provisional claims and source-review decisions.

The output is an editable evidence brief, not a grant-writing generator. The decision-support contract is `case-for-action.v1` in `packages/evidence-core/src/decision-support`.

## Reading order

The preview follows one decision path:

1. what can be said now;
2. local-plan, public-data, and resource-coverage status;
3. direct-label public-data comparisons;
4. evidence → practical barrier → potential response → partner role → measure of progress;
5. evidence gaps;
6. proposed measures;
7. full source ledger and disclosures.

Visual encodings are semantic:

- forest green: verified evidence or neutral/favorable context;
- mineral blue: the comparison series;
- amber: an adverse signal or a decision requiring local review;
- gray: missing evidence.

No color is the only carrier of meaning. Every state also has a text label.

## Evidence rules

- A metric is shown only when its geography, directionality, source record, release date, data period, retrieval date, and review status are present.
- A positive or protective measure cannot become a problem because its value is high.
- County evidence remains county evidence.
- Provisional, regional, and hospital-specific documents are never represented as a county’s verified current plan.
- Provisional claims are omitted from the external preview and appear only in the internal review view.
- “No verified resource record” means coverage is unknown; it does not mean resources are absent.
- A response marked “requires local partner review” is a conversation concept, not authorization to implement it.
- Every proposed measure is explicitly labeled `proposed_for_partner_review`.

## Pilot findings

### Albany County, New York

- Current county-level CDC PLACES context is available.
- The 2025 Capital Region CHNA is cataloged as a regional, provisional source.
- Albany-specific candidate claims remain withheld from the external brief.
- No verified resource inventory is available.
- Result: `insufficient evidence`; no SozoRock response is selected.

### Bexar County, Texas

- Current county-level CDC PLACES context includes reviewed adverse-direction signals.
- The University Health 2026–2028 document is cataloged as hospital-specific and provisional; it is not labeled as the county plan.
- No verified resource inventory is available.
- Result: a Health Access Day readiness conversation `requires local partner review`; it is not an implementation recommendation.

## Review routes

Local development only by default:

- `/review/partner-evidence?place=albany&mode=public`
- `/review/partner-evidence?place=bexar&mode=public`
- `/review/partner-evidence?place=albany&mode=internal`
- `/review/partner-evidence?place=bexar&mode=internal`

Downloads are served with `private, no-store` caching and `X-Robots-Tag: noindex, nofollow, noarchive`.

## Reproducible PDFs

Run:

```powershell
npm.cmd run build:partner-evidence-review
```

Review artifacts are written to `output/pdf/milestone-6`. The PDF and web preview are generated from the same decision-support cases. The script also creates the corresponding HTML used by the PDF renderer.

## Approval gate

Before any public release, Oluwabiyi Adeyemo must approve:

- the external language;
- the visual hierarchy;
- the public-data comparison method and labels;
- the disclosure wording;
- any claim promoted from provisional to verified;
- the selected response concept and proposed measures;
- the environment setting that enables the route.
