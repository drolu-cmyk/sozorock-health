# SozoRock Health mobile release readiness

Status date: July 10, 2026

This checklist covers the Expo application in `apps/mobile` for iPhone, iPad, Android phones, and Android tablets. The public legal identity is **The SozoRock Foundation, Inc.** The app is a non-clinical access service; it does not diagnose, treat, prescribe, or replace emergency services.

## Current release status

| Area | Status | Evidence or remaining gate |
| --- | --- | --- |
| Responsive resident experience | Complete in code | Phone and tablet layouts; English and Spanish; care, hub, and language journeys |
| Accessibility implementation | Complete in code; device audit pending | Screen-reader roles and announcements, 48-point targets, text alternatives, non-color state indicators, reduced-motion detection, and AA contrast tokens |
| Device speech | Complete in code; physical-device QA pending | `expo-speech` provides text-to-speech and `expo-speech-recognition` provides permission-gated English/Spanish voice intake; visible controls remain the fallback |
| Live conversational voice | Adapter ready and credential-gated | Requires both `EXPO_PUBLIC_LIVE_VOICE_ENABLED=true` and a real `EXPO_PUBLIC_LIVE_VOICE_SESSION_URL`; enable only after the approved server-side Realtime session service is configured |
| Microphone access | Enabled by resident choice | iOS and Android permission copy is configured through the speech-recognition plugin. Permission is requested only when the resident taps the voice-input control |
| Access API | Adapter complete; endpoint-gated | Set `EXPO_PUBLIC_ACCESS_API_URL`. Without it, the app clearly retains selections on screen and does not claim submission |
| Loading, success, empty, offline/unconfigured, and error states | Complete in code | All states have distinct resident copy and recovery actions |
| Kiosk privacy reset | Complete in code | Resident selections and speech stop whenever the app leaves the active foreground |
| Store signing and submission | Credential-gated | Apple, Google, and Expo organization credentials are not stored in the repository |
| Store review | Human/store-gated | Apple and Google must approve the signed production binaries and declarations |

## Required owner activation

### 1. Accounts and legal authority

