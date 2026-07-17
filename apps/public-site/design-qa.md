# Public-site design QA

Reference: approved SozoRock Health homepage Option 1.

The release build was reviewed against the approved source in one side-by-side comparison at a 1440 × 1024 viewport. Mobile and tablet continuity were then checked at 390 × 844 and 768 × 1024.

- The full-bleed tablet photograph, deep directional scrim, Instrument Sans typography, warm paper, yellow signal action, restrained green, sharp geometry, section order, copy, and visual pacing match the approved direction.
- The registered symbol remains attached to `SozoRock` in the header and footer lockups. `Health` remains visually connected to the wordmark.
- The approved publication section now uses the existing front covers and the existing gated `Access publication` routes. Publication verification, download analytics, consent separation, and access controls were not replaced.
- The local place search accepts a ZIP Code, city, or county and uses the existing protected U.S. geography endpoint. Technical geography labels are not exposed in the approved interface.
- Mobile navigation opens with a 48 px control, reports `aria-expanded`, locks background scrolling, and closes with Escape.
- Voice examples and audience tabs update their content and accessible states. Every internal hash link resolves to an existing target.
- The 390 px, 768 px, and 1440 px checks report zero horizontal overflow. The production browser console reports zero warnings or errors.
- The approved source and release candidate share the same 649 px desktop hero boundary at the comparison viewport.

Final evidence is stored with the approved prototype QA frames, including `comparison-deploy-candidate-1440.jpg`, `deploy-qa-mobile-390-top.png`, and `deploy-qa-tablet-768-top.png`.

Result: passed.
