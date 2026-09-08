import type { Metadata } from "next";
import { healthMetadata } from "./health-metadata.ts";
export function createLegalMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: `/${string}`;
}): Metadata {
  return healthMetadata(title, description, path);
}
