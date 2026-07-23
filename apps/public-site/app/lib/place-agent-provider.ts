import { answerWithOpenAI } from "./place-agent-openai";

export type PlaceNarrativeRequest = {
  geoid: string;
  question: string;
};

export type PlaceNarrativeProvider = {
  id: string;
  generate(input: PlaceNarrativeRequest): ReturnType<typeof answerWithOpenAI>;
};

const openAiResponsesProvider: PlaceNarrativeProvider = {
  id: "openai-responses",
  generate: answerWithOpenAI,
};

export function configuredPlaceNarrativeProvider(): PlaceNarrativeProvider {
  const provider = process.env.PLACE_EVIDENCE_PROVIDER?.trim() || "openai-responses";
  if (provider !== openAiResponsesProvider.id) {
    throw new Error("The configured Place Intelligence provider is not approved.");
  }
  return openAiResponsesProvider;
}
