"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  CheckCircle,
  Copy,
  FileCsv,
  Info,
  Printer,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { BrandLockup } from "./components/BrandLockup";
import { ComparisonBars } from "./components/ComparisonBars";
import { GeographySearch } from "./components/GeographySearch";
import { IntelligenceBrief } from "./components/IntelligenceBrief";
import { PlanningWorkspace } from "./components/PlanningWorkspace";
import { ReportStudio } from "./components/ReportStudio";
import { ScenarioPlanner } from "./components/ScenarioPlanner";
import { StateRanking } from "./components/StateRanking";
import { TrendAnalysis } from "./components/TrendAnalysis";
import {
  conditionMetrics,
  displayedBenchmarkComparison,
  formatOrdinal,
  planningBarrierMetrics,
} from "./lib/metrics";
import { inflateCountyMap } from "./lib/compact-counties";
import { profileEvidenceLabel, profileEvidenceMethod } from "./lib/profile-evidence";
import type {
  CountyMapPayload,
  DashboardResponse,
  GeographyProfile,
  GeographySuggestion,
  MapCountyRecord,
  ProfileResponse,
} from "./lib/types";
import type { LayerKey } from "./AccessMap";

const AccessMap = dynamic(() => import("./AccessMap"), {
  ssr: false,
  loading: () => <div className="map-skeleton" role="status"><span />Loading the national county map…</div>,
});

const navigation = [
  ["National view", "overview"],
  ["Place profile", "geography"],
  ["Barriers & priorities", "health-priorities"],
  ["CHA / CHIP workspace", "cha-chip"],
  ["Scenarios", "scenarios"],
  ["Briefs & exports", "intelligence"],
  ["Data & methods", "methods"],
] as const;

const mapLayers: { value: LayerKey; label: string; description: string }[] = [
  { value: "planningPressure", label: "Planning attention", description: "CB-CAP demonstration index" },
  { value: "chronicPercentile", label: "Chronic-condition pressure", description: "County percentile" },
  { value: "barrierPercentile", label: "Barrier pressure", description: "County percentile" },
  { value: "preventionOpportunityPercentile", label: "Prevention opportunity", description: "County percentile" },
  { value: "highBloodPressure", label: "High blood pressure", description: "CDC PLACES estimate" },
  { value: "diabetes", label: "Diagnosed diabetes", description: "CDC PLACES estimate" },
  { value: "uninsured", label: "Adults without insurance", description: "CDC PLACES estimate" },
  { value: "transportation", label: "Transportation barrier", description: "CDC PLACES estimate" },
  { value: "dataCoverage", label: "Data coverage", description: "Displayed measures available" },
];

type BarrierFilter = "" | "transportation" | "uninsured";
type PressureBand = "" | "80-100" | "60-79" | "40-59" | "20-39" | "0-19";

const pressureBands: { value: PressureBand; label: string; min: number; max: number }[] = [
  { value: "80-100", label: "80th–100th percentile", min: 80, max: 100 },
  { value: "60-79", label: "60th–79th percentile", min: 60, max: 79 },
  { value: "40-59", label: "40th–59th percentile", min: 40, max: 59 },
  { value: "20-39", label: "20th–39th percentile", min: 20, max: 39 },
  { value: "0-19", label: "0–19th percentile", min: 0, max: 19 },
];

