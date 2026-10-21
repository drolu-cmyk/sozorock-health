# SozoRock Health homepage redesign — handoff for implementation

Owner: Dr. Olu Adeyemo (SozoRock). Prepared October 21, 2026.

## Your task

Implement the approved homepage concept and the new film on the live SozoRock Health site (`drolu-cmyk/sozorock-health`, app `apps/public-site`, served at https://health.sozorockfoundation.org). Work on a branch, open a PR, pass the repository's required checks, then merge and deploy through the existing `Verify` → `Deploy` workflows. Verify the live result.

The owner has approved this design direction and wants it deployed. That approval does not waive security gates, accessibility, or the factual rules below.

## What is in this package

| Path | What it is |
|---|---|
| `concept/index.html` (+ `ny_map.js`) | The approved homepage concept as one standalone page. Open it in a browser. It is the visual and copy reference: match its hierarchy, spacing, type scale, colors, charts and wording. Do not ship this file as-is; rebuild it in the Next.js app's components. |
| `film/sozorock-health-care-for-every-zip-code.mp4` | New 47 s film, 1920×1080, 30 fps, H.264 High + AAC, 20.7 MB, −14 LUFS, metadata credited only to Dr. Olu Adeyemo / SozoRock. Replaces `care-within-reach.web.mp4`. |
| `film/poster.jpg` | Poster frame (end card). |
| `film/care-for-every-zip-code.en.vtt` | Captions track (music only, no narration). |
| `film/care-for-every-zip-code.visual.en.vtt` | Visual-description track (`kind="descriptions"`). |
| `film/care-for-every-zip-code.transcript.txt` | Descriptive transcript, linked under the player. |
| `film/TREATMENT.md` | The film's story, beat sheet and honesty rules. |
| `data/cdc-places-2025-ny-counties.json` | CDC PLACES 2025 release, all 62 NY counties: adults 18+, diagnosed diabetes %, high blood pressure %, uninsured 18–64 %. |
| `data/hrsa-fy2026-q4-table3-ny-and-neighbors.json` | HRSA FY2026 Q4 Table 3 rows used in the bar chart. |
| `apps/public-site/public/sources/hrsa-september-2026.pdf` | The archived HRSA report (in the repo; omitted from this folder). |

The county map geometry is in `concept/ny_map.js` (projected from the repo's own `packages/evidence-core/data/national/county-boundaries.v2025.json`, Census TIGERweb 2025). Film source code: `drolu-cmyk/sozorock-video-studio`, branch `health-film-review-v2`, folder `projects/health-care-within-reach-v2` (one-command `build.sh`).

## Page structure to build (home page, top to bottom)

1. **Header**: SozoRock. Health wordmark; links The program, Evidence, Sponsor; primary button Join the interest list (→ `/interest`).
2. **Hero**: H1 "Care for every ZIP Code." One sentence: "A year of sponsored primary care for up to 25 New Yorkers living with a chronic condition. Starting January 2027." Buttons: Join the interest list (`/interest`), Sponsor a participant (`https://www.sozorockfoundation.org/support`). Right: navy card with two bars, United States 46.75% vs New York 35.42%, 0–100% scale, source line.
3. **Key figures band**: 5.29M (HRSA), 1,130 (HRSA), 1.8M (SozoRock estimate from CDC PLACES).
4. **Evidence: ranked bar chart**: headline "New York meets the smallest share of primary-care need in its region." NJ 83.22, VT 82.64, CT 60.00, MA 58.72, PA 55.47, US 46.75, NY 35.42 (orange). Keep the definition and same-date caveat.
5. **Evidence: county map** (navy band): headline "Chronic conditions reach every corner of the state." Toggle Diabetes / High blood pressure; hover/focus shows county value; statewide estimate 11.5% / 32.6%; 5-step legend; CDC source line. Make counties keyboard-reachable or provide an accessible table alternative (e.g., a "View as table" disclosure with all 62 counties).
6. **Program**: "One clear route to a doctor who knows you." Four supports; eligibility panel (Up to 25 / 64 or younger / Chronic condition / 62 counties); "How the year works" 5-step timeline.
7. **Film**: place the new film here (between program and sponsor, or directly after the hero if it tests better), native controls, `preload="none"`, poster, no autoplay, captions + descriptions tracks, transcript link below.
8. **Sponsor** (cobalt band): $4,320 per New Yorker per year; $108,000 first-cohort budget; four tiers in a 2×2 grid with participant-year dots (Community $5,000 = 1, Access $10,000 = 2, Principal $25,000 = 5, Lead $50,000 = 11; rounded down at $4,320).
9. **Proposed Health Equity Hubs**: Library, Community, Home, each visibly labelled **Proposed**.
10. **Closing call to action** and footer with sources.

Keep existing routes, the interest form, privacy page, Spanish pages, publication flows and admin/reviewer views unchanged unless a change is required for this page. Move the longer methods text (HRSA definitions, Table 3 page 5, endnotes pages 14–15; CDC measure definitions; Albany detail) to the Evidence page rather than deleting it, and link to it.

## Design system (use exactly)

- Colors: navy `#071D3B`, cobalt `#0644AD`, icy `#EFF5FF`, light panel `#F7FAFF`, rule `#CED7E3`, body ink `#33495D`, muted `#4B607A`, chart blue `#8FB2E6`, highlight orange `#F28A3C` (only for New York and key moments). Map ramp: `#DCEAFF #A9C6F0 #6E9BDF #2F66C2 #0B2F6E`.
- Type: Instrument Sans (already loaded via `next/font`), tabular numerals. H1 72/1.0 desktop, 44 mobile; H2 40/1.1, 30 mobile; body 18/1.55.
- No gradients, no eyebrow labels, no stock or AI-generated imagery. Charts carry the visuals. If photography is added later it must be real program photography.
- Max content width 1200 px; generous section spacing (≈112 px desktop, 64 px mobile).

## Facts: use exactly, do not invent

- Primary Care Access Program, part of the SozoRock Health Equity Initiative. Starts January 2027 (no specific day in public copy). 12 months of support per participant. Up to 25 New Yorkers, one per household, aged 64 or younger, financial need, a chronic condition such as diabetes or high blood pressure, any of New York's 62 counties.
- Dr. Michael Purcell and **Purcell Integrative Osteopathic Care** (always the full name), a direct primary care practice in Clifton Park. Clinical care stays with the licensed provider. Membership is not health insurance.
- Supports: sponsored direct primary care membership, ongoing telehealth, help with transportation, health access education.
- Budget $108,000; about $4,320 per participant per year. Sponsorship levels Community $5,000, Access $10,000, Principal $25,000, Lead $50,000; other amounts welcome. Funds confirmed before enrollment. Reports at months 3, 6, 9, 12. Sponsors do not select participants or influence clinical care.
- HRSA FY2026 Q4 Table 3, as of September 30, 2026: NY 5,288,766 people in designated primary-care HPSAs; 35.42% of need met; 1,130 practitioners needed; US total 46.75%. The national total includes New York. Percent of need met is a workforce measure, not the share of people receiving care, not appointment access, not a trend.
- CDC PLACES 2025 release, 2023 model-based estimates, adults 18+: diabetes from 7.6% (Tompkins) to 16.1% (Bronx); high blood pressure from 26.1% (Tompkins) to 41.5% (Hamilton). Statewide 11.5% diabetes (≈1.79 million adults) and 32.6% high blood pressure are **SozoRock population-weighted calculations** from the county estimates and must be labelled as estimates.
- Hubs and Health Access Day stay **Proposed**. The Fireside and Working Roundtable stay a **Planned series** with no dates, locations, participants or partners.

## Quality bar

McKinsey / Brookings editorial standard as a benchmark for hierarchy and clarity only (do not copy their branding or imply affiliation): one idea per section, an action headline that states the takeaway, the chart as proof, source and limits directly under it, concise copy with no repetition.

## Required checks before merge

- `npm ci --omit=optional`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:public`, `npm run verify:public-runtime-security`, `npm run build:platform`, and the repository's production dependency audit exactly as the `Verify` workflow runs it. Do not weaken, narrow or bypass any gate.
- Add or update tests: the homepage contains the exact program facts above, "Proposed" labels, the full practice name, source lines, and no "January 15" or any specific start day.
- Accessibility: one h1; all controls are real buttons/links with ≥44 px targets; chart figures have text alternatives; map toggle uses `aria-pressed`; county data reachable without a mouse; color contrast ≥4.5:1 for text; captions + descriptions tracks on the video; works at 320, 390, 768, 1280 and 1440 px with no horizontal scroll.
- Video file: keep `public/media/` naming consistent; confirm the shipped file still has no tool metadata (`ffprobe -show_format -show_streams` shows only SozoRock / Dr. Olu Adeyemo credits).

## Deploy and verify

Merge to `main` only when `Verify` is green on the exact head. The `Deploy` workflow releases to Amplify. Afterwards confirm on https://health.sozorockfoundation.org: the deployed commit, the new sections, chart values, map toggle, film playback with captions, transcript link, `/interest` still working, Spanish pages unchanged, titles/descriptions/canonicals intact. Report the PR, workflow runs, deployed commit SHA and anything that could not be verified.
