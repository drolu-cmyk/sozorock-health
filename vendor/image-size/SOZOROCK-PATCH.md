# SozoRock security patch

This package is a vendored copy of `image-size` 1.2.1, distributed under the included MIT license. The local version number distinguishes it from the archived upstream package.

The patch rejects zero-length, undersized, truncated, and out-of-bounds ICNS and ISO media boxes so malformed ICNS, JXL, and HEIF input cannot keep a parser loop from advancing.

It addresses the parser conditions described by:

- GHSA-w3rx-r6r6-pgpr / CVE-2025-71330
- GHSA-5p2g-fcmc-qvqq / CVE-2025-71329

The package is used transitively by Metro for image metadata during mobile builds. Keep the regression tests in `apps/mobile/tests/image-size-security.test.mjs` when refreshing or replacing this package.
