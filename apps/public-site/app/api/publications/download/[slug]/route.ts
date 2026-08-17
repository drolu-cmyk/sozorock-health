import { NextRequest, NextResponse } from "next/server";
import {
  createDownloadUrl,
  recordEvent,
} from "../../../../lib/publication-access";
import { publicationRedirects } from "../../../../lib/publication-redirects";
import { getPublication } from "../../../../lib/publications";

export const runtime = "nodejs";

function productionCookies() {
  return process.env.NODE_ENV === "production";
}

function accessCookieName() {
  return productionCookies()
    ? "__Host-srh_publication_access"
    : "srh_publication_access";
}

function protectResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function clearAccessCookie(response: NextResponse) {
  response.cookies.set(accessCookieName(), "", {
    httpOnly: true,
    secure: productionCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const slug = (await params).slug;
  const publication = getPublication(slug);
  if (!publication?.assetKey) {
    return protectResponse(
      NextResponse.json({ error: "Publication not found." }, { status: 404 }),
    );
  }

  const session = request.cookies.get(accessCookieName())?.value;
  if (!session) {
    const target = publicationRedirects.sessionRequired(publication.slug);
    return protectResponse(NextResponse.redirect(target.location, target.status));
  }

  try {
    const url = await createDownloadUrl(session, publication.slug);
    if (!url) {
      const target = publicationRedirects.sessionExpired(publication.slug);
      return protectResponse(
        clearAccessCookie(
          NextResponse.redirect(target.location, target.status),
        ),
      );
    }

    return protectResponse(NextResponse.redirect(url, 307));
  } catch (error) {
    console.error("publication-download-failed", {
      name: (error as { name?: string }).name ?? "UnknownError",
      slug: publication.slug,
    });
    await recordEvent("access_failed", publication.slug, undefined, {
      stage: "download",
    }).catch(() => undefined);
    const target = publicationRedirects.downloadFailed(publication.slug);
    return protectResponse(NextResponse.redirect(target.location, target.status));
  }
}
