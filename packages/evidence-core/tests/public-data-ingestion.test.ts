import assert from "node:assert/strict";
import test from "node:test";
import { zipSync, strToU8 } from "fflate";
import {
  AcsIngestionAdapter,
  AhrqClhIngestionAdapter,
  createAhrqXlsxReader,
  CdcPlacesIngestionAdapter,
  HrsaHpsaIngestionAdapter,
  InMemoryHttpCache,
  InMemoryIngestionRepository,
  interpretMetricComparison,
  publicSourceStatus,
  runIngestion,
  type FetchLike,
  type Geography,
} from "../src/index.ts";

function geography(kind: Geography["kind"], authorityId: string, name: string, stateFips: string | null): Geography {
  return {
    id: `geo-${kind}-${authorityId}`,
    kind,
    authority: "census",
    authorityId,
    name,
    displayName: name,
    stateFips,
    countyFips: kind === "county" ? authorityId : null,
    vintage: "2024",
    validFrom: null,
    validTo: null,
    reviewStatus: "verified",
    caveat: kind === "zcta" ? "A ZCTA is not a USPS ZIP Code delivery route." : null,
  };
}

function response(body: string, status = 200, headers: Record<string, string> = {}): Awaited<ReturnType<FetchLike>> {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    async text() { return body; },
    async arrayBuffer() { return new TextEncoder().encode(body).buffer; },
  };
}

function staticFetcher(body: string, seenUrls: string[] = []): FetchLike {
  return async (url) => {
    seenUrls.push(url);
    return response(body, 200, { "content-type": "application/json", etag: '"fixture"' });
  };
}

const albany = geography("county", "36001", "Albany County, New York", "36");

const cdcRows = JSON.stringify([
  {
    year: "2023",
    locationid: "36001",
    locationname: "Albany County",
    measureid: "DIABETES",
    measure: "Diagnosed diabetes among adults",
    datasource: "BRFSS",
    data_value_unit: "%",
    data_value_typeid: "CrdPrv",
    data_value_type: "Crude prevalence",
    data_value: "10.4",
    low_confidence_limit: "9.8",
    high_confidence_limit: "11.0",
  },
  {
    year: "2023",
    locationid: "36001",
    locationname: "Albany County",
    measureid: "CHECKUP",
    measure: "Annual checkup among adults",
    datasource: "BRFSS",
    data_value_unit: "%",
    data_value_typeid: "CrdPrv",
    data_value_type: "Crude prevalence",
    data_value: "78.5",
    low_confidence_limit: "77.1",
    high_confidence_limit: "79.9",
  },
]);

test("Albany County retrieves valid county-level CDC evidence with separate release and data periods", async () => {
  const adapter = new CdcPlacesIngestionAdapter({ releaseLabel: "2025 release", releaseDate: "2025-12-04" });
  const batch = await adapter.fetch(
    { geography: albany },
    { fetcher: staticFetcher(cdcRows), cache: new InMemoryHttpCache(), now: "2026-07-20T12:00:00Z" },
  );
  assert.equal(batch.status, "available");
  assert.equal(batch.observations.length, 2);
  assert.equal(batch.observations[0].geographyId, albany.id);
  assert.equal(batch.observations[0].geographyLevel, "county");
  assert.equal(batch.observations[0].releaseDate, "2025-12-04");
  assert.equal(batch.observations[0].dataPeriodEnd, "2023-12-31");
  assert.match(batch.observations[0].sourceRecordId, /^swc5-untb:36001:/);
  assert.match(batch.observations[0].sourceUrl, /^https:\/\/data\.cdc\.gov\/resource\/swc5-untb\.json/);
});

test("a ZCTA query does not claim a county-only ACS row as ZIP-specific", async () => {
  const zcta = geography("zcta", "12203", "ZCTA 12203", "36");
  const seenUrls: string[] = [];
  const adapter = new AcsIngestionAdapter({ vintage: 2024, releaseDate: "2025-12-11", apiKey: "fixture-secret" });
  const countyOnlyResponse = JSON.stringify([
    ["NAME", "B01001_001E", "B01001_001M", "B17001_002E", "B17001_002M", "state", "county"],
    ["Albany County, New York", "316429", "100", "35000", "500", "36", "001"],
  ]);
  const cache = new InMemoryHttpCache();
  const batch = await adapter.fetch(
    { geography: zcta },
    { fetcher: staticFetcher(countyOnlyResponse, seenUrls), cache, now: "2026-07-20T12:00:00Z" },
  );
  assert.equal(batch.observations.length, 0);
  assert.equal(batch.recordsRejected, 1);
  assert.match(seenUrls[0], /key=fixture-secret/);
  assert.ok(batch.observations.every((observation) => !observation.sourceUrl.includes("fixture-secret")));
  assert.ok([...cache.entries.keys()].every((key) => !key.includes("fixture-secret")));
  assert.ok([...cache.entries.values()].every((entry) => !entry.url.includes("fixture-secret")));
});

