# Agentic AI architecture

## Product rule

SozoRock Health is agentic access infrastructure. AI is not a chat widget; it is a governed set of agents that can interpret a resident's request, use approved tools, explain the next non-clinical step, and create an auditable operational handoff.

Every agent is constrained by role, state readiness, consent, language, feature controls, usage budgets, and the non-clinical boundary. No agent may diagnose, prescribe, triage, determine medical urgency, or override a licensed provider.

## Agent roles

| Agent | Job | Permitted tools |
| --- | --- | --- |
| Resident access agent | Clarify access need, language, hub preference, and next pathway. | County directory, approved hub registry, state-readiness lookup, provider-availability lookup, translation, session handoff. |
| Hub support agent | Help staff prepare a resident for an approved non-clinical pathway. | Session support, approved accessibility prompts, hub operating information, escalation workflow. |
| Provider readiness agent | Guide provider onboarding and surface missing verification requirements. | License-verification workflow, state-readiness configuration, BYOP connection setup, audit checklist. |
| CB-CAP intelligence agent | Explain protected aggregate patterns and prepare permitted reports. | Aggregated-query service, disclosure-control service, report generator, methodology library. |
| Operations agent | Help approved internal teams manage exceptions, incidents, flags, and readiness. | Feature-control service, approval queue, audit events, incident runbooks. |

## Voice and model strategy

The system uses a provider-neutral AI adapter. The current web fallback connects through the OpenAI Realtime API using the account-approved model assigned to `OPENAI_REALTIME_MODEL`. The deployment defaults to `gpt-realtime-2.1`, the newest Realtime model currently exposed to the dedicated project. Non-real-time orchestration and tool use remain separate from the live audio transport.

### GPT-Live experience contract

`gpt-live` is the SozoRock Health capability alias for the most natural conversational voice experience. It is not a vendor model identifier. OpenAI announced GPT-Live on July 8, 2026 as the technology powering ChatGPT Voice and said API availability is coming soon. The production resolver therefore activates GPT-Live only when OpenAI publishes an API model and that exact account-approved identifier is assigned to `OPENAI_GPT_LIVE_MODEL`. Until then, choosing the alias safely uses the configured Realtime fallback. No resident, hub, or provider flow needs to change when the approved API model becomes available. [OpenAI: Introducing GPT-Live](https://openai.com/index/introducing-gpt-live/)

| Server setting | Purpose |
| --- | --- |
| `VOICE_PROVIDER_ALIAS=gpt-live` | Requests the future-ready GPT-Live capability. The deployment workflow uses this alias by default. |
| `OPENAI_GPT_LIVE_MODEL` | Remains empty until OpenAI publishes API access and the Foundation's project is entitled to an exact model. No guessed model value is permitted. |
| `OPENAI_REALTIME_MODEL` | Account-approved Realtime fallback. Defaults to `gpt-realtime-2.1`, which the dedicated project currently lists as available. |
| `OPENAI_REALTIME_ENABLED` | Server-side kill switch. It defaults off and may be set to `true` only after billing, boundary red-team, guardrail/monitoring, and real-device WebRTC gates pass. |

The active Realtime session uses semantic turn detection and interruption handling. Its prompt asks the voice guide to wait through thinking pauses, stop when interrupted, acknowledge sparingly, confirm the resident's meaning before acting, and keep tap and text alternatives available.

## Voice safety contract

1. Get explicit microphone and voice-processing consent before a live session.
2. Show a persistent text transcript and a one-tap text-only fallback.
3. Label AI-facilitated communication clearly; never represent generated speech as a clinician.
4. Use the same-origin, server-mediated SDP route. Never embed or return a long-lived provider key to a mobile or web client.
5. Enforce per-organization, per-state, per-channel, and incident-level feature controls.
6. Log only the minimum operational metadata needed for security, quality, and consent audit; do not place unnecessary voice content in application logs.
7. Escalate emergency or clinical concerns to an approved, plain-language emergency notice and human/provider workflow rather than attempting clinical decision-making.
8. Keep live speech disabled until the boundary evaluation suite, policy monitoring, human escalation, and real-device release gates pass. Prompt instructions alone are not a production safety control.

## Agent control plane

The backend owns the agent registry, prompt versions, tool schemas, evaluation cases, access policies, model allowlists, usage budgets, traces, audit events, and kill switches. Clients receive only an approved capability manifest.

No agent may call a provider platform, reveal CB-CAP results, generate a report, or change state readiness without a server-side authorization check and an auditable tool invocation.
