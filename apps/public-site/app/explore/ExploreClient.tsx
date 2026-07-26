"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Clock,
  DownloadSimple,
  FileText,
  Info,
  MapPin,
  MapTrifold,
  MagnifyingGlass,
  ShieldCheck,
  UsersThree,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import styles from "./explore.module.css";

type PlaceKind = "county" | "place" | "zip";
type WorkspaceView = "brief" | "map" | "action";
type EvidenceStatus = "Supported" | "Potentially supported" | "Insufficient evidence";

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
  direction: "adverse" | "protective" | "contextual";
  higherValueMeaning: "adverse" | "favorable" | "context_dependent";
  value: number;
  confidence: string;
  national: number;
  state: number | null;
  difference: number;
  score: number;
  release: "2025" | "2024";
  previousValue: number | null;
  trendDifference: number | null;
  trend: "improving" | "worsening" | "stable" | "unavailable";
  interpretation: "adverse_signal" | "favorable_signal" | "context_only" | "equal";
  geographyLevel: "county" | "census_place" | "zcta";
};

type PlanningDocument = {
  id: string;
  title: string;
  publisher: string;
  officialUrl: string;
  publishedAt: string;
  documentType: string;
  coverage: string;
  status: "not_yet_verified";
  reviewStatus: "provisional";
};

type PlaceResponse = {
  location: {
    kind: PlaceKind;
    geoid: string;
    label: string;
    state: string;
    population: number;
    coordinates: number[];
    geographyLabel: string;
    geographyAuthority: string;
    evidenceGeography: "county" | "census_place" | "zcta";
    caveats: string[];
  };
  metrics: Metric[];
  priorities: Metric[];
  dataCoverage: {
    measureCount: number;
    currentMeasureCount: number;
    previousMeasureCount: number;
  };
  intelligence: {
    placeBasedResponses: Array<{
      name: string;
      status: EvidenceStatus;
      reason: string;
      evidence: string;
    }>;
    practicalBarriers: Array<{
      title: string;
      statement: string;
      status: EvidenceStatus;
      source: string;
    }>;
    limitations: string[];
  };
  localPlan: {
    status: "verified" | "not_yet_verified" | "stale" | "unavailable";
    documents: PlanningDocument[];
    claims: Array<{ id: string; statement: string }>;
    note: string;
  };
  sources: Array<{
    name: string;
    url: string;
    release: string;
    period: string;
    note: string;
    status?: "verified" | "provisional" | "stale" | "unavailable";
    geography?: string;
    retrievedAt?: string;
  }>;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};

