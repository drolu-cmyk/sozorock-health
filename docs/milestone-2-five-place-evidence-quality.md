# Milestone 2 five-place evidence-quality report

Evaluation time: 2026-07-20 America/New_York / 2026-07-21 UTC

Grain: exact Census county FIPS

Places: Albany NY `36001`, Schenectady NY `36093`, Montgomery NY `36057`, Chester PA `42029`, and Bexar TX `48029`.

## Checks performed

- Official endpoint availability and response shape.
- Exact county FIPS match and geography-level retention.
- Original source ID and URL retention.
- Release date and underlying data period separation.
- Current/stale/unavailable state.
- Directionality safety for preventive-service measures.
- HRSA whole-county versus population/facility/subcounty separation.

## Results

| Place | CDC PLACES 2025 | ACS 2020–2024 | HRSA primary-care HPSA daily artifact | AHRQ CLH |
| --- | --- | --- | --- | --- |
| Albany County, NY | Available; 4 county observations for diabetes/checkup crude and age-adjusted estimates; 2023 data | Unavailable until Census key is configured | Available artifact; no active single-county geographic designation returned | Unavailable until approved XLSX reader and codebook are registered |
| Schenectady County, NY | Available; 4 county observations; 2023 data | Same configuration gate | Available artifact; no active single-county geographic designation returned | Same parser/codebook gate |
| Montgomery County, NY | Available; 4 county observations; 2023 data | Same configuration gate | Available artifact; no active single-county geographic designation returned | Same parser/codebook gate |
| Chester County, PA | Current dataset available, but no values for the selected 2023 BRFSS measures | Same configuration gate | Available artifact; no active single-county geographic designation returned | Same parser/codebook gate |
| Bexar County, TX | Available; 4 county observations; 2023 data | Same configuration gate | Available artifact; no active single-county geographic designation returned | Same parser/codebook gate |

## Findings and risk

1. **CDC PLACES coverage is source-dependent, not uniformly complete.** CDC states that Kentucky and Pennsylvania estimates based on 2023 BRFSS were unavailable in the 2025 release. Chester’s empty selected-measure result is therefore retained as missing source coverage, not converted to zero and not filled from another geography. Severity: high if ignored; confidence: high.
2. **ACS live ingestion is correctly blocked without a Census API key.** The 2026 API redirects unauthenticated calls to a missing-key page. The adapter now reports `Source unavailable` and keeps the key out of provenance and cache records. Severity: operational high; evidence integrity protected; confidence: high.
3. **HRSA zero whole-county observations is not “no shortage.”** The evaluation only counts active single-county geographic HPSAs. Population-group, facility, or subcounty designations may still exist and must be presented at their actual grain. Severity: high if misread; confidence: high.
4. **AHRQ CLH access is public, but format governance remains incomplete.** The September 2025 release contains annual XLSX files through 2023. The adapter refuses to publish until codebook and parser versions are paired. Severity: medium; confidence: high.
5. **Directionality is safe for the tested preventive measure.** Higher annual-checkup prevalence remains favorable by default and cannot be ranked as an adverse priority solely because it is statistically higher. Severity of regression: high; automated test coverage: present.

## Readiness conclusion

The CDC and HRSA adapters can retrieve current official national data without changing geography. ACS is implementation-complete but operationally unavailable until a Census key is configured. AHRQ CLH is intentionally unavailable until an approved workbook parser and codebook contract are added. The platform can now tell downstream consumers what is current, missing, stale, or blocked instead of manufacturing complete-looking evidence.
