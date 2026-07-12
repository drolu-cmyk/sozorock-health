import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_REALTIME_MODEL, resolveVoiceRuntime } from "../app/lib/voice-runtime.ts";

test("uses the deployed Realtime model by default", () => {
  assert.deepEqual(resolveVoiceRuntime({}), {
    requestedAlias: "openai-realtime",
    activeAlias: "openai-realtime",
    model: DEFAULT_REALTIME_MODEL,
    usedFallback: false,
  });
});

test("keeps GPT-Live behind an explicit model assignment", () => {
  assert.deepEqual(resolveVoiceRuntime({ VOICE_PROVIDER_ALIAS: "gpt-live" }), {
    requestedAlias: "gpt-live",
    activeAlias: "openai-realtime",
    model: DEFAULT_REALTIME_MODEL,
    usedFallback: true,
  });
});

test("activates GPT-Live only when an actual API model is configured", () => {
  assert.deepEqual(
    resolveVoiceRuntime({
      VOICE_PROVIDER_ALIAS: "gpt-live",
      OPENAI_GPT_LIVE_MODEL: "configured-value",
    }),
    {
      requestedAlias: "gpt-live",
      activeAlias: "gpt-live",
      model: "configured-value",
      usedFallback: false,
    },
  );
});

test("accepts an account-approved Realtime fallback override", () => {
  assert.equal(
    resolveVoiceRuntime({ OPENAI_REALTIME_MODEL: "configured-value" }).model,
    "configured-value",
  );
});