type GeometryResponse = {
  area: FeatureCollection;
  bounds: number[] | null;
  verifiedResources: FeatureCollection;
  vintage: string;
  sourceUrl: string;
  resourceNote: string;
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

const responseDetails: Record<string, { partner: string; measure: string }> = {
  "Health Access Day": {
    partner: "Local public health, community hosts and licensed professionals working within scope.",
    measure: "Attendance, completed readiness support and connections to existing services.",
  },
  "Health Equity Hub formats": {
    partner: "Libraries, community institutions, access partners and local government.",
    measure: "Use of non-clinical support, digital-readiness completion and successful handoffs.",
  },
  "Provider-led pathways": {
    partner: "Licensed providers and health organizations retaining their own platforms and clinical responsibility.",
    measure: "Residents prepared for and connected to an existing provider-led service.",
  },
  "CHA/CHIP planning support": {
    partner: "County health departments, hospitals, planning collaboratives and community partners.",
    measure: "Verified priorities linked to an owner, action, geography and reporting period.",
  },
  "Workforce capacity": {
    partner: "Employers, educators, workforce boards and credentialing bodies.",
    measure: "Verified shortage evidence, pathway participation and completed training milestones.",
  },
};

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

function formatDate(value: string | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function displaySuggestion(result: Omit<Suggestion, "display">) {
  const state = stateCodes[result.stateFips];
  const label = result.kind === "place"
    ? result.label.replace(/\s+(city|town|village|borough|CDP)$/i, "")
    : result.label;
  return `${label}${state ? `, ${state}` : ""}`;
}

function LocationSearch({
  onSelect,
  compact = false,
}: {
  onSelect: (place: Suggestion) => void;
  compact?: boolean;
}) {
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
        const response = await fetch(`/api/locations?q=${encodeURIComponent(term)}`, { signal: controller.signal });
        const payload = (await response.json().catch(() => ({}))) as { results?: Array<Omit<Suggestion, "display">>; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Search unavailable");
        setResults((payload.results ?? []).map((result) => ({ ...result, display: displaySuggestion(result) })));
      } catch (error) {
        if ((error as Error).name !== "AbortError") setMessage("Place search is temporarily unavailable.");
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
    if (choice) choose(choice);
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
    <form className={`${styles.search} ${compact ? styles.searchCompact : ""}`} onSubmit={submit} role="search">
      {!compact && <label htmlFor="explore-location">ZIP Code, city or county</label>}
      <div className={styles.searchRow}>
        <div className={styles.searchField}>
          <MagnifyingGlass size={20} aria-hidden="true" />
          <input
            id={compact ? "change-location" : "explore-location"}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
              setActiveIndex(-1);
              setMessage("");
            }}
            onKeyDown={onKeyDown}
            placeholder={compact ? "Change ZIP Code, city or county" : "Try 12207 or Albany County, NY"}
            aria-label={compact ? "Change ZIP Code, city or county" : undefined}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={results.length > 0}
            aria-controls={compact ? "change-location-suggestions" : "explore-suggestions"}
            aria-activedescendant={activeIndex >= 0 ? results[activeIndex]?.id : undefined}
          />
          {results.length > 0 && (
            <div id={compact ? "change-location-suggestions" : "explore-suggestions"} className={styles.suggestions} role="listbox">
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
        <button type="submit">{compact ? "Change" : "Explore the place"}<ArrowRight size={18} aria-hidden="true" /></button>
      </div>
      <p className={styles.searchStatus} aria-live="polite">{loading ? "Searching U.S. communities…" : message}</p>
    </form>
  );
}

function EvidenceCard({
  kind,
  metric,
}: {
  kind: "attention" | "improving" | "missing";
  metric?: Metric;
}) {
  const title = kind === "attention" ? "Needs attention" : kind === "improving" ? "Improving" : "Evidence missing";
  const Icon = kind === "attention" ? WarningCircle : kind === "improving" ? ChartLineUp : Info;
  const benchmark = metric?.state ?? metric?.national ?? 0;
  const max = metric ? Math.max(metric.value, benchmark, 1) * 1.15 : 1;
  return (
    <article className={`${styles.evidenceCard} ${styles[`evidenceCard_${kind}`]}`}>
      <header><Icon size={24} aria-hidden="true" /><span>{title}</span></header>
      {metric ? (
        <>
          <h3>{metric.label}</h3>
          <p>{metric.plainLanguage}</p>
          <div className={styles.metricValue}><strong>{metric.value.toFixed(1)}%</strong><span>{metric.geographyLevel === "zcta" ? "ZCTA estimate" : "Selected place"}</span></div>
          <div className={styles.miniBar} aria-label={`${metric.label}: ${metric.value.toFixed(1)} percent here and ${benchmark.toFixed(1)} percent comparison`}>
            <i style={{ width: `${(metric.value / max) * 100}%` }} />
            <b style={{ left: `${(benchmark / max) * 100}%` }} />
          </div>
          <small>
            {kind === "improving" && metric.previousValue !== null
              ? `${Math.abs(metric.trendDifference ?? 0).toFixed(1)} points better than the prior release.`
              : `${Math.abs(metric.difference).toFixed(1)} points ${metric.difference >= 0 ? "above" : "below"} the ${metric.state !== null ? "state" : "national"} comparison.`}
          </small>
        </>
      ) : (
        <>
          <h3>{kind === "improving" ? "No comparable trend yet" : "Local service capacity"}</h3>
          <p>{kind === "improving" ? "No measure has a compatible prior release showing a favorable change." : "Current provider capacity, wait time and community-input evidence is not available in this view."}</p>
          <span className={styles.noValue}>—</span>
        </>
      )}
    </article>
  );
}

function BriefView({ data }: { data: PlaceResponse }) {
  const attention = data.metrics
    .filter((metric) => metric.interpretation === "adverse_signal")
    .sort((a, b) => b.score - a.score)[0];
  const improving = data.metrics
    .filter((metric) => metric.trend === "improving")
    .sort((a, b) => Math.abs(b.trendDifference ?? 0) - Math.abs(a.trendDifference ?? 0))[0];
  const plan = data.localPlan.documents[0];
  return (
    <section id="brief-panel" role="tabpanel" aria-labelledby="brief-tab" className={styles.viewPanel}>
      <div className={styles.briefGrid}>
        <article className={styles.planCard}>
          <div className={styles.cardHeading}>
            <div><span>Latest local planning evidence</span><h2>What the local plan says</h2></div>
            <span className={styles.reviewBadge}>{data.localPlan.status === "verified" ? "Verified" : "Not yet verified"}</span>
          </div>
          {plan ? (
            <>
              <h3>{plan.title}</h3>
              <p>{data.localPlan.note}</p>
              <dl>
                <div><dt>Publisher</dt><dd>{plan.publisher}</dd></div>
                <div><dt>Published</dt><dd>{formatDate(plan.publishedAt)}</dd></div>
                <div><dt>Coverage</dt><dd>{plan.coverage}</dd></div>
                <div><dt>Public claims</dt><dd>{data.localPlan.claims.length ? `${data.localPlan.claims.length} verified` : "Withheld pending review"}</dd></div>
              </dl>
              <a href={plan.officialUrl} target="_blank" rel="noreferrer">Open source document <ArrowSquareOut size={17} aria-hidden="true" /></a>
            </>
          ) : (
            <div className={styles.emptyPlan}>
              <FileText size={34} aria-hidden="true" />
              <h3>No current local plan is verified here.</h3>
              <p>We will not infer a local priority from national-model estimates. A current official local plan and local review are still needed.</p>
            </div>
          )}
        </article>

        <div className={styles.contextPanel}>
          <div className={styles.cardHeading}>
            <div><span>Current public-data context</span><h2>What the comparable data shows</h2></div>
            <p>{data.dataCoverage.measureCount} compatible measures</p>
          </div>
          <div className={styles.evidenceCards}>
            <EvidenceCard kind="attention" metric={attention} />
            <EvidenceCard kind="improving" metric={improving} />
            <EvidenceCard kind="missing" />
          </div>
          <p className={styles.comparisonNote}><Info size={17} aria-hidden="true" /> Favorable measures are never ranked as problems simply because they are high. Comparisons use the same geographic level and release.</p>
        </div>
      </div>
      <SourceStrip data={data} />
    </section>
  );
}

function MapCanvas({ geometry, data, metric }: { geometry: GeometryResponse | null; data: PlaceResponse; metric?: Metric }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!containerRef.current || !geometry?.area.features.length) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !containerRef.current) return;
      const fill = metric?.interpretation === "adverse_signal" ? "#b9462c" : metric?.interpretation === "favorable_signal" ? "#446342" : "#6e7a74";
      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": "#e8ede6" } }],
        },
        center: data.location.coordinates.length === 2 ? [data.location.coordinates[0], data.location.coordinates[1]] : [-98.5, 39.5],
        zoom: 7,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
      map.on("load", () => {
        if (!map || cancelled) return;
        map.addSource("official-boundary", { type: "geojson", data: geometry.area as never });
        map.addLayer({ id: "boundary-fill", type: "fill", source: "official-boundary", paint: { "fill-color": fill, "fill-opacity": metric ? 0.28 : 0.12 } });
        map.addLayer({ id: "boundary-line", type: "line", source: "official-boundary", paint: { "line-color": "#111a1d", "line-width": 2.4 } });
        if (geometry.verifiedResources.features.length) {
          map.addSource("verified-resources", { type: "geojson", data: geometry.verifiedResources as never });
          map.addLayer({ id: "verified-resources", type: "circle", source: "verified-resources", paint: { "circle-radius": 6, "circle-color": "#f4b71b", "circle-stroke-color": "#111a1d", "circle-stroke-width": 2 } });
        }
        if (geometry.bounds?.length === 4) {
          map.fitBounds(
            [[geometry.bounds[0], geometry.bounds[1]], [geometry.bounds[2], geometry.bounds[3]]],
            { padding: 58, maxZoom: 10, animate: false },
          );
        }
        map.once("idle", () => {
          if (!cancelled && containerRef.current) {
            containerRef.current.dataset.mapReady = "true";
          }
        });
      });
      map.on("error", () => setMapError("The official boundary could not be rendered."));
    }).catch(() => setMapError("The map could not be loaded."));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [data, geometry, metric]);

  if (!geometry?.area.features.length || mapError) {
    return <div className={styles.mapEmpty}><MapTrifold size={44} aria-hidden="true" /><p>{mapError || "The official boundary is temporarily unavailable."}</p></div>;
  }
  return <div ref={containerRef} className={styles.mapCanvas} data-map-ready="false" role="img" aria-label={`Official ${data.location.evidenceGeography.replace("_", " ")} boundary for ${data.location.label}`} />;
}

