import { LegalPage } from "../components/LegalPage";
import { createLegalMetadata } from "../lib/legal-metadata";

export const metadata = createLegalMetadata({
  title: "Accessibility",
  description:
    "SozoRock Health accessibility commitment and accommodation contact.",
  path: "/accessibility",
});

export default function AccessibilityPage() {
  return (
    <LegalPage eyebrow="Our commitment" title="Accessibility" updated="July 11, 2026">
      <h2>Our accessibility goal</h2>
      <p>SozoRock Health works toward conformance with the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA across its public digital experiences. Accessibility is part of design, writing, development, testing, and ongoing maintenance.</p>
      <h2>What we are working to provide</h2>
      <p>Our goal is a website that supports keyboard navigation, visible focus, meaningful headings and labels, sufficient color contrast, text resizing and reflow, screen readers, reduced-motion preferences, captions and transcripts, understandable errors, and touch targets that work across mobile, tablet, and desktop.</p>
      <h2>Voice is a choice</h2>
      <p>Voice Access begins only after a person chooses the microphone and reviews the notice. Tap and text pathways remain available. A person does not need to use voice to read core information, contact the organization, or request an accommodation.</p>
      <h2>Known limits and continuous improvement</h2>
      <p>Some third-party services, linked documents, maps, or older publication files may not yet provide the same level of accessibility as the main website. We review essential journeys with automated checks and manual keyboard, screen-reader, zoom, reflow, and responsive testing. We prioritize barriers that prevent someone from understanding information or completing a task.</p>
      <h2>Request an accessible format or report a barrier</h2>
      <p>Email <a href="mailto:contact@sozorockfoundation.org">contact@sozorockfoundation.org</a>. Include the page or document, the task you were trying to complete, the barrier you encountered, and the accessible format or accommodation that would help. Device and assistive-technology details are helpful but optional. We will acknowledge the request and work toward a reasonable response.</p>
      <h2>Formal concerns</h2>
      <p>If an accessibility concern is not resolved through the contact above, reply to the same email thread and ask that it be reviewed by The SozoRock Foundation, Inc. Accessibility requests do not require disclosure of a diagnosis or medical information.</p>
    </LegalPage>
  );
}
