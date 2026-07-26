import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PARTNER_EVIDENCE_REVIEW_CASES } from "../src/decision-support/review-cases.ts";
import { isConcernSignal } from "../src/decision-support/quality.ts";
import type { CaseForActionPackage } from "../src/decision-support/types.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");
const outputDir = path.join(repoRoot, "output", "pdf", "milestone-6");
mkdirSync(outputDir, { recursive: true });

function escape(value: string | number) {
  return String(value).replace(/[‐‑‒–—―]/g, "-").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

function formatDate(value: string) {
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01T00:00:00Z` : value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: /^\d{4}-\d{2}$/.test(value) ? undefined : "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(normalized));
}

function bars(value: CaseForActionPackage) {
  return value.publicData.signals.map((signal) => `
    <article class="metric">
      <div class="metric-title"><div><h3>${escape(signal.label)}</h3><p>${escape(signal.definition)}</p></div><span class="${isConcernSignal(signal) ? "concern" : "context"}">${escape(isConcernSignal(signal) ? "Needs local attention" : signal.interpretation === "favorable_signal" ? "Favorable context" : "Context only")}</span></div>
      <div class="bar"><b>Place</b><i><em class="${isConcernSignal(signal) ? "fill concern-fill" : "fill"}" style="width:${signal.localValue}%"></em></i><strong>${signal.localValue.toFixed(1)}%</strong></div>
      <div class="bar"><b>U.S. counties</b><i><em class="fill comparison" style="width:${signal.comparisonValue}%"></em></i><strong>${signal.comparisonValue.toFixed(1)}%</strong></div>
      <small>95% confidence interval ${escape(signal.confidenceInterval ?? "not reported")} · Release ${escape(formatDate(signal.releaseDate))}</small>
    </article>`).join("");
}

function sourceRows(value: CaseForActionPackage) {
  return value.sources.map((source) => `<tr><th><a href="${escape(source.officialUrl)}">${escape(source.title)}</a><span>${escape(source.publisher)}</span></th><td>${escape(formatDate(source.releaseDate))}</td><td>${escape(source.dataPeriod)}</td><td>${escape(source.geography)}</td><td><b class="${source.reviewStatus === "verified" ? "verified" : "provisional"}">${escape(source.reviewStatus)}</b></td></tr>`).join("");
}

function internalReview(value: CaseForActionPackage) {
  return `<section class="internal"><p class="eyebrow">Internal source review</p><h2>Claims awaiting a human decision</h2><p>${escape(value.internalReview.summary)}</p><div class="claims">${value.internalReview.claimsAwaitingReview.map((claim) => `<article><header>${escape(claim.type.replaceAll("_", " "))}<b>Provisional</b></header><h3>${escape(claim.statement)}</h3><blockquote>“${escape(claim.exactExcerpt)}”</blockquote><small>Page ${claim.page} · ${escape(claim.section)}</small></article>`).join("")}</div><h3>Required decisions</h3><ul>${value.internalReview.decisionsRequired.map((item) => `<li>${escape(item)}</li>`).join("")}</ul></section>`;
}

function document(value: CaseForActionPackage, mode: "public" | "internal") {
  const localPlanStatus = value.evidenceStatus.localPlan === "verified" ? "Verified" : "Not yet verified";
  const resourceStatus = value.evidenceStatus.resourceCoverage === "verified" ? "Verified" : "No verified records";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(value.place.displayName)} — evidence brief</title><style>
  @page{size:Letter;margin:.42in}*{box-sizing:border-box}body{margin:0;color:#101917;background:#fff;font:10.5pt Arial,sans-serif;line-height:1.35}a{color:#143f31}.mast{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #101917;padding-bottom:10px}.brand{font:700 22pt Georgia,serif}.brand sup{font:8pt Arial,sans-serif}.review{border:1px solid #9b5907;color:#7a4300;padding:6px 9px;font-size:8pt;font-weight:800;text-transform:uppercase}.hero{display:grid;grid-template-columns:1.6fr .7fr;gap:28px;padding:28px 0 18px;border-bottom:1px solid #cfd2ca}.eyebrow{margin:0 0 7px;color:#143f31;font-size:7.5pt;font-weight:800;letter-spacing:1px;text-transform:uppercase}h1{margin:0;font:700 36pt/1 Georgia,serif;letter-spacing:-1.2px}h2{margin:0 0 8px;font:700 21pt/1.05 Georgia,serif}h3{margin:0 0 4px;font-size:10pt}.summary{margin-top:14px;color:#36413d;font-size:11pt}.scope{padding:12px;background:#fff3df;border-left:3px solid #9b5907}.scope b{display:block;color:#7a4300}.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:18px 0;background:#cfd2ca;border:1px solid #cfd2ca}.status-grid article{min-height:100px;padding:12px;background:#fff}.status-grid span{display:block;color:#53605b;font-size:7pt;font-weight:800;text-transform:uppercase}.status-grid strong{display:block;margin:10px 0 5px;font-size:15pt}.status-grid p{margin:0;color:#53605b;font-size:8.5pt}.section{padding:18px 0;border-bottom:1px solid #cfd2ca}.source-ledger{break-before:page}.intro{display:grid;grid-template-columns:.8fr 1fr;gap:24px;margin-bottom:10px}.intro p{margin:0;color:#53605b}.metrics{border-top:1px solid #101917}.metric{display:grid;grid-template-columns:1fr 1.45fr;column-gap:20px;padding:10px 0;border-bottom:1px solid #d9dbd5;break-inside:avoid}.metric-title{grid-row:span 3;display:flex;gap:8px;justify-content:space-between}.metric-title p{margin:0;color:#53605b;font-size:7.7pt}.metric-title span{height:max-content;padding:3px 5px;white-space:nowrap;font-size:6.5pt;font-weight:800;text-transform:uppercase}.concern{color:#7a4300;background:#fff3df}.context{color:#143f31;background:#e4eee8}.bar{display:grid;grid-template-columns:58px 1fr 38px;gap:7px;align-items:center;font-size:7.4pt}.bar b{color:#53605b}.bar i{height:7px;background:#e2e3dc}.fill{display:block;height:100%;background:#143f31}.comparison{background:#234d72}.concern-fill{background:#a75a10}.metric small{grid-column:2;color:#66716d}.path{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #cfd2ca}.path article{min-height:112px;padding:10px;border-right:1px solid #cfd2ca;break-inside:avoid}.path article:last-child{border:0}.path span{font-size:6.5pt;font-weight:800;text-transform:uppercase;color:#53605b}.path p{font-size:8pt}.path small{color:#7a4300;font-size:6.5pt;font-weight:800;text-transform:uppercase}.three{display:grid;grid-template-columns:1fr 1fr 1fr}.three article{padding:17px;border-right:1px solid #cfd2ca}.three article:first-child{padding-left:0}.three article:last-child{border:0}.three ul{padding-left:16px}.three li{margin-bottom:5px;color:#48534f;font-size:8.2pt}.three li b,.three li span{display:block}.fit{display:inline-block;padding:4px 6px;border:1px solid #9b5907;color:#7a4300;font-size:6.5pt;font-weight:800;text-transform:uppercase}table{width:100%;border-collapse:collapse;font-size:7.2pt}th,td{padding:6px;text-align:left;vertical-align:top;border-bottom:1px solid #d9dbd5}thead th{color:#53605b;font-size:6.5pt;text-transform:uppercase}tbody th{max-width:180px}tbody th span{display:block;color:#53605b;font-weight:400}.verified,.provisional{padding:2px 4px;text-transform:uppercase;font-size:6pt}.verified{color:#143f31;background:#e4eee8}.provisional{color:#7a4300;background:#fff3df}.disclosure{padding:15px 0;color:#53605b;font-size:7.4pt}.disclosure p{margin:4px 0}.internal{page-break-before:always;padding-top:15px}.claims{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#4d5652;border:1px solid #4d5652}.claims article{padding:12px;background:#18231f;color:#f8f7f1;break-inside:avoid}.claims header{display:flex;justify-content:space-between;color:#a8c7b7;font-size:6.5pt;text-transform:uppercase}.claims header b{color:#ffc766}.claims blockquote{margin:8px 0;padding-left:8px;border-left:2px solid #6c8b7c;color:#dce7e1;font:9pt/1.4 Georgia,serif}.claims small{color:#a8c7b7}.foot{display:flex;justify-content:space-between;padding-top:8px;color:#68736e;font-size:6.5pt}
  </style></head><body>
  <header class="mast"><div class="brand">SozoRock<sup>®</sup> Health</div><div>Partner evidence brief · ${escape(mode === "internal" ? "internal detail" : "external preview")}</div></header>
  <section class="hero"><div><p class="eyebrow">Case for action · ${escape(value.place.displayName)}</p><h1>A case for action—without inventing one.</h1><p class="summary">${escape(value.executiveSummary)}</p></div><aside class="scope"><b>Review only</b><p>Not approved for public distribution.</p><small>Editable evidence brief<br>Generated ${escape(formatDate(value.generatedAt))}</small></aside></section>
  <section class="status-grid"><article><span>Local-plan alignment</span><strong>${escape(localPlanStatus)}</strong><p>${escape(value.localPlan.publicStatement)}</p></article><article><span>Current public data</span><strong>Verified</strong><p>${value.publicData.signals.length} reviewed county-level measures are shown.</p></article><article><span>Verified assets</span><strong>${escape(resourceStatus)}</strong><p>${escape(value.resourceCoverage.publicStatement)}</p></article></section>
  <section class="section"><div class="intro"><div><p class="eyebrow">Current public-data context</p><h2>Read the direction before the number.</h2></div><p>${escape(value.publicData.publicStatement)}</p></div><div class="metrics">${bars(value)}</div><p style="font-size:7pt;color:#53605b">Comparison: average across county estimates in the same release, not a population-weighted national prevalence estimate.</p></section>
  <section class="section"><p class="eyebrow">Evidence pathway</p><h2>From signal to a decision worth testing.</h2><div class="path">${value.responseConcept.pathway.map((item) => `<article><span>${escape(item.stage)}</span><p>${escape(item.statement)}</p><small>${escape(item.status === "verified" ? "Verified evidence" : item.status === "missing" ? "Evidence missing" : "Partner review required")}</small></article>`).join("")}</div></section>
  <section class="three"><article><p class="eyebrow">Potential response</p><h2>${escape(value.responseConcept.title)}</h2><b class="fit">${escape(value.responseConcept.status)}</b><p>${escape(value.responseConcept.summary)}</p></article><article><p class="eyebrow">Evidence gaps</p><h2>What must be closed first.</h2><ul>${value.evidenceGaps.map((item) => `<li>${escape(item)}</li>`).join("")}</ul></article><article><p class="eyebrow">Measures of progress</p><h2>Proposed—not promised.</h2><ul>${value.progressMeasures.map((item) => `<li><b>${escape(item.label)}</b><span>${escape(item.definition)}</span></li>`).join("")}</ul></article></section>
  <section class="section source-ledger"><p class="eyebrow">Source ledger</p><h2>Every visible claim keeps its dates and scope.</h2><table><thead><tr><th>Source</th><th>Release</th><th>Data period</th><th>Geography</th><th>Review</th></tr></thead><tbody>${sourceRows(value)}</tbody></table></section>
  ${mode === "internal" ? internalReview(value) : ""}
  <section class="disclosure"><b>Boundaries and disclosures</b>${value.disclosures.map((item) => `<p>${escape(item)}</p>`).join("")}<p>${escape(value.place.geographyCaveat)}</p></section>
  <footer class="foot"><span>${escape(value.id)} · ${escape(value.schemaVersion)}</span><span>The SozoRock Foundation, Inc.</span></footer>
  </body></html>`;
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const [key, value] of Object.entries(PARTNER_EVIDENCE_REVIEW_CASES)) {
  for (const mode of ["public", "internal"] as const) {
    const basename = `${key}-county-${mode === "public" ? "evidence-brief" : "internal-review"}`;
    const htmlPath = path.join(outputDir, `${basename}.html`);
    const pdfPath = path.join(outputDir, `${basename}.pdf`);
    const html = document(value, mode);
    writeFileSync(htmlPath, html, "utf8");
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({ path: pdfPath, format: "Letter", printBackground: true, preferCSSPageSize: true });
    await page.close();
  }
}
await browser.close();

console.log(JSON.stringify({ outputDir, renderer: "Playwright Chromium", cases: Object.keys(PARTNER_EVIDENCE_REVIEW_CASES) }, null, 2));
