# Store review notes

## Product boundary

SozoRock Health is a non-clinical readiness and support-pathway application. It is not a clinic, healthcare provider, telehealth platform, medical device, symptom checker, or emergency service. It does not diagnose, treat, prescribe, triage symptoms, or make clinical decisions. Provider-led services remain within the licensed professional's own platform, credentials, records, compliance processes, and scope of practice.

## Reviewer path

No account or login is required for version 1.0.0.

1. Open the app and choose English or Spanish.
2. Tap **Speak your answer** to review the permission-gated speech-recognition path, or continue with the visible controls.
3. Choose one of the three resident pathways.
4. Enter a five-digit ZIP code, hub reference, or language-support option as prompted.
5. Read and accept the non-clinical consent statement.
6. Submit to view the configured result, no-results, retained-on-device, or recovery state.
7. Use **Privacy and data use** to open the public privacy notice.

The app always provides a tap-and-type alternative. Denying microphone or speech-recognition permission does not block the core journey.

## Voice behavior in version 1.0.0

The microphone is requested only after the resident taps the voice-input control. The device speech service returns text to the app. The app does not create or retain an audio recording. The transcript remains in transient interface state and is cleared by the kiosk privacy reset when the app leaves the active foreground.

Live conversational voice remains disabled unless a production HTTPS session broker and the corresponding feature flag are both configured. A provider API key is never embedded in the app.

## Test and production configuration

- Bundle ID / package: `org.sozorockfoundation.health`
- Default privacy URL: `https://health.sozorockfoundation.org/privacy`
- Production endpoints must use HTTPS.
- Version 1.0.0 does not use advertising, payments, contacts, photos, precise GPS, health records, or an advertising identifier.
- If the access API is not configured, the app says that the resident's selections remain on the device; it does not claim that a request was sent.

Contact for review: contact@sozorockfoundation.org

