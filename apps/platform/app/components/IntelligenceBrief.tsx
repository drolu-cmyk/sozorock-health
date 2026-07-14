"use client";

import { ArrowRight, Brain, CheckCircle, Database, Scales, UserFocus } from "@phosphor-icons/react";
import { conditionMetrics, displayedBenchmarkComparison, planningBarrierMetrics } from "../lib/metrics";
import { profileEstimateLabel, type ProfileProvenance } from "../lib/profile-evidence";
import type { BenchmarkProfile, GeographyProfile } from "../lib/types";

export function IntelligenceBrief({
  profile,
  provenance,
  nationalBenchmark,
}: {
  profile: GeographyProfile | null;
  provenance: ProfileProvenance | null;
  nationalBenchmark: BenchmarkProfile;
}) {
  const displayedCondition = profile
    ? displayedBenchmarkComparison(profile, nationalBenchmark, conditionMetrics)
    : null;
  const displayedBarrier = profile
    ? displayedBenchmarkComparison(profile, nationalBenchmark, planningBarrierMetrics)
    : null;
  return (
    <section className="intelligence-section" id="intelligence" aria-labelledby="intelligence-heading">
      <div className="intelligence-copy">
        <span>AI-assisted briefing with human review</span>
        <h2 id="intelligence-heading">AI drafts. People decide.</h2>
        <p>CB-CAP is structured to prepare source-linked drafts, organize accountable workflows, and preserve human judgment without allowing a model to invent data or make clinical decisions.</p>
        <div className="intelligence-loop" role="list" aria-label="Governed intelligence workflow">
          {[
            { Icon: Database, label: "Ingest evidence" },
            { Icon: CheckCircle, label: "Validate coverage" },
            { Icon: Scales, label: "Compare context" },
            { Icon: Brain, label: "Draft brief" },
            { Icon: UserFocus, label: "Human review" },
            { Icon: Scales, label: "Approve action" },
            { Icon: CheckCircle, label: "Monitor and learn" },
          ].map(({ Icon, label }, index) => (
            <div role="listitem" key={label}><Icon size={20} weight="duotone" aria-hidden="true" /><strong>{label}</strong>{index < 6 && <ArrowRight size={14} aria-hidden="true" />}</div>
          ))}
        </div>
      </div>
      <aside className="brief-preview" aria-label="Source-linked briefing preview">
        <header><span>Source-linked planning brief</span><small>Drafted only from the evidence shown</small></header>
        {!profile || profile.sourceStatus === "not-available" ? (
          <div className="brief-empty"><strong>Select a covered geography.</strong><p>The brief will cite only the evidence shown on screen.</p></div>
        ) : (
          <div className="brief-sections">
            <section><span>{profileEstimateLabel(provenance)} · condition</span><p>{displayedCondition ? `${displayedCondition.metric.label} is ${displayedCondition.value.toFixed(1)}%, ${Math.abs(displayedCondition.gap).toFixed(1)} percentage points ${displayedCondition.gap >= 0 ? "above" : "below"} the national county benchmark for the same measure.` : "No comparable condition estimate is available."}</p></section>
            <section><span>{profileEstimateLabel(provenance)} · pathway barrier</span><p>{displayedBarrier ? `${displayedBarrier.metric.label} is ${displayedBarrier.value.toFixed(1)}%, ${Math.abs(displayedBarrier.gap).toFixed(1)} percentage points ${displayedBarrier.gap >= 0 ? "above" : "below"} the national county benchmark for the same measure.` : "No comparable pathway-barrier estimate is available."}</p></section>
            <section><span>Interpretation boundary</span><p>Measures appear in a fixed source order. State values are derived summaries when labeled as such. They are not a priority ranking, and eligible populations vary by measure.</p></section>
            <section><span>Planning question</span><p>Which community, workforce, digital, and provider-led assets should be tested against this pattern before a priority or intervention is chosen?</p></section>
            <section><span>Where partnership could add capacity</span><p>Validate local barriers, map existing assets, and identify the workforce, technology, cybersecurity, and governance support needed.</p></section>
            <section><span>What a funded pilot could enable</span><p>Test a bounded Health Equity Hub or Health Access Day pathway in one geography, document decisions, and learn before expansion.</p></section>
            <section><span>How progress could be measured</span><p>Agree on a local baseline, reach, pathway readiness, accountable owner, review date, and provider-led follow-through before implementation.</p></section>
          </div>
        )}
        <footer><strong>Human review required</strong><span>Demonstration only—not a funding recommendation. Planned AI capability · no diagnosis, triage, treatment, or individual-level prediction.</span></footer>
      </aside>
    </section>
  );
}
