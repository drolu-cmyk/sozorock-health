# SozoRock application review — October 20, 2026

The accepted design is integrated into the real Health and Foundation applications. This is a visual-review candidate. Nothing has been merged, deployed or published to production.

## Changes

- Health retains its typography, colors and spacing. The six access barriers use text controls and an active underline. The HRSA comparison uses a shared 0–100% scale, direct values and visible source limitations. The archived PDF is preserved unchanged.
- Albany County is now verified against the CDC PLACES 2025 release: all selected estimates refer to 2023; the insurance population is ages 18–64 and the other measures are ages 18+. Confidence intervals and source data are included.
- The interest form uses underlined fields and selects, native consent controls and visible focus. Error focus and success focus now occur after rendering. Both email-only and phone-only browser submissions were exercised through the running Next route with local synthetic AWS services.
- Reviewer access includes a separate program-interest view, phone-only records, consent/expiry filtering, pagination and bounded complete CSV exports. Notification state distinguishes pending from published to SNS; published does not mean delivered or read. Existing contact and publication flows remain separate.
- Corrected 60-second Care Within Reach and 30-second planned-series videos include posters, native inline controls, captions, visual-description tracks and text transcripts. Original 4K media and soundtracks are preserved in the separate editable source package. Human listening approval remains outstanding.
- Supported dependency patches are applied. The public-site dependency closure and Foundation audit are clean. The required Health monorepo production audit still fails with 16 high findings caused by braces and node-forge; its scope and threshold are unchanged.

## Review evidence

Read VALIDATION.json, sozorock-browser-validation.json and sozorock-intake-validation.json. These are fresh local results, not a new GitHub CI run. All five pages were checked at 1280px and 390px. The form also passed at 320px. Automated WCAG checks found no violations; the hidden native-video fallback link required manual review. The visible transcript links are underlined. This is not a complete screen-reader audit.

The intake harness calls the actual production Next route and AWS SDK against local, in-memory test endpoints. It checks nine scenarios, including storage failure, pending notifications, rate limits, origin checks and ordinary inquiries. It sends no live messages and stores no real participant data. The January 15 date exists only in this synthetic fixture; no actual cohort day has been selected.

Public copy contains no implementation notes. Required consent, eligibility, privacy, proposed/planned status and evidence limitations remain. Spanish page sources are unchanged. No relational database was recreated.

## Before release

Confirm the real cohort date, existing-table expiration and deletion custodian, staff-copy deletion, hosted intake and email/publication delivery. Complete the remaining CI/security and screen-reader checks, resolve the unchanged dependency gate, listen to both soundtracks, and obtain visual approval. The separate redirect publication also requires its owner-variable, IAM and production-approval checks. The broader SEO/indexing and Workspace email audit is not certified by this review.

The preceding static preview remains an unchanged reference. Review the running applications, not the older boxed concept. Do not deploy the local review adapter.
