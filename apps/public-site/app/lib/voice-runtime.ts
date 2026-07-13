export const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";

export type VoiceProviderAlias = "openai-realtime" | "gpt-live";

type VoiceEnvironment = Record<string, string | undefined>;

export type VoiceRuntime = {
  requestedAlias: VoiceProviderAlias;
  activeAlias: VoiceProviderAlias;
  model: string;
  usedFallback: boolean;
};

function clean(value: string | undefined) {
  return value?.trim() || undefined;
}

function providerAlias(value: string | undefined): VoiceProviderAlias {
  return clean(value)?.toLowerCase() === "gpt-live" ? "gpt-live" : "openai-realtime";
}

export function isRealtimeVoiceEnabled(environment: VoiceEnvironment = process.env) {
  return clean(environment.OPENAI_REALTIME_ENABLED)?.toLowerCase() === "true";
}

/**
 * Resolve a server-side voice model without exposing vendor credentials or
 * inventing a GPT-Live API identifier. GPT-Live is available in ChatGPT today,
 * while OpenAI has announced that API access is coming later. Until an actual
 * API model identifier is assigned to OPENAI_GPT_LIVE_MODEL, this resolver
 * deliberately falls back to the currently deployed Realtime model.
 */
export function resolveVoiceRuntime(environment: VoiceEnvironment = process.env): VoiceRuntime {
  const requestedAlias = providerAlias(environment.VOICE_PROVIDER_ALIAS);
  const realtimeModel = clean(environment.OPENAI_REALTIME_MODEL) ?? DEFAULT_REALTIME_MODEL;
  const gptLiveModel = clean(environment.OPENAI_GPT_LIVE_MODEL);

  if (requestedAlias === "gpt-live" && gptLiveModel) {
    return {
      requestedAlias,
      activeAlias: "gpt-live",
      model: gptLiveModel,
      usedFallback: false,
    };
  }

  return {
    requestedAlias,
    activeAlias: "openai-realtime",
    model: realtimeModel,
    usedFallback: requestedAlias === "gpt-live",
  };
}
