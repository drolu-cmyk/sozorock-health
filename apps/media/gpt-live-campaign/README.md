# Natural Voice Access campaign

This is the approved 80-second bilingual campaign source package for the Option 2 visual direction.

The scenario is explicitly illustrative. It previews non-clinical request details and hands submission to tap or text; it does not depict voice persistence, a provider match, a hub opening, or a verified local result.

## Accuracy note

GPT-Live is the interaction-design reference. OpenAI’s July 8, 2026 announcement states that GPT-Live powers ChatGPT Voice and that API access is planned. The campaign must not be described as rendered by GPT-Live until that API exists and is enabled for SozoRock Health.

The current prerecorded campaign is synthesized through Amazon Polly’s `generative` engine in `us-east-1`. English uses Ruth for Voice Access and narration and Danielle for Renata. Spanish uses Pedro for Voice Access and narration and Lupe for Renata. The asset manifest records the provider, engine, region, voice identifiers, exact line text, and SHA-256 hashes. This truthful provenance must remain attached to every release.

The live product remains architected for OpenAI `gpt-realtime-2.1` over WebRTC. Its same-origin session route performs server-mediated SDP setup so the provider API key never reaches the browser. GPT-Live can replace that adapter only after OpenAI makes the API available and the SozoRock Health project is entitled to use it.

## Files

- `campaign.json` — canonical bilingual timing and dialogue
- `script-en.md` — approved English reader script
- `script-es.md` — approved Spanish reader script
- `storyboard.md` — responsive visual sequence
- generated JSON, VTT, transcripts, MP4s, and posters are written to `../exports/gpt-live-campaign/`

Visual previews without final speech are visibly labelled and are not release masters.

`npm run render:all --workspace @sozorock/media` renders preview-only assets. `npm run render:final --workspace @sozorock/media` is the fail-closed production path: it refuses to render unless all 28 English and Spanish voice files exist, match the campaign and production hashes, fit their approved timing windows, and have a complete `PRODUCTION-METHOD.json`. The interrupted guide line must extend beyond Renata’s interruption point. Masters then pass duration, codec, fast-start, 48 kHz stereo, two-pass loudness normalization, true-peak, and loudness-range checks. A separate `RELEASE-APPROVAL.json` must match both the campaign hash and exact voice-production manifest. `npm run publish:web --workspace @sozorock/media` verifies that approval and every selected source hash before publishing the landscape master, poster, captions, transcript, and provenance manifest.
