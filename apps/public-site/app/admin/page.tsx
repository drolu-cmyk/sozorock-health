import type { Metadata } from "next";
import { publications } from "../lib/publications";
import AdminClient from "./AdminClient";

export const metadata: Metadata = {
  title: "Foundation Operations | The SozoRock Foundation",
  description: "Private operations console for authorized Foundation reviewers.",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function FoundationAdminPage() {
  const publicationOptions = publications
    .filter((publication) => publication.status === "Available")
    .map((publication) => ({ slug: publication.slug, title: publication.title }));

  return <AdminClient publications={publicationOptions} />;
}
