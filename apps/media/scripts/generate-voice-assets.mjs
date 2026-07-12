import {createHash} from "node:crypto";
import {readFileSync, mkdirSync, writeFileSync, existsSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const mediaRoot = resolve(here, "..");
const repoRoot = resolve(mediaRoot, "..", "..");
const campaignPath = join(mediaRoot, "gpt-live-campaign", "campaign.json");
const campaignBuffer = readFileSync(campaignPath);
const campaign = JSON.parse(campaignBuffer.toString("utf8"));
const campaignSha256 = createHash("sha256").update(campaignBuffer).digest("hex");
const envPath = join(repoRoot, ".env.local");

const parseEnv = (source) => Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return [];
  return [[match[1], match[2].trim().replace(/^['"]|['"]$/g, "")]];
}));

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
const apiKey = process.env.OPENAI_API_KEY ?? env.OPENAI_API_KEY;
if (!apiKey) throw new Error("OPENAI_API_KEY is required in the environment or repository .env.local");

const publicDir = join(mediaRoot, "public", "gpt-live-campaign");
mkdirSync(publicDir, {recursive: true});

const directions = {
  resident: "A natural adult resident speaking conversationally: thoughtful and slightly uncertain, never distressed. Preserve hesitations and self-correction. Sound spontaneous, grounded, and human—not performed or promotional.",
  guide: "A warm, calm, perceptive voice guide. Use relaxed professional pacing, brief active-listening acknowledgements, and natural pauses. Sound attentive and human, never theatrical, sentimental, clinical, or promotional.",
  narrator: "Warm, assured, thoughtful closing narration. Measured and conversational with a quiet sense of purpose. Avoid advertising cadence and exaggerated enthusiasm."
};

const generated = [];

for (const [locale, localeData] of Object.entries(campaign.locales)) {
  for (const line of localeData.lines) {
    const target = join(publicDir, `${locale}-${line.id}-${line.speaker}.mp3`);
    const voice = line.speaker === "resident" ? campaign.production.residentVoice : campaign.production.guideVoice;
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json"},
      body: JSON.stringify({
        model: campaign.production.voiceModel,
        voice,
        input: line.text,
        instructions: `${directions[line.speaker]} Speak in ${localeData.language}.`,
        response_format: "mp3",
        speed: locale === "es" ? 1.08 : 1.04
      })
    });
    if (!response.ok) throw new Error(`${locale} ${line.id} failed: ${response.status} ${await response.text()}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    generated.push({
      target,
      buffer,
      record: {
        name: target.split(/[\\/]/).at(-1),
        locale,
        id: line.id,
        speaker: line.speaker,
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
  model: campaign.production.voiceModel,
  guideVoice: campaign.production.guideVoice,
  residentVoice: campaign.production.residentVoice,
  campaignSha256,
  disclosure: campaign.production.disclosure,
  files: generated.map((asset) => asset.record),
};
writeFileSync(join(publicDir, "PRODUCTION-METHOD.json"), JSON.stringify(productionMethod, null, 2));
writeFileSync(join(publicDir, "PRODUCTION-METHOD.txt"), [
  "SozoRock Health campaign voice production",
  `Model: ${campaign.production.voiceModel}`,
  `Guide/narrator voice: ${campaign.production.guideVoice}`,
  `Resident voice: ${campaign.production.residentVoice}`,
  campaign.production.disclosure,
  "Generated from the dedicated SozoRock Health OpenAI project credential. No API key is stored in this folder."
].join("\n"));
