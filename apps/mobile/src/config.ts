declare const process: {env: Record<string, string | undefined>};

const publicSiteUrl = "https://health.sozorockfoundation.org";

function secureUrl(value: string | undefined, fallback = ""): string {
  const normalized = value?.trim().replace(/\/$/, "") ?? "";
  return normalized.startsWith("https://") ? normalized : fallback;
}

export const accessApiUrl = secureUrl(process.env.EXPO_PUBLIC_ACCESS_API_URL);
export const privacyUrl = secureUrl(
  process.env.EXPO_PUBLIC_PRIVACY_URL,
  `${publicSiteUrl}/privacy`,
);

export type LiveVoiceProviderAlias = "openai-realtime" | "gpt-live";

function liveVoiceProviderAlias(value: string | undefined): LiveVoiceProviderAlias {
  return value?.trim().toLowerCase() === "openai-realtime" ? "openai-realtime" : "gpt-live";
}

const liveVoiceSessionUrl = secureUrl(
  process.env.EXPO_PUBLIC_LIVE_VOICE_SESSION_URL,
);

export const mobileFeatures = {
  deviceSpeech: process.env.EXPO_PUBLIC_DEVICE_SPEECH !== "false",
  liveVoice:
    process.env.EXPO_PUBLIC_LIVE_VOICE_ENABLED === "true" &&
    Boolean(liveVoiceSessionUrl),
  liveVoiceSessionUrl,
  liveVoiceProviderAlias: liveVoiceProviderAlias(
    process.env.EXPO_PUBLIC_VOICE_PROVIDER_ALIAS,
  ),
} as const;

export type LiveVoiceReadiness = "disabled" | "missing-session-service" | "ready";

export function getLiveVoiceReadiness(): LiveVoiceReadiness {
  if (process.env.EXPO_PUBLIC_LIVE_VOICE_ENABLED !== "true") return "disabled";
  return mobileFeatures.liveVoice ? "ready" : "missing-session-service";
}
