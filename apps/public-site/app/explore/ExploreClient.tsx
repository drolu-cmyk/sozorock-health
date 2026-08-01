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
  ChartBar,
  ChartLineUp,
  ChatCircleDots,
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
import {
  collectionPolygons,
  compoundPathForPolygons,
  fitFallbackGeometry,
  hasRenderableGeometry,
} from "../lib/explore-map-fallback";

type PlaceKind = "county" | "place" | "zip";
type WorkspaceView = "brief" | "map" | "action" | "visuals";
type EvidenceStatus = "Supported" | "Potentially supported" | "Insufficient evidence";

type CountyResolutionCandidate = {
  countyGeoid: string;
  label: string;
  overlapAreaPercent: number | null;
  overlapPopulationPercent: number | null;
  calculationMethod: string;
  isPrimary: boolean;
  sourceUrl: string;
  vintage: string;
};

type CountyResolution = {
  original: { kind: PlaceKind; geoid: string; label: string };
  status: "resolved" | "selection_required" | "not_found";
  selectedCountyGeoid: string | null;
  counties: CountyResolutionCandidate[];
  caveats: string[];
};

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
  national: number | null;
  state: number | null;
  difference: number | null;
  score: number;
  release: string;
  previousValue: number | null;
  trendDifference: number | null;
  trend: "improving" | "worsening" | "stable" | "unavailable";
  interpretation: "adverse_signal" | "favorable_signal" | "context_only" | "equal" | "comparison_unavailable";
  geographyLevel: "county" | "census_place" | "zcta";
  universe: string;
  adjustment: string;
  source: string;
  sourceUrl: string;
  dataPeriod: string;
  retrievedAt: string | null;
};

type ContextMeasure = {
  key: string;
  label: string;
  value: string | number | null;
  unit: string;
  uncertainty: string | null;
  source: string;
  release: string;
  period: string;
  direction: string;
  definition: string;
  sourceUrl?: string;
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
    resolution: CountyResolution;
  };
  metrics: Metric[];
  contextMeasures: ContextMeasure[];
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
  sourceCoverage: Array<{
    sourceId: string;
    status: string;
    reason: string;
    observationCount: number;
    releaseDate: string | null;
  }>;
  workforceContext: {
    hpsa: Array<{
      designationId: string;
      designationName: string;
      designationType: string;
      componentType: string;
      discipline: string;
      status: string;
      score: number | null;
      designationDate: string | null;
      lastUpdateDate: string | null;
      wholeCounty: boolean;
    }>;
    medicallyUnderservedAreasAndPopulations: Array<{
      designationId: string;
      designationName: string;
      designationType: string;
      componentType: string;
      populationType: string;
      status: string;
      imuScore: number | null;
      designationDate: string | null;
      lastUpdateDate: string | null;
      wholeCounty: boolean;
    }>;
    areaHealthResources: Array<{
      variableId: string;
      label: string;
      value: number | null;
      unit: string;
      year: string;
      direction: string;
    }>;
    limitation: string;
  };
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<Record<string, unknown>>;
};

type GeometryResponse = {
  area: FeatureCollection;
  contextArea?: FeatureCollection;
  bounds: number[] | null;
  verifiedResources: FeatureCollection;
  vintage: string;
  sourceUrl: string;
  resourceNote: string;
  contextNote?: string | null;
};

