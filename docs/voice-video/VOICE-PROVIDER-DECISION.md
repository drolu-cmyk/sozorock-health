# Voice provider decision

Verified 12 July 2026.

## Decision

SozoRock Health uses separate lanes for live conversation and mastered media.

| Need | Production choice | Why |
| --- | --- | --- |
| Live website and app conversation | OpenAI `gpt-realtime-2.1` over WebRTC, disabled pending the live-safety release gate | Low-latency speech-to-speech, semantic turn detection, interruption support, and server-mediated SDP setup that keeps the long-lived API key off the client. |
| English and Spanish campaign masters | Amazon Polly `generative` voices through the AWS deployment identity | Immediately deployable, AWS-native, bilingual, provenance-recorded, and independent of the live runtime. |
| Future highest-expression campaign dialogue | ElevenLabs v3 Text-to-Dialogue, after credentials and commercial terms are approved | Dialogue-wide context, multi-speaker pacing, non-verbal cues, and multilingual campaign production. |
| Avatar or lip-synced localization | HeyGen only after explicit spokesperson and likeness approval | Useful for approved spokesperson/localization workflows, but a generic synthetic avatar would weaken the current resident-interface direction. |
| Future ChatGPT Voice parity | GPT-Live adapter after public API availability and account entitlement | OpenAI states that GPT-Live powers ChatGPT Voice, while API access is planned rather than currently public. |

## Current release

- Live runtime configuration: `gpt-realtime-2.1` behind the server-only `OPENAI_REALTIME_ENABLED` kill switch, which defaults off. Production activation requires active API billing, boundary red-team coverage, output/policy monitoring, human escalation, and a successful real-device WebRTC smoke test. Tap and text remain available.
- Prerecorded English: Ruth for Voice Access and narration; Danielle for Renata.
- Prerecorded Spanish: Pedro for Voice Access and narration; Lupe for Renata.
- Voice engine: Amazon Polly `generative` in `us-east-1`.
- Visual renderer: Remotion, retained as the single campaign renderer.
- Music: original programmatic instrumental bed; no third-party recording or license dependency.
- Provenance: provider, engine, region, voice IDs, exact dialogue, campaign hash, file hashes, duration, codec, and loudness results.

The public product may say **natural voice interaction**. It must not say a current live session or prerecorded master is powered or rendered by GPT-Live.

## Why HeyGen is not the primary layer

HeyGen offers an official Remote MCP, Codex-oriented skills, voice endpoints, avatars, translation, and lip sync. It is appropriate when an approved real spokesperson, digital twin, or localized presenter is part of the creative brief. The SozoRock Health film instead demonstrates a resident interacting with Voice Access. Keeping the resident-interface film in Remotion avoids generic avatar aesthetics, likeness risk, an additional renderer, and avoidable vendor lock-in.

If HeyGen is later approved:

1. Install the official `heygen-com/skills` package or authorize HeyGen Remote MCP.
2. Keep the HeyGen key server-side and scoped to the campaign workflow.
3. Use an approved avatar or spokesperson only; never infer consent.
4. Lock exact script, avatar ID, voice ID, language, and export settings.
5. Retain captions, transcript, provenance, and human visual review.

## Release gates

- No vendor key in the browser bundle, device storage, repository, transcript, or asset manifest.
- Live clients send an SDP offer to the same-origin session route and receive only the SDP answer; the provider API key remains server-side.
- Typed/tap fallback remains available if voice is denied or unavailable.
- Voice Access does not diagnose, triage, treat, prescribe, interpret symptoms, or replace licensed professionals.
- English and Spanish scripts preserve pauses, correction, an audible interruption, and explicit review before submission.
- Masters are 80 seconds, H.264/AAC, 30 fps, 48 kHz stereo, approximately -16 LUFS, and no higher than -1 dBTP.
- Captions, transcripts, posters, responsive embeds, and downloadable masters ship together.
- Every release records the provider and exact production method truthfully.

## Primary sources

- [OpenAI: Introducing GPT-Live](https://openai.com/index/introducing-gpt-live/)
- [OpenAI: Realtime API with WebRTC](https://developers.openai.com/api/docs/guides/realtime-webrtc)
- [OpenAI: GPT-Realtime 2.1](https://developers.openai.com/api/docs/models/gpt-realtime-2.1)
- [Amazon Polly generative voices](https://docs.aws.amazon.com/polly/latest/dg/generative-voices.html)
- [ElevenLabs models and Text-to-Dialogue](https://elevenlabs.io/docs/overview/models)
- [HeyGen tools for AI agents](https://developers.heygen.com/docs/for-ai-agents)
- [HeyGen Remote MCP](https://developers.heygen.com/mcp/overview)
