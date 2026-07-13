import {createHash} from "node:crypto";
import {readFileSync, mkdirSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {PollyClient, SynthesizeSpeechCommand} from "@aws-sdk/client-polly";

const here = dirname(fileURLToPath(import.meta.url));
const mediaRoot = resolve(here, "..");
const campaignPath = join(mediaRoot, "gpt-live-campaign", "campaign.json");
const campaignBuffer = readFileSync(campaignPath);
const campaign = JSON.parse(campaignBuffer.toString("utf8"));
const campaignSha256 = createHash("sha256").update(campaignBuffer).digest("hex");
const publicDir = join(mediaRoot, "public", "gpt-live-campaign");

mkdirSync(publicDir, {recursive: true});

if (campaign.production.voiceProvider !== "amazon-polly") {
  throw new Error(`Unsupported campaign voice provider: ${campaign.production.voiceProvider}`);
}

const polly = new PollyClient({region: campaign.production.region});

const synthesize = async ({locale, speaker, text}) => {
  const voiceConfig = campaign.production.voices[locale];
  if (!voiceConfig) throw new Error(`Missing voice configuration for ${locale}.`);
  const VoiceId = voiceConfig[speaker];
  if (!VoiceId) throw new Error(`Missing ${speaker} voice for ${locale}.`);

  const result = await polly.send(new SynthesizeSpeechCommand({
    Engine: campaign.production.voiceModel,
    LanguageCode: voiceConfig.languageCode,
    OutputFormat: "mp3",
    SampleRate: "24000",
    Text: text,
    TextType: "text",
    VoiceId,
  }));

  if (!result.AudioStream) throw new Error(`${locale} ${speaker} returned no audio stream.`);

  return {
    buffer: Buffer.from(await result.AudioStream.transformToByteArray()),
    VoiceId,
    languageCode: voiceConfig.languageCode,
  };
};

const generated = [];

for (const [locale, localeData] of Object.entries(campaign.locales)) {
  for (const line of localeData.lines) {
    const target = join(publicDir, `${locale}-${line.id}-${line.speaker}.mp3`);
    const {buffer, VoiceId, languageCode} = await synthesize({locale, speaker: line.speaker, text: line.text});

    generated.push({
      target,
      buffer,
      record: {
        name: target.split(/[\\/]/).at(-1),
        locale,
        id: line.id,
        speaker: line.speaker,
        voice: VoiceId,
        languageCode,
        text: line.text,
        sha256: createHash("sha256").update(buffer).digest("hex"),
      },
    });
  }
}

for (const asset of generated) {
  writeFileSync(asset.target, asset.buffer);
  process.stdout.write(`generated ${asset.target}\n`);
}

const productionMethod = {
  generatedAt: new Date().toISOString(),
  provider: campaign.production.voiceProvider,
  model: campaign.production.voiceModel,
  region: campaign.production.region,
  voices: campaign.production.voices,
  campaignSha256,
  disclosure: campaign.production.disclosure,
  files: generated.map((asset) => asset.record),
};

writeFileSync(join(publicDir, "PRODUCTION-METHOD.json"), JSON.stringify(productionMethod, null, 2));
writeFileSync(join(publicDir, "PRODUCTION-METHOD.txt"), [
  "SozoRock Health campaign voice production",
  `Provider: ${campaign.production.voiceProvider}`,
  `Model: ${campaign.production.voiceModel}`,
  `English voices: guide/narrator ${campaign.production.voices.en.guide}; resident ${campaign.production.voices.en.resident}`,
  `Spanish voices: guide/narrator ${campaign.production.voices.es.guide}; resident ${campaign.production.voices.es.resident}`,
  campaign.production.disclosure,
  "Generated with the dedicated SozoRock Health AWS deployment identity. No credential is stored in this folder.",
].join("\n"));
