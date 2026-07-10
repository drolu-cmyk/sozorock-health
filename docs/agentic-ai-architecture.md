# Agentic AI architecture

## Product rule

SozoRock Health is agentic access infrastructure. AI is not a chat widget; it is a governed set of agents that can interpret a resident's request, use approved tools, explain the next non-clinical step, and create an auditable operational handoff.

Every agent is constrained by role, state readiness, consent, language, feature controls, usage budgets, and the non-clinical boundary. No agent may diagnose, prescribe, triage, determine medical urgency, or override a licensed provider.

## Agent roles

| Agent | Job | Permitted tools |
| --- | --- | --- |
| Resident access agent | Clarify access need, language, hub preference, and next pathway. | County directory, approved hub registry, state-readiness lookup, provider-availability lookup, translation, session handoff. |
| Hub navigator agent | Help staff guide a resident through an access flow. | Session support, approved accessibility prompts, hub operating information, escalation workflow. |
| Provider readiness agent | Guide provider onboarding and surface missing verification requirements. | License-verification workflow, state-readiness configuration, BYOP connection setup, audit checklist. |
| CB-CAP intelligence agent | Explain protected aggregate patterns and prepare permitted reports. | Aggregated-query service, disclosure-control service, report generator, methodology library. |
| Operations agent | Help approved internal teams manage exceptions, incidents, flags, and readiness. | Feature-control service, approval queue, audit events, incident runbooks. |

## Voice and model strategy

The system uses a provider-neutral AI adapter. The preferred OpenAI path is:

- `gpt-realtime-2.1` or `gpt-realtime-1.5` for live speech-to-speech conversations;
- `gpt-realtime-translate` for controlled real-time translation;
- `gpt-realtime-whisper` when a low-latency transcript stream is required;
- a reasoning model through the Responses API for non-real-time orchestration, structured summaries, and tool calls.

GPT-5.6 is configured as an optional reasoning-orchestration provider only after the SozoRock Health account receives the required preview entitlement. The public model catalog currently identifies GPT-5.6 as trusted-partner preview and does not position it as the general voice endpoint. Voice remains operational from launch through the Realtime model adapter, without waiting for GPT-5.6 access.

### GPT-Live experience contract

`gpt-live` is the SozoRock Health capability name for the most natural, conversational voice experience. It is an environment-controlled alias, not a hard-coded vendor model string: production maps it to the highest approved realtime voice model available to the organization, initially `gpt-realtime-2.1` or `gpt-realtime-1.5`. This preserves the human quality of a live conversation while allowing an approved future GPT-Live or GPT-5.6 voice endpoint to be adopted without changing resident, hub, or provider flows.

## Voice safety contract

1. Get explicit microphone and voice-processing consent before a live session.
2. Show a persistent text transcript and a one-tap text-only fallback.
3. Label AI-facilitated communication clearly; never represent generated speech as a clinician.
4. Use server-issued ephemeral session credentials. Never embed a long-lived provider key in a mobile or web client.
5. Enforce per-organization, per-state, per-channel, and incident-level feature controls.
6. Log only the minimum operational metadata needed for security, quality, and consent audit; do not place unnecessary voice content in application logs.
7. Escalate emergency or clinical concerns to an approved, plain-language emergency notice and human/provider workflow rather than attempting clinical decision-making.

## Agent control plane

The backend owns the agent registry, prompt versions, tool schemas, evaluation cases, access policies, model allowlists, usage budgets, traces, audit events, and kill switches. Clients receive only an approved capability manifest.

No agent may call a provider platform, reveal CB-CAP results, generate a report, or change state readiness without a server-side authorization check and an auditable tool invocation.