test("a positive preventive-service measure cannot become an adverse priority by default", async () => {
  const adapter = new CdcPlacesIngestionAdapter({ releaseLabel: "2025 release", releaseDate: "2025-12-04" });
  const batch = await adapter.fetch(
    { geography: albany, requestedMeasureIds: ["CHECKUP"] },
    { fetcher: staticFetcher(JSON.stringify([JSON.parse(cdcRows)[1]])), cache: new InMemoryHttpCache(), now: "2026-07-20T12:00:00Z" },
  );
  const definition = batch.measures[0];
  assert.equal(definition.higherValueMeaning, "favorable");
  assert.equal(interpretMetricComparison(definition, 78.5, 70).status, "favorable_signal");
});

test("an unavailable upstream endpoint visibly labels a cached source as stale", async () => {
  const adapter = new CdcPlacesIngestionAdapter({ releaseLabel: "2025 release", releaseDate: "2025-12-04" });
  const cache = new InMemoryHttpCache();
  await adapter.fetch(
    { geography: albany },
    { fetcher: staticFetcher(cdcRows), cache, now: "2026-07-01T12:00:00Z" },
  );
  const failedFetcher: FetchLike = async () => { throw new Error("source offline"); };
  const stale = await adapter.fetch(
    { geography: albany },
    { fetcher: failedFetcher, cache, now: "2026-07-20T12:00:00Z" },
  );
  assert.equal(stale.status, "stale");
  assert.equal(stale.cacheDisposition, "stale_fallback");
  assert.match(stale.statusReason ?? "", /labeled stale/i);
  const visible = publicSourceStatus({
    id: "stale-import",
    idempotencyKey: `sha256:${"b".repeat(64)}`,
    adapterId: adapter.id,
    sourceId: adapter.sourceId,
    status: "stale",
    attemptedAt: "2026-07-20T12:00:00Z",
    successfulImportAt: "2026-07-01T12:00:00Z",
    failedAt: null,
    failureCode: null,
    failureMessage: stale.statusReason,
    sourceVersion: stale.sourceVersion,
    measures: stale.measures,
    observations: stale.observations,
    recordsRead: stale.recordsRead,
    recordsAccepted: stale.recordsAccepted,
    recordsRejected: stale.recordsRejected,
    observationsPublished: stale.observations.length,
    cacheDisposition: stale.cacheDisposition,
  });
  assert.equal(visible.label, "Stale source");
  assert.equal(visible.usable, true);
});

test("scheduled import jobs are idempotent for the same adapter release and geography", async () => {
  const adapter = new CdcPlacesIngestionAdapter({ releaseLabel: "2025 release", releaseDate: "2025-12-04" });
  const repository = new InMemoryIngestionRepository();
  const seenUrls: string[] = [];
  const context = { fetcher: staticFetcher(cdcRows, seenUrls), cache: new InMemoryHttpCache(), now: "2026-07-20T12:00:00Z" };
  const first = await runIngestion({ adapter, query: { geography: albany }, context, repository });
  const second = await runIngestion({ adapter, query: { geography: albany }, context, repository });
  assert.equal(first.idempotentReplay, false);
  assert.equal(second.idempotentReplay, true);
  assert.equal(repository.imports.size, 1);
  assert.equal(seenUrls.length, 1);
});

test("HRSA population and facility designations are retained without being converted to county findings", async () => {
  const csv = [
    "HPSA ID,HPSA Name,Designation Type,Discipline,Status,County FIPS,Geography ID,Component Type,Component ID,HPSA Score,Designation Date,Last Update,Record Create",
    "A1,Albany Geographic,Geographic HPSA,Primary Care,Designated,36001,36001,Single County,C1,15,01/01/2024,07/19/2026,07/20/2026",
    "A2,Low Income Population,Population Group,Primary Care,Designated,36001,36001,Single County,C2,18,01/01/2024,07/19/2026,07/20/2026",
    "A3,Facility,Facility,Mental Health,Designated,36001,36001,Facility,C3,20,01/01/2024,07/19/2026,07/20/2026",
  ].join("\n");
  const adapter = new HrsaHpsaIngestionAdapter({
    artifactUrl: "https://data.hrsa.gov/DataDownload/DD_Files/HPSA_DASHBOARD.csv",
    releaseDate: "2026-07-20",
    releaseLabel: "HPSA daily snapshot 2026-07-20",
    columns: {
      designationId: "HPSA ID",
      designationName: "HPSA Name",
      designationType: "Designation Type",
      discipline: "Discipline",
      status: "Status",
      countyFips: "County FIPS",
      geographyIdentificationNumber: "Geography ID",
      componentTypeDescription: "Component Type",
      componentSourceId: "Component ID",
      score: "HPSA Score",
      designationDate: "Designation Date",
      lastUpdateDate: "Last Update",
      recordCreateDate: "Record Create",
    },
  });
  const batch = await adapter.fetch(
    { geography: albany },
    { fetcher: staticFetcher(csv), cache: new InMemoryHttpCache(), now: "2026-07-20T12:00:00Z" },
  );
  assert.equal(batch.observations.length, 3);
  assert.equal(batch.observations[0].sourceRecordId, "A1:C1");
  assert.deepEqual(batch.observations.map((item) => item.geographyLevel), ["county", "population_group", "facility"]);
  assert.equal(batch.sourceVersion?.releaseDate, "2026-07-20");
  assert.equal(batch.observations[0].dataPeriodStart, "2024-01-01");
  assert.match(batch.warnings[0], /2 population-group, facility, or subcounty/i);
});

