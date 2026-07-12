# Mobile release audit — July 11, 2026

Commit/branch at audit time: `redesign/option-2-release` (shared release worktree).

## Verified locally

| Check | Result |
| --- | --- |
| Mobile TypeScript | Passed |
| Expo public configuration | Passed; version 1.0.0, iOS/iPad and Android identifiers are `org.sozorockfoundation.health` |
| Expo Doctor | Passed 20/20 checks |
| Android production export | Passed; Hermes bundle and metadata generated |
| iOS production export | Passed; Hermes bundle and metadata generated |
| Mobile ESLint | Passed with zero warnings |
| App icon | 1024 × 1024 PNG, opaque RGB |
| Dynamic EAS linkage | Passed with validation owner/project values; real production values remain absent |
| Mobile release workflow YAML | Parsed successfully |
| Fail-closed release environment gate | Passed for build-only mode; store submission is blocked until the HTTPS access API exists; enabling live voice also requires an HTTPS session URL |

## External release gate

Signed EAS builds and store submissions could not start because the release environment has no Expo authentication or project linkage:

- `eas whoami` returned `Not logged in`.
- `eas project:info` required an Expo account.
- iOS and Android credential inspection both stopped at the Expo login prompt.
- GitHub's production environment contains no `EXPO_TOKEN` secret and no `EXPO_OWNER` or `EXPO_PROJECT_ID` variables.
- Apple App Store Connect and Google Play credentials cannot be inspected or used until the authorized Expo account is connected.

No build URL, EAS build ID, App Store Connect submission ID, or Google Play submission ID exists yet. This is an external account/credential gate, not a source-build failure.

## Exact activation path

1. From the authorized Expo organization, create/link `sozorock-health` and record its owner and project UUID.
2. Add `EXPO_TOKEN` as a GitHub **production environment secret**.
3. Add `EXPO_OWNER` and `EXPO_PROJECT_ID` as GitHub **production environment variables**.
4. Configure EAS-managed iOS distribution/provisioning credentials and an App Store Connect API key for the Foundation's Apple organization.
5. Configure the Android upload key and Play Console service-account credential in EAS for the Foundation's Google organization.
6. Complete the App Store Connect and Play Console app records for `org.sozorockfoundation.health`, including agreements, privacy declarations, reviewer details, and approved screenshots.
7. Dispatch **Mobile Store Release** with `internal`, complete TestFlight/Play internal acceptance, then dispatch with `production` for store review.

The workflow will rerun TypeScript, Expo configuration, Expo Doctor, both platform exports, signed builds, artifact recording, and the selected submission path.
