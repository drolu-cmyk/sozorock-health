"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, BookmarkSimple, DownloadSimple, FilePdf, Trash } from "@phosphor-icons/react";
import { restoreSavedReportViews, type SavedReportView } from "../saved-view";
import { conditionMetrics, formatOrdinal, indicatorValue, planningBarrierMetrics } from "../lib/metrics";
import { profileEvidenceLabel, profileEstimateLabel } from "../lib/profile-evidence";
import type { ProfileResponse } from "../lib/types";
import sourceManifest from "../../data/source-manifest.json";

type Audience = "county" | "partner" | "research";
type ReportSection = "portrait" | "priorities" | "planning" | "governance";

const sectionOptions: { value: ReportSection; label: string }[] = [
  { value: "portrait", label: "System portrait" },
  { value: "priorities", label: "Health priorities and barriers" },
  { value: "planning", label: "CHA / CHIP planning questions" },
  { value: "governance", label: "Governance and AI safeguards" },
];

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function reportSource(response: ProfileResponse | null) {
  const source = response?.provenance.indicators ?? response?.provenance.geography;
  if (source) {
    return {
      label: source.dataset,
      url: source.url,
      released: source.vintage,
      method: source.method,
      caveat: response?.provenance.limitations.join(" ") ?? "",
    };
  }
  return {
    label: sourceManifest.indicators.source,
    url: sourceManifest.indicators.url,
    released: sourceManifest.indicators.released,
    method: "Committed nationwide county-level CDC PLACES snapshot.",
    caveat: sourceManifest.indicators.modeledEstimateNotice,
  };
}

function reportMarkup(
  response: ProfileResponse | null,
  audience: Audience,
  sections: ReportSection[],
  context: { generatedAt: string; viewUrl: string },
) {
  const profile = response?.profile ?? null;
  const name = profile?.name ?? "United States county view";
  const source = reportSource(response);
  const evidenceLabel = profileEvidenceLabel(response?.provenance);
  const conditionRows = profile
    ? conditionMetrics.map((metric) => ({ label: metric.label, value: indicatorValue(profile, metric.key) })).filter((item) => item.value !== null).slice(0, 5)
    : [];
  const barrierRows = profile
    ? planningBarrierMetrics.map((metric) => ({ label: metric.label, value: indicatorValue(profile, metric.key) })).filter((item) => item.value !== null).slice(0, 4)
    : [];
  const audienceLabel = audience === "county" ? "County planning brief" : audience === "partner" ? "Funding and partnership brief" : "Research and learning brief";
  const section = (id: ReportSection, title: string, body: string) => sections.includes(id) ? `<section><h2>${title}</h2>${body}</section>` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(name)} — CB-CAP brief</title><style>body{margin:0;color:#16231e;background:#f4f1e8;font:16px/1.55 Arial,sans-serif}main{max-width:900px;margin:auto;background:#fff;padding:64px}header{border-bottom:6px solid #b88a3c;padding-bottom:24px}header span{color:#6d4b32;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase}h1{margin:10px 0 6px;font:46px/1.05 Georgia,serif}h2{margin:0 0 12px;font:28px/1.1 Georgia,serif}section{padding:28px 0;border-bottom:1px solid #d9d6cc}dl{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}dl div{border:1px solid #d9d6cc;padding:14px}dt{color:#5d6a63;font-size:11px;text-transform:uppercase}dd{margin:6px 0 0;font-weight:700}table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}footer{padding-top:28px;color:#5d6a63;font-size:12px;overflow-wrap:anywhere}@media print{body{background:#fff}main{padding:0}}@media(max-width:650px){main{padding:28px}h1{font-size:36px}dl{grid-template-columns:1fr}}</style></head><body><main><header><span>${audienceLabel}</span><h1>${escapeHtml(name)}</h1><p>County-Based Community Access Platform (CB-CAP) · Stakeholder preview</p><p><strong>Evidence basis:</strong> ${escapeHtml(evidenceLabel)}</p></header>${section("portrait", "Place profile", profile ? `<dl><div><dt>Geography</dt><dd>${escapeHtml(profile.context)}</dd></div><div><dt>Population</dt><dd>${profile.population === null ? "Not available" : profile.population.toLocaleString("en-US")}</dd></div><div><dt>Measure coverage</dt><dd>${profile.dataCoverage}%</dd></div><div><dt>Planning attention</dt><dd>${formatOrdinal(profile.planning.planningPressure)}</dd></div></dl>` : "<p>Select a geography in CB-CAP to populate this section.</p>")}${section("priorities", "Health measures and practical barriers", profile?.sourceStatus === "available" ? `<p><strong>${escapeHtml(profileEstimateLabel(response?.provenance))}.</strong> Not a priority ranking; eligible populations vary by measure.</p><h3>Condition estimates</h3><table><thead><tr><th>Measure</th><th>Estimate</th></tr></thead><tbody>${conditionRows.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.value!.toFixed(1)}%</td></tr>`).join("")}</tbody></table><h3>Pathway-barrier estimates</h3><table><thead><tr><th>Measure</th><th>Estimate</th></tr></thead><tbody>${barrierRows.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${item.value!.toFixed(1)}%</td></tr>`).join("")}</tbody></table>` : "<p>No compatible CDC PLACES profile is available for this selection.</p>")}${section("planning", "CHA / CHIP planning questions", "<ul><li>Which local evidence and lived experience confirm or challenge these signals?</li><li>Where do access, digital, workforce, and provider-led pathways break down?</li><li>Which Health Equity Hub or Health Access Day capabilities should be tested?</li><li>Who owns each action, safeguard, measure, and review date?</li></ul>")}${section("governance", "AI-assisted briefing and governance", "<p>CB-CAP separates resident-facing support from county-level systems intelligence. AI-generated synthesis must cite displayed sources, preserve missing values, and remain subject to human review. This brief does not diagnose, triage, recommend treatment, or predict individual health outcomes.</p>")}<footer><strong>The SozoRock Foundation, Inc.</strong><p><strong>Generated:</strong> ${escapeHtml(context.generatedAt)} · <strong>View and filter context:</strong> ${escapeHtml(context.viewUrl)}</p><p><strong>Privacy and suppression:</strong> Public aggregate or model-based area estimates only; no individual-level data. Missing, unavailable, or suppressed values are not inferred.</p><p><strong>Source:</strong> <a href="${escapeHtml(source.url)}">${escapeHtml(source.label)}</a>. Vintage or release: ${escapeHtml(source.released)}.</p><p><strong>Method:</strong> ${escapeHtml(source.method)}</p><p>${escapeHtml(source.caveat)}</p><p>Confirm source definitions, local context, governance, community participation, and accountable human review before action.</p></footer></main></body></html>`;
}

