const submit = process.argv.includes("--submit");
const failures = [];

const isHttps = value => typeof value === "string" && value.trim().startsWith("https://");
const accessApiUrl = process.env.EXPO_PUBLIC_ACCESS_API_URL;
const privacyUrl = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://health.sozorockfoundation.org/privacy";
const liveVoiceEnabled = process.env.EXPO_PUBLIC_LIVE_VOICE_ENABLED === "true";
const liveVoiceSessionUrl = process.env.EXPO_PUBLIC_LIVE_VOICE_SESSION_URL;

if (!isHttps(privacyUrl)) {
  failures.push("EXPO_PUBLIC_PRIVACY_URL must be an HTTPS URL.");
}

if (accessApiUrl && !isHttps(accessApiUrl)) {
  failures.push("EXPO_PUBLIC_ACCESS_API_URL must be an HTTPS URL when configured.");
}

if (submit && !isHttps(accessApiUrl)) {
  failures.push("Store submission requires EXPO_PUBLIC_ACCESS_API_URL so the app does not ship in retained-on-device mode.");
}

if (liveVoiceEnabled && !isHttps(liveVoiceSessionUrl)) {
  failures.push("Live voice cannot be enabled without an HTTPS EXPO_PUBLIC_LIVE_VOICE_SESSION_URL.");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`Release gate: ${failure}`);
  process.exit(1);
}

console.log(`Mobile release environment valid for ${submit ? "store submission" : "build validation"}.`);
