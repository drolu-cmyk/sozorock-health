# Milestone 3 - CHA/CHIP evidence pipeline

## Outcome

A controlled, nationwide-ready planning-document workflow now separates discovery, source validation, document scope, extraction, exact citation, formal human review, and current-plan designation. The public interface was not changed. No migration was applied to a live database and nothing was deployed.

## Approved discovery boundary

Candidate discovery accepts only state clearinghouses, county or local health departments, regional planning collaboratives, and hospital CHNA/CSP pages. Each candidate retains publisher, approved host, source page, artifact URL, covered geography, scope, publication-date precision, plan cycle, retrieval date, and confidence. Arbitrary web results cannot enter the adapter.

## Review and publication boundary

- Structured extraction preserves exact source text plus PDF page or HTML section.
- Priority, objective, intervention, responsible-partner, target-population, and evaluation-measure claims must be explicit in the source.
- Low-confidence, ambiguous, or mismatched extraction is quarantined.
- Accepted extraction remains provisional until a named human reviewer records a decision.
- Only a verified, county-specific CHIP with no open blocking review tasks can be designated as a current county plan.
- Regional CHNAs, hospital CHNAs, and hospital implementation strategies cannot be promoted as county plans.

## Pilot evidence review

## Albany County, New York

### Document record

- Publisher: Healthy Capital District.
- Document: [2025 Capital Region Community Health Needs Assessment](https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf).
- Official discovery page: [publisher page](https://www.albanycountyny.gov/departments/health/data-statistics).
- Type and scope: CHNA, regional.
- Covered geography IDs: planning-region:capital-region-ny.
- Publication date: 2025-10-01 (month precision).
- Plan cycle: not stated in the candidate record.
- Retrieved: 2026-07-21T23:45:00Z.
- Candidate confidence: high (0.98).

### Source-text-verified extraction

- **finding**: The regional assessment identifies cost-related forgone medical care as Albany County's highest rate in the Capital Region for the cited period.
  - Exact source text: “Albany County had the highest rate in the Capital Region of adults who did not receive medical care due to cost in 2021, although the rate ranked in the top half of NYS counties and was lower than NYS, excluding NYC rate (BRFSS)”
  - Citation: [official source](https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf), printed page 17, PDF page index 18, Albany County - General Health Status.
  - Status: source text matched; formal human verification pending.
- **disparity**: The assessment reports a large racial disparity in diabetes hospitalizations in Albany County.
  - Exact source text: “Albany County’s 2020-2022 rate of diabetes hospitalizations was 3.9 times higher among Black non-Hispanic residents than White non-Hispanic residents (NYS CHIRE)”
  - Citation: [official source](https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf), printed page 17, PDF page index 18, Albany County - Chronic Disease.
  - Status: source text matched; formal human verification pending.

### Awaiting human review

- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)

### Scope guard

- Document scope: regional.
- Public eligibility: no.
- Current county plan: not verified by this workflow.

## Schenectady County, New York

### Document record

