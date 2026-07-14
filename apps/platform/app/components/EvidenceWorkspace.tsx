"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle,
  ClockCountdown,
  Database,
  GlobeHemisphereWest,
} from "@phosphor-icons/react";
import registryData from "../../data/evidence-registry.json";
import type { EvidenceIntegrationStatus, EvidenceRegistry } from "../lib/types";

type EvidenceFilter = "displayed" | "planned" | "all";

const registry = registryData as EvidenceRegistry;

const statusCopy: Record<EvidenceIntegrationStatus, { label: string; detail: string }> = {
  "integrated-snapshot": {
    label: "Displayed nationwide",
    detail: "Versioned snapshot in this public release",
  },
  "integrated-on-demand": {
    label: "Checked when selected",
    detail: "Official source lookup for the chosen geography",
  },
  "official-guidance": {
    label: "Planning guidance",
    detail: "Official reference, not a statistical measure",
  },
  "planned-ingestion": {
    label: "Prepared for governed ingestion",
    detail: "Source is registered but its measures are not displayed",
  },
};

function isDisplayed(status: EvidenceIntegrationStatus) {
  return status !== "planned-ingestion";
}

export function EvidenceWorkspace() {
  const [filter, setFilter] = useState<EvidenceFilter>("displayed");
  const displayedSources = registry.sources.filter((source) => isDisplayed(source.integrationStatus));
  const plannedSources = registry.sources.filter((source) => !isDisplayed(source.integrationStatus));
  const sources = useMemo(() => registry.sources.filter((source) => {
    if (filter === "displayed") return isDisplayed(source.integrationStatus);
    if (filter === "planned") return !isDisplayed(source.integrationStatus);
    return true;
  }), [filter]);

  return (
    <section className="evidence-workspace" id="evidence" aria-labelledby="evidence-heading">
      <header className="evidence-workspace__heading">
        <div>
          <span>Evidence registry</span>
          <h2 id="evidence-heading">Know what is on the screen—and what is not.</h2>
          <p>Every public source is classified by coverage, freshness, geography, purpose, and integration status. Registered future sources are never presented as current findings.</p>
        </div>
        <dl className="evidence-workspace__summary">
          <div><dt>Displayed or checked on demand</dt><dd>{displayedSources.length}</dd></div>
          <div><dt>Prepared, not displayed</dt><dd>{plannedSources.length}</dd></div>
          <div><dt>Registry verified</dt><dd>{registry.verifiedAt}</dd></div>
        </dl>
      </header>

      <div className="evidence-coverage" role="list" aria-label="Nationwide geography availability">
        <div role="listitem"><GlobeHemisphereWest size={22} weight="duotone" aria-hidden="true" /><span><strong>{registry.geographySearch.statesAndDistrictOfColumbia.count}</strong> state and D.C. views</span></div>
        <div role="listitem"><Database size={22} weight="duotone" aria-hidden="true" /><span><strong>{registry.geographySearch.countyEquivalents.count.toLocaleString("en-US")}</strong> county equivalents</span></div>
        <div role="listitem"><CheckCircle size={22} weight="duotone" aria-hidden="true" /><span><strong>On demand</strong> cities, places, towns, and localities</span></div>
        <div role="listitem"><ClockCountdown size={22} weight="duotone" aria-hidden="true" /><span><strong>ZIP-linked</strong> Census ZCTA lookup</span></div>
      </div>

      <div className="evidence-filter" role="group" aria-label="Filter evidence registry">
        {([
          ["displayed", "Displayed now"],
          ["planned", "Prepared next"],
          ["all", "All registered sources"],
        ] as const).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={filter === value ? "is-active" : ""}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="evidence-ledger-table" role="table" aria-label="CB-CAP source registry">
        <div className="evidence-ledger-table__header" role="row">
          <span role="columnheader">Source</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Planning use</span>
          <span role="columnheader">Coverage and release</span>
          <span role="columnheader"><span className="sr-only">Official source</span></span>
        </div>
        {sources.map((source) => {
          const status = statusCopy[source.integrationStatus];
          return (
            <div className="evidence-ledger-table__row" role="row" key={source.id}>
              <div role="cell"><strong>{source.label}</strong><small>{source.agency}</small></div>
              <div role="cell" data-status={isDisplayed(source.integrationStatus) ? "displayed" : "planned"}><strong>{status.label}</strong><small>{status.detail}</small></div>
              <p role="cell">{source.purpose}</p>
              <div role="cell"><strong>{source.release}</strong><small>{source.coverage.scope}</small></div>
              <a role="cell" href={source.officialUrl} target="_blank" rel="noreferrer" aria-label={`Open official source for ${source.label}`}><ArrowUpRight size={18} aria-hidden="true" /></a>
            </div>
          );
        })}
      </div>

      <div className="evidence-boundary">
        <strong>Release boundary</strong>
        <p>{registry.releaseBoundary}</p>
        <a href="#methods">Read calculation, uncertainty, and missing-data methods</a>
      </div>
    </section>
  );
}
