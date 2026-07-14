"use client";

import { ArrowRight, Brain, CheckCircle, Database, Scales, UserFocus } from "@phosphor-icons/react";
import { conditionMetrics, displayedBenchmarkComparison, planningBarrierMetrics } from "../lib/metrics";
import type { BenchmarkProfile, GeographyProfile } from "../lib/types";

export function IntelligenceBrief({
  profile,
  nationalBenchmark,
}: {
  profile: GeographyProfile | null;
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
        <span>Governed AI and automation</span>
        <h2 id="intelligence-heading">Facts first. Synthesis second. Human judgment stays visible.</h2>
        <p>CB-CAP is structured for source-cited AI briefs, workflow orchestration, and continuous learning without allowing a model to invent data or make clinical decisions.</p>
        <div className="intelligence-loop" aria-label="Governed intelligence workflow">
          {[
            { Icon: Database, label: "Validate sources" },
            { Icon: Brain, label: "Draft insight" },
            { Icon: UserFocus, label: "Human review" },
            { Icon: Scales, label: "Approve action" },
            { Icon: CheckCircle, label: "Measure and learn" },
          ].map(({ Icon, label }, index) => (
            <div key={label}><Icon size={20} weight="duotone" aria-hidden="true" /><strong>{label}</strong>{index < 4 && <ArrowRight size={14} aria-hidden="true" />}</div>
          ))}
        </div>
      </div>
      <aside className="brief-preview" aria-label="Evidence-grounded briefing preview">
        <header><span>Evidence-grounded planning brief</span><small>Generated from the displayed public data</small></header>
        {!profile || profile.sourceStatus === "not-available" ? (
          <div className="brief-empty"><strong>Select a covered geography.</strong><p>The brief will cite only the evidence shown on screen.</p></div>
        ) : (
          <div className="brief-sections">
            <section><span>Published model-based condition estimate</span><p>{displayedCondition ? `${displayedCondition.metric.label} is ${displayedCondition.value.toFixed(1)}%, ${Math.abs(displayedCondition.gap).toFixed(1)} percentage points ${displayedCondition.gap >= 0 ? "above" : "below"} the national county benchmark for the same measure.` : "No comparable condition estimate is available."}</p></section>
            <section><span>Published model-based pathway-barrier estimate</span><p>{displayedBarrier ? `${displayedBarrier.metric.label} is ${displayedBarrier.value.toFixed(1)}%, ${Math.abs(displayedBarrier.gap).toFixed(1)} percentage points ${displayedBarrier.gap >= 0 ? "above" : "below"} the national county benchmark for the same measure.` : "No comparable pathway-barrier estimate is available."}</p></section>
            <section><span>Interpretation boundary</span><p>Measures appear in a fixed published order. They are not a priority ranking, and eligible populations vary by measure.</p></section>
            <section><span>Planning question</span><p>Which community, workforce, digital, and provider-led assets should be tested against this pattern before a priority or intervention is chosen?</p></section>
          </div>
        )}
        <footer><strong>Human review required</strong><span>No diagnosis, triage, treatment, or individual-level prediction.</span></footer>
      </aside>
    </section>
  );
}
