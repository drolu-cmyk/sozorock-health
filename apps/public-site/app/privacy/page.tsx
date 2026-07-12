import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";

export const metadata: Metadata = { title: "Privacy notice", description: "How SozoRock Health handles information across its public website and non-clinical readiness experiences." };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Public policy" title="Privacy notice" updated="July 11, 2026">
      <h2>Our approach</h2>
      <p>SozoRock Health is an initiative of The SozoRock Foundation Inc. We collect only the information reasonably needed to respond to a request, provide a feature a person chooses, protect our services, or understand whether public information is useful. This website is not a place to submit medical records, diagnoses, insurance identifiers, or urgent health information.</p>
      <h2>Information you choose to provide</h2>
      <p>A contact, partnership, volunteer, or publication-access request may include your name, email address, organization, role or sector, location, reason for interest, message, and the consent choices shown on the form. We use this information to fulfill the request, communicate with you, prevent misuse, and maintain an appropriate record of the interaction. Receiving future publication updates is optional and is not a condition of accessing a requested publication.</p>
      <h2>Resident Access Layer and mobile app</h2>
      <p>When you choose to send a non-clinical readiness request from the mobile app or a shared tablet, we receive only the journey you selected, a ZIP code or Health Equity Hub reference, the non-clinical support option you selected, the interface language, whether the request came from the mobile or kiosk experience, and the consent record shown before submission. We do not ask for your name, email address, medical history, symptoms, diagnosis, treatment information, insurance details, or other protected health information in this flow. Sending a request does not create a provider relationship, confirm eligibility, or connect you to a licensed provider.</p>
      <h2>Website and security information</h2>
      <p>Our hosting and security services may process limited technical information such as the date and time of a request, browser or device type, requested page, referring page, and network address. We use this information to operate the website, diagnose errors, measure general use, and protect against automated abuse. Rate-limiting records use a one-way representation of a network address rather than storing it with the inquiry.</p>
      <h2>Voice Access</h2>
      <p>Microphone access begins only after you review the voice notice and agree. In the current mobile app, speech recognition is performed through the speech service available on the Apple or Android device, which may process the audio under Apple&apos;s, Google&apos;s, or the device provider&apos;s terms. SozoRock Health does not send that device-speech transcript to its access-request API or store it with a request. When a future live voice option is enabled, the notice shown before the session will identify the voice-service provider and applicable processing terms. Do not share medical records or protected health information. You can stop a session at any time, and text or tap options remain available. SozoRock Health does not intentionally record or retain raw microphone audio.</p>
      <h2>How information is shared</h2>
      <p>We may share information with service providers that operate the website, protect it, deliver requested email, or support an approved feature. They may use the information only to provide those services under appropriate safeguards. We may also disclose information when required by law, to protect people or our services, or as part of an organizational transaction permitted by law. We do not sell personal information or use it for behavioral advertising.</p>
      <h2>Retention and security</h2>
      <p>Contact inquiries are scheduled for deletion after one year unless they become part of an active relationship or a longer period is required by law. Resident Access Layer requests and their consent records are scheduled for deletion after 30 days. Their short-lived abuse-prevention records use a salted, one-way representation of a network address and expire separately; the network address is not stored with the request. Publication-access requests, consent records, and related activity records are scheduled for deletion after 180 days. Verification links expire after 30 minutes and secure access sessions after 12 hours. We use administrative, technical, and organizational safeguards appropriate to the information, but no internet service can guarantee absolute security.</p>
      <h2>County-Based Community Access Platform</h2>
      <p>The County-Based Community Access Platform (CB-CAP) is designed to keep individual-facing support separate from county-level systems intelligence. Dashboard views and reports use aggregated, de-identified pathway information. Small groups are withheld when the approved privacy threshold is not met. CB-CAP is not intended to expose individual-level protected health information.</p>
      <h2>Children and external services</h2>
      <p>This public website is intended for a general audience and is not designed to collect personal information directly from children under 13. Links to provider, public-agency, social-media, and other external services lead to sites with their own privacy practices.</p>
      <h2>Your choices</h2>
      <p>You may ask to access, correct, or delete information you submitted, or withdraw an optional communications choice, subject to identity verification and legal, security, and operational obligations. Email <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a> and describe your request. We may update this notice as the service changes and will post the revision date on this page.</p>
    </LegalPage>
  );
}
