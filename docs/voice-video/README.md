# SozoRock Health voice and campaign system

The campaign demonstrates **Voice Access**, the non-clinical resident layer that listens, confirms, requests permission, previews bounded request details, and helps the resident prepare for a next step. The current voice endpoint does not save or submit the request; submission requires an explicit tap-or-text action. Voice Access never diagnoses, triages, treats, prescribes, interprets symptoms, matches a provider without verified data, or replaces a licensed professional.

## Interaction standard

The interaction design follows the qualities demonstrated in OpenAI’s GPT-Live announcement: continuous attention, brief acknowledgements, room for pauses, user interruption, mid-thought correction, translation, and visual responses. OpenAI states that GPT-Live powers ChatGPT Voice and that developer API access is planned. Therefore:

- the public product may describe the experience as **natural voice interaction**;
- it must not claim that a current API render or live session uses GPT-Live;
- the runtime adapter uses the highest approved Realtime API model available to the account;
- prerecorded campaign narration uses an approved, provenance-recorded speech provider that is separate from the live runtime;
- the adapter can adopt GPT-Live after the API is released, security-reviewed, and enabled by feature flag.

Official reference: <https://openai.com/index/introducing-gpt-live/>

## Voice character

- Warm, perceptive, relaxed, and adult.
- Brief acknowledgements such as “Mm-hm” or “Got it” only when they help the resident know the guide is following.
- A full beat after permission or confirmation questions.
- Short, plain sentences with no promotional or clinical cadence.
- The guide yields immediately when the resident interrupts or corrects the request.
- Every search-relevant detail is reflected back before use.

Boundary line: “I can help you prepare and understand the next non-clinical step. A licensed provider is responsible for care and clinical decisions.”

Emergency line: “This service is not for emergencies. If you may be in immediate danger, call 911 or your local emergency number.”

## Campaign package

The approved two-voice interaction uses the persona **Renata Cole**. It includes:

- active listening and a natural acknowledgement;
- a resident’s mid-sentence correction;
- a direct interruption while results are being explained;
- explicit permission before county or language is used;
- visual responses for location, language, request details, and readiness steps;
- a clear non-clinical/provider boundary;
- English and Spanish scripts, captions, transcripts, posters, and social reframes.

The resident journey is explicitly illustrative. It previews non-clinical request details and hands submission to tap or text. It does not depict voice persistence, a provider match, a hub opening, or a verified local result.

Source: `apps/media/gpt-live-campaign/campaign.json`

Formats:

| Channel | Dimensions |
| --- | ---: |
| YouTube Shorts | 1080 × 1920 |
| Instagram Reels | 1080 × 1920 |
| LinkedIn | 1080 × 1350 |
| X | 1280 × 720 |

## Production state

The creative, timing, bilingual scripts, captions, visual system, natural voice assets, and Remotion compositions are complete. Prerecorded English and Spanish dialogue is synthesized through Amazon Polly’s generative engine with distinct resident and Voice Access speakers. Every asset records its provider, engine, region, voice identifier, line text, and content hash. The live product remains on the OpenAI Realtime adapter; prerecorded Polly audio is never represented as GPT-Live output.

Visual-only renders remain labelled **visual preview · voice pending** and are never published as marketing masters.

No legacy resident-journey audio or public-site campaign files should be reused or silently relabelled.

## Rendering

Preview rendering is always safe and remains visibly labelled:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm run audio:ambient --workspace @sozorock/media
npm run typecheck --workspace @sozorock/media
npm run render:all --workspace @sozorock/media
npm run verify:campaign --workspace @sozorock/media
```

Final rendering is separate and fail-closed:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm run voice:generate --workspace @sozorock/media
npm run render:final --workspace @sozorock/media
npm run publish:web --workspace @sozorock/media
```

`voice:generate` records the exact campaign hash, approved line text, voice identifiers, and a SHA-256 provenance record for every expected dialogue asset. `render:final` refuses to run if any of the 28 English and Spanish assets is absent, altered, invalid, stale, or outside its approved dialogue window. The interrupted guide line must extend beyond Renata’s interruption point before it is deliberately yielded with an audible overlap. Every encoded master passes duration, codec, fast-start, 48 kHz stereo, two-pass loudness normalization, true-peak, and loudness-range gates. Release approval is a separate tracked artifact bound to both the campaign hash and the exact voice-production manifest. `publish:web` verifies the approval, campaign, source hashes, media contract, and inactive render lock before publishing the localized landscape film, poster, captions, transcript, and provenance manifest.

Preview assets are written to `apps/media/exports/gpt-live-campaign/`. API credentials stay server-side and are never written into campaign artifacts.
