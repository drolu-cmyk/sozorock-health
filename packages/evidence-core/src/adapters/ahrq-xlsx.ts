import { readSheet } from "read-excel-file/node";
import { sha256 } from "../ingestion/hash.ts";
import type { AhrqTabularArtifactReader } from "./ahrq-clh.ts";

export type AhrqCodebookVariable = {
  variableId: string;
  geographyKinds: Array<"county" | "postal_zip">;
  dataYearField?: string;
};

export type AhrqXlsxReaderConfig = {
  dataWorksheet: string;
  headerRow?: number;
  codebookReleaseLabel: string;
  codebookUrl: string;
  codebookWorksheet?: string;
  codebookVariableColumn?: number;
  approvedVariables: AhrqCodebookVariable[];
};

function cellValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return typeof value === "number" ? value : String(value).trim();
}

export function createAhrqXlsxReader(config: AhrqXlsxReaderConfig): AhrqTabularArtifactReader {
  return async ({ artifactUrl, fetcher }) => {
    const [response, codebookResponse] = await Promise.all([
      fetcher(artifactUrl, {
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "User-Agent": "SozoRock-Evidence-Core/1.0",
      },
      signal: AbortSignal.timeout(120_000),
      }),
      fetcher(config.codebookUrl, {
        headers: {
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "User-Agent": "SozoRock-Evidence-Core/1.0",
        },
        signal: AbortSignal.timeout(120_000),
      }),
    ]);
    if (!response.ok) throw new Error(`AHRQ CLH workbook request failed (${response.status}).`);
    if (!codebookResponse.ok) throw new Error(`AHRQ CLH codebook request failed (${codebookResponse.status}).`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const codebookBuffer = Buffer.from(await codebookResponse.arrayBuffer());
    const [dataRows, codebookRows] = await Promise.all([
      readSheet(buffer, config.dataWorksheet),
      readSheet(codebookBuffer, config.codebookWorksheet ?? "County"),
    ]);
    const codebookVariableColumn = config.codebookVariableColumn ?? 3;
    const codebookVariables = new Set<string>();
    for (const row of codebookRows.slice(1)) {
      const variable = String(cellValue(row[codebookVariableColumn - 1]) ?? "").trim();
      if (variable) codebookVariables.add(variable);
    }
    const headerRowNumber = config.headerRow ?? 1;
    const normalizedHeaders = dataRows[headerRowNumber - 1].map((value) => String(cellValue(value) ?? "").trim());
    const registeredColumns = new Set(config.approvedVariables.flatMap((variable) =>
      [variable.variableId, variable.dataYearField].filter((value): value is string => Boolean(value))));
    const absentFromCodebook = [...registeredColumns].filter((column) => !codebookVariables.has(column));
    if (absentFromCodebook.length) {
      throw new Error(`AHRQ CLH codebook ${config.codebookReleaseLabel} does not define: ${absentFromCodebook.join(", ")}.`);
    }
    const missingColumns = [...registeredColumns].filter((column) => !normalizedHeaders.includes(column));
    if (missingColumns.length) {
      throw new Error(`AHRQ CLH codebook validation failed for ${config.codebookReleaseLabel}; missing columns: ${missingColumns.join(", ")}.`);
    }
    const rows: Record<string, string | number | null>[] = [];
    for (const row of dataRows.slice(headerRowNumber)) {
      const output: Record<string, string | number | null> = {};
      normalizedHeaders.forEach((header, index) => {
        if (header) output[header] = cellValue(row[index]);
      });
      if (Object.values(output).some((value) => value !== null && value !== "")) rows.push(output);
    }
    return {
      rows,
      contentHashInput: sha256(Buffer.concat([buffer, codebookBuffer])),
      retrievedAt: new Date().toISOString(),
    };
  };
}
