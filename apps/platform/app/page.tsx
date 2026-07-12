"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Buildings,
  ChartLineUp,
  FileArrowDown,
  House,
  MapTrifold,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  aggregateCountyRecords,
  aggregateCountyRecordsByFips,
  cbcapSeedMetadata,
  countyAccessSeed,
  countyRecordsToCsv,
  disclosureControl,
  filterCountyRecords,
  type CountyFipsSummary,
  type CountyFilters,
} from "@sozorock/domain";
import { MAX_SAVED_VIEW_LENGTH, restoreSavedView } from "./saved-view";

const initialFilters: Required<CountyFilters> = {
  state: "All states",
  county: "All counties",
  zip: "All ZIP codes",
  period: "All periods",
  hubType: "All hub types",
  language: "All languages",
  barrier: "All barriers",
  accessRange: "All access levels",
};
const unique = (items: string[]) => [...new Set(items)].sort();
const labels: Record<string, string> = {
  transportation: "Transportation",
  cost: "Affordability",
  information: "Information access",
  digital: "Digital access",
  language: "Language access",
};
const navigationItems = [
  { label: "Overview", target: "overview", Icon: House },
  { label: "Geography", target: "geography", Icon: MapTrifold },
  { label: "Barriers", target: "barriers", Icon: WarningCircle },
  { label: "Counties", target: "counties", Icon: Buildings },
  { label: "Trends", target: "trends", Icon: ChartLineUp },
  { label: "Reports", target: "reports", Icon: FileArrowDown },
] as const;
const usStates = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "District of Columbia",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];
const filterChoices = {
  state: new Set([initialFilters.state, ...usStates]),
  county: new Set([
    initialFilters.county,
    ...countyAccessSeed.map((record) => record.county),
  ]),
  zip: new Set([
    initialFilters.zip,
    ...countyAccessSeed.map((record) => record.zip),
  ]),
  period: new Set([
    initialFilters.period,
    ...countyAccessSeed.map((record) => record.period),
  ]),
  hubType: new Set([
    initialFilters.hubType,
    ...countyAccessSeed.map((record) => record.hubType),
  ]),
  language: new Set([
    initialFilters.language,
    ...countyAccessSeed.map((record) => record.language),
  ]),
  barrier: new Set([initialFilters.barrier, ...Object.keys(labels)]),
  accessRange: new Set([
    initialFilters.accessRange,
    "High (70-100)",
    "Developing (50-69)",
    "Limited (0-49)",
  ]),
} satisfies Parameters<typeof restoreSavedView>[2];
const AccessMap = dynamic(() => import("./AccessMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      <span />
      Loading county map…
    </div>
  ),
});

