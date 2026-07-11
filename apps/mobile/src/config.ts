declare const process: {env: Record<string, string | undefined>};

export const accessApiUrl = process.env.EXPO_PUBLIC_ACCESS_API_URL?.replace(/\/$/, "") ?? "";
export const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "";

export const mobileFeatures = {
  deviceSpeech: process.env.EXPO_PUBLIC_DEVICE_SPEECH !== "false",
  liveVoice:
    process.env.EXPO_PUBLIC_LIVE_VOICE_ENABLED === "true" &&
    Boolean(process.env.EXPO_PUBLIC_LIVE_VOICE_SESSION_URL),
  liveVoiceSessionUrl: process.env.EXPO_PUBLIC_LIVE_VOICE_SESSION_URL ?? "",
} as const;

export type LiveVoiceReadiness = "disabled" | "missing-session-service" | "ready";

export function getLiveVoiceReadiness(): LiveVoiceReadiness {
  if (process.env.EXPO_PUBLIC_LIVE_VOICE_ENABLED !== "true") return "disabled";
  return mobileFeatures.liveVoice ? "ready" : "missing-session-service";
}
