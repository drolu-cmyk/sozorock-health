# SozoRock Health voice and campaign system

The campaign demonstrates **Voice Access**, the non-clinical resident layer that listens, confirms, requests permission, previews bounded request details, and helps the resident prepare for a next step. The current voice endpoint does not save or submit the request; submission requires an explicit tap-or-text action. Voice Access never diagnoses, triages, treats, prescribes, interprets symptoms, matches a provider without verified data, or replaces a licensed professional.

## Interaction standard

The interaction design follows the qualities demonstrated in OpenAI’s GPT-Live announcement: continuous attention, brief acknowledgements, room for pauses, user interruption, mid-thought correction, translation, and visual responses. OpenAI states that GPT-Live powers ChatGPT Voice and that developer API access is planned. Therefore:

- the product may describe the interaction pattern as **GPT-Live-ready**;
- it must not claim that a current API render or live session uses GPT-Live;
- the runtime adapter uses the highest approved Realtime API model available to the account;
- prerecorded campaign narration uses an approved OpenAI speech endpoint and records its exact model and voices in the asset manifest;
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

The creative, timing, bilingual scripts, captions, visual system, and Remotion compositions are complete. Final voice synthesis requires an active OpenAI project with speech billing enabled. A render made without approved OpenAI voice tracks is labelled **visual preview · voice pending** and is not a final marketing master.

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

Final-candidate rendering is separate and fail-closed:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm run voice:generate --workspace @sozorock/media
npm run render:final --workspace @sozorock/media
```

`voice:generate` records the exact campaign hash, approved line text, and a SHA-256 provenance record for every expected dialogue asset. `render:final` refuses to run if any of the 28 English and Spanish assets is absent, altered, invalid, stale, or longer than its approved dialogue window. Voice sequences are trimmed to their line windows with short edge fades; the guide's interrupted line yields exactly when Renata begins. Every encoded candidate must also pass automated duration, codec, 48 kHz stereo, integrated-loudness, true-peak, and loudness-range gates. The renderer passes `voiceReady: true` only after preflight succeeds, writes voiced master candidates to `apps/media/exports/gpt-live-campaign/final-voiced-masters/`, and keeps `releaseApproved: false` until naturalness, interruption timing, caption sync, mix, boundaries, and final release approval are reviewed by a person.

Preview assets are written to `apps/media/exports/gpt-live-campaign/`. API credentials stay server-side and are never written into campaign artifacts.
