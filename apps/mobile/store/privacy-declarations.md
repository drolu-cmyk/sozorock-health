# Mobile privacy and store declarations — version 1.0.0

This inventory must be reconciled against the signed binary, production API logs, and current store questionnaires before submission. It is a release record, not legal advice.

## Runtime permissions

| Permission | User-visible purpose | Trigger | Required for core use |
| --- | --- | --- | --- |
| Microphone | Capture speech after the resident chooses voice input | Resident taps the voice-input control | No |
| Speech recognition | Convert the resident's chosen spoken input to text | Resident taps the voice-input control | No |

The app does not request contacts, camera, photos, precise or background location, Bluetooth, calendar, motion, health records, payment, or advertising permissions.

## Data inventory when the production access API is enabled

| Data | Source | Purpose | Linked to identity | App retention |
| --- | --- | --- | --- | --- |
| Five-digit ZIP or entered hub reference | Resident | Record where non-clinical readiness is being requested | No account identity | Scheduled for deletion after 30 days |
| Selected readiness/support pathway | Resident | Record the type of non-clinical readiness requested | No account identity | Scheduled for deletion after 30 days |
| Interface language | App choice | Return and measure language-appropriate support | No account identity | Scheduled for deletion after 30 days |
| Versioned consent record | Resident action/app | Demonstrate that the resident accepted the applicable privacy notice | No account identity | Scheduled for deletion after 30 days |
| Voice transcript | Device speech service | Show the resident what device speech recognized; not sent to the access API | No account identity | Transient interface state; cleared on privacy reset |
| Salted network rate-limit key | API | Reliability, security, and abuse prevention | Not intentionally linked to a resident identity | Up to 2 hours |

Do not collect medical history, symptoms, diagnosis, treatment information, medication information, insurance identifiers, account credentials, government identifiers, contacts, or precise location in this release.

## Apple App Privacy answer basis

- **Tracking:** No.
- **Third-party advertising:** No.
- **Data used for app functionality:** coarse location represented by a voluntarily entered ZIP; other user content represented by the support selection and optional transcript; app interactions or diagnostics only if production telemetry actually records them.
- **Linked to the user:** No account exists in version 1.0.0. Confirm that infrastructure logs do not create an identity link before answering.
- **Audio data:** the app does not store an audio recording. Confirm the current Apple definition and the behavior of the system speech service before the final answer.

## Google Play Data safety answer basis

- **Data shared:** No sale, advertising, or unrelated third-party sharing. Reconcile cloud processors used for app functionality under the current Play definition.
- **Data collected:** approximate location if ZIP is transmitted; other user-generated content for pathway selections/transcripts; app activity or diagnostics only if the production service records them.
- **Encryption in transit:** Yes. The app rejects non-HTTPS production endpoint values.
- **Deletion request:** Direct requests to `contact@sozorockfoundation.org` and the process stated in the public privacy notice.
- **Account deletion:** Not applicable because version 1.0.0 has no resident account.
- **Ads:** No.

## Change gate for live conversational voice

Before enabling live conversational voice in a submitted binary, re-review the microphone purpose text, prominent consent, audio/transcript handling, retention, deletion, AI subprocessors, Apple App Privacy answers, Google Data safety answers, privacy notice, and reviewer notes. The app must continue to provide a complete tap-and-type alternative.
