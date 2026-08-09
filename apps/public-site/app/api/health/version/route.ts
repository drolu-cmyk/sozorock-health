import { NextResponse } from "next/server";
import { EXPLORE_CONTRACT_VERSION, EXPLORE_OPENAPI_VERSION } from "../../../lib/explore-openapi";
import { placeAgentRuntimeVersions } from "../../../lib/place-agent-openai";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    repositoryCommitSha: process.env.REPOSITORY_COMMIT_SHA?.trim() || "unavailable",
    buildTimestamp: process.env.BUILD_TIMESTAMP?.trim() || "unavailable",
    deploymentEnvironment: process.env.RUNTIME_ENV?.trim() || process.env.NODE_ENV,
    applicationContractVersion: EXPLORE_CONTRACT_VERSION,
    databaseMigrationVersion: process.env.EVIDENCE_DATABASE_MIGRATION_VERSION?.trim() || "unavailable",
    evidenceSnapshotContentHash: placeAgentRuntimeVersions.snapshotContentHash || "unavailable",
    policyVersion: placeAgentRuntimeVersions.policyVersion,
    openApiVersion: EXPLORE_OPENAPI_VERSION,
  }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