- Publisher: Healthy Capital District.
- Document: [2025 Capital Region Community Health Needs Assessment](https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf).
- Official discovery page: [publisher page](https://www.healthycapitaldistrict.org/tiles/index/display?alias=hcdireports).
- Type and scope: CHNA, regional.
- Covered geography IDs: planning-region:capital-region-ny.
- Publication date: 2025-10-01 (month precision).
- Plan cycle: not stated in the candidate record.
- Retrieved: 2026-07-21T23:45:00Z.
- Candidate confidence: high (0.98).

### Source-text-verified extraction

- **finding**: The assessment identifies Schenectady County as having the Capital Region's highest overall Social Vulnerability Index.
  - Exact source text: “Schenectady County had the highest overall Social Vulnerability Index (SVI) in the Capital Region (CDC)”
  - Citation: [official source](https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf), printed page 25, PDF page index 26, Schenectady County - Sociodemographic.
  - Status: source text matched; formal human verification pending.
- **disparity**: The assessment reports the region's largest Hispanic-to-White disparity in early prenatal care in Schenectady County.
  - Exact source text: “Schenectady County had the largest disparity in the Capital Region for percent of births with early prenatal care in 2020-2022, between Hispanic and White non-Hispanic residents (NYS Vital Statistics)”
  - Citation: [official source](https://www.healthycapitaldistrict.org/content/sites/hcdi/CHNA2025/CHNA_HCDI_2025.pdf), printed page 26, PDF page index 27, Schenectady County - Infant and Maternal Health.
  - Status: source text matched; formal human verification pending.

### Awaiting human review

- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)

### Scope guard

- Document scope: regional.
- Public eligibility: no.
- Current county plan: not verified by this workflow.

## Montgomery County, New York evaluation

### Document record

- Publisher: St. Mary's Healthcare.
- Document: [2024 St. Mary's Healthcare Community Health Needs Assessment](https://www.smha.org/wp-content/uploads/2025/05/2024-PRC-CHNA-Report-St-Marys-Healthcare-Amsterdam_compressed-2.pdf).
- Official discovery page: [publisher page](https://www.smha.org/aboutus/continuous-improvement/).
- Type and scope: CHNA, hospital specific.
- Covered geography IDs: planning-region:st-marys-fulton-montgomery.
- Publication date: 2024-08-01 (month precision).
- Plan cycle: not stated in the candidate record.
- Retrieved: 2026-07-21T23:45:00Z.
- Candidate confidence: high (0.96).

### Source-text-verified extraction

- **priority**: Community leaders ranked mental health, substance use, and nutrition, physical activity and weight as the service area's top three needs.
  - Exact source text: “1. Mental Health 2. Substance Use 3. Nutrition, Physical Activity & Weight”
  - Citation: [official source](https://www.smha.org/wp-content/uploads/2025/05/2024-PRC-CHNA-Report-St-Marys-Healthcare-Amsterdam_compressed-2.pdf), printed page 15, PDF page index 15, Community Feedback on Prioritization of Health Needs.
  - Status: source text matched; formal human verification pending.
- **barrier**: The assessment explicitly identifies social determinants, including housing, as a cross-cutting concern.
  - Exact source text: “It is also important to note that the Social Determinants of Health (including Housing) are a cross-cutting issue that impact all of the above and also ranked highly among key informants' concerns.”
  - Citation: [official source](https://www.smha.org/wp-content/uploads/2025/05/2024-PRC-CHNA-Report-St-Marys-Healthcare-Amsterdam_compressed-2.pdf), printed page 15, PDF page index 15, Community Feedback on Prioritization of Health Needs.
  - Status: source text matched; formal human verification pending.

### Awaiting human review

- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)

### Scope guard

- Document scope: hospital specific.
- Public eligibility: no.
- Current county plan: not verified by this workflow.

## Chester County, Pennsylvania

### Document record

- Publisher: Chester County Health Department.
- Document: [2025 Chester County Community Health Assessment](https://www.chesco.org/DocumentCenter/View/79811/Chester-County-CHA--2025).
- Official discovery page: [publisher page](https://www.chesco.org/5772/2025-Community-Health-Assessment).
- Type and scope: CHA, county specific.
- Covered geography IDs: county:42029.
- Publication date: 2025-05-27 (day precision).
- Plan cycle: not stated in the candidate record.
- Retrieved: 2026-07-21T23:45:00Z.
- Candidate confidence: high (0.99).

### Source-text-verified extraction

- **disparity**: The county reports widening disparities in chronic disease outcomes and maternal and child health.
  - Exact source text: “The assessment also highlighted demographic shifts and several key issues, including growing mental health concerns, the shortage of affordable housing and high cost of living, and persistent health and economic disparities, particularly among Black residents.”
  - Citation: [official source](https://www.chesco.org/DocumentCenter/View/79811/Chester-County-CHA--2025), printed page 11, PDF page index 10, Key Findings.
  - Status: source text matched; formal human verification pending.
- **barrier**: Community survey participants identified cost of living and affordable housing as major concerns.
  - Exact source text: “Nearly 2 out of 3 (62%) survey respondents said “cost of living” and half (50%) of respondents said “lack of affordable, quality housing” were top community issues.”
  - Citation: [official source](https://www.chesco.org/DocumentCenter/View/79811/Chester-County-CHA--2025), printed page 13, PDF page index 12, Housing Affordability and Cost of Living.
  - Status: source text matched; formal human verification pending.

### Awaiting human review

- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)

### Scope guard

- Document scope: county specific.
- Public eligibility: no.
- Current county plan: not verified by this workflow.

## Bexar County, Texas

### Document record

- Publisher: University Health.
- Document: [University Health Community Health Needs Assessment and Implementation Strategy for Bexar County, 2026-2028](https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx).
- Official discovery page: [publisher page](https://www.universityhealth.com/about-us/community-health-needs-assessment).
- Type and scope: IMPLEMENTATION_STRATEGY, hospital specific.
- Covered geography IDs: county:48029.
- Publication date: 2026-03-01 (month precision).
- Plan cycle: 2026-01-01 through 2028-12-31.
- Retrieved: 2026-07-21T23:45:00Z.
- Candidate confidence: high (0.99).

### Source-text-verified extraction

- **priority**: The 2025 Bexar CHNA organizes identified needs into three explicit priority categories.
  - Exact source text: “The data are disaggregated to identify and describe health disparities and are grouped into three categories of priorities: • What We Need for Health • How We are Taking Care of Ourselves • How We are Faring”
  - Citation: [official source](https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx), printed page 2, PDF page index 1, Executive Summary.
  - Status: source text matched; formal human verification pending.
- **barrier**: The assessment identifies rural, South Side, and West Side access disparities, including digital and transportation barriers.
  - Exact source text: “For rural areas, in particular, there was discussion about digital equity and access”
  - Citation: [official source](https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx), printed page 8, PDF page index 7, Geographic disparities.
  - Status: source text matched; formal human verification pending.
- **objective**: University Health's strategy explicitly aims to improve prevention, disease-management, and well-being access.
  - Exact source text: “Improve access to care & services that promote prevention, disease management & overall well-being”
  - Citation: [official source](https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx), printed page 15, PDF page index 14, How We are Taking Care of Ourselves.
  - Status: source text matched; formal human verification pending.
- **evaluation measure**: The strategy reports a concrete screening measure for adult inpatients.
  - Exact source text: “In 2025, 76% of admitted adult patients were screened for SDOH.”
  - Citation: [official source](https://www.universityhealth.com/-/media/Files/About-Us/Community-Health-Needs-Assessment/Community-Health-Needs-Implementation-Strategy-2026.ashx), printed page 9, PDF page index 8, Impact Evaluation.
  - Status: source text matched; formal human verification pending.

### Awaiting human review

- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)
- The exact citation matched the extracted page or section; a named human reviewer must verify the claim before public use. (formal_verification_required; review_required)

### Scope guard

- Document scope: hospital specific.
- Public eligibility: no.
- Current county plan: not verified by this workflow.

## Albany validation

Albany County's official Data & Statistics page links the 2025 Capital Region Community Health Needs Assessment. The pilot extraction uses the assessment's Albany-specific findings, including cost-related forgone care and the reported racial disparity in diabetes hospitalizations. It does not substitute CDC PLACES rankings for local planning evidence, and it does not call the regional CHNA a current Albany County CHIP. The county page still lists the 2022-2024 CHIP separately; current county-plan status therefore remains not yet verified.

## Refresh, storage, and audit

1. A scheduled monthly discovery review checks approved official source pages only.
2. New or changed artifacts are retrieved, SHA-256 fingerprinted, and stored as immutable source versions.
3. PDF or HTML text is normalized into page or section records without discarding original locators.
4. Structured proposals are validated against the retained page text.
5. Quarantined proposals and all provisional accepted claims appear in the internal review queue.
6. Human decisions require reviewer identity, timestamp, and a decision note.
7. Current-plan promotion is blocked at both application and database layers unless verification conditions pass.
8. Audit events remain append-only; source versions and prior decisions are never overwritten.

## Pilot limitations

- The Capital Region assessment states publication as October 2025 without an exact day; date precision is recorded as month.
- Montgomery's 2024 St. Mary's CHNA is service-area and hospital-specific evidence spanning Fulton and Montgomery Counties, not a county plan.
- Chester County's 2025 CHA is verified as an official county assessment, while the county page describes CHIP development as the next step.
- Bexar evidence includes the 2025 county CHNA summary embedded in University Health's board-approved 2026-2028 hospital implementation strategy; that strategy is not labeled as Bexar County's plan.

## Operations performed

- Added migration 0003, but did not apply it to any database.
- Downloaded official artifacts only to the ignored local tmp directory for fingerprinting and text verification.
- Generated this internal report and the machine-readable review bundle.
