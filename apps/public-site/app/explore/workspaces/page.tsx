import type { Metadata } from "next";
import { WorkspaceListClient } from "./WorkspaceListClient";

export const metadata: Metadata = { title: "County workspaces | SozoRock Place Intelligence", robots: { index: false, follow: false } };
export default function WorkspacesPage() { return <WorkspaceListClient />; }
