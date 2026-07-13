import { LegalPage } from "../components/LegalPage";
import { createLegalMetadata } from "../lib/legal-metadata";

export const metadata = createLegalMetadata({
  title: "Terms of use",
  description:
    "Terms governing the public use of SozoRock Health digital experiences.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Public policy" title="Terms of use" updated="July 11, 2026">
      <h2>About these terms</h2>
      <p>These terms apply to the public SozoRock Health website and related public digital experiences operated by The SozoRock Foundation, Inc. By using them, you agree to use them lawfully and consistently with these terms. If you do not agree, do not use the service.</p>
      <h2>Non-clinical purpose</h2>
      <p>SozoRock Health provides public education, access readiness, research, systems infrastructure, and practical pathway support. It is not a clinic, healthcare provider, or telehealth platform. It does not diagnose, triage symptoms, recommend treatment, prescribe medication, or create a provider-patient relationship.</p>
      <h2>Emergencies</h2>
      <p>Do not use this website or Voice Access for an emergency or to decide whether a situation is urgent. Call 911 or the appropriate local emergency service when immediate help is needed.</p>
      <h2>Provider-led services</h2>
      <p>Licensed providers and healthcare organizations retain responsibility for their clinical systems, records, compliance, professional judgment, telehealth tools, eligibility decisions, and patient care. A link, listing, or pathway does not constitute an endorsement, guarantee availability, or verify that a service is appropriate for a particular person.</p>
      <h2>Publications and planning information</h2>
      <p>Publications, maps, dashboards, and other planning materials are provided for public-interest education and systems learning. They are not medical, legal, financial, or regulatory advice. Data coverage, service availability, local readiness, and program details may change. Confirm consequential decisions with the responsible institution or qualified professional.</p>
      <h2>Responsible use</h2>
      <p>Do not bypass security controls; submit unlawful, harmful, or deceptive content; impersonate another person; probe the service without authorization; overload it; or use automated tools in a way that harms availability or other people&rsquo;s access. We may restrict access when reasonably necessary to protect people, information, or the service.</p>
      <h2>Intellectual property</h2>
      <p>Website content, publications, graphics, software, and marks are protected by applicable intellectual-property laws unless a specific item states otherwise. Access to a publication does not transfer ownership or grant permission to remove notices, republish the work, or use a mark. SozoRock is a registered trademark used in accordance with its applicable ownership and licensing arrangements.</p>
      <h2>External links and availability</h2>
      <p>External links are provided for convenience and do not place the linked service under our control. We may update, suspend, or discontinue website features, and we do not promise uninterrupted or error-free availability.</p>
      <h2>Changes</h2>
      <p>We may revise these terms when the website or applicable requirements change. The date above identifies the current version. Continued use after a revision means the revised terms apply to later use.</p>
    </LegalPage>
  );
}
