import { LegalPage } from "../components/LegalPage";
import { createLegalMetadata } from "../lib/legal-metadata";

export const metadata = createLegalMetadata({
  title: "Nondiscrimination",
  description: "The SozoRock Foundation Inc. nondiscrimination commitment for SozoRock Health public programs and digital experiences.",
  path: "/nondiscrimination",
});

export default function NondiscriminationPage() {
  return (
    <LegalPage eyebrow="Our commitment" title="Nondiscrimination" titleSize="compact" updated="July 11, 2026">
      <h2>Equal access and respectful participation</h2>
      <p>The SozoRock Foundation Inc. is committed to providing its programs, activities, and public digital experiences without unlawful discrimination. We welcome people from rural and underserved communities and the broader public with dignity and respect.</p>
      <h2>Protected characteristics</h2>
      <p>Consistent with applicable law, we do not discriminate on the basis of race, color, national origin, ethnicity, religion, sex, pregnancy, sexual orientation, gender identity or expression, age, disability, genetic information, veteran or military status, marital or familial status, or another characteristic protected by law.</p>
      <h2>Communication access and reasonable accommodation</h2>
      <p>We work to provide reasonable accommodations and meaningful access to public information. To request an accessible format, language support, or another accommodation, email <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>. Please describe the activity or information involved and the support requested. You do not need to disclose a diagnosis in a general request.</p>
      <h2>Clinical boundaries</h2>
      <p>SozoRock Health does not deliver clinical care. Any clinical service connected through an independent licensed provider remains governed by that provider&rsquo;s legal duties, professional scope, eligibility rules, and nondiscrimination obligations.</p>
      <h2>Report a concern</h2>
      <p>If you believe you experienced discrimination in a SozoRock Health program or public digital experience, email <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>. Include the date, the program or page involved, what happened, and a safe way to contact you. Do not send medical records or other unnecessary sensitive information. We will review the concern and respond as appropriate.</p>
      <h2>No retaliation</h2>
      <p>We do not permit retaliation against a person for raising a good-faith concern, requesting an accommodation, or participating in a review.</p>
    </LegalPage>
  );
}
