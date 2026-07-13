import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("the shared wordmark keeps the registered mark attached in header and footer", () => {
  const component = read("../app/components/LogoLockup.tsx");
  const styles = read("../app/globals.css");
  assert.match(component, /sozorock-wordmark-clean-v2\.png/);
  assert.match(component, /width=\{560\} height=\{140\}/);
  assert.match(component, /Inicio de SozoRock Health/);
  assert.match(component, /<sup aria-hidden="true">®<\/sup>/);
  assert.match(styles, /\.logo-lockup__name sup \{[\s\S]*?position: absolute;[\s\S]*?right: -1px;/);
});

test("both localized homepages include the accessible downloadable voice film", () => {
  const englishPage = read("../app/page.tsx");
  const spanishPage = read("../app/es/page.tsx");
  const film = read("../app/components/VoiceAccessFilm.tsx");
  assert.match(englishPage, /<VoiceAccessFilm \/>/);
  assert.match(spanishPage, /<VoiceAccessFilm locale="es" \/>/);
  assert.match(film, /controls/);
  assert.match(film, /playsInline/);
  assert.match(film, /preload="none"/);
  assert.match(film, /<track[\s\S]*?default[\s\S]*?kind="captions"/);
  assert.match(film, /-transcript\.txt/);
  assert.match(film, /download>/);
  assert.doesNotMatch(film, /autoPlay/);
});

test("video metadata and media publication remain localized and fail closed", () => {
  const layout = read("../app/layout.tsx");
  const englishPage = read("../app/page.tsx");
  const spanishPage = read("../app/es/page.tsx");
  const publisher = read("../../media/scripts/publish-web-assets.mjs");
  assert.doesNotMatch(layout, /"@type": "VideoObject"/);
  assert.match(englishPage, /"@type": "VideoObject"/);
  assert.match(englishPage, /sozorock-health-voice-access-english\.mp4/);
  assert.doesNotMatch(englishPage, /sozorock-health-voice-access-spanish\.mp4/);
  assert.match(spanishPage, /"@type": "VideoObject"/);
  assert.match(spanishPage, /sozorock-health-voice-access-spanish\.mp4/);
  assert.doesNotMatch(spanishPage, /sozorock-health-voice-access-english\.mp4/);
  assert.match(spanishPage, /twitter: \{/);
  assert.match(spanishPage, /siteName: "SozoRock Health"/);
  assert.match(spanishPage, /type: "website"/);
  assert.match(publisher, /assertCurrentReleaseApproval/);
  assert.match(publisher, /RELEASE-APPROVAL\.json/);
  assert.match(publisher, /PRODUCTION-METHOD\.json/);
  assert.match(publisher, /manifestFiles\.get/);
  assert.match(publisher, /renderLock/);
  assert.match(publisher, /publication-manifest\.json/);
});

test("published homepage media exists and matches its release manifest", () => {
  const mediaRoot = new URL("../public/media/voice-access/", import.meta.url);
  const manifestUrl = new URL("publication-manifest.json", mediaRoot);
  assert.equal(existsSync(manifestUrl), true, "publication-manifest.json must be generated before release");
  const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
  assert.equal(manifest.releaseApproved, true);
  assert.equal("interactionReference" in manifest, false, "public manifest must not expose production references");
  assert.equal("speechProduction" in manifest, false, "public manifest must not fingerprint the voice provider");
  assert.equal("disclosure" in manifest, false, "provider disclosure belongs in the private release record");
  assert.equal(manifest.files.length, 2);
  for (const file of manifest.files) {
    for (const name of [file.video, file.poster, file.captions, file.transcript]) {
      assert.equal(existsSync(new URL(name, mediaRoot)), true, `${name} must exist`);
    }
    const videoHash = createHash("sha256").update(readFileSync(new URL(file.video, mediaRoot))).digest("hex");
    const posterHash = createHash("sha256").update(readFileSync(new URL(file.poster, mediaRoot))).digest("hex");
    const captionsHash = createHash("sha256").update(readFileSync(new URL(file.captions, mediaRoot))).digest("hex");
    const transcriptHash = createHash("sha256").update(readFileSync(new URL(file.transcript, mediaRoot))).digest("hex");
    assert.equal(videoHash, file.videoSha256);
    assert.equal(posterHash, file.posterSha256);
    assert.equal(captionsHash, file.captionsSha256);
    assert.equal(transcriptHash, file.transcriptSha256);
  }
});