- [ ] Confirm an Expo organization owns the production EAS project and invite the release operator with build/submit access.
- [ ] Enroll **The SozoRock Foundation, Inc.** as the Apple Developer organization. Apple requires a legal entity, D-U-N-S number, binding authority, work-domain email, public website, and an Apple Account with two-factor authentication. The organization name becomes the App Store seller. [Apple enrollment requirements](https://developer.apple.com/help/account/membership/program-enrollment)
- [ ] Accept every current Apple Developer and App Store Connect agreement. Complete tax and banking sections if App Store Connect requires them, even when the app is free.
- [ ] Create or verify the Google Play Console organization account for **The SozoRock Foundation, Inc.**, complete organization identity verification, accept the Developer Distribution Agreement, and add the release operator.
- [ ] Confirm `org.sozorockfoundation.health` is unused and approved in both stores. Do not change it after the first release.

### 2. Credentials and signing

- [ ] Create the Expo project and add its `extra.eas.projectId` and `owner` to `apps/mobile/app.json` using `npx eas-cli@latest init`.
- [ ] Create a repository/CI secret named `EXPO_TOKEN` from a scoped Expo access token; never commit the token.
- [ ] Apple: allow EAS to generate/manage the iOS distribution certificate and provisioning profile, or upload the organization-controlled credentials with `npx eas-cli@latest credentials --platform ios`.
- [ ] Apple automated submission: create an App Store Connect API key with the minimum required App Manager access; securely provide its Key ID, Issuer ID, and `.p8` private key to EAS/CI.
- [ ] Google: allow EAS to generate/manage the Android upload keystore or upload the existing production keystore with `npx eas-cli@latest credentials --platform android`. Archive the keystore and passwords in the Foundation password vault.
- [ ] Google automated submission: create a Google Cloud service account, grant it the required Play Console app permissions, and upload its JSON key to EAS. Do not commit the JSON file.
- [ ] Turn on Google Play App Signing and preserve the upload-key recovery contacts.

EAS can generate and securely manage Android keystores, iOS distribution certificates, and provisioning profiles; store binaries must be signed. [Expo build setup](https://docs.expo.dev/build/setup/) and [Expo signing credentials](https://docs.expo.dev/app-signing/app-credentials/)

### 3. Production configuration

Create the following EAS **production** environment variables:

| Variable | Required value/owner |
| --- | --- |
| `EXPO_PUBLIC_ACCESS_API_URL` | Production HTTPS access API; Security/Engineering approval required |
| `EXPO_PUBLIC_PRIVACY_URL` | Public, mobile-specific privacy notice on an active HTTPS URL |
| `EXPO_PUBLIC_DEVICE_SPEECH` | `true` for device TTS; verify English and Spanish voices on release devices |
| `EXPO_PUBLIC_LIVE_VOICE_ENABLED` | Keep `false` until microphone, session service, consent, retention, and store disclosures pass review |
| `EXPO_PUBLIC_LIVE_VOICE_SESSION_URL` | Leave unset until a short-lived-token session broker is deployed; never expose an AI provider key in the app |

- [ ] Confirm the access API enforces TLS, rate limits, schema validation, consent, state/provider readiness, and short retention.
- [ ] Confirm the API never treats ZIP code as precise location and never returns a provider who is not verified for the resident’s state.
- [ ] Publish the privacy notice and verify its in-app link on both platforms.
- [ ] Approve the final retention schedule and deletion/contact process at `contact@sozorockfoundation.org`.

### 4. Privacy and policy declarations

Current production payload, when the API is configured: journey type, resident-entered ZIP/hub reference, support selection, interface language, and source=`mobile`. The current app does **not** request contacts, photos, precise GPS, advertising ID, health records, microphone input, or payment information. Device TTS stays on the device. Validate actual backend logs and every included SDK before answering store forms.

- [ ] Apple App Privacy: declare any retained coarse location/ZIP, selections or other user content, and app interactions used for App Functionality. State whether each type is linked to identity; do not declare “Data Not Collected” if the production API retains it. Include all SDK practices. Apple requires these answers for new apps and updates. [Apple App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [ ] Google Data safety: declare the same transmitted/retained data, encryption in transit, deletion/request mechanism, required-versus-optional collection, and all SDK collection. Every published app must complete the form and provide a privacy policy, even if it collects no data. [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [ ] Complete Apple age rating, regulated medical device declaration, export compliance, accessibility nutrition labels, and review notes. State clearly that this is non-clinical access navigation.
- [ ] Complete Google ads declaration (`No`, unless this changes), target audience, content rating, app access/reviewer instructions, health-app declaration if presented, and permissions declarations.
- [ ] Legal/privacy counsel approves the resident consent text, privacy notice, state/provider licensure language, emergency language, and the store-form answers.
- [ ] If microphone/live voice is enabled later: add microphone permission descriptions, prominent consent, audio/transcript retention terms, deletion controls, AI-provider subprocessors, and revised Apple/Google declarations before shipping that build.

### 5. Store metadata for approval

Owner approval is required before upload.

| Field | Proposed value |
| --- | --- |
| App name | SozoRock Health |
| Apple subtitle | Access pathways, closer to home |
| Google short description | Find participating hubs and state-licensed provider access pathways. |
| Primary category | Health & Fitness |
| Secondary category | Medical only if store counsel confirms the non-clinical positioning is not misleading |
| Support email | contact@sozorockfoundation.org |
| Copyright | © 2026 The SozoRock Foundation, Inc. |
| Support URL | Public mobile support page; must be live before review |
| Privacy URL | Value of `EXPO_PUBLIC_PRIVACY_URL`; must be live before review |
| Review note | “SozoRock Health is a non-clinical access navigator. It does not diagnose, treat, prescribe, or provide emergency services. Provider availability is limited by verified state licensure and participation.” |

- [ ] Prepare full English and Spanish descriptions using only features present in the submitted binary.
- [ ] Prepare keyword/category choices without clinical outcome, “nationwide provider availability,” or AI-model claims that the binary cannot prove.
- [ ] Provide a working reviewer path. If any feature requires authentication, supply non-expiring review credentials and exact navigation instructions.

### 6. Required screenshots and graphics

Capture the real signed release build with no mock data claims, debug menus, personal notifications, or fake provider availability.

**Apple**

- [ ] Upload 1–10 iPhone screenshots. Use one accepted 6.9-inch portrait size, preferably `1320 × 2868`, or another current accepted 6.9-inch size.
- [ ] Because the app supports iPad, upload 13-inch iPad screenshots: `2064 × 2752` portrait or `2752 × 2064` landscape (Apple also accepts `2048 × 2732` / `2732 × 2048`).
- [ ] Provide localized screenshot sets for English and Spanish when screenshot text differs.
- [ ] Recommended sequence: welcome/voice readiness; three resident pathways; ZIP/state pathway; hub check-in; language support; transparent offline/error recovery; non-clinical/privacy boundary.

Apple requires 1–10 screenshots and current accepted device dimensions. [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)

**Google Play**

- [ ] Store icon: 32-bit PNG with alpha, `512 × 512`, at most 1024 KB.
- [ ] Feature graphic: JPEG or 24-bit PNG without alpha, exactly `1024 × 500`.
- [ ] Upload at least two phone screenshots; for merchandising eligibility provide at least four `1080 × 1920` portrait screenshots.
- [ ] For tablet/large-screen listing quality, provide at least four screenshots, 1080–7680 px, using 16:9 landscape or 9:16 portrait.
- [ ] Provide English and Spanish assets when added marketing text differs; include concise alt text for every Play graphic.

Google’s current asset rules require the listed icon, feature graphic, and screenshot formats. [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)

### 7. Device acceptance tests

- [ ] VoiceOver on current iPhone and iPad: logical order, labels, headings, checkbox state, live status, and no focus traps.
- [ ] TalkBack on current Android phone and 10-inch tablet: same coverage.
- [ ] Dynamic Type / largest system font and Android largest font: no clipped controls or inaccessible horizontal content.
- [ ] Switch Control/Voice Control and keyboard navigation on tablet.
- [ ] English and Spanish device voices: start, stop, interruption, missing-voice fallback, silent mode, and audio route changes.
- [ ] Portrait and landscape on supported tablets; small phone; large phone; split-view iPad.
- [ ] No API configured, airplane mode, poor network, API timeout, HTTP error, empty result, success, foreground/background, and kiosk reset.
- [ ] Verify ZIP validation, consent required state, licensure copy, emergency statement, and privacy URL.
- [ ] Verify the app collects no microphone data and requests no microphone permission in this release.
- [ ] Complete accessibility, privacy, security, and content review sign-offs; archive screenshots and results with the release.

### 8. Exact build and submission commands

Run from the repository root after all credential and configuration gates above are complete:

```powershell
npm ci
npm run typecheck --workspace @sozorock/mobile
npm run check:config --workspace @sozorock/mobile
Set-Location apps/mobile
npx expo-doctor
npx expo export --platform android --output-dir "$env:TEMP\sozorock-mobile-android-export"
npx eas-cli@latest whoami
npx eas-cli@latest project:info
npx eas-cli@latest credentials --platform ios
npx eas-cli@latest credentials --platform android
npx eas-cli@latest build --platform all --profile production --non-interactive
```

After TestFlight and Play internal-track acceptance passes:

```powershell
Set-Location apps/mobile
npx eas-cli@latest submit --platform ios --profile production --latest --non-interactive
npx eas-cli@latest submit --platform android --profile production --latest --non-interactive
```

EAS also supports `build --auto-submit`, but first release submission should remain a separate gated job so the exact signed binaries complete device, privacy, and store-metadata review before upload. EAS can automate later releases after this gate is proven. [Expo automated submissions](https://docs.expo.dev/build/automate-submissions/)

## Release definition of done

The mobile release is done only when:

1. Repository checks, Expo Doctor, Android export, EAS iOS build, and EAS Android App Bundle build pass from the same commit.
2. Physical iPhone, iPad, Android phone, and Android tablet acceptance tests pass.
3. Accessibility, privacy, security, legal, and content owners sign off against the shipped behavior.
4. Store metadata and screenshots show only working functionality.
5. Apple TestFlight and Google Play internal testing pass before production review.
6. Apple and Google approve the app, the production listings are live, and post-release install/smoke checks pass.
