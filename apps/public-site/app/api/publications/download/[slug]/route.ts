import { NextRequest, NextResponse } from "next/server";
import { createDownloadUrl, recordEvent } from "../../../../lib/publication-access";
import { publicationRedirects } from "../../../../lib/publication-redirects";
import { getPublication } from "../../../../lib/publications";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const publication = getPublication(slug);
  if (!publication?.assetKey) return NextResponse.json({ error: "Publication not found." }, { status: 404 });
  const session = request.cookies.get("__Host-srh_publication_access")?.value ?? request.cookies.get("srh_publication_access")?.value;
  if (!session) {
    const target = publicationRedirects.sessionRequired(publication.slug);
    return NextResponse.redirect(target.location, target.status);
  }
  try {
    const url = await createDownloadUrl(session, publication.slug);
    if (!url) {
      const target = publicationRedirects.sessionExpired(publication.slug);
      return NextResponse.redirect(target.location, target.status);
    }
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("publication-download-failed", { name: (error as { name?: string }).name ?? "UnknownError", slug: publication.slug });
    await recordEvent("access_failed", publication.slug, undefined, { stage: "download" }).catch(() => undefined);
    const target = publicationRedirects.downloadFailed(publication.slug);
    return NextResponse.redirect(target.location, target.status);
  }
}
