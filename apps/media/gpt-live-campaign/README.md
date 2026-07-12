# GPT-Live-ready Voice Access campaign

This is the approved 80-second bilingual campaign source package for the Option 2 visual direction.

The scenario is explicitly illustrative. It previews non-clinical request details and hands submission to tap or text; it does not depict voice persistence, a provider match, a hub opening, or a verified local result.

## Accuracy note

GPT-Live is the interaction reference. OpenAI’s July 8, 2026 announcement states that GPT-Live powers ChatGPT Voice and that API access is planned. The campaign must not be described as rendered by GPT-Live until that API exists and is enabled for SozoRock Health.

The generation script currently targets `gpt-4o-mini-tts` with `marin` for Voice Access and `coral` for Renata because those models and voices are available to the configured project. The asset manifest records the method. If generation is blocked, do not substitute an unapproved synthetic voice or remove the disclosure.

## Files

- `campaign.json` — canonical bilingual timing and dialogue
- `script-en.md` — approved English reader script
- `script-es.md` — approved Spanish reader script
- `storyboard.md` — responsive visual sequence
- generated JSON, VTT, transcripts, MP4s, and posters are written to `../exports/gpt-live-campaign/`

Visual previews without final OpenAI speech are visibly labelled and are not release masters.

`npm run render:all --workspace @sozorock/media` always renders preview-only assets. `npm run render:final --workspace @sozorock/media` is a separate fail-closed path: it refuses to render unless all 28 expected English and Spanish voice files exist, match the recorded campaign and production hashes, fit their approved timing windows, and have a complete `PRODUCTION-METHOD.json`. Voice clips are trimmed to their approved windows with short edge fades; line 08 yields exactly when Renata interrupts on line 09. Candidate renders must pass duration, codec, 48 kHz stereo, integrated-loudness, true-peak, and loudness-range checks. Successful output is still a **voiced master candidate** with `releaseApproved: false` until human review is complete.
