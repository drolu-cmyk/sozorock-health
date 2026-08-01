import type { Metadata } from "next";
import { ShareWorkspaceClient } from "./ShareWorkspaceClient";

export const metadata: Metadata = {
  title: "Shared county plan | SozoRock Place Intelligence",
  description: "A read-only, evidence-linked county planning workspace shared through SozoRock Place Intelligence.",
  robots: { index: false, follow: false },
};

export default function SharedWorkspacePage() {
  return <ShareWorkspaceClient />;
}
