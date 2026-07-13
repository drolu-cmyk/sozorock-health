import { publicSiteUrl } from "./request-security.ts";

export type PublicationRedirect = {
  location: URL;
  status: 303 | 307;
};

function redirect(path: string, status: PublicationRedirect["status"]) {
  return { location: publicSiteUrl(path), status } satisfies PublicationRedirect;
}

export const publicationRedirects = {
  beginVerification(token: string) {
    const path = token
      ? `/publications/verify?token=${encodeURIComponent(token)}`
      : "/publications?verification=missing";
    return redirect(path, 307);
  },
  missingVerification() {
    return redirect("/publications?verification=missing", 303);
  },
  expiredVerification() {
    return redirect("/publications?verification=expired", 303);
  },
  completedVerification(slug: string) {
    return redirect(`/publications/${encodeURIComponent(slug)}/verified`, 303);
  },
  failedVerification() {
    return redirect("/publications?verification=failed", 303);
  },
  sessionRequired(slug: string) {
    return redirect(
      `/publications/${encodeURIComponent(slug)}/access?session=required`,
      307,
    );
  },
  sessionExpired(slug: string) {
    return redirect(
      `/publications/${encodeURIComponent(slug)}/access?session=expired`,
      307,
    );
  },
  downloadFailed(slug: string) {
    return redirect(
      `/publications/${encodeURIComponent(slug)}/access?download=failed`,
      307,
    );
  },
} as const;
