# SozoRock Health voice and video system

This package defines the public voice character and the downloadable 80-second resident-journey campaign assets. The Resident Access Layer helps people understand where to start, assess digital readiness, prepare for a Health Equity Hub or Health Access Day, and enter a provider-led pathway. It is intentionally non-clinical: voice never diagnoses, triages, recommends treatment, interprets symptoms, or replaces a licensed provider.

## Voice character: savvy + relaxed

The desired delivery is informed, unhurried, and warm without sounding sentimental. It should feel like a capable readiness guide beside the resident—not a clinician, call-center script, or synthetic assistant performing enthusiasm.

- **Pace:** 118–132 words per minute, with a full beat after permission or confirmation questions.
- **Register:** plainspoken and adult; short sentences; contractions are welcome.
- **Energy:** calm confidence, low pressure, lightly conversational.
- **Behavior:** listen first, reflect the request, ask permission, offer a fallback, and name the next step.
- **Never:** diagnose, triage, prescribe, promise availability, imply provider endorsement, or use urgency to force action.
- **Boundary line:** “I can help you prepare and understand the next non-clinical step. A licensed provider is responsible for care and clinical decisions.”
- **Emergency line:** “This service is not for emergencies. If you may be in immediate danger, call 911 or your local emergency number.”

“Sol” is an internal direction for cadence and ease—not a claim that the production voice is an OpenAI or ChatGPT voice. Interactive production voice must use an approved Realtime voice configured through the platform’s server-side feature controls.

## Interactive resident journey

**Guide:** Hi, Maya. Take your time. You can speak, tap, or type. What would you like help with today?

**Resident:** I need help finding care near me.

**Guide:** I can help with the access steps. I heard that you want to find an available care option nearby. Is that right?

**Resident:** Yes.

**Guide:** Thanks. With your permission, I’ll use your county and language preference to look for available pathways. Nothing is shared until you choose to continue.

**Resident:** Continue.

**Guide:** I found an option available to New York residents. I can open the provider’s secure platform next. The licensed provider remains responsible for care and clinical decisions. Would you like to continue?

**Resident:** Yes.

**Guide:** All right. Opening the provider’s platform now.

## Short explainer narration (30 seconds)

Getting to care can mean distance, limited internet, language barriers, and one more unfamiliar system. SozoRock Health makes the access steps clearer. A resident can begin by voice, touch, or text at a Health Equity Hub, during a Health Access Day, or from home. With permission, the Resident Access Layer checks digital readiness and prepares a provider-led pathway. SozoRock supports access. The licensed provider remains responsible for care.

## 80-second marketable narration

The production script is maintained in [`apps/media/narration.txt`](../../apps/media/narration.txt). The timed SSML source and machine-readable captions live beside the media source assets. The story follows one resident from the moment access feels difficult through permission, confirmation, state readiness, and provider handoff.

## Future voice asset patterns

### Language selection

“Would you like to continue in English or Spanish? You can change this later.”

### Permission before location use

“I can use your county or ZIP code to look for access options. Would you like to share that now?”

### No result

“I don’t see a ready option for that location yet. Your request can still help the team understand where access is needed. Would you like to leave contact information for a follow-up?”

### Voice unavailable

“Voice isn’t available right now. You can keep going by tapping or typing, and nothing you entered has been lost.”

### Provider handoff

“You’re leaving SozoRock Health and opening the provider’s secure platform. The provider’s privacy and care policies apply there.”

### Clarifying a request

“I want to make sure I understood. Are you looking for a provider connection, language support, or help using a hub?”

## Production controls

- Keep API credentials server-side; never expose a Realtime API key to a browser or app bundle.
- Mint short-lived client credentials from an authenticated, rate-limited server endpoint.
- Require explicit microphone permission and show listening, processing, and muted states visually and audibly.
- Provide a persistent text/tap alternative and a clear stop control.
- Do not retain raw audio by default. Document any approved retention separately.
- Route emergency or clinical language to the bounded safety response; do not let the model improvise clinical guidance.
- Log operational events without audio, transcript content, names, ZIP codes, or provider details.

## Deliverables and formats

All versions are 80 seconds at 30 fps with burned-in open captions and AAC narration:

| Channel | Dimensions | File |
| --- | ---: | --- |
| YouTube Shorts | 1080 × 1920 | `sozorock-health-resident-journey-youtube-shorts-1080x1920.mp4` |
| Instagram Reels | 1080 × 1920 | `sozorock-health-resident-journey-instagram-reels-1080x1920.mp4` |
| LinkedIn | 1080 × 1350 | `sozorock-health-resident-journey-linkedin-1080x1350.mp4` |
| X | 1280 × 720 | `sozorock-health-resident-journey-x-1280x720.mp4` |

Each render has a matching PNG poster. These are standalone campaign assets and are not embedded in the website.

## Rendering

From the monorepo root:

```powershell
npm run typecheck --workspace @sozorock/media
npm run render:all --workspace @sozorock/media
```

Rendered assets are written to the release campaign folder at `apps/media/exports/resident-journey-80s-final/`. The four MP4 masters are standalone downloads; they are not copied into or embedded by the marketing website.
