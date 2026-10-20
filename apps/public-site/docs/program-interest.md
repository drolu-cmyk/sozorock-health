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
