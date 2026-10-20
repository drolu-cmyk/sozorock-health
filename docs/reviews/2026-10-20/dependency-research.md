# Remaining Health dependency advisories — 2026-10-20

No vendor-supported, published fix was found for either remaining package. The current registry releases are `braces@3.0.3` and `node-forge@1.4.0`; both GitHub advisories have `first_patched_version: null` and `withdrawn_at: null`. Local backports could be evaluated as additional protection, but authentic package identities remain within the advisory ranges and an unchanged npm audit gate remains blocked. This research did not modify the repository, install packages, apply patches, or run security regression tests.

| Package | Active advisory | Affected range | Registry latest | Supported upgrade found |
| --- | --- | --- | --- | --- |
| braces | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), CVE-2026-93687 | <=3.0.3 | 3.0.3 | No |
| node-forge | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), CVE-2026-85393 | <=1.4.0 | 1.4.0 | No |

Registry verification used read-only `npm view` and the official `/latest` registry endpoints. GitHub API responses for both advisories and selected upstream PRs are preserved beside this report; see `DEPENDENCY-SOURCES.json` for hashes and URLs.

## braces

[Upstream issue #70](https://github.com/micromatch/braces/issues/70) reports recursive AST processing exceeding the JavaScript stack under the default input-length ceiling. The maintainer disputes the security classification and recommends handling exceptions and restricting untrusted patterns, including use of the existing `maxLength` option. These are application-boundary mitigations, not a newly published library fix. They would need enforcement at every relevant caller; a wrapper used only by SozoRock application code would not automatically cover transitive build-tool calls.

Candidate changes are not merged upstream:

| Upstream work | Verified status | Consequence |
| --- | --- | --- |
| [PR #72](https://github.com/micromatch/braces/pull/72), head `28d440b5dd449dbf1fe6f3506cf94ecca4d02660` | Closed; API `merged: false` | Depth bounds across parsing and walkers are a rejected/unmerged proposal, not an official fix. |
| [PR #75](https://github.com/micromatch/braces/pull/75), head `bdb6fda18f2aba1ae63d78786cb4460b478459ba` | Closed; API `merged: false` | Author withdrew it and acknowledged overstated protection and incomplete implementation. |
| [PR #79](https://github.com/micromatch/braces/pull/79) | Open | Proposed parser cap changes over-limit nesting into literal text; semantics therefore change. |
| [PR #82](https://github.com/micromatch/braces/pull/82), displayed head `1f11eb558be9ea0cda87861408bb766e2e714086` | Open | Broader AST preflight, cycle/visit bounds, and range-processing changes; not a narrow maintainer-approved backport. |

[Advisory correction PR #10132](https://github.com/github/advisory-database/pull/10132) was closed without merge on October 13. It does not withdraw the active advisory. [The maintainer's pinned issue #85](https://github.com/micromatch/braces/issues/85) points to the dispute. Do not label the current scanner result a resolved false positive merely because the maintainer disputes it.

In the inspected Health lockfile, `micromatch@4.0.8` requires `braces@^3.0.3`. The original audit traces micromatch through Metro/Expo, fast-glob, and find-yarn-workspace-root. The installed `micromatch/index.js` exposes `braces` and `braceExpand` forwarding caller options to braces. Its presence alone does not prove a public request can reach the vulnerable walker, and this research has not established that reachability.

Safe narrow mitigations, where a call boundary is actually controlled, are bounded trusted glob inputs and caught parser errors. These mitigate exposure and leave the package finding unresolved. `brace-expansion` is a different package; upgrading its fixed releases does not fix `braces`.

## node-forge

The active advisory covers nested `DigestAlgorithm` content that signature verification accepts improperly. The earlier outer-element fix in 1.4.0 is insufficient.

[Forge PR #1152](https://github.com/digitalbazaar/forge/pull/1152), head `ceba34402e329f0365134f23fe19898756527d65`, remains open and unmerged. It adds an inner element-count check. Do not treat it as a complete remedy: newer upstream discussion identifies count-preserving malformed NULL/length encodings that it still accepts.

[Forge PR #1159](https://github.com/digitalbazaar/forge/pull/1159), pinned head `db05494352dd3c9a5a07c5270333dcc78866cad2`, remains open and unmerged. It compares the decoded structure with a canonical DER encoding; the recorded diff touches `lib/rsa.js`, regression tests, and the changelog. The author reports a passing Node suite and OpenSSL interoperability. A separate commenter reports testing actual Expo consumers and the malformed NULL/length cases, while explicitly retaining the real 1.4.0 identity and the audit failure. These are contributor reports, not a test run performed here or maintainer approval. This is the more complete candidate for independent review, not a supported release.

[PR #1160](https://github.com/digitalbazaar/forge/pull/1160) is also open and now uses canonical encoding after its earlier count-only revision was challenged. [PR #1161](https://github.com/digitalbazaar/forge/pull/1161), opened October 20, adds count and empty-NULL checks; it is unmerged and not established here as covering non-minimal length encodings. An arbitrary downstream fork labeled 1.4.1 would not establish that the problem is solved.

The installed Health dependency path is substantive:

- `expo` in `apps/mobile` resolves `@expo/cli@57.0.15`, which depends on node-forge and `@expo/code-signing-certificates@0.0.6`.
- `@expo/code-signing-certificates/build/main.js` imports Forge and calls certificate verification, public-key signature verification, and CSR verification. It also performs key generation, certificate creation, PEM conversion, and signing.
- `@expo/cli/build/src/run/ios/codeSigning/Security.js` imports Forge to parse signing certificates.

A no-op Forge replacement would remove real functionality. Replacing Forge wholesale with Node crypto is a separate API migration requiring certificate, CSR, key-format and signing compatibility work. [Expo issue #51773](https://github.com/expo/expo/issues/51773) requests a supported path for SDK 57 and has no maintainer remedy in the inspected discussion. This research does not prove whether SozoRock's own deployment accepts attacker-controlled signatures through those tooling paths.

## Decision and validation boundaries

The existing Health CI command is `npm audit --omit=dev --omit=optional --audit-level=moderate`. The two installed package lock entries are not marked dev-only. [npm documents](https://docs.npmjs.com/cli/v11/commands/npm-audit/) that its normal advisory request is based on package names and version lists, rather than a comparison of patched source code. Therefore, a source backport retaining `braces@3.0.3` or `node-forge@1.4.0` does not by itself make that gate pass. Changing package names, omitting version fields, pretending a local 1.4.1/3.0.4 is an official release, changing the gate's scope, or accepting audit errors would conceal rather than establish remediation.

Recommended course: finish supported dependency upgrades and the website work, retain the original audit command and accurate unresolved status, and keep production release blocked on these findings. A future upstream fixed release or actual removal of the affected functionality/dependency path can resolve them. Replacing Expo/Metro tooling to remove all paths is broader than a website refinement and must be tested as a migration, not silently counted as a patch.

If a separately reviewed local backport is pursued for interim protection, preserve original package metadata and license; pin exact upstream source and patch hashes; verify the installed bytes at both Expo consumers after clean installation and cache restoration; and keep the registry finding visible. For Forge, validation must include the count-only bypass cases, canonical signatures with/without NULL, wrong-digest and tamper rejection, normal padding/trailing-byte enforcement, Node/OpenSSL SHA-256/384/512 interoperability, RSA-PSS/NONE compatibility, certificate/CSR/PEM operations and Expo exports. For braces, parsing alone is insufficient: manually supplied ASTs, parenthesis/brace nesting, cycles/shared nodes, range limits, valid-pattern equivalence and build consumers need coverage. Neither proposed backport has been executed or certified here.

The public website's production dependency closure can be assessed separately as additional evidence. That does not replace or waive the required monorepo gate, and this report does not certify the website artifact's runtime closure.