test("AHRQ CLH reports unavailable rather than parsing an unapproved XLSX release", async () => {
  const adapter = new AhrqClhIngestionAdapter({
    releaseLabel: "September 2025 release",
    releaseDate: "2025-09-01",
    artifactUrl: "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_county_2_0.xlsx",
    geographyKind: "county",
    geographyIdField: "county_fips",
    variables: [],
  });
  const batch = await adapter.fetch(
    { geography: albany },
    { fetcher: staticFetcher(""), cache: new InMemoryHttpCache(), now: "2026-07-20T12:00:00Z" },
  );
  assert.equal(batch.status, "unavailable");
  assert.match(batch.statusReason ?? "", /approved XLSX reader/i);
});

test("AHRQ CLH XLSX reader validates approved variables against the matching codebook", async () => {
  function fixtureXlsx(sheetName: string, rows: Array<Array<string | number>>) {
    const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const column = (index: number) => String.fromCharCode(65 + index);
    const sheetRows = rows.map((row, rowIndex) =>
      `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => typeof value === "number"
        ? `<c r="${column(columnIndex)}${rowIndex + 1}"><v>${value}</v></c>`
        : `<c r="${column(columnIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`).join("")}</row>`).join("");
    return Buffer.from(zipSync({
      "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
      "_rels/.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
      "xl/workbook.xml": strToU8(`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
      "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`),
    }));
  }
  const dataBytes = fixtureXlsx("Data", [
    ["YEAR", "COUNTYFIPS", "ACS_PCT_HH_NO_INTERNET"],
    [2023, "36001", 7.4],
  ]);
  const codebookBytes = fixtureXlsx("County", [
    ["Domain", "Topic", "Variable Name", "Variable Label"],
    ["Physical infrastructure", "Internet", "ACS_PCT_HH_NO_INTERNET", "Households with no internet"],
  ]);
  const fetcher: FetchLike = async (url) => {
    const bytes = url.includes("codebook") ? codebookBytes : dataBytes;
    return {
      status: 200,
      ok: true,
      headers: { get: () => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      async text() { return ""; },
      async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
    };
  };
  const reader = createAhrqXlsxReader({
    dataWorksheet: "Data",
    codebookReleaseLabel: "AHRQ CLH September 2025 / 2023 data",
    codebookUrl: "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_codebook_2_0.xlsx",
    approvedVariables: [{ variableId: "ACS_PCT_HH_NO_INTERNET", geographyKinds: ["county"] }],
  });
  const adapter = new AhrqClhIngestionAdapter({
    releaseLabel: "September 2025 release",
    releaseDate: "2025-09-01",
    artifactUrl: "https://www.ahrq.gov/sites/default/files/wysiwyg/sdoh/clh_2023_county_2_0.xlsx",
    geographyKind: "county",
    geographyIdField: "COUNTYFIPS",
    variables: [{
      sourceMeasureId: "ACS_PCT_HH_NO_INTERNET",
      name: "Households with no internet access",
      description: "AHRQ CLH variable validated against the 2023 county codebook.",
      universe: "Households",
      unit: "percent",
      higherValueMeaning: "adverse",
    }],
    reader,
  });
  const batch = await adapter.fetch(
    { geography: albany },
    { fetcher, cache: new InMemoryHttpCache(), now: "2026-07-23T00:00:00Z" },
  );
  assert.equal(batch.status, "available");
  assert.equal(batch.observations.length, 1);
  assert.equal(batch.observations[0].numericValue, 7.4);
});

test("runtime artifact adapters reject unapproved hosts before any network request", async () => {
  let fetched = false;
  const adapter = new AhrqClhIngestionAdapter({
    releaseLabel: "fixture",
    releaseDate: "2025-09-01",
    artifactUrl: "https://example.com/unapproved.xlsx",
    geographyKind: "county",
    geographyIdField: "county_fips",
    variables: [],
  });
  await assert.rejects(
    adapter.fetch(
      { geography: albany },
      {
        fetcher: async () => {
          fetched = true;
          return response("");
        },
        cache: new InMemoryHttpCache(),
        now: "2026-07-20T12:00:00Z",
      },
    ),
    /source URL validation failed/i,
  );
  assert.equal(fetched, false);
});
