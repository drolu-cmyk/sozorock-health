import type { Metadata } from "next";
import { ApprovedMarketingHome } from "./components/ApprovedMarketingHome";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    languages: { "en-US": "/", "es-US": "/es" },
  },
};

export default function Home() {
  return <ApprovedMarketingHome />;
}