const number = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function quoteCsv(value: string | number | null) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function download(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function profileKindLabel(kind: GeographyProfile["kind"]) {
  if (kind === "zcta") return "ZIP-linked";
  if (kind === "locality") return "Local-area";
  if (kind === "place") return "City or place";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function planningComparator(kind: GeographyProfile["kind"]) {
  if (kind === "state") return "median county demonstration percentile";
  if (kind === "place" || kind === "zcta") return "compared with the national county distribution";
  return "among U.S. county equivalents";
}

export default function Dashboard({ initialData: data }: { initialData: DashboardResponse }) {
  const [countyRecords, setCountyRecords] = useState<MapCountyRecord[] | null>(null);
  const [countyStatus, setCountyStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [profileResponse, setProfileResponse] = useState<ProfileResponse | null>(null);
  const [profileStatus, setProfileStatus] = useState<"idle" | "loading" | "error">("idle");
  const [selectedState, setSelectedState] = useState("");
  const [selectedFips, setSelectedFips] = useState<string | null>(null);
  const [layer, setLayer] = useState<LayerKey>("planningPressure");
  const [barrierFilter, setBarrierFilter] = useState<BarrierFilter>("");
  const [pressureBand, setPressureBand] = useState<PressureBand>("");
  const [countyQuery, setCountyQuery] = useState("");
  const [sort, setSort] = useState<"pressure" | "population" | "name">("pressure");
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState("");
  const mapLoadRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLElement>(null);
  const profileRequestRef = useRef<AbortController | null>(null);
  const countyRequestRef = useRef<Promise<MapCountyRecord[]> | null>(null);
  const restoredViewRef = useRef(false);
  const pageSize = 12;

  const loadCounties = useCallback(() => {
    if (countyRecords) return Promise.resolve(countyRecords);
    if (countyRequestRef.current) return countyRequestRef.current;
    setCountyStatus("loading");
    const request = fetch("/data/cbcap-county-map-2025.json")
      .then((response) => {
        if (!response.ok) throw new Error("County snapshot unavailable");
        return response.json() as Promise<CountyMapPayload>;
      })
      .then((payload) => {
        if (payload.sourceHash !== data.sources.quality.sha256) {
          throw new Error("County snapshot source hash does not match the dashboard release");
        }
        const records = inflateCountyMap(payload, data.states);
        setCountyRecords(records);
        setCountyStatus("ready");
        return records;
      })
      .catch((error: unknown) => {
        setCountyStatus("error");
        countyRequestRef.current = null;
        throw error;
      });
    countyRequestRef.current = request;
    return request;
  }, [countyRecords, data.sources.quality.sha256, data.states]);

  useEffect(() => {
    const target = mapLoadRef.current;
    if (!target || countyStatus !== "idle") return;
    if (!("IntersectionObserver" in window)) {
      void loadCounties().catch(() => undefined);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void loadCounties().catch(() => undefined);
    }, { rootMargin: "0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [countyStatus, loadCounties]);

  const loadProfile = useCallback(async (suggestion: GeographySuggestion, reveal = true) => {
    profileRequestRef.current?.abort();
    const controller = new AbortController();
    profileRequestRef.current = controller;
    setProfileStatus("loading");
    setToast("");
    try {
      const params = new URLSearchParams({
        kind: suggestion.kind,
        geoid: suggestion.geoid,
        name: suggestion.label,
        contract: "2025-12-04-v2",
      });
      const response = await fetch(`/api/profile?${params}`, { signal: controller.signal });
      if (!response.ok) throw new Error("Profile unavailable");
      const body = await response.json() as ProfileResponse;
      setProfileResponse(body);
      setProfileStatus("idle");
      setSelectedFips(suggestion.kind === "county" ? suggestion.geoid : null);
      setSelectedState(body.profile.stateFips || "");
      setPage(1);
      if (reveal) {
        window.requestAnimationFrame(() => {
          portraitRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          portraitRef.current?.focus({ preventScroll: true });
        });
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setProfileStatus("error");
      setToast("That geography profile could not be loaded. The nationwide view is still available.");
    }
  }, []);

  useEffect(() => () => profileRequestRef.current?.abort(), []);

  useEffect(() => {
    if (restoredViewRef.current) return;
    restoredViewRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const requestedLayer = params.get("layer") as LayerKey | null;
    if (requestedLayer && mapLayers.some((candidate) => candidate.value === requestedLayer)) {
      setLayer(requestedLayer);
    }
    const requestedBarrier = params.get("barrier") as BarrierFilter | null;
    if (requestedBarrier === "transportation" || requestedBarrier === "uninsured") {
      setBarrierFilter(requestedBarrier);
    }
    const requestedPressure = params.get("pressure") as PressureBand | null;
    if (pressureBands.some((candidate) => candidate.value === requestedPressure)) {
      setPressureBand(requestedPressure ?? "");
    }
    setCountyQuery(params.get("q")?.slice(0, 80) ?? "");
    const requestedSort = params.get("sort");
    if (requestedSort === "pressure" || requestedSort === "population" || requestedSort === "name") {
      setSort(requestedSort);
    }
    const kind = params.get("kind") as GeographySuggestion["kind"] | null;
    const geoid = params.get("geoid") ?? "";
    if (!kind || !["state", "county", "place", "locality", "zcta"].includes(kind) || !/^\d{2,10}$/.test(geoid)) return;
    const stateFips = kind === "zcta" ? "" : geoid.slice(0, 2);
    void loadProfile({
      id: `${kind}-${geoid}`,
      kind,
      label: params.get("name")?.slice(0, 120) || "Selected geography",
      context: "Restored shared view",
      geoid,
      stateFips,
    }, false);
  }, [data, loadProfile]);

  useEffect(() => {
    if (!restoredViewRef.current) return;
    const params = new URLSearchParams({ layer });
    const restoredProfile = profileResponse?.profile;
    if (restoredProfile) {
      params.set("kind", restoredProfile.kind);
      params.set("geoid", restoredProfile.geoid);
      params.set("name", restoredProfile.name);
      if (restoredProfile.stateFips) params.set("state", restoredProfile.stateFips);
    } else if (selectedState) {
      params.set("state", selectedState);
    }
    if (barrierFilter) params.set("barrier", barrierFilter);
    if (pressureBand) params.set("pressure", pressureBand);
    if (countyQuery) params.set("q", countyQuery);
    if (sort !== "pressure") params.set("sort", sort);
    window.history.replaceState(null, "", `?${params}`);
  }, [barrierFilter, countyQuery, layer, pressureBand, profileResponse, selectedState, sort]);

  const selectCounty = (record: MapCountyRecord) => {
    void loadProfile({
      id: `county-${record.fips}`,
      kind: "county",
      label: record.county,
      context: `${record.state} · County FIPS ${record.fips}`,
      geoid: record.fips,
      stateFips: record.stateFips,
    });
  };

  const selectState = (stateFips: string) => {
    setSelectedState(stateFips);
    setSelectedFips(null);
    setPage(1);
    if (!stateFips) {
      setProfileResponse(null);
      return;
    }
    const state = data.states.find((candidate) => candidate.fips === stateFips);
    if (!state) return;
    void loadProfile({
      id: `state-${state.fips}`,
      kind: "state",
      label: state.name,
      context: `State · FIPS ${state.fips}`,
      geoid: state.fips,
      stateFips: state.fips,
    });
  };

  const profile = profileResponse?.profile ?? null;
  const profileProvenance = profileResponse?.provenance ?? null;
  const stateBenchmark = profile?.kind === "state" ? null : profileResponse?.stateBenchmark ?? null;
  const filteredCounties = useMemo(() => {
    if (!countyRecords) return [];
    const term = countyQuery.trim().toLowerCase();
    const band = pressureBands.find((candidate) => candidate.value === pressureBand) ?? null;
    const barrierBenchmark = barrierFilter ? data.nationalBenchmark.barriers[barrierFilter] : null;
    const records = countyRecords.filter((county) =>
      (!selectedState || county.stateFips === selectedState) &&
      (!term || county.county.toLowerCase().includes(term) || county.fips.startsWith(term)) &&
      (!band || (county.planningPressure !== null && county.planningPressure >= band.min && county.planningPressure <= band.max)) &&
      (!barrierFilter || (county[barrierFilter] !== null && barrierBenchmark !== null && county[barrierFilter] > barrierBenchmark)),
    );
    return records.sort((a, b) => {
      if (sort === "name") return a.county.localeCompare(b.county);
      if (sort === "population") return (b.population ?? -1) - (a.population ?? -1);
      return (b.planningPressure ?? -1) - (a.planningPressure ?? -1);
    });
  }, [barrierFilter, countyQuery, countyRecords, data.nationalBenchmark.barriers, pressureBand, selectedState, sort]);
  const filteredFips = useMemo(() => new Set(filteredCounties.map((county) => county.fips)), [filteredCounties]);
  const pageCount = Math.max(1, Math.ceil(filteredCounties.length / pageSize));
  const tableRows = filteredCounties.slice((page - 1) * pageSize, page * pageSize);
  const availableCounties = data.coverage.availableCountyCount;
  const totalPopulation = data.coverage.totalPopulation;
  const publicDataCoverage = (availableCounties / data.coverage.countyCount) * 100;
  const selectedStateSummary = data.states.find((state) => state.fips === selectedState) ?? null;
  const displayedCondition = profile && profile.sourceStatus === "available"
    ? displayedBenchmarkComparison(profile, data.nationalBenchmark, conditionMetrics)
    : null;
  const displayedBarrier = profile && profile.sourceStatus === "available"
    ? displayedBenchmarkComparison(profile, data.nationalBenchmark, planningBarrierMetrics)
    : null;

  const clearAllFilters = () => {
    profileRequestRef.current?.abort();
    setSelectedState("");
    setSelectedFips(null);
    setProfileResponse(null);
    setProfileStatus("idle");
    setLayer("planningPressure");
    setBarrierFilter("");
    setPressureBand("");
    setCountyQuery("");
    setSort("pressure");
    setPage(1);
    setToast("Filters cleared. Nationwide view restored.");
  };

  const exportCsv = async () => {
    setToast("Preparing the nationwide county export…");
    let exportRecords: MapCountyRecord[];
    try {
      exportRecords = await loadCounties();
    } catch {
      setToast("The county export could not be prepared. Try again.");
      return;
    }
    const term = countyQuery.trim().toLowerCase();
    const band = pressureBands.find((candidate) => candidate.value === pressureBand) ?? null;
    const barrierBenchmark = barrierFilter ? data.nationalBenchmark.barriers[barrierFilter] : null;
    const rows = exportRecords.filter((county) =>
      (!selectedState || county.stateFips === selectedState) &&
      (!term || county.county.toLowerCase().includes(term) || county.fips.startsWith(term)) &&
      (!band || (county.planningPressure !== null && county.planningPressure >= band.min && county.planningPressure <= band.max)) &&
      (!barrierFilter || (county[barrierFilter] !== null && barrierBenchmark !== null && county[barrierFilter] > barrierBenchmark)),
    ).map((county) => [
      county.fips, county.state, county.stateCode, county.county, county.population,
      county.dataCoverage, county.planningPressure, county.chronicPercentile,
      county.barrierPercentile, county.preventionOpportunityPercentile,
      county.diabetes, county.highBloodPressure, county.uninsured, county.transportation,
      data.sources.indicators.released,
    ]);
    const header = [
      "County FIPS", "State", "State code", "County", "Population", "Data coverage (%)",
      "CB-CAP planning attention (percentile)", "Chronic-condition pressure (percentile)",
      "Barrier pressure (percentile)", "Prevention opportunity (percentile)",
      "Diagnosed diabetes (%)", "High blood pressure (%)", "Adults without insurance (%)",
      "Lack of reliable transportation (%)", "CDC PLACES release",
    ];
    const csv = [header, ...rows].map((row) => row.map((value) => quoteCsv(value)).join(",")).join("\n");
    download(csv, `cbcap-${selectedStateSummary?.code.toLowerCase() ?? "us"}-county-planning-view.csv`, "text/csv;charset=utf-8");
    setToast(`${number.format(rows.length)} county rows downloaded with source and release fields.`);
  };

  const copyView = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("View link copied.");
    } catch {
      setToast("Copy was unavailable. Use the address bar to share this view.");
    }
  };

  return (
    <div className="cbcap-app">
      <a className="skip-link" href="#main-content">Skip to national systems intelligence</a>
      <header className="institutional-header">
        <BrandLockup priority />
        <div className="product-identity"><strong>CB-CAP</strong><span>County-Based Community Access Platform</span></div>
        <div className="header-status"><i aria-hidden="true" /><span>Public demonstration</span></div>
      </header>
      <nav className="section-nav" aria-label="CB-CAP sections">
        <div>{navigation.map(([label, target]) => <a key={target} href={`#${target}`}>{label}</a>)}</div>
        <a className="foundation-link" href="https://www.sozorockfoundation.org" target="_blank" rel="noreferrer">The SozoRock Foundation, Inc.</a>
      </nav>
      <main id="main-content">
        <section className="decision-room" id="overview" aria-labelledby="overview-heading">
          <div className="decision-room__intro">
            <span>National systems view · public demonstration</span>
            <h1 id="overview-heading">See the pattern. Test a response. Build a fundable plan.</h1>
            <p>Use nationwide public estimates to frame local questions, compare barriers and health priorities, and move into Health Equity Hub, Health Access Day, workforce, and CHA/CHIP planning.</p>
          </div>
          <div className="decision-room__actions" role="group" aria-label="Dashboard actions">
            <a href={profile ? "#intelligence" : "#geography"}>{profile ? "Build a stakeholder brief" : "Choose a place to build a brief"} <ArrowDown size={16} aria-hidden="true" /></a>
            <button type="button" onClick={() => void exportCsv()}><FileCsv size={18} aria-hidden="true" />Download county data</button>
            <button type="button" onClick={() => void copyView()}><Copy size={18} aria-hidden="true" />Copy this view</button>
            <button type="button" onClick={() => window.print()}><Printer size={18} aria-hidden="true" />Print / save PDF</button>
          </div>
          <div className="evidence-ledger" role="list" aria-label="Evidence and capability status">
            <div role="listitem" data-status="current"><span>Current evidence</span><strong>Census geography + CDC PLACES</strong><small>Nationwide boundaries and modeled public estimates</small></div>
            <div role="listitem" data-status="derived"><span>Derived planning view</span><strong>Benchmarks + planning attention</strong><small>Transparent calculations, not official designations</small></div>
            <div role="listitem" data-status="demonstration"><span>Demonstration capability</span><strong>AI-assisted briefing with human review</strong><small>Source-linked drafts and scenario ranges</small></div>
            <div role="listitem" data-status="planned"><span>Planned governed feeds</span><strong>Local, hub + workflow data</strong><small>Not connected in this public demonstration</small></div>
          </div>
        </section>
        <div className="truth-banner">
          <Info size={18} aria-hidden="true" />
          <p><strong>Public estimates guide questions—not diagnoses, rankings, or final county priorities.</strong> CDC PLACES measures are modeled estimates. CB-CAP planning views and scenarios demonstrate capability and require local evidence, community input, and accountable human review.</p>
          <a href="#methods">Read methods</a>
        </div>
        {toast && <div className="toast" role="status"><span>{toast}</span><button type="button" onClick={() => setToast("")} aria-label="Dismiss message">×</button></div>}
        <section className="geography-workspace" id="geography" aria-labelledby="geography-heading">
          <header className="workspace-heading workspace-heading--command">
            <div><span>Start with geography</span><h2 id="geography-heading">Choose a place or scan the country.</h2></div>
            <p>Search every state, county equivalent, city or town, Census place, and ZIP-linked area by name, ZIP, FIPS code, or GEOID. Missing measures stay visible as missing—not zero.</p>
          </header>
          <div className="control-deck">
            <GeographySearch onSelect={(suggestion) => void loadProfile(suggestion)} />
            <label className="control-deck__select"><span>State view</span><select value={selectedState} onChange={(event) => selectState(event.target.value)}><option value="">All states + D.C.</option>{data.states.map((state) => <option key={state.fips} value={state.fips}>{state.name} ({state.countyCount})</option>)}</select><small>{selectedStateSummary ? `${selectedStateSummary.countyCount} county equivalents` : "Nationwide county map"}</small></label>
            <label className="control-deck__select"><span>Map layer</span><select value={layer} onChange={(event) => setLayer(event.target.value as LayerKey)}>{mapLayers.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{mapLayers.find((option) => option.value === layer)?.description}</small></label>
          </div>
          {profileStatus === "loading" && <div className="profile-loading" role="status">Loading the selected geography profile…</div>}
          {profileStatus === "error" && <div className="profile-error" role="alert">The selected profile could not be loaded. Try another geography.</div>}
          <div ref={mapLoadRef} className="map-and-portrait">
            <div className="map-panel">
              {countyStatus === "ready" && countyRecords ? (
                <AccessMap records={countyRecords} includedFips={filteredFips} layer={layer} selectedFips={selectedFips} selectedStateFips={selectedState} onSelect={selectCounty} />
              ) : countyStatus === "error" ? (
                <div className="map-error" role="alert"><strong>The nationwide county layer could not load.</strong><p>Search remains available. <button type="button" onClick={() => void loadCounties().catch(() => undefined)}>Try the county layer again</button></p></div>
              ) : (
                <div className="map-skeleton" role="status"><span />Preparing the national county map…</div>
              )}
              <p className="map-note"><ShieldCheck size={15} aria-hidden="true" />Every county equivalent can be selected. Use search and the county table as accessible alternatives to the map.</p>
              <p className="panel-source"><a href={data.sources.geography.url} target="_blank" rel="noreferrer">{data.sources.geography.source}</a> · {data.sources.geography.vintage} boundaries. <a href={data.sources.indicators.url} target="_blank" rel="noreferrer">{data.sources.indicators.source}</a> · released {data.sources.indicators.released}. Planning-attention layer status: {data.sources.demonstrationIndex.status}.</p>
            </div>
            <aside ref={portraitRef} className="system-portrait" aria-live="polite" tabIndex={-1}>
              {profile ? (
                <>
                  <header><span>{profileKindLabel(profile.kind)} place profile · {profileEvidenceLabel(profileProvenance)}</span><h2>{profile.name}</h2><p>{profile.context}</p></header>
                  {profile.sourceStatus === "not-available" ? (
                    <div className="portrait-no-data"><WarningCircle size={25} aria-hidden="true" /><strong>No CDC PLACES profile is available.</strong><p>This geography is valid and searchable. CB-CAP will not turn missing coverage into a zero score.</p></div>
                  ) : (
                    <>
                      <div className="portrait-score"><span>Planning attention</span><strong>{formatOrdinal(profile.planning.planningPressure)}</strong><p>{planningComparator(profile.kind)}</p></div>
                      <dl className="portrait-facts">
                        <div><dt>Population</dt><dd>{profile.population === null ? "Not available" : number.format(profile.population)}</dd></div>
                        <div><dt>Measure coverage</dt><dd>{profile.dataCoverage}%</dd></div>
                        <div><dt>Displayed condition comparison</dt><dd>{displayedCondition ? `${displayedCondition.metric.shortLabel} · ${displayedCondition.value.toFixed(1)}% · ${Math.abs(displayedCondition.gap).toFixed(1)} points ${displayedCondition.gap >= 0 ? "above" : "below"} national` : "Not available"}</dd></div>
                        <div><dt>Displayed pathway-barrier comparison</dt><dd>{displayedBarrier ? `${displayedBarrier.metric.shortLabel} · ${displayedBarrier.value.toFixed(1)}% · ${Math.abs(displayedBarrier.gap).toFixed(1)} points ${displayedBarrier.gap >= 0 ? "above" : "below"} national` : "Not available"}</dd></div>
                      </dl>
                      <div className="portrait-next-actions">
                        <a className="portrait-action" href="#cha-chip">Open CHA / CHIP workspace <ArrowDown size={15} aria-hidden="true" /></a>
                        <a className="portrait-action portrait-action--quiet" href="#intelligence">Draft stakeholder brief <ArrowDown size={15} aria-hidden="true" /></a>
                      </div>
                    </>
                  )}
                  <footer>
                    Evidence method: {profileEvidenceMethod(profileProvenance)} {profileProvenance?.indicators && <><a href={profileProvenance.indicators.url} target="_blank" rel="noreferrer">Open source</a> · {profileProvenance.indicators.vintage}. </>}{profileProvenance?.limitations[0]}
                  </footer>
                </>
              ) : (
                <>
                  <header><span>Nationwide evidence frame</span><h2>One country. 3,144 local systems.</h2><p>Select any state, county equivalent, city, town, Census place, or ZIP-linked area to build a place profile without losing the national context.</p></header>
                  <dl className="national-facts">
                    <div><dt>Geography coverage</dt><dd>{number.format(data.coverage.countyCount)} county equivalents</dd></div>
                    <div><dt>Public profiles</dt><dd>{number.format(availableCounties)} CDC PLACES profiles</dd></div>
                    <div><dt>Latest release</dt><dd>2025 · modeled estimates</dd></div>
                    <div><dt>Missing data</dt><dd>Shown as unavailable, never zero</dd></div>
                  </dl>
                  <div className="national-capabilities">
                    {["Compare health priorities and practical barriers", "Test Health Equity Hub and workforce scenarios", "Structure CHA / CHIP evidence questions", "Prepare a source-linked planning brief"].map((item) => <div key={item}><CheckCircle size={17} weight="fill" aria-hidden="true" />{item}</div>)}
                  </div>
                  <p className="human-decision-note"><strong>AI drafts. People decide.</strong><span>Any future AI-assisted output remains bounded by sources, governance, and human review.</span></p>
                  <a className="portrait-action" href="#counties">Browse all county equivalents <ArrowDown size={15} aria-hidden="true" /></a>
                </>
              )}
            </aside>
          </div>
          <div className="filter-deck" role="group" aria-label="County planning filters">
            <label><span>Barrier signal</span><select value={barrierFilter} onChange={(event) => { setBarrierFilter(event.target.value as BarrierFilter); setPage(1); }}><option value="">All barrier profiles</option><option value="transportation">Transportation above national benchmark</option><option value="uninsured">Uninsured above national benchmark</option></select></label>
            <label><span>Planning attention</span><select value={pressureBand} onChange={(event) => { setPressureBand(event.target.value as PressureBand); setPage(1); }}><option value="">All percentiles</option>{pressureBands.map((band) => <option key={band.value} value={band.value}>{band.label}</option>)}</select></label>
            <label><span>Evidence release</span><select value="2025" disabled aria-describedby="evidence-release-note"><option value="2025">CDC PLACES 2025</option></select><small id="evidence-release-note">Historical release comparisons appear after selecting a county.</small></label>
            <button type="button" onClick={clearAllFilters}>Clear all</button>
          </div>
          <div className="active-filters" role="region" aria-label="Active filters" aria-live="polite">
            <strong>{countyStatus === "ready" ? `${number.format(filteredCounties.length)} counties in view` : "Preparing counties in view"}</strong>
            <div>
              {selectedStateSummary && <button type="button" onClick={() => selectState("")} aria-label={`${selectedStateSummary.name} — remove filter`}>{selectedStateSummary.name}<span aria-hidden="true">×</span></button>}
              {layer !== "planningPressure" && <button type="button" onClick={() => setLayer("planningPressure")} aria-label={`${mapLayers.find((option) => option.value === layer)?.label} — reset map layer`}>{mapLayers.find((option) => option.value === layer)?.label}<span aria-hidden="true">×</span></button>}
              {barrierFilter && <button type="button" onClick={() => setBarrierFilter("")} aria-label={`${barrierFilter === "transportation" ? "Transportation above benchmark" : "Uninsured above benchmark"} — remove filter`}>{barrierFilter === "transportation" ? "Transportation above benchmark" : "Uninsured above benchmark"}<span aria-hidden="true">×</span></button>}
              {pressureBand && <button type="button" onClick={() => setPressureBand("")} aria-label={`${pressureBands.find((band) => band.value === pressureBand)?.label} — remove filter`}>{pressureBands.find((band) => band.value === pressureBand)?.label}<span aria-hidden="true">×</span></button>}
              {countyQuery && <button type="button" onClick={() => setCountyQuery("")} aria-label={`County search: ${countyQuery} — remove filter`}>County search: {countyQuery}<span aria-hidden="true">×</span></button>}
              {!selectedStateSummary && layer === "planningPressure" && !barrierFilter && !pressureBand && !countyQuery && <span>Nationwide · no filters applied</span>}
            </div>
          </div>
        </section>
        <section className="metric-ribbon" aria-label="Nationwide data coverage">
          <article><span>County equivalents</span><strong>{number.format(data.coverage.countyCount)}</strong><small>50 states + D.C.</small></article>
          <article><span>CDC PLACES profiles</span><strong>{number.format(availableCounties)}</strong><small>{number.format(data.sources.quality.planningIndexAvailable)} support the composite planning view</small></article>
          <article><span>Population represented</span><strong>{compact.format(totalPopulation)}</strong><small>CDC source population</small></article>
          <article><span>Public-data coverage</span><strong>{publicDataCoverage === 100 ? "100%" : `${publicDataCoverage.toFixed(2)}%`}</strong><small>county profile availability</small></article>
          <article className="metric-ribbon__source"><span>Latest source release</span><strong>2025</strong><small>CDC PLACES · Dec. 4, 2025</small></article>
        </section>
        <section className="analysis-layout" id="health-priorities">
          <ComparisonBars profile={profile} stateBenchmark={stateBenchmark} nationalBenchmark={data.nationalBenchmark} metrics={conditionMetrics.slice(0, 7)} title="Health measures in context" description="Compare chronic-condition estimates for the selected geography with state and national county benchmarks." />
          <ComparisonBars profile={profile} stateBenchmark={stateBenchmark} nationalBenchmark={data.nationalBenchmark} metrics={planningBarrierMetrics} title="Practical barriers that may shape access" description="See where practical and social barriers may need to be tested against local experience and resource capacity." />
        </section>
        <section className="national-patterns">
          <StateRanking states={data.states} selectedState={selectedState} onSelect={selectState} />
          <section className="analysis-panel systems-frame" aria-labelledby="systems-frame-heading">
            <header className="panel-heading"><div><span>Rethinking Rural Governance</span><h2 id="systems-frame-heading">From data capture to institutional intelligence.</h2><p>CB-CAP turns the publication’s continuous-learning model into a visible operating sequence.</p></div></header>
            <div className="systems-stages">
              {[
                ["Capture", "Geography, health estimates, capacity, and community input"],
                ["Validate", "Coverage, vintage, definitions, uncertainty, and privacy"],
                ["Integrate", "Health, workforce, hubs, providers, digital readiness, and governance"],
                ["Decide", "Planning questions, scenarios, ownership, and safeguards"],
                ["Learn", "Measures, review cadence, transparency, and course correction"],
              ].map(([title, copy]) => <div key={title}><span>{title}</span><p>{copy}</p></div>)}
            </div>
          </section>
        </section>
        <TrendAnalysis profile={profile} />
        <PlanningWorkspace profile={profile} provenance={profileProvenance} nationalBenchmark={data.nationalBenchmark} />
        <ScenarioPlanner profile={profile} provenance={profileProvenance} />
        <IntelligenceBrief profile={profile} provenance={profileProvenance} nationalBenchmark={data.nationalBenchmark} />
        <ReportStudio response={profileResponse} />
        <section className="county-browser" id="counties" aria-labelledby="counties-heading">
          <header className="workspace-heading"><div><span>County explorer</span><h2 id="counties-heading">Browse every county equivalent.</h2></div><p>{countyStatus === "ready" ? `${number.format(filteredCounties.length)} geographies match this view. Select a row to update the system portrait and all comparisons.` : "The county explorer loads as this section comes into view."}</p></header>
          <div className="county-browser__controls">
            <label><span>Find county or FIPS</span><input type="search" value={countyQuery} onChange={(event) => { setCountyQuery(event.target.value); setPage(1); }} placeholder="County name or 5-digit FIPS" /></label>
            <label><span>Sort counties</span><select value={sort} onChange={(event) => { setSort(event.target.value as typeof sort); setPage(1); }}><option value="pressure">Planning attention</option><option value="population">Population</option><option value="name">County name</option></select></label>
            <button type="button" onClick={() => void exportCsv()}><FileCsv size={18} aria-hidden="true" />Export this view</button>
          </div>
          <div className="county-table-wrap" role="region" aria-label="Scrollable county planning table" aria-busy={countyStatus !== "ready"} tabIndex={0}>
            <table>
              <thead><tr><th scope="col">County</th><th scope="col">Population</th><th scope="col">Planning attention</th><th scope="col">Chronic pressure</th><th scope="col">Barrier pressure</th><th scope="col">Data coverage</th><th scope="col"><span className="sr-only">Open profile</span></th></tr></thead>
              <tbody>{tableRows.map((county) => <tr key={county.fips}><td><strong>{county.county}</strong><small>{county.state} · FIPS {county.fips}</small></td><td>{county.population === null ? "Not available" : number.format(county.population)}</td><td>{formatOrdinal(county.planningPressure)}</td><td>{formatOrdinal(county.chronicPercentile)}</td><td>{formatOrdinal(county.barrierPercentile)}</td><td>{county.dataCoverage}%</td><td><button type="button" onClick={() => selectCounty(county)}>View</button></td></tr>)}</tbody>
            </table>
          </div>
          <div className="county-mobile-list" role="region" aria-label="County planning profiles">
            {tableRows.map((county) => (
              <article key={county.fips}>
                <header>
                  <div>
                    <strong>{county.county}</strong>
                    <span>{county.state} · FIPS {county.fips}</span>
                  </div>
                  <button type="button" onClick={() => selectCounty(county)}>View profile</button>
                </header>
                <dl>
                  <div><dt>Population</dt><dd>{county.population === null ? "Not available" : number.format(county.population)}</dd></div>
                  <div><dt>Planning attention</dt><dd>{formatOrdinal(county.planningPressure)}</dd></div>
                  <div><dt>Chronic pressure</dt><dd>{formatOrdinal(county.chronicPercentile)}</dd></div>
                  <div><dt>Barrier pressure</dt><dd>{formatOrdinal(county.barrierPercentile)}</dd></div>
                  <div><dt>Data coverage</dt><dd>{county.dataCoverage}%</dd></div>
                </dl>
              </article>
            ))}
          </div>
          {countyStatus !== "ready" && <div className="county-empty" role="status">Preparing the nationwide county explorer…</div>}
          {countyStatus === "ready" && !tableRows.length && <div className="county-empty">No counties match this search.</div>}
          {countyStatus === "ready" && <div className="pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><span>Page {page} of {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div>}
        </section>
        <section className="methods-section" id="methods" aria-labelledby="methods-heading">
          <div className="methods-intro"><span>Methods and data</span><h2 id="methods-heading">Transparent enough to question. Structured enough to improve.</h2><p>Stakeholders can see what is sourced, what is calculated, what is unavailable, and what requires human judgment.</p></div>
          <div className="method-grid">
            <article><span>Geography</span><h3>{data.sources.geography.source}</h3><p>{data.sources.geography.coverage}. County boundaries and GEOIDs use the {data.sources.geography.vintage} vintage.</p><a href={data.sources.geography.url} target="_blank" rel="noreferrer">Open Census source</a></article>
            <article><span>Health estimates</span><h3>CDC PLACES 2025</h3><p>{data.sources.indicators.modeledEstimateNotice} Underlying years: {data.sources.indicators.underlyingYears}.</p><a href={data.sources.indicators.url} target="_blank" rel="noreferrer">Open CDC dataset</a></article>
            <article><span>CB-CAP calculation</span><h3>Demonstration planning attention</h3><p>{data.sources.demonstrationIndex.formula} County profiles use the national county distribution; state portraits show the median county percentile. Place and ZIP-linked profiles are also compared with the county distribution and are labeled accordingly.</p><strong>{data.sources.demonstrationIndex.boundary}</strong></article>
            <article><span>Quality controls</span><h3>Coverage and lineage</h3><p>{number.format(data.sources.quality.uniqueFips)} unique county FIPS values. {number.format(data.sources.indicators.matchedCountyCount)} matched PLACES profiles; {number.format(data.sources.quality.planningIndexAvailable)} meet the two-component minimum for the composite planning view. Source snapshot hash is recorded for reproducibility.</p><code>{data.sources.quality.sha256.slice(0, 16)}…</code></article>
          </div>
          <details><summary>How CB-CAP handles uncertainty and missing data</summary><div><p>Confidence intervals are preserved for individual PLACES measures and used in scenario ranges. A missing measure remains “Not available.” CB-CAP does not convert missing coverage to zero, and a scenario is disabled when the required population or measure is absent.</p><p>Census ZCTAs approximate ZIP-shaped statistical areas; they are not USPS delivery routes. Places and ZCTAs may cross county boundaries, so the platform does not silently force a one-county relationship.</p></div></details>
          <details><summary>How AI-assisted briefs remain bounded</summary><div><p>Facts are calculated from the cited sources before any narrative is drafted. This public view writes each brief from the values shown on screen. Future AI-assisted drafting will remain limited to sourced observations, comparisons, scenarios, and planning questions, with human review before publication.</p><p>CB-CAP does not diagnose, triage, prescribe, determine individual eligibility, or replace official CHA/CHIP governance.</p></div></details>
        </section>
      </main>
      <footer className="institutional-footer">
        <div><BrandLockup compact /><p>County systems intelligence for health access, planning, workforce readiness, digital assurance, and accountable public action.</p></div>
        <div><strong>Decision boundary</strong><p>CB-CAP is non-clinical and privacy-preserving. Public views use aggregate public estimates and demonstration calculations.</p></div>
        <div><strong>The SozoRock Foundation, Inc.</strong><p>A New York-based 501(c)(3) nonprofit. EIN 39-4736725.</p><a href="https://www.sozorockfoundation.org">sozorockfoundation.org</a></div>
        <small>© 2026 The SozoRock Foundation, Inc. SozoRock® is a registered trademark. All rights reserved.</small>
      </footer>
    </div>
  );
}
