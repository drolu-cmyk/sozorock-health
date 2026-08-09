import type { Metadata } from "next";
import { InvitationClient } from "./InvitationClient";
export const metadata: Metadata = { title: "Accept workspace invitation | SozoRock Place Intelligence", robots: { index: false, follow: false } };
export default function InvitationPage(){return <InvitationClient/>}
