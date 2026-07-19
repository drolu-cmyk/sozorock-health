"use client";

import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  ChartBar,
  ChatCircleText,
  CheckCircle,
  DownloadSimple,
  FileText,
  Funnel,
  GlobeHemisphereWest,
  House,
  Info,
  MapPin,
  Minus,
  Plus,
  RoadHorizon,
  ShieldCheck,
  ArrowCounterClockwise,
  X,
} from "@phosphor-icons/react";
import { orientBoundaryForD3 } from "../lib/explore-map-geometry";
import styles from "./explore.module.css";

type PlaceKind = "county" | "place" | "zip";

type Suggestion = {
  id: string;
  kind: PlaceKind;
  label: string;
  display: string;
  geoid: string;
  stateFips: string;
  population?: number;
};

type Metric = {
  key: string;
  label: string;
  category: "Chronic conditions" | "Access barriers" | "Prevention";
  plainLanguage: string;
  response: string;
  value: number;
  confidence: string;
  national: number;
  state: number | null;
  difference: number;
  score: number;
  release: "2025" | "2024";
};

type ExploreResponse = {
  location: {
    kind: PlaceKind;
    geoid: string;
    label: string;
    state: string;
    population: number;
    coordinates: number[];
  };
  summary: string;
  metrics: Metric[];
  priorities: Metric[];
  dataCoverage: {
    measureCount: number;
    currentMeasureCount: number;
    previousMeasureCount: number;
  };
  offerings: Array<{
    name: string;
    status: string;
    evidence: string;
    text: string;
  }>;
  intelligence: {
    generatedAt: string;
    evidenceBasis: string;
    locationSummary: string;
    keyFindings: Array<{
      title: string;
      statement: string;
      source: string;
      status: EvidenceStatus;
    }>;
    healthAccessDay: {
      status: EvidenceStatus;
      statement: string;
      reasons: string[];
    };
    priorityIssues: Array<{
      key: string;
      title: string;
      category: Metric["category"];
      localValue: number;
      benchmarkValue: number;
      difference: number;
      source: string;
      status: EvidenceStatus;
    }>;
    practicalBarriers: Array<{
      title: string;
      statement: string;
      status: EvidenceStatus;
      source: string;
    }>;
    placeBasedResponses: Array<{
      name: string;
      status: EvidenceStatus;
      reason: string;
      evidence: string;
    }>;
    geospatialInsights: Array<{
      title: string;
      statement: string;
      layer: string;
      status: EvidenceStatus;
    }>;
    questions: Array<{
      id: string;
      prompt: string;
      answer: string;
    }>;
    limitations: string[];
  };
  localPlan: null | {
    title: string;
    period: string;
    published: string;
    url: string;
    findings: string[];
  };
  sources: Array<{
    name: string;
    url: string;
    release: string;
    period: string;
    note: string;
  }>;
};

type EvidenceStatus =
  | "Supported"
  | "Potentially supported"
  | "Insufficient evidence";

type GeometryResponse = {
  area: { type: "FeatureCollection"; features: Array<Record<string, unknown>> };
  roads: { type: "FeatureCollection"; features: Array<Record<string, unknown>> };
  vintage?: string;
};

const stateCodes: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU",
  "69": "MP", "72": "PR", "78": "VI",
};

const focusOptions = ["All", "Chronic conditions", "Access barriers", "Prevention"] as const;
type Focus = (typeof focusOptions)[number];
type View = "compare" | "pattern" | "pathways";
type Order = "priority" | "prevalence" | "difference";