export function ReportStudio({ response }: { response: ProfileResponse | null }) {
  const profile = response?.profile ?? null;
  const [audience, setAudience] = useState<Audience>("county");
  const [sections, setSections] = useState<ReportSection[]>(sectionOptions.map((option) => option.value));
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSavedViews(restoreSavedReportViews(
      localStorage.getItem("cbcap-public-saved-views") ?? "[]",
      window.location.origin,
    ));
  }, []);

  const buildReport = () => reportMarkup(response, audience, sections, {
    generatedAt: new Date().toISOString(),
    viewUrl: window.location.href,
  });
  const toggleSection = (section: ReportSection) => setSections((current) => current.includes(section) ? current.filter((item) => item !== section) : [...current, section]);
  const openBrief = () => {
    const report = buildReport();
    const url = URL.createObjectURL(new Blob([report], { type: "text/html;charset=utf-8" }));
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const downloadBrief = () => {
    const report = buildReport();
    const url = URL.createObjectURL(new Blob([report], { type: "text/html;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `cbcap-${profile?.geoid ?? "national"}-stakeholder-brief.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setMessage("Accessible stakeholder brief downloaded.");
  };
  const saveView = () => {
    const view: SavedReportView = {
      id: crypto.randomUUID(),
      label: profile?.name ?? "Nationwide view",
      url: window.location.href,
      createdAt: new Date().toISOString(),
    };
    const next = [view, ...savedViews.filter((saved) => saved.url !== view.url)].slice(0, 8);
    setSavedViews(next);
    localStorage.setItem("cbcap-public-saved-views", JSON.stringify(next));
    setMessage(`${view.label} saved in this browser.`);
  };
  const removeView = (id: string) => {
    const next = savedViews.filter((view) => view.id !== id);
    setSavedViews(next);
    localStorage.setItem("cbcap-public-saved-views", JSON.stringify(next));
  };

  return (
    <section className="report-studio" id="reports" aria-labelledby="reports-heading">
      <div className="report-builder">
        <header><span>Briefs and exports</span><h2 id="reports-heading">Turn the current view into a stakeholder-ready brief.</h2><p>Choose an audience and the evidence that belongs in the conversation. No login is required; saved views stay in this browser.</p></header>
        <div className="report-controls">
          <label><span>Audience</span><select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}><option value="county">County planning</option><option value="partner">Funding and partnership</option><option value="research">Research and learning</option></select></label>
          <fieldset><legend>Include</legend>{sectionOptions.map((option) => <label key={option.value}><input type="checkbox" checked={sections.includes(option.value)} onChange={() => toggleSection(option.value)} />{option.label}</label>)}</fieldset>
        </div>
        <div className="report-actions">
          <button type="button" onClick={openBrief} disabled={!sections.length}><FilePdf size={18} aria-hidden="true" />Open print-ready brief</button>
          <button type="button" onClick={downloadBrief} disabled={!sections.length}><DownloadSimple size={18} aria-hidden="true" />Download accessible brief</button>
          <button type="button" onClick={saveView}><BookmarkSimple size={18} aria-hidden="true" />Save this view</button>
        </div>
        <p className="report-note">Evidence basis: {profileEvidenceLabel(response?.provenance)}. Exports include generation time, the current filter URL, source vintage and method, missing-data treatment, and privacy status. Use the browser’s Print command in the print-ready brief to save a customized PDF. {message && <span role="status">{message}</span>}</p>
      </div>
      <aside className="saved-views" aria-labelledby="saved-views-heading">
        <span>Browser-local workspace</span><h3 id="saved-views-heading">Saved views</h3>
        {!savedViews.length ? <p>Save a geography and filter combination to return to it later on this device.</p> : <ul>{savedViews.map((view) => <li key={view.id}><a href={view.url}>{view.label}<small>{new Date(view.createdAt).toLocaleDateString("en-US")}</small><ArrowSquareOut size={14} aria-hidden="true" /></a><button type="button" onClick={() => removeView(view.id)} aria-label={`Remove saved view ${view.label}`}><Trash size={16} aria-hidden="true" /></button></li>)}</ul>}
      </aside>
    </section>
  );
}