function downloadFile(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}
function SelectFilter({
  label,
  value,
  options,
  onChange,
  optionLabels,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const data = values.length ? values : [0],
    w = 560,
    h = 190,
    max = Math.max(...data, 1),
    min = Math.min(...data, 0),
    span = Math.max(max - min, 1);
  const points = data.map((value, index) => ({
    value,
    x: 22 + index * ((w - 44) / Math.max(data.length - 1, 1)),
    y: h - 28 - ((value - min) / span) * (h - 62),
  }));
  const line = points.map(({ x, y }) => `${x},${y}`).join(" ");
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${label}: ${data.join(", ")}`}
    >
      {[0, 1, 2].map((i) => (
        <line
          key={i}
          x1="22"
          x2={w - 22}
          y1={32 + i * 54}
          y2={32 + i * 54}
          className="gridline"
        />
      ))}
      <polyline points={line} className="trend-area" />
      <polyline points={line} className="trend-line" />
      {points.map(({ value, x, y }, i) => (
        <g key={`${value}-${i}`}>
          <circle cx={x} cy={y} r="5" />
          <text x={x} y={y - 13} textAnchor="middle">
            {value}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Benchmark({
  county,
  state,
  stateLabel,
  national,
}: {
  county: number;
  state?: number;
  stateLabel?: string;
  national: number;
}) {
  const rows = [
    { label: "Selected view", value: county, tone: "selected" },
    ...(state === undefined
      ? []
      : [{ label: stateLabel ?? "State benchmark", value: state, tone: "state" }]),
    { label: "National benchmark", value: national, tone: "national" },
  ];
  return (
    <div
      className="benchmark"
      role="img"
      aria-label={`Systems readiness comparison. ${rows.map((row) => `${row.label} ${row.value}`).join(", ")}.`}
    >
      {rows.map((row) => (
        <div className="benchmark-row" key={row.label}>
          <span>{row.label}</span>
          <div>
            <i className={row.tone} style={{ width: `${row.value}%` }} />
          </div>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function LoadingState() {
  return (
    <section className="state-panel" role="status" aria-live="polite">
      <div className="skeleton wide" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span>Refreshing county information…</span>
    </section>
  );
}
function ErrorState({ retry }: { retry: () => void }) {
  return (
    <section className="state-panel" role="alert">
      <strong>County information is temporarily unavailable.</strong>
      <p>Your filters are still here. Try the refresh again.</p>
      <button onClick={retry}>Try again</button>
    </section>
  );
}

export default function Platform() {
  const [filters, setFilters] = useState(initialFilters),
    [toast, setToast] = useState(""),
    [selectedFips, setSelectedFips] = useState<string | null>(null),
    [dataState, setDataState] = useState<"ready" | "loading" | "error">(
      "ready",
    ),
    [filtersOpen, setFiltersOpen] = useState(false),
    [activeSection, setActiveSection] = useState("overview");
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const queryIsBounded =
      window.location.search.length <= MAX_SAVED_VIEW_LENGTH + 16;
    const params = queryIsBounded
      ? new URLSearchParams(window.location.search)
      : null;
    const saved = params?.get("view") || localStorage.getItem("cbcap-view");
    if (saved) {
      const restored = restoreSavedView(saved, initialFilters, filterChoices);
      if (restored) {
        setFilters(restored);
      } else {
        setToast("This saved view could not be restored.");
      }
    } else if (!queryIsBounded) {
      setToast("This saved view could not be restored.");
    }
  }, []);
  useEffect(() => {
    if (!selectedFips) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const background = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".rail, .workspace > :not(.county-drawer)",
      ),
    );
    background.forEach((element) => {
      element.inert = true;
    });
    drawerCloseRef.current?.focus();
    const manageDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelectedFips(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", manageDialogKeyboard);
    return () => {
      window.removeEventListener("keydown", manageDialogKeyboard);
      background.forEach((element) => {
        element.inert = false;
      });
      previouslyFocused?.focus();
    };
  }, [selectedFips]);
  useEffect(() => {
    const targets = ["overview", "geography", "barriers", "counties", "trends", "reports"]
      .map((id) => document.getElementById(id))
      .filter((target): target is HTMLElement => Boolean(target));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: [0, 0.1, 0.5] },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);
  const stateRecords = useMemo(
    () =>
      countyAccessSeed.filter(
        (r) => filters.state === "All states" || r.state === filters.state,
      ),
    [filters.state],
  );
  const countyRecords = useMemo(
    () =>
      stateRecords.filter(
        (r) => filters.county === "All counties" || r.county === filters.county,
      ),
    [stateRecords, filters.county],
  );
  const filtered = useMemo(
    () => filterCountyRecords(countyAccessSeed, filters),
    [filters],
  );
  const summary = useMemo(() => aggregateCountyRecords(filtered), [filtered]);
  const countySummaries = useMemo(
    () => aggregateCountyRecordsByFips(filtered),
    [filtered],
  );
  const nationwide = useMemo(
    () => aggregateCountyRecords(countyAccessSeed),
    [],
  );
  const stateSummary = useMemo(
    () =>
      aggregateCountyRecords(
        filters.state === "All states"
          ? countyAccessSeed
          : countyAccessSeed.filter((r) => r.state === filters.state),
      ),
    [filters.state],
  );
  const selectedCounty = countySummaries.find(
    (county) => county.fips === selectedFips,
  );
  const topBarriers = useMemo(
    () =>
      Object.keys(labels)
        .map((key) => ({
          key,
          label: labels[key],
          value: summary.sampleSize
            ? Math.round(
                summary.visible.reduce(
                  (sum, r) =>
                    sum +
                    r.barriers[key as keyof typeof r.barriers] * r.sampleSize,
                  0,
                ) / summary.sampleSize,
              )
            : 0,
        }))
        .sort((a, b) => b.value - a.value),
    [summary.sampleSize, summary.visible],
  );
  const trend = useMemo(
    () =>
      unique(summary.visible.map((r) => r.period)).map((period) => ({
        period,
        ...aggregateCountyRecords(
          summary.visible.filter((r) => r.period === period),
        ),
      })),
    [summary.visible],
  );
  const activeFilters = Object.entries(filters).filter(
    ([, value]) => !value.startsWith("All "),
  );
  const updateFilter = (key: keyof CountyFilters, value: string) => {
    setToast("");
    setSelectedFips(null);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "state"
        ? { county: "All counties", zip: "All ZIP codes" }
        : {}),
      ...(key === "county" ? { zip: "All ZIP codes" } : {}),
    }));
  };
  const saveView = () => {
    const value = JSON.stringify(filters);
    localStorage.setItem("cbcap-view", value);
    const url = new URL(window.location.href);
    url.searchParams.set("view", value);
    history.replaceState(null, "", url);
    setToast("View saved on this device. You can also copy this page link.");
  };
  const exportCsv = () => {
    if (!summary.visible.length)
      return setToast("There are no rows available to export in this view.");
    downloadFile(
      `# ${cbcapSeedMetadata.source}\n# ${cbcapSeedMetadata.note}\n${countyRecordsToCsv(filtered)}`,
      "cbcap-county-view.csv",
      "text/csv;charset=utf-8",
    );
    setToast(
      `CSV downloaded with ${summary.visible.length} row${summary.visible.length === 1 ? "" : "s"}.`,
    );
  };
  const downloadBrief = (record?: CountyFipsSummary) => {
    const target = record
      ? `${record.county}, ${record.state}`
      : filters.county !== "All counties"
        ? filters.county
        : filters.state !== "All states"
          ? filters.state
          : "Nationwide view";
    const index = record?.accessIndex ?? summary.accessIndex;
    const requests = record?.connectionRequests ?? summary.totalRequests;
    const completed = record?.completedPathways ?? summary.completedPathways;
    const minutes = record?.medianMinutes ?? summary.medianMinutes;
    const safeTarget = escapeHtml(target);
    const brief = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CB-CAP systems brief - ${safeTarget}</title><style>body{font:16px/1.55 Arial,sans-serif;color:#13251f;max-width:780px;margin:48px auto;padding:0 28px}header{border-bottom:4px solid #17372d;padding-bottom:24px}h1{font:42px Georgia,serif;margin:.2em 0}.meta{color:#5d6b65}.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#ccd2cc;border:1px solid #ccd2cc;margin:32px 0}.metrics div{background:#fff;padding:20px}.metrics strong{display:block;font:36px Georgia,serif}.notice{background:#f1eee4;padding:18px;border-left:4px solid #a9863f}li{margin:.55em 0}footer{margin-top:36px;border-top:1px solid #ccd2cc;padding-top:16px;font-size:13px;color:#5d6b65}@media print{body{margin:0}}@media(max-width:600px){.metrics{grid-template-columns:1fr}}</style></head><body><header><strong>SozoRock Health® · County-Based Community Access Platform (CB-CAP)</strong><h1>${safeTarget}</h1><p>County systems brief</p><p class="meta">Prepared ${new Date().toLocaleDateString()}</p></header><section class="metrics" aria-label="Summary measures"><div><span>Systems readiness</span><strong>${index}/100</strong></div><div><span>Pathway requests</span><strong>${requests.toLocaleString()}</strong></div><div><span>Completed pathways</span><strong>${completed.toLocaleString()}</strong></div><div><span>Typical connection time</span><strong>${minutes || "-"}${minutes ? " min" : ""}</strong></div></section><h2>Planning considerations</h2><ul><li>Review the pattern alongside local Community Health Assessment and Community Health Improvement Plan priorities.</li><li>Assess Health Equity Hub and Health Access Day readiness.</li><li>Coordinate provider participation, workforce capacity, language access, digital readiness, and governance.</li></ul><p class="notice"><strong>Decision boundary:</strong> This demonstration uses synthetic, de-identified information. It does not describe current county performance and provides no clinical guidance.</p><footer>Source: ${escapeHtml(cbcapSeedMetadata.source)}. Groups with fewer than ${disclosureControl.minimumCellSize} observations are not shown. No personal or clinical information is included.</footer></body></html>`;
    const filename = `cbcap-${target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "nationwide"}-systems-brief.html`;
    downloadFile(brief, filename, "text/html;charset=utf-8");
    setToast("Systems brief downloaded as a print-ready HTML file.");
  };
  const title =
    filters.county !== "All counties"
      ? filters.county
      : filters.state !== "All states"
        ? filters.state
        : "Nationwide overview";
  const leader = topBarriers[0];
  const completionDelta = summary.completionRate - nationwide.completionRate;
  const comparisonSummary =
    filters.state === "All states" ? nationwide : stateSummary;
  const comparisonLabel =
    filters.state === "All states" ? "nationwide benchmark" : "state benchmark";

  return (
    <main className="app-shell">
      <aside className="rail">
        <a
          className="wordmark"
          href="#overview"
          aria-label="SozoRock Health CB-CAP home"
        >
          <span>
            SozoRock<sup>®</sup>
          </span>
          <small>HEALTH</small>
        </a>
        <div className="product-mark">
          <strong>CB-CAP</strong>
          <span>
            County-Based Community
            <br />
            Access Platform
          </span>
        </div>
        <nav aria-label="Dashboard sections">
          {navigationItems.map(({ label, target, Icon }) => (
            <a
              key={target}
              href={`#${target}`}
              className={activeSection === target ? "active" : ""}
              aria-current={activeSection === target ? "location" : undefined}
            >
              <Icon size={17} weight="duotone" aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
        <div className="rail-note">
          <i />
          Demonstration view<small>Sample, non-clinical information</small>
        </div>
      </aside>
      <section className="workspace" id="overview">
        <header className="topbar">
          <div>
            <p className="section-label">
              Privacy-preserving county systems intelligence
            </p>
            <h1>{title}</h1>
            <p>
              See pathway gaps, compare system readiness, and coordinate Health
              Equity Hubs, Health Access Days, workforce capacity, digital
              assurance, and public-sector action.
            </p>
          </div>
          <div className="actions" id="reports">
            <button
              className="quiet"
              onClick={() => setFiltersOpen(!filtersOpen)}
              aria-expanded={filtersOpen}
            >
              Filters <b>{activeFilters.length || ""}</b>
            </button>
            <button className="quiet" onClick={exportCsv}>
              Export data
            </button>
            <button className="primary" onClick={() => downloadBrief()}>
              Download brief
            </button>
          </div>
        </header>
        <div className="notice">
          <div>
            <strong>Demonstration</strong>
            <span>
              This preview shows the decision experience using sample
              information. It does not describe current county performance.
            </span>
          </div>
          <time>Updated {cbcapSeedMetadata.refreshedAt}</time>
        </div>
        <details className="quick-guide">
          <summary>New to this dashboard? Start here</summary>
          <div className="guide-steps">
            <p><strong>Choose a place or planning lens.</strong> Open Filters to narrow the view.</p>
            <p><strong>Compare the signals.</strong> Review geography, barriers, benchmarks, and trends together.</p>
            <p><strong>Carry the view forward.</strong> Save the filters, export data, or download a brief.</p>
          </div>
        </details>
        <section
          className={`filter-panel ${filtersOpen ? "open" : ""}`}
          aria-label="Dashboard filters"
        >
          <SelectFilter
            label="State"
            value={filters.state}
            options={[
              "All states",
              ...usStates,
            ]}
            onChange={(v) => updateFilter("state", v)}
          />
          <SelectFilter
            label="County"
            value={filters.county}
            options={[
              "All counties",
              ...unique(stateRecords.map((r) => r.county)),
            ]}
            onChange={(v) => updateFilter("county", v)}
          />
          <SelectFilter
            label="ZIP code"
            value={filters.zip}
            options={[
              "All ZIP codes",
              ...unique(countyRecords.map((r) => r.zip)),
            ]}
            onChange={(v) => updateFilter("zip", v)}
          />
          <SelectFilter
            label="Period"
            value={filters.period}
            options={[
              "All periods",
              ...unique(countyAccessSeed.map((r) => r.period)),
            ]}
            onChange={(v) => updateFilter("period", v)}
          />
          <SelectFilter
            label="Hub"
            value={filters.hubType}
            options={[
              "All hub types",
              ...unique(countyAccessSeed.map((r) => r.hubType)),
            ]}
            onChange={(v) => updateFilter("hubType", v)}
          />
          <SelectFilter
            label="Language"
            value={filters.language}
            options={[
              "All languages",
              ...unique(countyAccessSeed.map((r) => r.language)),
            ]}
            onChange={(v) => updateFilter("language", v)}
          />
          <SelectFilter
            label="Leading barrier"
            value={filters.barrier ?? "All barriers"}
            options={["All barriers", ...Object.keys(labels)]}
            optionLabels={labels}
            onChange={(v) => updateFilter("barrier", v)}
          />
          <SelectFilter
            label="Access level"
            value={filters.accessRange ?? "All access levels"}
            options={[
              "All access levels",
              "High (70-100)",
              "Developing (50-69)",
              "Limited (0-49)",
            ]}
            onChange={(v) => updateFilter("accessRange", v)}
          />
          <div className="filter-actions">
            <button
              onClick={() => {
                setFilters(initialFilters);
                setToast("Filters cleared.");
              }}
            >
              Clear all
            </button>
            <button onClick={saveView}>Save this view</button>
          </div>
        </section>
        {activeFilters.length > 0 && (
          <div className="filter-chips" aria-label="Active filters">
            {activeFilters.map(([key, value]) => (
              <button
                key={key}
                onClick={() =>
                  updateFilter(
                    key as keyof CountyFilters,
                    initialFilters[key as keyof CountyFilters] ?? "",
                  )
                }
                aria-label={`Remove ${value} filter`}
              >
                {value}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              className="clear-chip"
              onClick={() => setFilters(initialFilters)}
            >
              Clear all
            </button>
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
            <button aria-label="Dismiss message" onClick={() => setToast("")}>
              ×
            </button>
          </div>
        )}
        {dataState === "loading" && <LoadingState />}
        {dataState === "error" && (
          <ErrorState retry={() => setDataState("ready")} />
        )}{" "}
        {dataState === "ready" && (
          <>
            <section
              className="metric-grid"
              aria-label="Filtered pathway and systems summary"
            >
              <article>
                <span>People represented</span>
                <strong>{summary.sampleSize.toLocaleString()}</strong>
                <small>
                  {summary.visible.length} community view
                  {summary.visible.length === 1 ? "" : "s"}
                </small>
              </article>
              <article>
                <span>Pathway requests</span>
                <strong>{summary.totalRequests.toLocaleString()}</strong>
                <small>For this selection</small>
              </article>
              <article>
                <span>Pathways completed</span>
                <strong>{summary.completionRate}%</strong>
                <small
                  className={completionDelta >= 0 ? "positive" : "negative"}
                >
                  {completionDelta >= 0 ? "+" : ""}
                  {completionDelta} pts vs nationwide
                </small>
              </article>
              <article>
                <span>Typical connection time</span>
                <strong>
                  {summary.medianMinutes || "—"}
                  <sup>{summary.medianMinutes ? " min" : ""}</sup>
                </strong>
                <small>Across this selection</small>
              </article>
              <article className="accent-metric">
                <span>Systems readiness</span>
                <strong>
                  {summary.accessIndex || "—"}
                  <sup>{summary.accessIndex ? "/100" : ""}</sup>
                </strong>
                <small>
                  {summary.accessIndex === nationwide.accessIndex
                    ? "At"
                    : summary.accessIndex > nationwide.accessIndex
                      ? "Above"
                      : "Below"}{" "}
                  nationwide benchmark
                </small>
              </article>
            </section>
            <section className="insight-strip" aria-label="Key takeaways">
              <article>
                <i className="signal" />
                <div>
                  <span>Leading barrier</span>
                  <strong>{leader?.label ?? "No data"}</strong>
                  <p>
                    {leader
                      ? `${leader.value}/100 across the selected view.`
                      : "Broaden the filters to see a pattern."}
                  </p>
                </div>
              </article>
              <article>
                <i className="signal compare" />
                <div>
                  <span>Benchmark signal</span>
                  <strong>
                    {summary.accessIndex === comparisonSummary.accessIndex
                      ? "At"
                      : summary.accessIndex > comparisonSummary.accessIndex
                        ? "Ahead of"
                        : "Below"}{" "}
                    {comparisonLabel}
                  </strong>
                  <p>
                    {Math.abs(summary.accessIndex - comparisonSummary.accessIndex)}{" "}
                    points separate this view from its {comparisonLabel}.
                  </p>
                </div>
              </article>
              <article>
                <i className="signal action" />
                <div>
                  <span>Planning opportunity</span>
                  <strong>
                    {leader?.key === "transportation"
                      ? "Plan local Health Equity Hubs"
                      : leader?.key === "language"
                        ? "Expand language-ready capacity"
                        : "Align partners and workforce"}
                  </strong>
                  <p>
                    Bring this systems view into Community Health Assessment and
                    Community Health Improvement Plan priorities, Health Access
                    Day planning, and AI-readiness decisions.
                  </p>
                </div>
              </article>
            </section>
            <section className="planning-lenses" aria-labelledby="planning-lenses-heading">
              <div>
                <span>County planning framework</span>
                <h2 id="planning-lenses-heading">One view. Six connected decisions.</h2>
              </div>
              <ul>
                <li>Health Equity Hub readiness</li>
                <li>Health Access Day planning</li>
                <li>CHA and CHIP support</li>
                <li>Digital and AI readiness</li>
                <li>Workforce capacity</li>
                <li>Governance and digital assurance</li>
              </ul>
              <p>Community Health Assessment and Community Health Improvement Plan support. These are planning lenses, not clinical measures; demonstration values are sample and de-identified.</p>
            </section>
            <section className="dashboard-grid">
              <article className="panel map-panel" id="geography">
                <div className="panel-head">
                  <div>
                    <span>Geography</span>
                    <h2>County pathway and readiness pattern</h2>
                    <p>Select a highlighted county for its systems brief.</p>
                  </div>
                  <div className="map-key" aria-label="Map legend">
                    <span>
                      <i className="limited" />
                      Limited
                    </span>
                    <span>
                      <i className="developing" />
                      Developing
                    </span>
                    <span>
                      <i className="strong" />
                      Strong
                    </span>
                  </div>
                </div>
                <AccessMap
                  records={countySummaries}
                  selectedFips={selectedFips}
                  onSelect={setSelectedFips}
                />
              </article>
              <article className="panel benchmark-panel">
                <div className="panel-head">
                  <div>
                    <span>Comparison</span>
                    <h2>How this view compares</h2>
                    <p>Systems readiness index, scaled from 0 to 100.</p>
                  </div>
                </div>
                <Benchmark
                  county={summary.accessIndex}
                  state={filters.state === "All states" ? undefined : stateSummary.accessIndex}
                  stateLabel={filters.state === "All states" ? undefined : `${filters.state} benchmark`}
                  national={nationwide.accessIndex}
                />
                <div className="benchmark-note">
                  <strong>
                    {Math.abs(summary.accessIndex - nationwide.accessIndex)} pts
                  </strong>
                  <span>
                    {summary.accessIndex === nationwide.accessIndex
                      ? "at"
                      : summary.accessIndex > nationwide.accessIndex
                        ? "above"
                        : "below"}{" "}
                    the nationwide sample
                  </span>
                </div>
              </article>
              <article className="panel trend-panel" id="trends">
                <div className="panel-head">
                  <div>
                    <span>Trend</span>
                    <h2>Requests over time</h2>
                    <p>Connection requests within the selected view.</p>
                  </div>
                </div>
                <Sparkline
                  values={trend.map((item) => item.totalRequests)}
                  label="Connection requests by period"
                />
                <div className="period-labels">
                  {trend.map((item) => (
                    <span key={item.period}>{item.period}</span>
                  ))}
                </div>
              </article>
              <article className="panel barriers-panel" id="barriers">
                <div className="panel-head">
                  <div>
                    <span>Barriers</span>
                    <h2>What residents encounter</h2>
                    <p>Higher values indicate a more persistent barrier.</p>
                  </div>
                </div>
                <div className="bar-list">
                  {topBarriers.map((barrier, index) => (
                    <button
                      className="bar-row"
                      key={barrier.key}
                      onClick={() => updateFilter("barrier", barrier.key)}
                      aria-label={`Filter to ${barrier.label}, index ${barrier.value}`}
                    >
                      <span>{barrier.label}</span>
                      <div>
                        <i style={{ width: `${barrier.value}%` }} />
                      </div>
                      <strong>{barrier.value}</strong>
                      <small>{index === 0 ? "Leading" : ""}</small>
                    </button>
                  ))}
                </div>
              </article>
              <article className="panel table-panel" id="counties">
                <div className="panel-head">
                  <div>
                    <span>County detail</span>
                    <h2>Community access views</h2>
                    <p>
                      {countySummaries.length} counties shown · {summary.suppressedCount}{" "}
                      not shown because the group is too small
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>County</th>
                        <th>Hub</th>
                        <th>Language</th>
                        <th>Requests</th>
                        <th>Completed</th>
                        <th>Time</th>
                        <th>Index</th>
                        <th>
                          <span className="sr-only">Open</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {countySummaries.map((r) => (
                        <tr key={r.fips}>
                          <td>
                            <strong>{r.county}</strong>
                            <small>
                              {r.stateCode} · {r.zips.join(", ")}
                            </small>
                          </td>
                          <td>{r.hubTypes.join(", ")}</td>
                          <td>{r.languages.join(", ")}</td>
                          <td>{r.connectionRequests}</td>
                          <td>{r.completedPathways}</td>
                          <td>{r.medianMinutes} min</td>
                          <td>
                            <span
                              className={`score score-${r.accessIndex >= 70 ? "high" : r.accessIndex >= 50 ? "mid" : "low"}`}
                            >
                              {r.accessIndex}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => setSelectedFips(r.fips)}
                              aria-label={`Open ${r.county} brief`}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!countySummaries.length && (
                        <tr>
                          <td colSpan={8} className="empty">
                            No community views match these filters. Clear one or
                            more filters to continue.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        )}
        {selectedCounty && (
          <aside
            ref={drawerRef}
            className="county-drawer"
            data-testid="county-decision-drawer"
            aria-label={`${selectedCounty.county} decision brief`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="county-drawer-title"
          >
            <button
              className="drawer-close"
              ref={drawerCloseRef}
              onClick={() => setSelectedFips(null)}
              aria-label="Close county brief"
            >
              ×
            </button>
            <p className="section-label">County systems brief</p>
            <h2 id="county-drawer-title">
              {selectedCounty.county}
              <small>{selectedCounty.state}</small>
            </h2>
            <div className="drawer-score">
              <strong>{selectedCounty.accessIndex}</strong>
              <span>
                Systems readiness
                <br />
                Nationwide benchmark {nationwide.accessIndex}
              </span>
            </div>
            <section>
              <h3>What stands out</h3>
              <p>
                {
                  labels[
                    Object.entries(selectedCounty.barriers).sort(
                      (a, b) => b[1] - a[1],
                    )[0][0]
                  ]
                }{" "}
                is the most persistent barrier in this community view. The
                completion rate is{" "}
                {Math.round(selectedCounty.completionRate)}
                %.
              </p>
            </section>
            <section>
              <h3>Systems planning considerations</h3>
              <ul>
                <li>
                  Test this pattern against current CHA/CHIP priorities and
                  local evidence.
                </li>
                <li>
                  Assess where a Health Equity Hub or Health Access Day could
                  close the visible gap.
                </li>
                <li>
                  Align licensed-provider participation, language readiness, and
                  workforce development.
                </li>
                <li>
                  Document data and governance readiness before enabling
                  AI-supported insights.
                </li>
              </ul>
            </section>
            <button
              className="primary"
              onClick={() => downloadBrief(selectedCounty)}
            >
              Download systems brief
            </button>
            <small>Sample information · No clinical guidance</small>
          </aside>
        )}
        <footer className="privacy">
          <span aria-hidden="true">i</span>
          <div>
            <strong>Small groups are not shown</strong>
            <p>
              Results representing fewer than{" "}
              {disclosureControl.minimumCellSize} observations are withheld.
              This demonstration contains no personal or clinical information.
            </p>
          </div>
          <button
            onClick={() =>
              setToast(
                "Methodology: sample county-level records, minimum group thresholds, weighted summary measures, and no individual-level information.",
              )
            }
          >
            How this view works
          </button>
        </footer>
      </section>
    </main>
  );
}
