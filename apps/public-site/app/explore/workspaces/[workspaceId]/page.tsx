import type { Metadata } from "next";
import { WorkspaceClient } from "./WorkspaceClient";
export const metadata: Metadata = { title: "County plan | SozoRock Place Intelligence", robots: { index: false, follow: false } };
export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) { return <WorkspaceClient workspaceId={(await params).workspaceId} />; }
