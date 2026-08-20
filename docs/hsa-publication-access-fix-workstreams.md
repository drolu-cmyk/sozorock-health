# HSA publication access recovery

Branch: `fix/hsa-email-verification-download`

## Lead goal

Make Health Systems Assurance publication download work for a visitor using any syntactically valid email address, without making the PDF public and without making successful email delivery a prerequisite for access.

The access form remains the controlled-entry point. A valid, rate-limited form submission should establish a short-lived publication access session. The server should still attempt a verification email so the Foundation can verify an address when delivery is available, but SES sandbox state, provider rejection, mailbox filtering, or delivery delay must not strand a legitimate visitor after the form has already been accepted.

## Non-negotiable rules

1. Keep publication PDFs out of the public web root and in the private S3 bucket.
2. Keep downloads behind the existing short-lived signed S3 URL flow.
3. Do not introduce email-domain allowlists or deny consumer, education, nonprofit, government, or corporate domains.
4. Keep normal email syntax validation; do not pretend that an undeliverable mailbox is verified.
5. A valid access-form submission, after existing same-origin and rate-limit checks, may create the 12-hour access session before email verification.
6. Verification email remains useful evidence of mailbox control, but delivery failure must be non-fatal to publication access.
7. Keep access and verification tokens server-side/HttpOnly; never expose raw tokens in page URLs except the existing one-time email handoff URL.
8. Preserve same-origin enforcement, rate limiting, salted identifiers, DynamoDB TTL, and one-time verification-token consumption.
9. Preserve five-minute signed download URLs and the private S3 bucket policy.
10. Do not collect health or medical information.
11. Keep update/marketing consent separate from publication access.
12. Make email-delivery failures observable without logging raw tokens or unnecessary personal information.
13. Deploy gates must test the access contract that users actually depend on. SES production access may be reported as a deliverability warning once email is no longer the access gate.
14. Prefer small, atomic commits. Each change should keep the branch in a reviewable state.
15. Do not merge to `main` from this workstream; leave the branch ready for review after tests/CI evidence.

## Shared current-state context

- The form and server validator accept ordinary email domains and do not contain a domain allowlist.
- Publication verification mail is sent directly through AWS SES.
- The existing deploy workflow explicitly blocks release while SES production access is disabled/pending.
- Verification currently creates the publication access session.
- The download route already requires that session and generates a short-lived signed S3 URL from the private publication bucket.
- Recent fixes addressed runtime permissions, SES IAM, production-access requests, and deploy checks. The remaining design risk is that email delivery is still the single gate to download.

## 19 specialized workstreams

### 1. Repository-history worker
Prompt: Review the recent publication-access and SES-related commits/PRs, especially the fixes around runtime configuration, SES IAM, production-access requests, and release gating. Identify assumptions that are still true, assumptions invalidated by the new goal, and code that must not be reverted.

### 2. Email-input worker
Prompt: Review client and server email parsing/validation. Confirm there is no domain allowlist or provider-specific restriction. Keep reasonable syntactic validation while ensuring Gmail, Yahoo, Outlook/Hotmail, iCloud, education, government, nonprofit, and custom corporate domains all follow the same path.

### 3. Access-request API worker
Prompt: Review `POST /api/publications/access/[slug]`. Design the response so a successful validated request can establish secure access even if email delivery later fails. Preserve same-origin enforcement, bounded JSON parsing, honeypot behavior, and rate-limit error semantics.

### 4. DynamoDB transaction worker
Prompt: Review `createAccessRequest`. Make request creation, verification-token creation, and initial publication-session creation atomic where practical. Ensure a database failure cannot create a partially authorized access state.

### 5. Session worker
Prompt: Review publication session generation/validation. Ensure the initial access session uses the existing random token, salted hash, publication scoping, 12-hour TTL, and legacy-slug handling. Avoid weakening token entropy or persistence rules.

### 6. Verification-token worker
Prompt: Preserve single-use email verification. Confirm a user who already received an initial access session can still click the verification email later, be marked verified, and receive/refresh a valid session without breaking consumed-token semantics.

### 7. Email-delivery worker
Prompt: Make SES delivery best-effort after the access state is safely committed. Classify/log SES failures without exposing sensitive content. Return whether verification delivery was attempted/sent so the UI can communicate truthfully.

### 8. SES-account worker
Prompt: Review SES sandbox/production-access assumptions. Since publication access must no longer depend on SES production status, change release behavior from hard dependency to explicit deliverability status/warning while keeping sender identity and sending configuration checks useful.

### 9. IAM worker
Prompt: Review publication IAM. Keep least-privilege DynamoDB, Secrets Manager, S3, and SES permissions. Do not broaden permissions merely to bypass delivery failures.

### 10. Cookie worker
Prompt: Centralize or consistently apply publication access cookie attributes. Production cookies must remain `__Host-`, HttpOnly, Secure, SameSite=Lax, path `/`, with the existing session lifetime.

### 11. Download-route worker
Prompt: Verify `/api/publications/download/[slug]` works unchanged with an access session created at form submission. Preserve session-expiry cleanup, no-store/no-referrer headers, publication scoping, and safe failure redirects.

### 12. Signed-asset worker
Prompt: Verify `createDownloadUrl` and S3 behavior. Keep `HeadObject`, private bucket, attachment content disposition, and five-minute presigned URL expiry. Do not move PDFs into the public application.

### 13. Access-form UX worker
Prompt: Update the publication form so success presents an immediate secure download action. Do not tell users to wait for email before they can access the publication. If verification email was sent, say so as a secondary action; if not, do not present delivery failure as access failure.

### 14. Publication-copy worker
Prompt: Review public publication detail/access copy. Remove claims that email verification is what protects or unlocks the publication if the form submission now grants access. Keep the explanation accurate, restrained, and privacy-conscious.

### 15. Verification-page worker
Prompt: Keep the existing verification page useful for users arriving from email. Ensure it still verifies mailbox control and lands the visitor on the verified/download path even when the visitor previously received an immediate session.

### 16. Privacy/consent worker
Prompt: Review consent wording and documentation. Keep publication-delivery/access consent distinct from optional future updates. Ensure the documentation accurately states when access is granted and what verification means.

### 17. Rate-limit/abuse worker
Prompt: Review request, network, recipient, verification, and event throttles after initial-session issuance. Confirm immediate access does not accidentally bypass request throttling or create an obvious unlimited-session endpoint.

### 18. Test/release-gate worker
Prompt: Expand targeted tests to assert that email-delivery failure cannot block access-session issuance, the response/cookie contract supports download, no email domains are singled out, and the production gate no longer treats the SES simulator as proof of public mailbox delivery. Preserve all existing secure-delivery assertions.

### 19. Observability/rollout worker
Prompt: Ensure events distinguish form completion, verification sent, verification delivery failure, email verified, download-link issued, and true access failures. Define release/rollback evidence: tests pass, production page loads, validated access request establishes a session, unauthorized download remains rejected, authorized session reaches a signed private-asset URL, and SES status is reported separately.

## Definition of done

- Any visitor who submits valid required access information with a syntactically valid email address can reach the secure publication download without waiting for or depending on an email provider.
- Verification email is still attempted and can still verify the address when delivered.
- SES sandbox/review state cannot make the publication inaccessible.
- The PDF remains private and downloads remain session-scoped and signed.
- Same-origin, throttling, privacy, token, cookie, TTL, and private-storage controls remain intact.
- Targeted tests and repository CI/release checks reflect the new contract.
