# Primary Care Access Program interest list

The English interest form uses the existing contact intake. It does not require a relational database or a new delivery service. Spanish pages and the existing contact request format remain unchanged.

## Before release

- Set the server-only `PRIMARY_CARE_COHORT_START_DATE` to the confirmed January 2027 start date in `YYYY-MM-DD` format. Do not guess the day. The program intake returns 503 until that setting is valid; other contact inquiries continue normally.
- The existing contact table must have expiration enabled for `expiresAt`. New program records expire 12 calendar months after the configured start date, at midnight New York time.
- Assign an authorized staff owner to delete remaining interest-list records by that deadline. Automatic expiration is asynchronous and is not a substitute for checking deletion. Remove staff exports and any other copies under the same schedule.
- If someone enrolls or asks to remain on the list, document that choice and apply the separate enrollment notice or renewed retention agreement before changing their record's expiration. A request to stay must not be inferred from silence.
- If the confirmed cohort start changes, update existing program records as well as the server setting. Do not change ordinary contact or publication records.
- Verify deletion requests through the existing privacy contact process, then remove the matching program records and staff copies.
- Confirm only authorized SozoRock staff can access submissions. Program notifications contain a submission reference, with no submitted contact details.
- Complete the form and privacy review before enabling the page publicly. Children under 13 are directed to a parent or guardian contacting staff without the child's personal details.

## Review checks

Run the repository install, lint, typecheck, public-site tests and build. The contact-route tests replace storage and notification clients with test doubles; they must never send a real notification.

On a local or test target, check email-only and phone-only submissions, missing and malformed contacts, matching preferred contact methods, all required confirmations, unsupported fields, an overlong referral answer, rate limiting, retry after storage failure and the success message. Inspect the saved test record for the expected expiration and absence of health fields, then delete test records.

Review the homepage, work, interest and privacy pages at 390 and 1280 pixels. Use only the keyboard to complete the form; check labels, focus movement, announced errors, retry input preservation and duplicate-submit prevention.

## Staff review and notification status

The existing MFA-protected Foundation Operations console has a Program interest view. It queries the existing ContactIntelligence index with `recordType=program-interest`; it does not create a database or use the publication request table. The view includes phone-only requests, preferred contact method, county, referral answer and the deletion deadline. Expired and unconsented program records are excluded before projection. Ordinary inquiries keep their separate view and response shape.

Requests are stored with `notificationStatus=pending`. A successful SNS Publish response changes the status to `published`; this means the notification service accepted the alert, not that a person received or read it. If publication or the status update fails, the saved request stays accepted and remains visible to authorized reviewers. The staff owner must review pending/unknown alerts and the interest view routinely. Program alerts contain no submitted contact details.

Staff pages support continuation through all records. CSV export reads consecutive pages and returns an explicit error rather than a partial export if the bounded export limit is exceeded. Protect and delete exported copies under the same retention deadline; the website cannot delete files already downloaded to staff devices.

The Amplify build allowlist now passes the cohort-date setting into the server environment. Its value has not been selected or configured in production. Local integration verification uses a clearly marked synthetic January 15 fixture and an in-memory AWS protocol emulator; this is not a confirmed program start day or proof of live AWS delivery.
