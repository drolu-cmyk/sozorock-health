"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, ShieldCheck } from "@phosphor-icons/react";
import { MAX_PLANNING_DRAFT_ITEMS, restorePlanningDraft } from "../saved-view";
import { conditionMetrics, indicatorValue, planningBarrierMetrics } from "../lib/metrics";
import { profileEstimateLabel, type ProfileProvenance } from "../lib/profile-evidence";
import type { BenchmarkProfile, GeographyProfile, MetricDefinition } from "../lib/types";

type PlanningSignal = {
  id: string;
  metric: MetricDefinition;
  value: number;
  benchmark: number | null;
  difference: number | null;
  question: string;
  action: string;
  measure: string;
};

function benchmarkValue(benchmark: BenchmarkProfile, metric: MetricDefinition) {
  if (metric.group === "condition") return benchmark.conditions[metric.key as keyof BenchmarkProfile["conditions"]];
  return benchmark.barriers[metric.key as keyof BenchmarkProfile["barriers"]];
}

export function PlanningWorkspace({
  profile,
  provenance,
  nationalBenchmark,
}: {
  profile: GeographyProfile | null;
  provenance: ProfileProvenance | null;
  nationalBenchmark: BenchmarkProfile;
}) {
  const [draft, setDraft] = useState<string[]>([]);
  useEffect(() => {
    setDraft(restorePlanningDraft(localStorage.getItem("cbcap-public-planning-draft") ?? "[]"));
  }, []);

  const signals = useMemo<PlanningSignal[]>(() => {
    if (!profile) return [];
    const candidates = [...conditionMetrics, ...planningBarrierMetrics].flatMap((metric) => {
      const value = indicatorValue(profile, metric.key);
      if (value === null) return [];
      const benchmark = benchmarkValue(nationalBenchmark, metric);
      const difference = benchmark === null ? null : value - benchmark;
      const isBarrier = metric.group === "barrier";
      return [{
        id: `${profile.kind}:${profile.geoid}:${String(metric.key)}`,
        metric,
        value,
        benchmark,
        difference,
        question: isBarrier
          ? `Where does ${metric.shortLabel.toLowerCase()} interrupt an existing pathway?`
          : `Which prevention, education, or provider-led pathways align with this pattern?`,
        action: isBarrier
          ? "Map trusted resources, digital support, language needs, and accountable handoffs."
          : "Confirm the pattern with local evidence and licensed/public-health partners.",
        measure: isBarrier
          ? "Barrier resolved or pathway completed"
          : "Local baseline, reach, readiness, and provider-led follow-through",
      }];
    });
    return candidates.slice(0, 5);
  }, [nationalBenchmark, profile]);

  const currentDraftCount = signals.filter((signal) => draft.includes(signal.id)).length;

  const toggle = (id: string) => {
    setDraft((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id].slice(-MAX_PLANNING_DRAFT_ITEMS);
      localStorage.setItem("cbcap-public-planning-draft", JSON.stringify(next));
      return next;
    });
  };

  return (
    <section className="analysis-panel planning-workspace" id="cha-chip" aria-labelledby="planning-heading">
      <header className="panel-heading">
        <div>
          <span>CHA / CHIP workspace</span>
          <h2 id="planning-heading">Move from evidence to interpretation, a practical lever, and accountable review.</h2>
          <p>Build a source-linked shortlist for Community Health Assessment and Community Health Improvement Plan discussions without replacing local governance or community ownership.</p>
        </div>
        <div className="draft-status"><ShieldCheck size={18} aria-hidden="true" /><strong>{currentDraftCount}</strong> saved for this geography</div>
      </header>
      {!profile ? (
        <div className="planning-empty">
          <strong>Select a geography to generate an evidence shortlist.</strong>
          <p>CB-CAP will separate source-linked estimates, derived summaries, comparisons, questions, actions, and measures.</p>
        </div>
      ) : profile.sourceStatus === "not-available" ? (
        <div className="planning-empty">
          <strong>No PLACES profile is available for {profile.name}.</strong>
          <p>The geography remains searchable. A responsible planning workflow shows the coverage gap instead of manufacturing a priority.</p>
        </div>
      ) : (
        <div className="evidence-matrix" role="table" aria-label={`Planning evidence for ${profile.name}`}>
          <div className="evidence-matrix__header" role="row">
            <span role="columnheader">Signal</span>
            <span role="columnheader">Evidence</span>
            <span role="columnheader">Planning question</span>
            <span role="columnheader">Action and measure</span>
            <span role="columnheader">Draft</span>
          </div>
          {signals.map((signal) => {
            const selected = draft.includes(signal.id);
            return (
              <div className="evidence-matrix__row" role="row" key={signal.id}>
                <div role="cell"><strong>{signal.metric.shortLabel}</strong><small>{signal.metric.group === "condition" ? "Health priority" : "Barrier"}</small></div>
                <div role="cell"><strong>{signal.value.toFixed(1)}%</strong><small>{profileEstimateLabel(provenance)} · {signal.difference === null ? "No national comparison" : `${signal.difference >= 0 ? "+" : ""}${signal.difference.toFixed(1)} points vs national county benchmark`}</small></div>
                <p role="cell">{signal.question}</p>
                <div role="cell"><p>{signal.action}</p><small>Measure: {signal.measure}</small></div>
                <div role="cell"><button type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} onClick={() => toggle(signal.id)}>{selected ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}<span className="sr-only">{selected ? "Remove" : "Add"} {signal.metric.shortLabel} {selected ? "from" : "to"} the {profile.name} planning draft</span></button></div>
              </div>
            );
          })}
        </div>
      )}
      <div className="planning-sequence" role="list" aria-label="CHA and CHIP support sequence">
        {[
          ["Evidence", "See the source, coverage, value, and uncertainty."],
          ["Interpretation", "Add community experience and local records."],
          ["Lever", "Name a practical policy, pathway, or capacity response."],
          ["Owner", "Assign accountable organizations and safeguards."],
          ["Measure", "Set a baseline, objective, and review date."],
          ["Review", "Explain results, learn, and revise together."],
        ].map(([title, copy]) => (
          <div role="listitem" key={title}><strong>{title}</strong><p>{copy}</p></div>
        ))}
      </div>
      <p className="panel-source">Evidence basis: {profileEstimateLabel(provenance)}. Displayed measures follow a fixed source order and are not a priority ranking. CB-CAP supports CHA/CHIP evidence and workflow; it does not replace community participation, health-department governance, or official priority-setting.</p>
    </section>
  );
}
