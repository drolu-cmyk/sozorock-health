import type { StoredImport } from "./types.ts";

export type PublicSourceStatus = {
  status: "current" | "stale" | "unavailable" | "failed" | "refreshing";
  label: string;
  usable: boolean;
  lastSuccessfulImportAt: string | null;
  detail: string | null;
};

export function publicSourceStatus(record: StoredImport): PublicSourceStatus {
  if (record.status === "available") {
    return {
      status: "current",
      label: "Current",
      usable: true,
      lastSuccessfulImportAt: record.successfulImportAt,
      detail: null,
    };
  }
  if (record.status === "stale") {
    return {
      status: "stale",
      label: "Stale source",
      usable: true,
      lastSuccessfulImportAt: record.successfulImportAt,
      detail: record.failureMessage ?? "The last successful import is outside the source freshness window.",
    };
  }
  if (record.status === "unavailable") {
    return {
      status: "unavailable",
      label: "Source unavailable",
      usable: false,
      lastSuccessfulImportAt: record.successfulImportAt,
      detail: record.failureMessage,
    };
  }
  if (record.status === "failed") {
    return {
      status: "failed",
      label: "Refresh failed",
      usable: false,
      lastSuccessfulImportAt: record.successfulImportAt,
      detail: record.failureMessage,
    };
  }
  return {
    status: "refreshing",
    label: "Refreshing",
    usable: false,
    lastSuccessfulImportAt: record.successfulImportAt,
    detail: null,
  };
}