function MapView({
  data,
  geometry,
}: {
  data: PlaceResponse;
  geometry: GeometryResponse | null;
}) {
  const compatibleMetrics = useMemo(
    () => data.metrics.filter((metric) => metric.geographyLevel === data.location.evidenceGeography),
    [data.location.evidenceGeography, data.metrics],
  );
  const [metricKey, setMetricKey] = useState(compatibleMetrics[0]?.key ?? "");
  useEffect(() => setMetricKey(compatibleMetrics[0]?.key ?? ""), [compatibleMetrics]);
  const metric = compatibleMetrics.find((item) => item.key === metricKey);
  return (
    <section id="map-panel" role="tabpanel" aria-labelledby="map-tab" className={styles.viewPanel}>
      <div className={styles.mapLayout}>
        <figure className={styles.mapFigure}>
          <MapCanvas geometry={geometry} data={data} metric={metric} />
          <figcaption>{geometry?.vintage ?? "Official Census boundary"}. The shaded value applies to the selected geography as a whole; it does not show neighborhood variation.</figcaption>
        </figure>
        <aside className={styles.mapSidebar}>
          <span>Map evidence</span>
          <h2>{data.location.label}</h2>
          <p>{data.location.geographyLabel}</p>
          <label htmlFor="map-measure">Compatible data layer</label>
          <select id="map-measure" value={metricKey} onChange={(event) => setMetricKey(event.target.value)}>
            {compatibleMetrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
          {metric ? (
            <div className={styles.mapMetric}>
              <strong>{metric.value.toFixed(1)}%</strong>
              <span>{metric.label}</span>
              <p>{metric.release} release · {metric.geographyLevel === "zcta" ? "ZCTA" : metric.geographyLevel === "census_place" ? "Census place" : "County"} estimate</p>
            </div>
          ) : <p className={styles.mapNotice}>No compatible measure is available for this geography.</p>}
          <div className={styles.legend}>
            <span><i className={styles.legendFill} /> Selected geography and compatible measure</span>
            <span><i className={styles.legendLine} /> Official boundary</span>
            <span><i className={styles.legendMarker} /> Verified resource</span>
          </div>
          <div className={styles.resourceStatus}><MapPin size={20} aria-hidden="true" /><p>{geometry?.resourceNote ?? "Verified resource information is loading."}</p></div>
          {geometry?.sourceUrl && <a href={geometry.sourceUrl} target="_blank" rel="noreferrer">Open boundary source <ArrowSquareOut size={16} aria-hidden="true" /></a>}
        </aside>
      </div>
    </section>
  );
}

function ActionView({ data }: { data: PlaceResponse }) {
  const rows = data.intelligence.placeBasedResponses.map((response) => {
    const details = responseDetails[response.name] ?? {
      partner: "Local institutions with responsibility for the evidence and response.",
      measure: "A locally agreed measure with an owner, baseline and reporting period.",
    };
    return {
      ...response,
      barrier: data.intelligence.practicalBarriers.find((item) => item.status !== "Insufficient evidence")?.title ?? "Local evidence gap",
      outcome: response.status === "Insufficient evidence" ? "Insufficient evidence" : "Local review required",
      ...details,
    };
  });
  return (
    <section id="action-panel" role="tabpanel" aria-labelledby="action-tab" className={styles.viewPanel}>
      <header className={styles.actionHeader}>
        <div><span>From evidence to accountable action</span><h2>Show the link. Keep the boundary.</h2></div>
        <p>These are non-clinical options for local review, not automatic recommendations. Licensed care remains with licensed professionals.</p>
      </header>
      <div className={styles.actionTable} role="table" aria-label="Evidence to action pathways">
        <div className={styles.actionColumns} role="row">
          <span role="columnheader">Evidence</span><span role="columnheader">Practical barrier</span><span role="columnheader">Potential response</span><span role="columnheader">Partner role</span><span role="columnheader">Measure of progress</span>
        </div>
        {rows.map((row) => (
          <article role="row" key={row.name} className={styles.actionRow}>
            <div role="cell" data-label="Evidence"><span className={styles.actionStatus}>{row.outcome}</span><p>{row.evidence}</p></div>
            <div role="cell" data-label="Practical barrier"><strong>{row.barrier}</strong><p>Confirm with current local evidence and community review.</p></div>
            <div role="cell" data-label="Potential response"><strong>{row.name}</strong><p>{row.reason}</p></div>
            <div role="cell" data-label="Partner role"><p>{row.partner}</p></div>
            <div role="cell" data-label="Measure of progress"><p>{row.measure}</p></div>
          </article>
        ))}
      </div>
      <div className={styles.noRecommendation}><ShieldCheck size={22} aria-hidden="true" /><p><strong>“No recommendation yet” is a valid outcome.</strong> If the geography, source, recency or local review is insufficient, the system should stop rather than overstate a case for action.</p></div>
    </section>
  );
}

function SourceStrip({ data }: { data: PlaceResponse }) {
  const verifiedSources = data.sources.filter((source) => source.status !== "provisional");
  const first = verifiedSources[0] ?? data.sources[0];
  return (
    <div className={styles.sourceStrip}>
      <div><Clock size={20} aria-hidden="true" /><span><small>Retrieved</small>{formatDate(first?.retrievedAt)}</span></div>
      <div><span><small>Release</small>{first?.release ?? "Unavailable"}</span></div>
      <div><span><small>Data period</small>{first?.period ?? "Unavailable"}</span></div>
      <div><span><small>Geography</small>{first?.geography ?? data.location.geographyLabel}</span></div>
      <details>
        <summary>Sources &amp; citations <CaretRight size={17} aria-hidden="true" /></summary>
        <div className={styles.sourceList}>
          {data.sources.map((source) => (
            <article key={`${source.name}-${source.release}`}>
              <div><strong>{source.name}</strong><span className={source.status === "provisional" ? styles.provisional : styles.verified}>{source.status === "provisional" ? "Under review" : "Verified source"}</span></div>
              <p>{source.release} · {source.period} · {source.geography ?? "Source geography"}</p>
              <p>{source.note}</p>
              <a href={source.url} target="_blank" rel="noreferrer">Open source <ArrowSquareOut size={15} aria-hidden="true" /></a>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}

function DownloadDialog({ data, onClose }: { data: PlaceResponse; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
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
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"), email: form.get("email"), role: form.get("role"),
          stateOrCounty: data.location.label, inquiryType: "Local evidence brief access",
          message: `Organization: ${String(form.get("organization") ?? "")}\nPurpose: ${String(form.get("purpose") ?? "")}`,
          website: form.get("website"), consent: form.get("consent") === "yes",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The brief could not be prepared.");
      const rows = [
        ["SozoRock Place Intelligence", data.location.label],
        ["Evidence geography", data.location.geographyLabel],
        ["Geographic caveat", ...data.location.caveats],
        ["Local planning evidence", data.localPlan.status, data.localPlan.note],
        ["Measure", "Local estimate", "National comparison", "Direction", "Interpretation", "Release", "Geography"],
        ...data.metrics.map((metric) => [metric.label, metric.value, metric.national, metric.higherValueMeaning, metric.interpretation, metric.release, metric.geographyLevel]),
        ["Sources"],
        ...data.sources.map((source) => [source.name, source.release, source.period, source.geography ?? "", source.url]),
      ];
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sozorock-health-${data.location.geoid}-place-brief.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      setState("sent");
      setMessage("Your place brief is ready.");
    } catch (error) {
      setState("error");
      setMessage((error as Error).message);
    }
  }

  return (
    <div className={styles.dialogBackdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="download-title">
        <button ref={closeRef} className={styles.dialogClose} type="button" onClick={onClose} aria-label="Close"><X size={22} /></button>
        <span>Place brief</span><h2 id="download-title">Tell us how the evidence will be used.</h2>
        <p>Do not include medical information. Your contact details help us understand public use of the brief.</p>
        <form onSubmit={submit} className={styles.downloadForm}>
          <div><label>Full name<input required name="name" autoComplete="name" /></label><label>Email<input required type="email" name="email" autoComplete="email" /></label></div>
          <div><label>Organization<input required name="organization" autoComplete="organization" /></label><label>Role or sector<select required name="role" defaultValue=""><option value="" disabled>Select one</option><option>Community organization</option><option>County, state or public agency</option><option>Licensed provider or health organization</option><option>University or researcher</option><option>Foundation or funder</option><option>Individual or family</option><option>Other</option></select></label></div>
          <label>Purpose<textarea required name="purpose" rows={3} /></label>
          <input className={styles.honeypot} name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          <label className={styles.consent}><input required type="checkbox" name="consent" value="yes" /><span>I agree that The SozoRock Foundation, Inc. may use this information to provide the file and understand its use. I have read the <a href="/privacy">Privacy Notice</a>.</span></label>
          <button type="submit" disabled={state === "sending"}>{state === "sending" ? "Preparing…" : "Download place brief"}</button>
          <p role="status" className={state === "error" ? styles.error : styles.success}>{message}</p>
        </form>
      </section>
    </div>
  );
}

export function ExploreClient() {
  const [data, setData] = useState<PlaceResponse | null>(null);
  const [geometry, setGeometry] = useState<GeometryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState<WorkspaceView>("brief");
  const [downloadOpen, setDownloadOpen] = useState(false);

  const loadPlace = useCallback(async (place: Pick<Suggestion, "kind" | "geoid">) => {
    setLoading(true);
    setError("");
    setData(null);
    setGeometry(null);
    setActiveView("brief");
    const params = new URLSearchParams({ kind: place.kind, geoid: place.geoid, view: "brief" });
    try {
      const [dataResponse, geometryResponse] = await Promise.all([
        fetch(`/api/explore?kind=${place.kind}&geoid=${place.geoid}`),
        fetch(`/api/explore/geometry?kind=${place.kind}&geoid=${place.geoid}`),
      ]);
      const payload = (await dataResponse.json().catch(() => ({}))) as PlaceResponse & { error?: string };
      if (!dataResponse.ok) throw new Error(payload.error ?? "Current public data could not be loaded.");
      const map = (await geometryResponse.json().catch(() => null)) as GeometryResponse | null;
      setData(payload);
      setGeometry(map);
      window.history.replaceState({}, "", `/explore?${params.toString()}`);
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
    const view = params.get("view");
    if (view === "brief" || view === "map" || view === "action") setActiveView(view);
    if ((kind === "county" || kind === "place" || kind === "zip") && geoid) void loadPlace({ kind, geoid });
  }, [loadPlace]);

  function changeView(view: WorkspaceView) {
    setActiveView(view);
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    window.history.replaceState({}, "", `/explore?${params.toString()}`);
  }

  function moveViewFocus(event: ReactKeyboardEvent<HTMLButtonElement>, view: WorkspaceView) {
    const views: WorkspaceView[] = ["brief", "map", "action"];
    const current = views.indexOf(view);
    const next = event.key === "ArrowRight"
      ? views[(current + 1) % views.length]
      : event.key === "ArrowLeft"
        ? views[(current - 1 + views.length) % views.length]
        : event.key === "Home"
          ? views[0]
          : event.key === "End"
            ? views[views.length - 1]
            : null;
    if (!next) return;
    event.preventDefault();
    changeView(next);
    window.requestAnimationFrame(() => document.getElementById(`${next}-tab`)?.focus());
  }

  const partnershipHref = `/contact?interest=${encodeURIComponent("Partner with us")}${data ? `&location=${encodeURIComponent(data.location.label)}` : ""}`;

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#explore-main">Skip to main content</a>
      <header className={styles.header}>
        <a href="/" aria-label="SozoRock Health home"><BrandLockup /></a>
        <nav aria-label="Explore navigation"><a href="/"><ArrowLeft size={18} /> Back to SozoRock Health</a><a href={partnershipHref}>Partner with us</a></nav>
      </header>

      <main id="explore-main">
        {!data && !loading && (
          <>
            <section className={styles.hero}>
              <div className={styles.heroCopy}><span>SozoRock Place Intelligence</span><h1>See what is shaping health in this place.</h1><p>Search a U.S. ZIP Code, city or county. See what current sources support, what remains uncertain and where local review is still needed.</p></div>
              <LocationSearch onSelect={loadPlace} />
              <div className={styles.coverage}><span><strong>Nationwide</strong> geography</span><span><strong>Source-traceable</strong> evidence</span><span><strong>Strictly non-clinical</strong> place analysis</span></div>
            </section>
            <section className={styles.intro}>
              <div><span>One place. Three useful views.</span><h2>A brief to understand. A map with a reason. An action path with limits.</h2></div>
              <div><article><FileText size={26} /><strong>Brief</strong><p>Local-plan status, public-data context, gaps and citations.</p></article><article><MapTrifold size={26} /><strong>Map</strong><p>Official geography and only compatible evidence layers.</p></article><article><CheckCircle size={26} /><strong>Action</strong><p>Evidence linked to a possible response, partner and measure.</p></article></div>
            </section>
          </>
        )}

        {loading && <section className={styles.loading} aria-live="polite"><span /><p>Resolving the geography and checking current sources…</p></section>}
        {error && <section className={styles.errorPanel} role="alert"><h1>We could not load this place.</h1><p>{error}</p><button type="button" onClick={() => window.location.assign("/explore")}>Start another search</button></section>}

        {data && (
          <div className={styles.workspace}>
            <section className={styles.placeBand}>
              <div className={styles.placeIdentity}>
                <span>Selected place</span>
                <h1>{data.location.label}</h1>
                <div><ShieldCheck size={19} aria-hidden="true" /><strong>{data.location.geographyLabel}</strong><span>{formatNumber(data.location.population)} people</span></div>
                <p><Info size={18} aria-hidden="true" /> {data.location.caveats[0]}</p>
              </div>
              <LocationSearch compact onSelect={loadPlace} />
            </section>

            <div className={styles.workspaceToolbar}>
              <div className={styles.tabs} role="tablist" aria-label="Explore views">
                {(["brief", "map", "action"] as const).map((view) => {
                  const label = view[0].toUpperCase() + view.slice(1);
                  const Icon = view === "brief" ? FileText : view === "map" ? MapTrifold : CheckCircle;
                  return <button key={view} id={`${view}-tab`} role="tab" aria-selected={activeView === view} aria-controls={`${view}-panel`} tabIndex={activeView === view ? 0 : -1} onClick={() => changeView(view)} onKeyDown={(event) => moveViewFocus(event, view)}><Icon size={20} aria-hidden="true" />{label}</button>;
                })}
              </div>
              <div className={styles.workspaceActions}><button type="button" onClick={() => setDownloadOpen(true)}><DownloadSimple size={18} aria-hidden="true" /> Download brief</button><a href={partnershipHref}><UsersThree size={18} aria-hidden="true" /> Discuss this place</a></div>
            </div>

            {activeView === "brief" && <BriefView data={data} />}
            {activeView === "map" && <MapView data={data} geometry={geometry} />}
            {activeView === "action" && <ActionView data={data} />}
          </div>
        )}
      </main>

      <footer className={styles.footer}><BrandLockup /><p>Public place evidence for community planning. No patient profile, diagnosis or medical advice.</p><a href="/privacy">Privacy</a><a href="/accessibility">Accessibility</a><a href="/contact">Contact</a></footer>
      {downloadOpen && data && <DownloadDialog data={data} onClose={() => setDownloadOpen(false)} />}
    </div>
  );
}
