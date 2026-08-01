import type { Metadata } from "next";
import { OnboardingClient } from "./OnboardingClient";

export const metadata: Metadata = {
  title: "Request a county pilot | SozoRock Place Intelligence",
  description: "Request a reviewable SozoRock Place Intelligence county workspace for public evidence and non-clinical planning conversations.",
  alternates: { canonical: "/explore/onboarding" },
};

export default function ExploreOnboardingPage() {
  return <OnboardingClient />;
}
