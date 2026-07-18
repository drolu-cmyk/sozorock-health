import assert from "node:assert/strict";
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

test("the rejected Voice Access film is absent from both localized homepages and public media", () => {
  const englishPage = read("../app/page.tsx");
  const spanishPage = read("../app/es/page.tsx");
  assert.doesNotMatch(englishPage, /VoiceAccessFilm|media\/voice-access|"@type": "VideoObject"/);
  assert.doesNotMatch(spanishPage, /VoiceAccessFilm|media\/voice-access|"@type": "VideoObject"/);
  assert.equal(existsSync(new URL("../app/components/VoiceAccessFilm.tsx", import.meta.url)), false);
  assert.equal(existsSync(new URL("../public/media/voice-access/", import.meta.url)), false);
});

test("future media publication remains fail closed while ordinary page metadata stays localized", () => {
  const layout = read("../app/layout.tsx");
  const spanishPage = read("../app/es/page.tsx");
  const publisher = read("../../media/scripts/publish-web-assets.mjs");
  assert.doesNotMatch(layout, /"@type": "VideoObject"/);
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

test("the approved marketing homepage and publication access remain locked together", () => {
  const page = read("../app/page.tsx");
  const homepage = read("../app/components/ApprovedMarketingHome.jsx");
  const approvedBrand = read("../app/components/ApprovedBrandLockup.jsx");
  const locationSearch = read("../app/components/ApprovedLocationSearch.tsx");
  const locationRoute = read("../app/api/locations/route.ts");
  const contactForm = read("../app/components/ContactForm.tsx");
  const contactPage = read("../app/contact/page.tsx");
  const publicationSection = read("../app/components/ApprovedPublications.tsx");
  const styles = read("../app/approved-home.css");

  assert.match(page, /<ApprovedMarketingHome \/>/);
  assert.match(homepage, /A clearer path to <span>Care<\/span> that already exists\./);
  assert.match(homepage, /Care\. For every ZIP Code\./);
  assert.match(approvedBrand, /SozoRock<sup aria-label="registered trademark">®<\/sup>/);
  assert.doesNotMatch(homepage, /Nonprofit health-equity systems infrastructure/);
  assert.match(homepage, /appointment-distance\.webp/);
  assert.match(homepage, /history\.replaceState/);
  assert.match(homepage, /instagram\.com\/srockfoundation/);
  assert.match(homepage, /youtube\.com\/@srockfoundation/);
  assert.match(homepage, /x\.com\/srockfoundation/);
  assert.match(locationSearch, /replace\(\/\^ZIP\\s\+\/i, ""\)/);
  assert.match(locationSearch, /selected\?\.display === query/);
  assert.match(locationSearch, /place-result/);
  assert.match(locationSearch, /Start a local conversation/);
  assert.match(contactForm, /defaultValue=\{initialLocation\}/);
  assert.match(contactPage, /initialLocation=\{initialLocation\}/);
  assert.match(homepage, /hero-community-desktop-v2\.webp/);
  assert.match(homepage, /hero-community-mobile-v2\.webp/);
  assert.match(homepage, /portal-barrier-v2\.webp/);
  assert.match(locationRoute, /replace\(\/\\s\+COUNTY\$\/, ""\)/);
  assert.match(locationRoute, /label: String\(attributes\.ZCTA5/);
  assert.match(contactForm, /CB-CAP inquiry/);
  assert.match(contactForm, /Media inquiry/);
  assert.match(publicationSection, /publication\.cover/);
  assert.match(publicationSection, /href=\{`\/publications\/\$\{publication\.slug\}`\}/);
  assert.match(publicationSection, /Access publication/);
  assert.match(styles, /\.approved-home \.hero-scrim/);
  assert.match(styles, /\.approved-home \.publication-cover/);
});