function BrandLockup() {
  return (
    <span className={styles.brand} aria-label="SozoRock Health">
      <span className={styles.brandWord}>SozoRock<sup>®</sup></span>
      <span className={styles.brandHealth}>Health</span>
    </span>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function displaySuggestion(result: Omit<Suggestion, "display">) {
  const state = stateCodes[result.stateFips];
  const label = result.kind === "place"
    ? result.label.replace(/\s+(city|town|village|borough|CDP)$/i, "")
    : result.label;
  return `${label}${state ? `, ${state}` : ""}`;
}

function LocationSearch({ onSelect }: { onSelect: (place: Suggestion) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || selected?.display === term) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch(`/api/locations?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          results?: Array<Omit<Suggestion, "display">>;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Search unavailable");
        setResults(
          (payload.results ?? []).map((result) => ({
            ...result,
            display: displaySuggestion(result),
          })),
        );
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage("Place search is temporarily unavailable. Please try again shortly.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected]);

  function choose(result: Suggestion) {
    setSelected(result);
    setQuery(result.display);
    setResults([]);
    setActiveIndex(-1);
    setMessage(`Loading ${result.display}…`);
    onSelect(result);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const choice = selected ?? results[activeIndex] ?? results[0];
    if (choice) {
      setResults([]);
      setActiveIndex(-1);
      setSelected(choice);
      setQuery(choice.display);
      setMessage(`Loading ${choice.display}…`);
      onSelect(choice);
    }
    else setMessage("Choose a ZIP Code, city or county from the search results.");
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && results.length) {
      event.preventDefault();
      setActiveIndex((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp" && results.length) {
      event.preventDefault();
      setActiveIndex((value) => Math.max(value - 1, 0));
    } else if (event.key === "Escape") {
      setResults([]);
      setActiveIndex(-1);
    } else if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return (
    <form className={styles.search} onSubmit={submit} role="search">
      <label htmlFor="explore-location">ZIP Code, city or county</label>
      <div className={styles.searchRow}>
        <div className={styles.searchField}>
          <input
            id="explore-location"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setActiveIndex(-1);
              setMessage("");
            }}
            onKeyDown={onKeyDown}
            placeholder="Try 13856 or Delaware County, NY"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls="explore-suggestions"
            aria-activedescendant={activeIndex >= 0 ? results[activeIndex]?.id : undefined}
          />
          {results.length > 0 && (
            <div id="explore-suggestions" className={styles.suggestions} role="listbox">
              {results.map((result, index) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.id === result.id}
                  className={activeIndex === index ? styles.activeSuggestion : ""}
                  key={result.id}
                  id={result.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(result)}
                >
                  <strong>{result.display}</strong>
                  <span>{result.kind === "zip" ? "ZIP Code" : result.kind === "county" ? "County" : "City or place"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit">See local priorities <ArrowRight size={18} aria-hidden="true" /></button>
      </div>
      <p className={styles.searchStatus} aria-live="polite">
        {loading ? "Searching U.S. communities…" : message}
      </p>
    </form>
  );
}

function EvidenceMap({
  geometry,
  label,
  metrics,
  activeMetricKey,
  onMetricChange,
}: {
  geometry: GeometryResponse | null;
  label: string;
  metrics: Metric[];
  activeMetricKey: string;
  onMetricChange: (metricKey: string) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [showRoads, setShowRoads] = useState(true);
  const activeMetric = metrics.find((metric) => metric.key === activeMetricKey) ?? metrics[0];
  const evidenceOpacity = activeMetric
    ? Math.min(0.72, Math.max(0.2, 0.3 + activeMetric.difference / 30))
    : 0.2;

  useEffect(() => {
    setZoom(1);
    setShowRoads(true);
  }, [geometry, label]);

  const paths = useMemo(() => {
    if (!geometry?.area.features.length) return null;
    const areaForD3 = {
      ...geometry.area,
      features: geometry.area.features.map(orientBoundaryForD3),
    };
    const projection = geoMercator().fitExtent(
      [[34, 28], [966, 472]],
      areaForD3 as never,
    );
    const path = geoPath(projection);
    return {
      area: areaForD3.features.map((feature, index) => ({
        key: `area-${index}`,
        d: path(feature as never) ?? "",
      })),
      roads: geometry.roads.features.map((feature, index) => ({
        key: `road-${index}`,
        d: path(feature as never) ?? "",
      })),
    };
  }, [geometry]);

  return (
    <figure className={styles.mapPanel}>
      <div className={styles.mapHeading}>
        <div><span>Place view</span><strong>{label}</strong>{activeMetric && <small>{activeMetric.label}: {activeMetric.value.toFixed(1)}% here</small>}</div>
        <div className={styles.mapLegend}><span><i className={styles.boundaryKey} /> Boundary</span><span><i className={styles.roadKey} /> Major roads</span></div>
      </div>
      {paths ? (
        <>
          <div className={styles.mapControls} aria-label="Map controls">
            <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} disabled={zoom >= 3} aria-label="Zoom in"><Plus size={18} /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} aria-label="Zoom out"><Minus size={18} /></button>
            <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Reset map"><ArrowCounterClockwise size={18} /></button>
            <button type="button" className={showRoads ? styles.mapControlActive : ""} onClick={() => setShowRoads((value) => !value)} aria-pressed={showRoads}><RoadHorizon size={18} /> Roads</button>
            <label className={styles.mapLayerSelect}>
              <ChartBar size={18} aria-hidden="true" />
              <span>Evidence layer</span>
              <select value={activeMetric?.key ?? ""} onChange={(event) => onMetricChange(event.target.value)}>
                {metrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}
              </select>
            </label>
          </div>
          <div className={styles.mapViewport}>
            <svg viewBox="0 0 1000 500" role="img" aria-label={`Interactive boundary and major-road context for ${label}`}>
              <title>{label}: Census boundary with major-road context</title>
              <rect width="1000" height="500" className={styles.mapBackground} />
              <g transform={`translate(${500 - 500 * zoom} ${250 - 250 * zoom}) scale(${zoom})`}>
                {showRoads && paths.roads.map((road) => <path key={road.key} d={road.d} className={styles.mapRoad} />)}
                {paths.area.map((area) => <path key={area.key} d={area.d} className={styles.mapArea} style={{ fillOpacity: evidenceOpacity }} />)}
              </g>
            </svg>
          </div>
        </>
      ) : (
        <div className={styles.mapEmpty}><GlobeHemisphereWest size={58} weight="thin" aria-hidden="true" /><p>Select a place to see its boundary and major-road context.</p></div>
      )}
      <figcaption>{geometry?.vintage ?? "U.S. geographic context"}{paths ? ` · ${paths.area.length} boundary feature${paths.area.length === 1 ? "" : "s"} · ${paths.roads.length} major-road segment${paths.roads.length === 1 ? "" : "s"}` : ""}</figcaption>
    </figure>
  );
}

function CompareView({ metrics, benchmark }: { metrics: Metric[]; benchmark: "national" | "state" }) {
  const max = Math.max(...metrics.flatMap((metric) => [metric.value, benchmark === "state" ? metric.state ?? 0 : metric.national]), 1);
  return (
    <div className={styles.barList} aria-label="Local measure comparison">
      {metrics.map((metric) => {
        const comparison = benchmark === "state" ? metric.state ?? metric.national : metric.national;
        return (
          <article key={metric.key} className={styles.barRow}>
            <div className={styles.barLabel}><strong>{metric.label}</strong><span>{metric.value.toFixed(1)}% here · {comparison.toFixed(1)}% {benchmark}</span></div>
            <div className={styles.barTrack} aria-hidden="true">
              <i className={styles.barLocal} style={{ width: `${(metric.value / max) * 100}%` }} />
              <i className={styles.barBenchmark} style={{ left: `${(comparison / max) * 100}%` }} />
            </div>
          </article>
        );
      })}
      <div className={styles.chartLegend}><span><i className={styles.localKey} /> Selected place</span><span><i className={styles.benchmarkKey} /> Comparison</span></div>
    </div>
  );
}

function PatternView({ metrics }: { metrics: Metric[] }) {
  const maxValue = Math.max(...metrics.map((metric) => metric.value), 1);
  const differences = metrics.map((metric) => metric.difference);
  const minDiff = Math.min(...differences, -1);
  const maxDiff = Math.max(...differences, 1);
  return (
    <div className={styles.pattern} role="img" aria-label="Local prevalence and difference from the national geographic average">
      <span className={styles.patternYAxis}>Higher local prevalence</span>
      <span className={styles.patternXAxis}>Further above national average →</span>
      {metrics.map((metric) => {
        const left = ((metric.difference - minDiff) / (maxDiff - minDiff)) * 78 + 10;
        const bottom = (metric.value / maxValue) * 68 + 12;
        return (
          <button
            type="button"
            key={metric.key}
            className={styles.patternDot}
            style={{ left: `${left}%`, bottom: `${bottom}%` }}
            title={`${metric.label}: ${metric.value.toFixed(1)}%, ${metric.difference > 0 ? "+" : ""}${metric.difference.toFixed(1)} points from national`}
            aria-label={`${metric.label}: ${metric.value.toFixed(1)} percent, ${metric.difference > 0 ? "+" : ""}${metric.difference.toFixed(1)} points from the national geographic average`}
          >
            <span>{metric.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PathwayView({ priorities }: { priorities: Metric[] }) {
  const lead = priorities[0];
  const barrier = priorities.find((metric) => metric.category === "Access barriers") ?? priorities[1];
  return (
    <div className={styles.pathway}>
      <article><span>See</span><strong>{lead?.label ?? "Local priorities"}</strong><p>Start with the strongest current signals and the source period behind them.</p></article>
      <ArrowRight size={24} aria-hidden="true" />
      <article><span>Understand</span><strong>{barrier?.label ?? "Practical barriers"}</strong><p>Connect health conditions with the barriers that can make existing services harder to use.</p></article>
      <ArrowRight size={24} aria-hidden="true" />
      <article><span>Prioritize</span><strong>A place-based response</strong><p>Choose an event, hub format, provider-led pathway, workforce action or planning step supported by the evidence.</p></article>
    </div>
  );
}

function EvidenceStatusBadge({ status }: { status: EvidenceStatus }) {
  const className = status === "Supported"
    ? styles.statusSupported
    : status === "Potentially supported"
      ? styles.statusPotential
      : styles.statusInsufficient;
  return <span className={`${styles.evidenceStatus} ${className}`}>{status}</span>;
}

function PlaceIntelligenceNarrative({ data }: { data: ExploreResponse }) {
  const intelligence = data.intelligence;
  return (
    <section className={styles.intelligence} aria-labelledby="place-intelligence-title">
      <header className={styles.intelligenceHeader}>
        <div>
          <p className={styles.kicker}>SozoRock Place Intelligence</p>
          <h2 id="place-intelligence-title">A source-traceable case for local action.</h2>
        </div>
        <p><ShieldCheck size={20} aria-hidden="true" /> {intelligence.evidenceBasis}</p>
      </header>

      <div className={styles.narrativeGrid}>
        <article className={styles.narrativeLead}>
          <h3>Location Summary</h3>
          <p>{intelligence.locationSummary}</p>
        </article>

        <article>
          <h3>Key Findings from Current Data</h3>
          <ul className={styles.findingList}>
            {intelligence.keyFindings.slice(0, 4).map((finding) => (
              <li key={finding.title}>
                <div><strong>{finding.title}</strong><EvidenceStatusBadge status={finding.status} /></div>
                <p>{finding.statement}</p>
                <small>{finding.source}</small>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.healthAccessDayCase}>
          <div><h3>Data-Backed Justification for Health Access Day</h3><EvidenceStatusBadge status={intelligence.healthAccessDay.status} /></div>
          <p>{intelligence.healthAccessDay.statement}</p>
          <ul>{intelligence.healthAccessDay.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </article>

        <article>
          <h3>Priority Issues &amp; Practical Barriers</h3>
          <ul className={styles.barrierList}>
            {intelligence.practicalBarriers.map((barrier) => (
              <li key={barrier.title}>
                <div><strong>{barrier.title}</strong><EvidenceStatusBadge status={barrier.status} /></div>
                <p>{barrier.statement}</p>
                <small>{barrier.source}</small>
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h3>Recommended Place-Based Responses</h3>
          <ul className={styles.responseReasoning}>
            {intelligence.placeBasedResponses.map((response) => (
              <li key={response.name}>
                <div><strong>{response.name}</strong><EvidenceStatusBadge status={response.status} /></div>
                <p>{response.reason}</p>
                <small>{response.evidence}</small>
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h3>Geospatial &amp; Mapping Insights</h3>
          <ul className={styles.geospatialList}>
            {intelligence.geospatialInsights.map((insight) => (
              <li key={insight.title}>
                <MapPin size={19} aria-hidden="true" />
                <div><strong>{insight.title}</strong><p>{insight.statement}</p><small>{insight.layer}</small></div>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <aside className={styles.evidenceLimits}>
        <Info size={22} aria-hidden="true" />
        <div><strong>What this view does not assume</strong><ul>{intelligence.limitations.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </aside>
    </section>
  );
}

function AskPlaceIntelligence({ data }: { data: ExploreResponse }) {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState(data.intelligence.questions[0]?.answer ?? "");

  useEffect(() => {
    setQuery("");
    setAnswer(data.intelligence.questions[0]?.answer ?? "");
  }, [data]);

  function selectQuestion(id: string) {
    const question = data.intelligence.questions.find((item) => item.id === id);
    if (!question) return;
    setQuery(question.prompt);
    setAnswer(question.answer);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = query.toLowerCase();
    const id = normalized.includes("access day")
      ? "health-access-day"
      : normalized.includes("barrier") || normalized.includes("transport")
        ? "practical-barriers"
        : normalized.includes("missing") || normalized.includes("limit")
          ? "missing-evidence"
          : normalized.includes("prevent")
            ? "prevention-opportunity"
            : "strongest-signal";
    selectQuestion(id);
  }

  return (
    <section className={styles.askPanel} aria-labelledby="ask-place-title">
      <div>
        <p className={styles.kicker}>Ask about this place</p>
        <h2 id="ask-place-title">Follow the evidence, not a generic answer.</h2>
        <p>Ask a planning question. The response uses only the measures, comparisons and source coverage shown for {data.location.label}.</p>
      </div>
      <div className={styles.askWorkspace}>
        <div className={styles.questionChips} aria-label="Suggested questions">
          {data.intelligence.questions.map((question) => <button type="button" key={question.id} onClick={() => selectQuestion(question.id)}>{question.prompt}</button>)}
        </div>
        <form onSubmit={submit} className={styles.askForm}>
          <label htmlFor="place-question">Question about {data.location.label}</label>
          <div><input id="place-question" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What evidence is still missing?" /><button type="submit"><ChatCircleText size={19} /> Ask</button></div>
        </form>
        <article className={styles.answer} aria-live="polite"><span>SozoRock Place Intelligence</span><p>{answer}</p></article>
      </div>
    </section>
  );
}

function DownloadDialog({ data, onClose }: { data: ExploreResponse; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = Array.from(
          document.querySelectorAll<HTMLElement>(
            `.${styles.dialog} button:not([disabled]), .${styles.dialog} input:not([disabled]), .${styles.dialog} select:not([disabled]), .${styles.dialog} textarea:not([disabled]), .${styles.dialog} a[href]`,
          ),
        ).filter((element) => element.getAttribute("aria-hidden") !== "true");
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("sending");
    setMessage("");
    const payload = {
      name: form.get("name"),
      email: form.get("email"),
      role: form.get("role"),
      stateOrCounty: data.location.label,
      inquiryType: "Local evidence brief access",
      message: `Organization: ${String(form.get("organization") ?? "")}\nPurpose: ${String(form.get("purpose") ?? "")}`,
      website: form.get("website"),
      consent: form.get("consent") === "yes",
    };
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The brief could not be prepared.");
      const rows = [
        ["SozoRock Place Intelligence", data.location.label],
        ["Location Summary", data.intelligence.locationSummary],
        ["Health Access Day evidence status", data.intelligence.healthAccessDay.status],
        ["Health Access Day evidence statement", data.intelligence.healthAccessDay.statement],
        ...data.intelligence.placeBasedResponses.map((response) => [
          "Place-based response",
          response.name,
          response.status,
          response.reason,
          response.evidence,
        ]),
        ["Sources and data notes"],
        ...data.sources.map((source) => [source.name, source.release, source.period, source.url]),
        ["Measures"],
        ["Location", data.location.label],
        ["Measure", "Local estimate", "National geographic average", "Difference"],
        ...data.metrics.map((metric) => [metric.label, metric.value, metric.national, metric.difference]),
      ];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sozorock-health-${data.location.geoid}-evidence.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setState("sent");
      setMessage("Your local evidence file is ready.");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    }
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="download-title">
        <button ref={closeRef} className={styles.dialogClose} type="button" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <p className={styles.kicker}>Local evidence brief</p>
        <h2 id="download-title">Tell us how the data will be used.</h2>
        <p>Your contact information helps SozoRock Health understand who is using the brief and what communities need. Do not include medical information.</p>
        <form onSubmit={submit} className={styles.downloadForm}>
          <div><label>Full name<input required name="name" autoComplete="name" /></label><label>Email<input required type="email" name="email" autoComplete="email" /></label></div>
          <div><label>Organization<input required name="organization" autoComplete="organization" /></label><label>Role or sector<select required name="role" defaultValue=""><option value="" disabled>Select one</option><option>Community organization</option><option>County, state or public agency</option><option>Licensed provider or health organization</option><option>University or researcher</option><option>Foundation or funder</option><option>Technology company</option><option>Individual or family</option><option>Other</option></select></label></div>
          <label>Purpose<textarea required name="purpose" rows={3} placeholder="Example: county planning, partnership development or funding research" /></label>
          <input className={styles.honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <label className={styles.consent}><input required type="checkbox" name="consent" value="yes" /><span>I agree that The SozoRock Foundation, Inc. may use this information to provide the requested file and understand its use. I have read the <a href="/privacy">Privacy Notice</a>.</span></label>
          <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Preparing…" : "Download the evidence file"}</button>
          <p role="status" className={state === "error" ? styles.error : styles.success}>{message}</p>
        </form>
      </section>
    </div>
  );
}

export function ExploreClient() {
  const [data, setData] = useState<ExploreResponse | null>(null);
  const [geometry, setGeometry] = useState<GeometryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focus, setFocus] = useState<Focus>("All");
  const [view, setView] = useState<View>("compare");
  const [benchmark, setBenchmark] = useState<"national" | "state">("national");
  const [order, setOrder] = useState<Order>("priority");
  const [mapMetricKey, setMapMetricKey] = useState("");
  const [downloadOpen, setDownloadOpen] = useState(false);

  const loadPlace = useCallback(async (place: Pick<Suggestion, "kind" | "geoid">) => {
    setLoading(true);
    setError("");
    setData(null);
    setGeometry(null);
    const params = new URLSearchParams({ kind: place.kind, geoid: place.geoid });
    window.history.replaceState({}, "", `/explore?${params.toString()}`);
    try {
      const [dataResponse, geometryResponse] = await Promise.all([
        fetch(`/api/explore?${params.toString()}`),
        fetch(`/api/explore/geometry?${params.toString()}`),
      ]);
      const payload = (await dataResponse.json().catch(() => ({}))) as ExploreResponse & { error?: string };
      if (!dataResponse.ok) throw new Error(payload.error ?? "Current public data could not be loaded.");
      const map = (await geometryResponse.json().catch(() => null)) as GeometryResponse | null;
      setData(payload);
      setGeometry(map);
      setMapMetricKey(payload.priorities[0]?.key ?? payload.metrics[0]?.key ?? "");
      setBenchmark(payload.metrics.some((metric) => metric.state !== null) ? "state" : "national");
      window.requestAnimationFrame(() =>
        document.getElementById("local-results")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (nextError) {
      setError((nextError as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind");
    const geoid = params.get("geoid");
    if ((kind === "county" || kind === "place" || kind === "zip") && geoid) {
      void loadPlace({ kind, geoid });
    }
  }, [loadPlace]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const metrics = focus === "All" ? data.metrics : data.metrics.filter((metric) => metric.category === focus);
    return [...metrics].sort((a, b) => {
      if (order === "prevalence") return b.value - a.value;
      if (order === "difference") return b.difference - a.difference;
      return b.score - a.score;
    });
  }, [data, focus, order]);
  const partnershipHref = `/contact?interest=${encodeURIComponent("Partner with us")}${data ? `&location=${encodeURIComponent(data.location.label)}` : ""}`;

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#explore-main">Skip to main content</a>
      <header className={styles.header}>
        <a href="/" aria-label="SozoRock Health home"><BrandLockup /></a>
        <nav aria-label="Explore navigation"><a href="/"><ArrowLeft size={18} /> Back to SozoRock Health</a><a href={partnershipHref}>Partner with us</a></nav>
      </header>

      <main id="explore-main">
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>SozoRock Place Intelligence</p>
            <h1>See what is shaping health in this place.</h1>
            <p>Search any U.S. ZIP Code, city or county. Current public data becomes a clear view of local conditions, priorities and ways to respond.</p>
          </div>
          <LocationSearch onSelect={loadPlace} />
          <div className={styles.coverage} aria-label="National data coverage">
            <span><strong>3,144</strong> counties</span>
            <span><strong>29,923</strong> cities and places</span>
            <span><strong>All U.S.</strong> ZIP Code areas with sufficient data</span>
          </div>
        </section>

        {!data && !loading && !error && (
          <section className={styles.nationalIntro}>
            <div>
              <p className={styles.kicker}>One place at a time</p>
              <h2>A national view built from local differences.</h2>
              <p>Use the same evidence path anywhere in the country: compare health measures, see practical barriers, review current local plans when available and connect the findings to a response.</p>
            </div>
            <div className={styles.sourceFlow}>
              <article><MapPin size={28} /><span>Choose a place</span><p>ZIP Code, city or county.</p></article>
              <ArrowRight size={24} aria-hidden="true" />
              <article><ChartBar size={28} /><span>See the pattern</span><p>Conditions, barriers and comparisons.</p></article>
              <ArrowRight size={24} aria-hidden="true" />
              <article><CheckCircle size={28} /><span>Prioritize action</span><p>Planning, partnership and SozoRock responses.</p></article>
            </div>
          </section>
        )}

        {loading && <section className={styles.loading} aria-live="polite"><span /><p>Building the local evidence view…</p></section>}
        {error && <section className={styles.errorPanel} role="alert"><h2>We could not load this place.</h2><p>{error}</p><button type="button" onClick={() => window.location.assign("/explore")}>Start another search</button></section>}

        {data && (
          <div id="local-results" className={styles.results}>
            <section className={styles.placeHeader}>
              <div><p className={styles.kicker}>Current place view</p><h2>{data.location.label}</h2><p>{data.summary}</p></div>
              <div className={styles.placeFacts}>
                <span><strong>{formatNumber(data.location.population)}</strong> population</span>
                {data.priorities[0] && <span><strong>{data.priorities[0].value.toFixed(1)}%</strong> {data.priorities[0].label}</span>}
                <span><strong>{data.dataCoverage.measureCount}</strong> measures available</span>
              </div>
            </section>

            <section className={styles.controls} aria-label="Evidence controls">
              <div><Funnel size={18} aria-hidden="true" /><span>Focus</span>{focusOptions.map((option) => <button type="button" key={option} className={focus === option ? styles.active : ""} onClick={() => setFocus(option)}>{option}</button>)}</div>
              <div><label className={styles.orderControl}><span>Order</span><select value={order} onChange={(event) => setOrder(event.target.value as Order)}><option value="priority">Priority</option><option value="prevalence">Prevalence</option><option value="difference">Difference</option></select></label><span>View</span><button type="button" className={view === "compare" ? styles.active : ""} onClick={() => setView("compare")}>Compare</button><button type="button" className={view === "pattern" ? styles.active : ""} onClick={() => setView("pattern")}>Pattern</button><button type="button" className={view === "pathways" ? styles.active : ""} onClick={() => setView("pathways")}>Pathways</button></div>
            </section>

            <section className={styles.evidenceGrid}>
              <EvidenceMap geometry={geometry} label={data.location.label} metrics={data.metrics} activeMetricKey={mapMetricKey} onMetricChange={setMapMetricKey} />
              <article className={styles.keyFindings}>
                <p className={styles.kicker}>What the data shows</p>
                <h2>Priority signals</h2>
                <ol>{data.priorities.slice(0, 4).map((metric) => <li key={metric.key}><span>{metric.value.toFixed(1)}%</span><div><strong>{metric.label} <small>{metric.release} release</small></strong><p>{metric.difference > 0 ? `${metric.difference.toFixed(1)} points above` : `${Math.abs(metric.difference).toFixed(1)} points below`} the national geographic average.</p></div></li>)}</ol>
              </article>
            </section>

            <PlaceIntelligenceNarrative data={data} />

            <AskPlaceIntelligence data={data} />

            <section className={styles.visuals} aria-labelledby="visual-title">
              <div className={styles.sectionHeading}><div><p className={styles.kicker}>Explore the pattern</p><h2 id="visual-title">Different views. One evidence base.</h2></div>{view === "compare" && data.metrics.some((metric) => metric.state !== null) && <div className={styles.benchmark}><button type="button" className={benchmark === "state" ? styles.active : ""} onClick={() => setBenchmark("state")}>State</button><button type="button" className={benchmark === "national" ? styles.active : ""} onClick={() => setBenchmark("national")}>National</button></div>}</div>
              {view === "compare" && <CompareView metrics={filtered.slice(0, 8)} benchmark={benchmark} />}
              {view === "pattern" && <PatternView metrics={filtered.slice(0, 9)} />}
              {view === "pathways" && <PathwayView priorities={data.priorities} />}
              {view !== "pathways" && filtered.length === 0 && <p className={styles.noMeasures}>No measures are available for this filter. Choose another focus.</p>}
              {data.dataCoverage.previousMeasureCount > 0 && <p className={styles.coverageNote}>This view uses {data.dataCoverage.currentMeasureCount} measure{data.dataCoverage.currentMeasureCount === 1 ? "" : "s"} from the 2025 release and {data.dataCoverage.previousMeasureCount} from the 2024 release where the latest release has no estimate. Each comparison uses the same release as the local measure.</p>}
            </section>

            {data.localPlan && (
              <section className={styles.localPlan}>
                <div><p className={styles.kicker}>Current local plan</p><h2>{data.localPlan.title}</h2><p>{data.localPlan.period} · Published {data.localPlan.published}</p><a href={data.localPlan.url} target="_blank" rel="noreferrer">Open the public plan <ArrowRight size={18} /></a></div>
                <ul>{data.localPlan.findings.map((finding) => <li key={finding}>{finding}</li>)}</ul>
              </section>
            )}

            <section className={styles.responses} aria-labelledby="responses-title">
              <div className={styles.sectionHeading}><div><p className={styles.kicker}>Where action may help</p><h2 id="responses-title">Match the response to the place.</h2></div><p>These options stay non-clinical. Licensed professionals retain clinical responsibility.</p></div>
              <div className={styles.responseGrid}>{data.offerings.map((offering) => <article key={offering.name}><p>{offering.status}</p><h3>{offering.name}</h3><strong>{offering.evidence}</strong><p>{offering.text}</p></article>)}</div>
            </section>

            <section className={styles.planning}>
              <div><p className={styles.kicker}>For planning and partnership</p><h2>Turn local evidence into a case for action.</h2><p>The same place view can support community health assessment and improvement planning, health-system grant design, local foundation proposals, public-sector modernization and technology-for-public-good partnerships.</p></div>
              <div className={styles.planningGrid}>
                <article><FileText size={30} /><h3>CHA/CHIP support</h3><p>Connect current measures and local plan priorities to a defined geography, partner role and outcome.</p></article>
                <article><Buildings size={30} /><h3>Community benefit</h3><p>Show the need, the people and places affected, the response and how progress will be measured.</p></article>
                <article><RoadHorizon size={30} /><h3>Replicable model</h3><p>Use one disciplined method across counties while keeping each place’s evidence and priorities distinct.</p></article>
                <article><House size={30} /><h3>Place-based delivery</h3><p>Connect public data to hub formats, Health Access Day, provider-led pathways and workforce capacity.</p></article>
              </div>
            </section>

            <section className={styles.literacy}>
              <div><p className={styles.kicker}>Health literacy</p><h2>Explain the measure in plain words.</h2><p>Use a current local signal to shape public education without turning this page into medical advice.</p></div>
              <div>{data.priorities.slice(0, 4).map((metric) => <article key={metric.key}><span>{metric.category}</span><h3>{metric.label}</h3><p>{metric.plainLanguage}</p><strong>Place-based opportunity</strong><p>{metric.response}</p></article>)}</div>
            </section>

            <section className={styles.sources}>
              <div><p className={styles.kicker}>Sources and data dates</p><h2>See what supports the view.</h2></div>
              <div>{data.sources.map((source) => <article key={source.name}><div><strong>{source.name}</strong><span>{source.release}</span></div><p>{source.period}</p><p>{source.note}</p><a href={source.url} target="_blank" rel="noreferrer">Open source <ArrowRight size={16} /></a></article>)}</div>
            </section>

            <section className={styles.actionBand}>
              <div><p className={styles.kicker}>Use the evidence</p><h2>Bring the place into the conversation.</h2><p>Download the current measures or start a partnership conversation around a local need.</p></div>
              <div><button type="button" onClick={() => setDownloadOpen(true)}><DownloadSimple size={20} /> Download local evidence</button><a href={partnershipHref}>Start a partnership conversation <ArrowRight size={18} /></a></div>
            </section>
          </div>
        )}
      </main>

      <footer className={styles.footer}><BrandLockup /><p>Current public data organized for community health planning and place-based action.</p><a href="/privacy">Privacy</a><a href="/accessibility">Accessibility</a><a href="/contact">Contact</a></footer>
      {downloadOpen && data && <DownloadDialog data={data} onClose={() => setDownloadOpen(false)} />}
    </div>
  );
}
