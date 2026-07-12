export const publicationEventNames = [
  "publication_viewed",
  "access_started",
  "access_form_completed",
  "verification_sent",
  "email_verified",
  "publication_opened",
  "download_link_issued",
  "access_failed",
] as const;

export type AccessEvent = (typeof publicationEventNames)[number];
