# Health redesign — Prompt 3 design acceptance

Reviewed 2026-09-07 against the user-approved revised Option 2 image. This record supersedes the earlier navigation-led review. Implementation: e6813ae050d8481a4936a5cc13e37ee63cabb227.

VERIFIED: local design acceptance passed. Production acceptance is recorded separately after release.

## Reference comparison

- Desktop: the white/cobalt 52/48 opening, Instrument Sans, large headline, four capability disclosures and short evidence/publications entry retain the approved composition. Actual 1418px screenshot reviewed alongside the 1418px reference.
- Positioning: “Building the systems that make health access possible.” Community access, evidence and intelligence, digital and provider readiness, and workforce capacity are the four areas. Navigation is not the umbrella proposition.
- Deliberate differences: the Spanish entry is retained; disclosures have working deeper links; the footer contains the verified Foundation relationship and complete legal routes. These make the page taller than the concept image.
- Mobile/tablet: 390px and 768px full-page captures reviewed. Mobile has full-width actions, menu disclosure, compact headings and a single evidence-link column. Tablet has a full-width opening and two evidence links. No hero bitmap or crop is required.
- Clinical responsibility is stated concisely near the opening and expanded where relevant. No diagnosis, treatment, prescribing or clinical-provider claims.
- Explore: no product component or module stylesheet changed. Before/after typography, colors, dimensions and screenshots were compared. Its redesign remains a separate assignment.

## Executed checks

VERIFIED: 72 production-build route/viewport cases across 18 routes and 1418, 768, 390 and 320 CSS-pixel widths. No overflow, broken images, encoding errors, unexpected HTTP statuses or browser page errors. One H1 per page.

VERIFIED: axe WCAG 2 A/AA, 2.1 AA and 2.2 AA checks on 11 representative routes returned zero violations and zero incomplete checks. Mobile menu, Escape/focus return, native capability disclosure, reduced motion, contact interest preselection and form validation passed. Contact API error/success responses were simulated without duplicate inquiries.

VERIFIED: application/repository tests, typecheck, lint, build, runtime checks, dependency audit and CodeQL passed. CI 34173926460 includes PostgreSQL migrations and secret/runtime scans.

UNVERIFIED: comprehensive screen-reader and real-device Safari/Firefox acceptance; field INP and sustained real-user Core Web Vitals. Automated and Chromium checks do not establish full conformance. Local measurements are lab samples. Existing Explore backend findings are not repaired by this visual release.
