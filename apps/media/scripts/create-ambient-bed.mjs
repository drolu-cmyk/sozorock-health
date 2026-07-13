import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "public", "gpt-live-campaign", "ambient-bed.wav");
const sampleRate = 48000;
const durationSeconds = 80;
const frames = sampleRate * durationSeconds;
const channels = 2;
const bytesPerSample = 2;
const dataBytes = frames * channels * bytesPerSample;
const wav = Buffer.allocUnsafe(44 + dataBytes);

const writeAscii = (offset, value) => wav.write(value, offset, "ascii");
writeAscii(0, "RIFF");
wav.writeUInt32LE(36 + dataBytes, 4);
writeAscii(8, "WAVE");
writeAscii(12, "fmt ");
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(channels, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
wav.writeUInt16LE(channels * bytesPerSample, 32);
wav.writeUInt16LE(bytesPerSample * 8, 34);
writeAscii(36, "data");
wav.writeUInt32LE(dataBytes, 40);

const midiToHz = (note) => 440 * 2 ** ((note - 69) / 12);
const chords = [
  [48, 55, 59, 64],
  [45, 52, 55, 60],
  [41, 48, 52, 57],
  [43, 50, 55, 57],
];
const motif = [64, 67, 71, 67, 60, 64, 67, 64, 57, 60, 64, 60, 62, 67, 69, 67];
const noteStarts = motif.map((_, index) => index * 5 + (index % 3 === 1 ? 0.045 : index % 3 === 2 ? -0.025 : 0));
const phase = (frequency, time, offset = 0) => Math.sin(2 * Math.PI * frequency * time + offset);
const smoothstep = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};

for (let frame = 0; frame < frames; frame += 1) {
  const t = frame / sampleRate;
  const chordIndex = Math.floor(t / 10) % chords.length;
  const chordTime = t % 10;
  const chordEnvelope = smoothstep(chordTime / 2.4) * smoothstep((10 - chordTime) / 2.4);
  let padLeft = 0;
  let padRight = 0;

  for (let index = 0; index < chords[chordIndex].length; index += 1) {
    const frequency = midiToHz(chords[chordIndex][index]);
    const partial = phase(frequency, t, index * 0.31) + 0.22 * phase(frequency * 2, t, index * 0.47);
    padLeft += partial * (index % 2 === 0 ? 1 : 0.76);
    padRight += partial * (index % 2 === 1 ? 1 : 0.76);
  }

  let pluckLeft = 0;
  let pluckRight = 0;
  const noteIndex = Math.min(motif.length - 1, Math.floor(t / 5));
  const localNoteTime = t - noteStarts[noteIndex];
  if (localNoteTime >= 0 && localNoteTime < 3.2) {
    const frequency = midiToHz(motif[noteIndex]);
    const envelope = Math.exp(-localNoteTime * 1.42) * smoothstep(localNoteTime / 0.035);
    const pluck = (phase(frequency, localNoteTime) + 0.38 * phase(frequency * 2, localNoteTime, 0.21) + 0.12 * phase(frequency * 3, localNoteTime, 0.37)) * envelope;
    pluckLeft = pluck * (noteIndex % 2 === 0 ? 1 : 0.62);
    pluckRight = pluck * (noteIndex % 2 === 1 ? 1 : 0.62);
  }

  const programFade = smoothstep(t / 2.2) * smoothstep((durationSeconds - t) / 3.2);
  const lowPulse = phase(55, t) * (0.55 + 0.45 * Math.sin(Math.PI * chordTime / 10) ** 2);
  const left = programFade * (0.021 * chordEnvelope * padLeft + 0.038 * pluckLeft + 0.008 * lowPulse);
  const right = programFade * (0.021 * chordEnvelope * padRight + 0.038 * pluckRight + 0.008 * lowPulse);
  wav.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(left * 32767))), 44 + frame * 4);
  wav.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(right * 32767))), 46 + frame * 4);
}

mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, wav);
process.stdout.write(`created original 80-second 48 kHz stereo instrumental bed at ${output}\n`);