type PlaceAgentAnswer = {
  schemaVersion: string;
  answer: string;
  status: "answered" | "evidence_gap" | "refused";
  citedEvidence: Array<{ citationId: string; claim: string }>;
  sourceAndDataDates: Array<{
    sourceId: string;
    releaseDate: string | null;
    dataPeriodStart: string | null;
    dataPeriodEnd: string | null;
  }>;
  geographicScope: { kind: string; geoid: string; displayName: string };
  confidence: "high" | "moderate" | "low";
  missingEvidence: string[];
  caveats: string[];
  nonClinicalBoundary: string;
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
  kind: "attention" | "improving" | "protective" | "context" | "missing";
  metric?: Metric;
}) {
  const title = kind === "attention"
    ? "Needs attention"
    : kind === "improving"
      ? "Improving"
      : kind === "protective"
        ? "Protective signal"
        : kind === "context"
          ? "Local context"
          : "Evidence missing";
  const Icon = kind === "attention" ? WarningCircle : kind === "improving" || kind === "protective" ? ChartLineUp : Info;
  const benchmark = metric?.state ?? metric?.national ?? null;
  const max = metric ? Math.max(metric.value, benchmark ?? 0, 1) * 1.15 : 1;
  return (
    <article className={`${styles.evidenceCard} ${styles[`evidenceCard_${kind}`]}`}>
      <header><Icon size={24} aria-hidden="true" /><span>{title}</span></header>
      {metric ? (
        <>
          <h3>{metric.label}</h3>
          <p>{metric.plainLanguage}</p>
          <div className={styles.metricValue}><strong>{metric.value.toFixed(1)}%</strong><span>{metric.geographyLevel === "zcta" ? "ZCTA estimate" : "Selected place"}</span></div>
          <div className={styles.miniBar} aria-label={`${metric.label}: ${metric.value.toFixed(1)} percent here and ${benchmark === null ? "comparison unavailable" : `${benchmark.toFixed(1)} percent comparison`}`}>
            <i style={{ width: `${(metric.value / max) * 100}%` }} />
            {benchmark !== null && <b style={{ left: `${(benchmark / max) * 100}%` }} />}
          </div>
          <small>
            {kind === "improving" && metric.previousValue !== null
              ? `${Math.abs(metric.trendDifference ?? 0).toFixed(1)} points better than the prior release.`
              : metric.difference === null
                ? "Comparison unavailable for this release."
                : `${Math.abs(metric.difference).toFixed(1)} points ${metric.difference >= 0 ? "above" : "below"} the ${metric.state !== null ? "state" : "national"} comparison.`}
          </small>
        </>
      ) : (
        <>
          <h3>{kind === "improving" ? "No comparable trend yet" : kind === "context" ? "No context measure available" : "Local service capacity"}</h3>
          <p>{kind === "improving" ? "No measure has a compatible prior release showing a favorable change." : kind === "context" ? "No compatible contextual measure is published for this county." : "Current provider capacity, wait time and community-input evidence is not available in this view."}</p>
          <span className={styles.noValue}>—</span>
        </>
      )}
    </article>
  );
}

