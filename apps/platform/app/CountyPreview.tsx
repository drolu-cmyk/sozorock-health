"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProfileResponse, GeographyProfile } from "./lib/types";

export type CountyChoice = { geoid: string; name: string; state: string; stateFips: string };
export function CountyPreview({ counties, onCounty }: { counties: CountyChoice[]; onCounty?: (profile: GeographyProfile | null) => void }) {
  const [state, setState] = useState("36");
  const [county, setCounty] = useState("36001");
  const [response, setResponse] = useState<ProfileResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const states = useMemo(() => [...new Map(counties.map(item => [item.stateFips, item.state])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [counties]);
  const choices = counties.filter(item => item.stateFips === state);

  useEffect(() => {
    const abort = new AbortController();
    setResponse(null);
    onCounty?.(null);
    setStatus("loading");
    void fetch(`/api/profile?kind=county&geoid=${encodeURIComponent(county)}`, { signal: abort.signal }).then(async result => {
      if (!result.ok) throw new Error("Evidence unavailable");
      const next = await result.json() as ProfileResponse;
      if (next.profile?.kind !== "county" || next.profile.geoid !== county) throw new Error("County mismatch");
      if (abort.signal.aborted) return;
      setResponse(next); setStatus("ready"); onCounty?.(next.profile);
    }).catch(() => { if (!abort.signal.aborted) setStatus("error"); });
    return () => abort.abort();
  }, [county, onCounty]);

  const measures = response ? [
    { label: "Adults without health insurance", estimate: response.profile.barriers.uninsured, population: "Adults aged 18–64" },
    { label: "Transportation barriers", estimate: response.profile.barriers.transportation, population: "Adults aged 18 and older" },
    { label: "Diagnosed diabetes", estimate: response.profile.conditions.diabetes, population: "Adults aged 18 and older" },
  ] : [];
  return <div className="county-preview">
    <div className="county-picker">
      <label>State<select aria-label="State" value={state} onChange={event => { const next = event.target.value; setState(next); setCounty(counties.find(item => item.stateFips === next)!.geoid); }}>{states.map(([fips, name]) => <option key={fips} value={fips}>{name}</option>)}</select></label>
      <label>County<select aria-label="County" value={county} onChange={event => setCounty(event.target.value)}>{choices.map(item => <option key={item.geoid} value={item.geoid}>{item.name}</option>)}</select></label>
    </div>
    <div className="county-result" aria-live="polite" aria-busy={status === "loading"}>
      {status === "loading" && <p role="status">Loading county evidence…</p>}
      {status === "error" && <p role="alert">County evidence is temporarily unavailable. Select another county or try again later. The product and methods remain available below.</p>}
      {response && <>
        <header><span className="cb-kicker">Source estimate</span><h3>{response.profile.name}</h3><p>{response.profile.context}</p></header>
        <dl className="county-estimates">{measures.map(({ label, estimate, population }) => <div key={label}><dt>{label}<small>{population}</small></dt><dd>{estimate.value === null ? "Not available" : `${estimate.value.toFixed(1)}%`}<small>{estimate.ci ? `95% confidence interval ${estimate.ci[0]}–${estimate.ci[1]}%` : "Confidence interval not available"}</small></dd></div>)}</dl>
        <details className="county-source"><summary>Sources and what these numbers mean</summary><p><a href={response.source.url} target="_blank" rel="noreferrer">{response.source.label}</a> · released {response.source.released} · County {response.profile.geoid}.</p><p>{response.source.modeledEstimateNotice}</p><p>Measures may use different eligible populations. Differences alone do not establish statistical significance. A missing estimate is not zero.</p>{response.provenance.limitations.map(text => <p key={text}>{text}</p>)}</details>
        <p className="county-question"><strong>Planning question</strong>What local evidence would help explain these barriers, and who should review it before a response is chosen?</p>
      </>}
    </div>
  </div>;
}