function BoundaryFallback({ geometry, data, metric }: { geometry: GeometryResponse; data: PlaceResponse; metric?: Metric }) {
  const areaPolygons = collectionPolygons(geometry.area);
  const contextPolygons = collectionPolygons(geometry.contextArea);
  const layout = fitFallbackGeometry([geometry.area, geometry.contextArea]);
  const fill = metric?.interpretation === "adverse_signal" ? "#b9462c" : metric?.interpretation === "favorable_signal" ? "#446342" : "#6e7a74";
  const areaPath = layout ? compoundPathForPolygons(areaPolygons, layout) : "";
  const contextPath = layout ? compoundPathForPolygons(contextPolygons, layout) : "";
  return (
    <div className={styles.mapFallback} data-map-fallback="true">
      <svg viewBox="0 0 100 100" role="img" aria-label={`Cached official boundary for ${data.location.label}`}>
        <rect width="100" height="100" fill="#e8ede6" />
        {areaPath ? <path d={areaPath} fill={fill} fillOpacity="0.28" fillRule="evenodd" clipRule="evenodd" stroke="#111a1d" strokeWidth="0.55" vectorEffect="non-scaling-stroke" /> : null}
        {contextPath ? <path d={contextPath} fill="none" stroke="#f4b71b" strokeWidth="0.75" strokeDasharray="2.2 1.6" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      <p>Interactive map unavailable. Showing the cached official boundary for this geography.{contextPath ? " The original search geography is outlined for context; evidence remains county-level." : ""}</p>
    </div>
  );
}

function MetricDetails({ metric }: { metric: Metric }) {
  return (
    <details className={styles.measureDetails}>
      <summary><Info size={14} aria-hidden="true" /> Details</summary>
      <dl>
        <div><dt>Definition</dt><dd>{metric.plainLanguage}</dd></div>
        <div><dt>Universe</dt><dd>{metric.universe}</dd></div>
        <div><dt>Uncertainty</dt><dd>{metric.confidence || "Not supplied by source"}</dd></div>
        <div><dt>Source</dt><dd><a href={metric.sourceUrl} target="_blank" rel="noreferrer">{metric.source}</a></dd></div>
        <div><dt>Release</dt><dd>{metric.release}</dd></div>
        <div><dt>Data period</dt><dd>{metric.dataPeriod}</dd></div>
        <div><dt>Geography</dt><dd>{metric.geographyLevel === "county" ? "County" : metric.geographyLevel}</dd></div>
        <div><dt>Direction</dt><dd>{metric.direction}</dd></div>
      </dl>
    </details>
  );
}

function ContextMeasureDetails({ measure }: { measure: ContextMeasure }) {
  return (
    <details className={styles.measureDetails}>
      <summary><Info size={14} aria-hidden="true" /> Details</summary>
      <dl>
        <div><dt>Definition</dt><dd>{measure.definition}</dd></div>
        <div><dt>Uncertainty</dt><dd>{measure.uncertainty ?? "Not supplied by source"}</dd></div>
        <div><dt>Source</dt><dd>{measure.sourceUrl ? <a href={measure.sourceUrl} target="_blank" rel="noreferrer">{measure.source}</a> : measure.source}</dd></div>
        <div><dt>Release</dt><dd>{measure.release}</dd></div>
        <div><dt>Data period</dt><dd>{measure.period}</dd></div>
        <div><dt>Geography</dt><dd>County</dd></div>
        <div><dt>Direction</dt><dd>{measure.direction}</dd></div>
      </dl>
    </details>
  );
}

function BriefView({ data }: { data: PlaceResponse }) {
  const attention = data.metrics
    .filter((metric) => metric.interpretation === "adverse_signal")
    .sort((a, b) => b.score - a.score)[0];
  const improving = data.metrics
    .filter((metric) => metric.trend === "improving")
    .sort((a, b) => Math.abs(b.trendDifference ?? 0) - Math.abs(a.trendDifference ?? 0))[0];
  const protective = data.metrics
    .filter((metric) => metric.direction === "protective")
    .sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0))[0];
  const contextual = data.metrics
    .filter((metric) => metric.direction === "contextual")
    .sort((a, b) => Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0))[0];
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
            <EvidenceCard kind={attention ? "attention" : "protective"} metric={attention ?? protective} />
            <EvidenceCard kind={improving ? "improving" : "context"} metric={improving ?? contextual} />
            <EvidenceCard kind="missing" />
          </div>
          <p className={styles.comparisonNote}><Info size={17} aria-hidden="true" /> Favorable measures are never ranked as problems simply because they are high. Comparisons use the same geographic level and release.</p>
          <details className={styles.allMeasures}>
            <summary>All {data.metrics.length + data.contextMeasures.length} compatible measures <CaretRight size={17} aria-hidden="true" /></summary>
            <div className={styles.measureTable} role="table" aria-label={`All compatible county measures for ${data.location.label}`}>
              <div role="row">
                <span role="columnheader">Measure</span>
                <span role="columnheader">County</span>
                <span role="columnheader">State</span>
                <span role="columnheader">National</span>
                <span role="columnheader">Uncertainty</span>
              </div>
              {data.metrics.map((metric) => (
                <div role="row" key={metric.key}>
                  <span role="cell"><strong>{metric.label}</strong><small>{metric.plainLanguage}</small><MetricDetails metric={metric} /></span>
                  <span role="cell">{metric.value.toFixed(1)}%</span>
                  <span role="cell">{metric.state === null ? "Unavailable" : `${metric.state.toFixed(1)}%`}</span>
                  <span role="cell">{metric.national === null ? "Comparison unavailable" : `${metric.national.toFixed(1)}%`}</span>
                  <span role="cell">{metric.confidence || "Not supplied"}</span>
                </div>
              ))}
              {data.contextMeasures.map((measure) => (
                <div role="row" key={measure.key}>
                  <span role="cell">
                    <strong>{measure.label}</strong>
                    <small>{measure.source} · {measure.definition} · {measure.period}</small>
                    <ContextMeasureDetails measure={measure} />
                  </span>
                  <span role="cell">{measure.value === null
                    ? "Unavailable"
                    : typeof measure.value === "string"
                      ? `${measure.value} ${measure.unit}`
                      : measure.unit === "percent"
                      ? `${measure.value.toFixed(1)}%`
                      : `${formatNumber(measure.value)} ${measure.unit}`}</span>
                  <span role="cell">Not comparable here</span>
                  <span role="cell">Not comparable here</span>
                  <span role="cell">{measure.uncertainty ?? "Not supplied by source"}</span>
                </div>
              ))}
            </div>
          </details>
          <details className={styles.coverageMatrix}>
            <summary>Evidence coverage <CaretRight size={17} aria-hidden="true" /></summary>
            <div>
              {data.sourceCoverage.map((source) => (
                <article key={source.sourceId}>
                  <strong>{source.sourceId.replaceAll("-", " ")}</strong>
                  <span>{source.status.replaceAll("_", " ")}</span>
                  <p>{source.reason}</p>
                </article>
              ))}
            </div>
          </details>
          <details className={styles.coverageMatrix}>
            <summary>Workforce and shortage designations <CaretRight size={17} aria-hidden="true" /></summary>
            <div>
              {data.workforceContext.hpsa.length === 0
                && data.workforceContext.medicallyUnderservedAreasAndPopulations.length === 0
                && data.workforceContext.areaHealthResources.every((observation) => observation.value === null) ? (
                  <article>
                    <strong>No associated designation in the approved source</strong>
                    <p>This does not mean that no shortage or access barrier exists.</p>
                  </article>
                ) : (
                  <>
                    {data.workforceContext.hpsa.map((designation) => (
                      <article key={`hpsa-${designation.designationId}-${designation.discipline}`}>
                        <strong>{designation.designationName || designation.discipline}</strong>
                        <span>{designation.wholeCounty ? "Whole county" : designation.componentType || "Source-defined area"}</span>
                        <p>{designation.discipline} · {designation.status}{designation.score === null ? "" : ` · score ${designation.score}`}</p>
                      </article>
                    ))}
                    {data.workforceContext.medicallyUnderservedAreasAndPopulations.map((designation) => (
                      <article key={`muap-${designation.designationId}`}>
                        <strong>{designation.designationName || "Medically underserved designation"}</strong>
                        <span>{designation.wholeCounty ? "Whole county" : designation.componentType || "Source-defined area"}</span>
                        <p>{designation.designationType} · {designation.status}{designation.imuScore === null ? "" : ` · IMU ${designation.imuScore}`}</p>
                      </article>
                    ))}
                    {data.workforceContext.areaHealthResources.map((observation) => (
                      <article key={`ahrf-${observation.variableId}`}>
                        <strong>{observation.label}</strong>
                        <span>{observation.year}</span>
                        <p>{observation.value === null
                          ? "Unavailable from source"
                          : `${formatNumber(observation.value)} ${observation.unit}`}</p>
                      </article>
                    ))}
                  </>
                )}
              <article>
                <strong>How to read this</strong>
                <p>{data.workforceContext.limitation}</p>
              </article>
            </div>
          </details>
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
    if (!containerRef.current || !geometry || !hasRenderableGeometry(geometry.area)) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    void import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !containerRef.current) return;
      const fill = metric?.interpretation === "adverse_signal" ? "#b9462c" : metric?.interpretation === "favorable_signal" ? "#446342" : "#6e7a74";
      try {
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
      } catch {
        setMapError("The official boundary could not be rendered.");
        return;
      }
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), "top-right");
      map.on("load", () => {
        if (!map || cancelled) return;
        map.addSource("official-boundary", { type: "geojson", data: geometry.area as never });
        map.addLayer({ id: "boundary-fill", type: "fill", source: "official-boundary", paint: { "fill-color": fill, "fill-opacity": metric ? 0.28 : 0.12 } });
        map.addLayer({ id: "boundary-line", type: "line", source: "official-boundary", paint: { "line-color": "#111a1d", "line-width": 2.4 } });
        if (hasRenderableGeometry(geometry.contextArea)) {
          map.addSource("search-context", { type: "geojson", data: geometry.contextArea as never });
          map.addLayer({ id: "search-context-line", type: "line", source: "search-context", paint: { "line-color": "#f4b71b", "line-width": 2, "line-dasharray": [3, 2] } });
        }
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

  const hasAreaGeometry = hasRenderableGeometry(geometry?.area);
  if (!hasAreaGeometry || mapError) {
    return hasAreaGeometry && geometry
      ? <BoundaryFallback geometry={geometry} data={data} metric={metric} />
      : <div className={styles.mapEmpty}><MapTrifold size={44} aria-hidden="true" /><p>{mapError || "The official boundary is temporarily unavailable."}</p></div>;
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
  const contextVisible = hasRenderableGeometry(geometry?.contextArea);
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
            {contextVisible ? <span><i className={styles.legendContext} /> Original search geography</span> : null}
            <span><i className={styles.legendMarker} /> Verified resource</span>
          </div>
          <div className={styles.resourceStatus}><MapPin size={20} aria-hidden="true" /><p>{geometry?.resourceNote ?? "Verified resource information is loading."}</p></div>
          {contextVisible && geometry?.contextNote ? <p className={styles.mapNotice}>{geometry.contextNote}</p> : null}
          {geometry?.sourceUrl && <a href={geometry.sourceUrl} target="_blank" rel="noreferrer">Open boundary source <ArrowSquareOut size={16} aria-hidden="true" /></a>}
        </aside>
      </div>
    </section>
  );
}

function ActionView({ data }: { data: PlaceResponse }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<PlaceAgentAnswer | null>(null);
  const [status, setStatus] = useState<"idle" | "asking" | "error">("idle");
  const [error, setError] = useState("");

  async function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuestion = question.trim();
    if (nextQuestion.length < 3) return;
    setStatus("asking");
    setError("");
    setAnswer(null);
    try {
      const response = await fetch("/api/evidence/v1/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ geoid: data.location.geoid, question: nextQuestion }),
      });
      const payload = (await response.json().catch(() => ({}))) as PlaceAgentAnswer & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Place Intelligence could not answer this question.");
      setAnswer(payload);
      setStatus("idle");
    } catch (nextError) {
      setError((nextError as Error).message);
      setStatus("error");
    }
  }

  const prompts = [
    "What evidence is available for this county?",
    "What evidence is still missing?",
    "Does the evidence potentially support a Health Access Day for local review?",
  ];
  return (
    <section id="action-panel" role="tabpanel" aria-labelledby="action-tab" className={styles.viewPanel}>
      <header className={styles.actionHeader}>
        <div><span>Ask the evidence</span><h2>A planning conversation with sources.</h2></div>
        <p>Ask about this county’s approved evidence, sources, gaps and possible non-clinical responses. Every substantive answer must cite the stored evidence package.</p>
      </header>
      <div className={styles.agentWorkspace}>
        <form className={styles.agentQuestion} onSubmit={ask}>
          <label htmlFor="place-question">Question about {data.location.label}</label>
          <div>
            <textarea
              id="place-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              maxLength={1500}
              placeholder="Ask what current evidence shows, how a measure is defined, or what requires local review."
            />
            <button type="submit" disabled={status === "asking" || question.trim().length < 3}>
              <ChatCircleDots size={20} aria-hidden="true" />
              {status === "asking" ? "Checking evidence…" : "Ask Place Intelligence"}
            </button>
          </div>
          <div className={styles.promptChips} aria-label="Example evidence questions">
            {prompts.map((prompt) => (
              <button key={prompt} type="button" onClick={() => setQuestion(prompt)}>{prompt}</button>
            ))}
          </div>
          {error && <p className={styles.agentError} role="alert">{error}</p>}
        </form>
        <aside className={styles.agentBoundary}>
          <ShieldCheck size={24} aria-hidden="true" />
          <h3>County evidence only</h3>
          <p>No live web search. No patient profile. No diagnosis, triage, treatment advice or individual-risk inference.</p>
        </aside>
        {answer && (
          <article className={styles.agentAnswer} aria-live="polite">
            <header>
              <span className={styles.actionStatus}>{answer.status.replace("_", " ")}</span>
              <span>{answer.confidence} confidence</span>
            </header>
            <h3>Place Intelligence response</h3>
            <p>{answer.answer}</p>
            {answer.citedEvidence.length > 0 && (
              <div className={styles.agentCitations}>
                <h4>Cited evidence</h4>
                {answer.citedEvidence.map((citation) => (
                  <article key={`${citation.citationId}-${citation.claim}`}>
                    <p>{citation.claim}</p>
                    <small>Citation {citation.citationId}</small>
                  </article>
                ))}
              </div>
            )}
            {answer.missingEvidence.length > 0 && (
              <div><h4>Missing evidence</h4><ul>{answer.missingEvidence.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            <p className={styles.agentDisclosure}>{answer.nonClinicalBoundary}</p>
          </article>
        )}
        <section className={styles.planReview} aria-labelledby="plan-review-title">
          <div>
            <span>Shared county plan</span>
            <h3 id="plan-review-title">Agent suggestions require acceptance.</h3>
            <p>Approved collaborators can add a cited result to a named plan section, comment, assign a review question and restore an earlier version. Agent and human changes remain visibly separate.</p>
          </div>
          <div>
            {data.intelligence.placeBasedResponses.map((response) => {
              const details = responseDetails[response.name];
              return (
                <article key={response.name}>
                  <span>{response.status}</span>
                  <h4>{response.name}</h4>
                  <p>{response.reason}</p>
                  <small>{details?.measure ?? "A locally agreed measure with an owner, baseline and reporting period."}</small>
                  <button type="button" disabled title="Contributor invitation required">Add for human review</button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
      <div className={styles.noRecommendation}><ShieldCheck size={22} aria-hidden="true" /><p><strong>“No recommendation yet” is a valid outcome.</strong> If the geography, source, recency or local review is insufficient, the system should stop rather than overstate a case for action.</p></div>
    </section>
  );
}

function VisualsView({ data }: { data: PlaceResponse }) {
  const [measureKey, setMeasureKey] = useState(data.metrics[0]?.key ?? "");
  const selected = data.metrics.find((metric) => metric.key === measureKey) ?? data.metrics[0];
  const chartMax = selected
    ? Math.max(selected.value, selected.national ?? 0, selected.state ?? 0, 1)
    : 1;
  const workforceCount = data.workforceContext.hpsa.length
    + data.workforceContext.medicallyUnderservedAreasAndPopulations.length;
  return (
    <section id="visuals-panel" role="tabpanel" aria-labelledby="visuals-tab" className={`${styles.viewPanel} ${styles.visualsView}`}>
      <header className={styles.visualsHeader}>
        <div><span>Evidence views</span><h2>See the measure. See its limits.</h2></div>
        <div><p>Visuals use compatible county evidence only. They do not create an overall health ranking or imply neighborhood-level precision.</p><a href={`/api/evidence/v1/funder-snapshot?geoid=${encodeURIComponent(data.location.geoid)}&format=pdf`}><DownloadSimple size={18} aria-hidden="true" /> Download funder snapshot</a></div>
      </header>
      <div className={styles.visualGrid}>
        <article className={styles.comparisonVisual}>
          <header><div><span>County comparison</span><h3>{selected?.label ?? "No comparable measure"}</h3></div>
            <label>Measure<select value={measureKey} onChange={(event) => setMeasureKey(event.target.value)}>{data.metrics.map((metric) => <option key={metric.key} value={metric.key}>{metric.label}</option>)}</select></label>
          </header>
          {selected ? (
            <>
              <div className={styles.comparisonBars} role="img" aria-label={`${selected.label}: ${data.location.label} ${selected.value} percent, state ${selected.state ?? "unavailable"} percent, national ${selected.national} percent.`}>
                {[
                  [data.location.label, selected.value],
                  ["State", selected.state],
                  ["National", selected.national],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <div><i style={{ width: `${typeof value === "number" ? (value / chartMax) * 100 : 0}%` }} /></div>
                    <strong>{typeof value === "number" ? `${value.toFixed(1)}%` : "Unavailable"}</strong>
                  </div>
                ))}
              </div>
              <dl className={styles.measureDefinition}>
                <div><dt>Meaning</dt><dd>{selected.plainLanguage}</dd></div>
                <div><dt>Universe</dt><dd>{selected.universe}</dd></div>
                <div><dt>Source</dt><dd><a href={selected.sourceUrl} target="_blank" rel="noreferrer">{selected.source}</a></dd></div>
                <div><dt>Release</dt><dd>{selected.release}</dd></div>
                <div><dt>Data period</dt><dd>{selected.dataPeriod}</dd></div>
                <div><dt>Adjustment</dt><dd>{selected.adjustment}</dd></div>
                <div><dt>Uncertainty</dt><dd>{selected.confidence}</dd></div>
                <div><dt>Direction</dt><dd>{selected.direction}</dd></div>
                <div><dt>Geography</dt><dd>County</dd></div>
              </dl>
            </>
          ) : <p>No compatible county measure is available.</p>}
        </article>
        <article className={styles.coverageVisual}>
          <span>Evidence coverage</span><h3>Available, missing and under review.</h3>
          <div>
            {data.sourceCoverage.map((source) => (
              <div key={source.sourceId}><strong>{source.sourceId.replaceAll("-", " ")}</strong><span data-status={source.status}>{source.status.replaceAll("_", " ")}</span><small>{source.observationCount} record{source.observationCount === 1 ? "" : "s"} · {source.releaseDate ?? "Release unavailable"}</small></div>
            ))}
          </div>
        </article>
        <article className={styles.freshnessVisual}>
          <span>Source freshness</span><h3>Different sources move on different schedules.</h3>
          <ol>{data.sources.map((source) => <li key={`${source.name}-${source.release}`}><time>{source.release}</time><div><strong>{source.name}</strong><span>{source.period} · {source.geography ?? "Source geography"}</span></div></li>)}</ol>
        </article>
        <article className={styles.workforceVisual}>
          <span>Workforce and shortage context</span><h3>{workforceCount ? `${workforceCount} designation records require scope-aware review.` : "No designation record is available in the approved snapshot."}</h3>
          <p>{data.workforceContext.limitation}</p>
          <div>{data.workforceContext.areaHealthResources.map((measure) => <p key={measure.variableId}><strong>{measure.label}</strong><span>{measure.value ?? "Unavailable"} {measure.unit} · {measure.year}</span></p>)}</div>
        </article>
        <article className={styles.signalMatrix}>
          <span>Planning priority versus statistical signal</span><h3>Keep the evidence types separate.</h3>
          <div><section><strong>Verified local priorities</strong>{data.localPlan.claims.length ? data.localPlan.claims.map((claim) => <p key={claim.id}>{claim.statement}</p>) : <p>Current local planning evidence: not yet verified.</p>}</section><section><strong>Statistical signals</strong>{data.priorities.slice(0, 5).map((metric) => <p key={metric.key}>{metric.label}: {metric.value.toFixed(1)}%</p>)}</section></div>
        </article>
        <article className={styles.hubMatrix}>
          <span>Response-fit review</span><h3>No fixed scores. No automatic recommendation.</h3>
          <div>{data.intelligence.placeBasedResponses.map((response) => <section key={response.name}><strong>{response.name}</strong><span>{response.status}</span><p>{response.reason}</p></section>)}</div>
        </article>
      </div>
      <details className={styles.visualMeasureExplorer}>
        <summary>All available measures <CaretRight size={18} aria-hidden="true" /></summary>
        <div className={styles.measureTable} role="table" aria-label="All compatible county measures">
          <div role="row"><span role="columnheader">Measure</span><span role="columnheader">Value</span><span role="columnheader">Direction</span><span role="columnheader">Release</span><span role="columnheader">Geography</span></div>
          {data.metrics.map((metric) => <div role="row" key={metric.key}><span role="cell"><strong>{metric.label}</strong><small>{metric.plainLanguage}</small><MetricDetails metric={metric} /></span><span role="cell">{metric.value.toFixed(1)}%</span><span role="cell">{metric.direction}</span><span role="cell">{metric.release}</span><span role="cell">County</span></div>)}
          {data.contextMeasures.map((measure) => <div role="row" key={measure.key}><span role="cell"><strong>{measure.label}</strong><small>{measure.definition}</small><ContextMeasureDetails measure={measure} /></span><span role="cell">{measure.value ?? "Unavailable"} {measure.unit}</span><span role="cell">{measure.direction}</span><span role="cell">{measure.release}</span><span role="cell">County</span></div>)}
        </div>
      </details>
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
  const [pendingResolution, setPendingResolution] = useState<CountyResolution | null>(null);
  const [pendingPlace, setPendingPlace] = useState<Suggestion | null>(null);

  const loadPlace = useCallback(async (
    place: Pick<Suggestion, "kind" | "geoid"> & Partial<Pick<Suggestion, "display" | "label">>,
    countyGeoid?: string,
  ) => {
    setLoading(true);
    setError("");
    setData(null);
    setGeometry(null);
    setPendingResolution(null);
    setPendingPlace(null);
    setActiveView("brief");
    const queryLabel = place.display ?? place.label ?? place.geoid;
    const params = new URLSearchParams({ kind: place.kind, geoid: place.geoid, query: queryLabel, view: "brief" });
    if (countyGeoid) params.set("county", countyGeoid);
    try {
      const dataResponse = await fetch(`/api/explore?${params.toString()}`);
      const payload = (await dataResponse.json().catch(() => ({}))) as PlaceResponse & { error?: string; resolution?: CountyResolution };
      if (dataResponse.status === 409 && payload.resolution?.status === "selection_required") {
        setPendingResolution(payload.resolution);
        setPendingPlace({
          id: `${place.kind}-${place.geoid}`,
          kind: place.kind,
          geoid: place.geoid,
          label: place.label ?? queryLabel,
          display: queryLabel,
          stateFips: "",
        });
        window.history.replaceState({}, "", `/explore?${params.toString()}`);
        return;
      }
      if (!dataResponse.ok) throw new Error(payload.error ?? "Current public data could not be loaded.");
      const geometryResponse = await fetch(
        `/api/explore/geometry?kind=county&geoid=${encodeURIComponent(payload.location.geoid)}&contextKind=${encodeURIComponent(place.kind)}&contextGeoid=${encodeURIComponent(place.geoid)}`,
      );
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
    const query = params.get("query") ?? geoid ?? "";
    const county = params.get("county") ?? undefined;
    if (view === "brief" || view === "map" || view === "action" || view === "visuals") setActiveView(view);
    if ((kind === "county" || kind === "place" || kind === "zip") && geoid) {
      void loadPlace({ kind, geoid, label: query, display: query }, county);
    }
  }, [loadPlace]);

  function changeView(view: WorkspaceView) {
    setActiveView(view);
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    window.history.replaceState({}, "", `/explore?${params.toString()}`);
  }

  function moveViewFocus(event: ReactKeyboardEvent<HTMLButtonElement>, view: WorkspaceView) {
    const views: WorkspaceView[] = ["brief", "map", "action", "visuals"];
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
        {!data && !loading && !pendingResolution && (
          <>
            <section className={styles.hero}>
              <div className={styles.heroCopy}><span>SozoRock Place Intelligence</span><h1>Start with a place.</h1><p>Explore public evidence about the conditions that shape access to care. See the geography, source, date, comparison, and limits before drawing a conclusion.</p></div>
              <LocationSearch onSelect={loadPlace} />
              <div className={styles.coverage}><span><strong>Nationwide</strong> geography</span><span><strong>Source-traceable</strong> evidence</span><span><strong>Strictly non-clinical</strong> place analysis</span></div>
            </section>
            <section className={styles.intro}>
              <div><span>One place. Four useful views.</span><h2>A brief to understand. A map with a reason. An action path with limits. Visuals that show their evidence.</h2></div>
              <div><article><FileText size={26} /><strong>Brief</strong><p>Local-plan status, public-data context, gaps and citations.</p></article><article><MapTrifold size={26} /><strong>Map</strong><p>Official geography and only compatible evidence layers.</p></article><article><ChatCircleDots size={26} /><strong>Action</strong><p>Ask grounded questions and review possible responses.</p></article><article><ChartBar size={26} /><strong>Visuals</strong><p>Comparisons, uncertainty, coverage and source freshness.</p></article></div>
            </section>
          </>
        )}

        {loading && <section className={styles.loading} aria-live="polite"><span /><p>Resolving the geography and checking current sources…</p></section>}
        {pendingResolution && pendingPlace && !loading && (
          <section className={styles.countyChoice} aria-labelledby="county-choice-title">
            <span>County evidence selection</span>
            <h1 id="county-choice-title">{pendingResolution.original.label} intersects more than one county.</h1>
            <p>Choose the county whose evidence you want to view. The original search remains visible, but the evidence and first map will describe the selected county.</p>
            <div>
              {pendingResolution.counties.map((county) => (
                <button
                  type="button"
                  key={county.countyGeoid}
                  onClick={() => void loadPlace(pendingPlace, county.countyGeoid)}
                >
                  <strong>{county.label}</strong>
                  <span>{county.overlapAreaPercent === null ? "Overlap unavailable" : `${county.overlapAreaPercent.toFixed(2)}% land-area overlap`}</span>
                  <small>{county.calculationMethod}{county.isPrimary ? " · Largest mapped overlap" : ""}</small>
                  <ArrowRight size={18} aria-hidden="true" />
                </button>
              ))}
            </div>
            {pendingResolution.caveats.map((caveat) => <p className={styles.resolutionCaveat} key={caveat}><Info size={17} aria-hidden="true" />{caveat}</p>)}
          </section>
        )}
        {error && <section className={styles.errorPanel} role="alert"><h1>We could not load this place.</h1><p>{error}</p><button type="button" onClick={() => window.location.assign("/explore")}>Start another search</button></section>}

        {data && (
          <div className={styles.workspace}>
            <section className={styles.placeBand}>
              <div className={styles.placeIdentity}>
                <span>Selected place</span>
                <h1>{data.location.label}</h1>
                <div><ShieldCheck size={19} aria-hidden="true" /><strong>{data.location.geographyLabel}</strong><span>{formatNumber(data.location.population)} people</span></div>
                {data.location.resolution.original.kind !== "county" && (
                  <p><MapPin size={18} aria-hidden="true" /> Search resolved from {data.location.resolution.original.label} to this county.</p>
                )}
                <p><Info size={18} aria-hidden="true" /> {data.location.caveats[0]}</p>
              </div>
              <LocationSearch compact onSelect={loadPlace} />
            </section>

            <div className={styles.workspaceToolbar}>
              <div className={styles.tabs} role="tablist" aria-label="Explore views">
                {(["brief", "map", "action", "visuals"] as const).map((view) => {
                  const label = view[0].toUpperCase() + view.slice(1);
                  const Icon = view === "brief" ? FileText : view === "map" ? MapTrifold : view === "action" ? ChatCircleDots : ChartBar;
                  return <button key={view} id={`${view}-tab`} role="tab" aria-selected={activeView === view} aria-controls={`${view}-panel`} tabIndex={activeView === view ? 0 : -1} onClick={() => changeView(view)} onKeyDown={(event) => moveViewFocus(event, view)}><Icon size={20} aria-hidden="true" />{label}</button>;
                })}
              </div>
              <div className={styles.workspaceActions}><button type="button" onClick={() => setDownloadOpen(true)}><DownloadSimple size={18} aria-hidden="true" /> Download brief</button><a href={partnershipHref}><UsersThree size={18} aria-hidden="true" /> Discuss this place</a></div>
            </div>

            {activeView === "brief" && <BriefView data={data} />}
            {activeView === "map" && <MapView data={data} geometry={geometry} />}
            {activeView === "action" && <ActionView data={data} />}
            {activeView === "visuals" && <VisualsView data={data} />}
          </div>
        )}
      </main>

      <footer className={styles.footer}><BrandLockup /><p>Public place evidence for community planning. No patient profile, diagnosis or medical advice.</p><a href="/privacy">Privacy</a><a href="/accessibility">Accessibility</a><a href="/contact">Contact</a></footer>
      {downloadOpen && data && <DownloadDialog data={data} onClose={() => setDownloadOpen(false)} />}
    </div>
  );
}
