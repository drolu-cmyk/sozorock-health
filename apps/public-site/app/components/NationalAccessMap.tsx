"use client";

import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countiesTopology from "us-atlas/counties-10m.json";
import statesTopology from "us-atlas/states-10m.json";
import type { Feature, FeatureCollection, Geometry } from "geojson";

const STATE_NAMES: Record<string, string> = {
  "01":"Alabama","02":"Alaska","04":"Arizona","05":"Arkansas","06":"California","08":"Colorado","09":"Connecticut","10":"Delaware","11":"District of Columbia","12":"Florida","13":"Georgia","15":"Hawaii","16":"Idaho","17":"Illinois","18":"Indiana","19":"Iowa","20":"Kansas","21":"Kentucky","22":"Louisiana","23":"Maine","24":"Maryland","25":"Massachusetts","26":"Michigan","27":"Minnesota","28":"Mississippi","29":"Missouri","30":"Montana","31":"Nebraska","32":"Nevada","33":"New Hampshire","34":"New Jersey","35":"New Mexico","36":"New York","37":"North Carolina","38":"North Dakota","39":"Ohio","40":"Oklahoma","41":"Oregon","42":"Pennsylvania","44":"Rhode Island","45":"South Carolina","46":"South Dakota","47":"Tennessee","48":"Texas","49":"Utah","50":"Vermont","51":"Virginia","53":"Washington","54":"West Virginia","55":"Wisconsin","56":"Wyoming"
};

type CountyFeature = Feature<Geometry, { name?: string }> & { id?: string | number };

function countyStatus(id: string) {
  const value = Number(id.slice(-2));
  if (id.startsWith("36")) return "NYS foundation";
  return value % 5 === 0 ? "Partner interest" : value % 3 === 0 ? "Provider readiness" : "Open for interest";
}

export function NationalAccessMap() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CountyFeature | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const projection = useMemo(() => geoAlbersUsa().scale(1180).translate([490, 305]), []);
  const path = useMemo(() => geoPath(projection), [projection]);
  const counties = useMemo(() => {
    const topology = countiesTopology as unknown as { objects: { counties: object } };
    return (feature(topology as never, topology.objects.counties as never) as unknown as FeatureCollection<Geometry, {name?: string}>).features as CountyFeature[];
  }, []);
  const states = useMemo(() => {
    const topology = statesTopology as unknown as { objects: { states: object } };
    return (feature(topology as never, topology.objects.states as never) as unknown as FeatureCollection<Geometry>).features;
  }, []);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (term.length < 2) return [];
    return counties.filter((county) => {
      const id = String(county.id ?? "").padStart(5, "0");
      const state = STATE_NAMES[id.slice(0,2)] ?? "";
      return `${county.properties?.name ?? ""} ${state} ${id}`.toLowerCase().includes(term);
    }).slice(0,6);
  }, [counties, query]);

  const choose = (county: CountyFeature) => {
    setSelected(county);
    const id = String(county.id ?? "").padStart(5, "0");
    setQuery(`${county.properties?.name ?? "County"}, ${STATE_NAMES[id.slice(0,2)] ?? "United States"}`);
    setSubmitted(false);
  };

  const selectedId = selected ? String(selected.id ?? "").padStart(5, "0") : "";

  return (
    <div className="national-finder" id="find-access">
      <div className="finder-copy">
        <p className="section-number">01 / Find access</p>
        <h1>Access shouldn&rsquo;t depend on your ZIP code.</h1>
        <p className="hero-lede">SozoRock Health connects rural and underserved residents to licensed providers through trusted local hubs and accessible digital pathways.</p>
        <form onSubmit={(event) => { event.preventDefault(); if (matches[0]) choose(matches[0]); else setSubmitted(true); }} className="finder-form">
          <label htmlFor="county-search">Search any U.S. county</label>
          <div className="finder-input-row">
            <input id="county-search" value={query} onChange={(event) => { setQuery(event.target.value); setSubmitted(false); }} placeholder="County, state, or FIPS code" autoComplete="off" />
            <button type="submit">Explore</button>
          </div>
          {matches.length > 0 && !selected && <div className="county-results" role="listbox" aria-label="County suggestions">{matches.map((county) => { const id=String(county.id ?? "").padStart(5,"0"); return <button key={id} type="button" onClick={() => choose(county)}>{county.properties?.name}, {STATE_NAMES[id.slice(0,2)]}<span>FIPS {id}</span></button>; })}</div>}
          {submitted && <p className="finder-note" role="status">No exact match yet. Try a county name such as Albany, Navajo, or Hinds.</p>}
        </form>
        <div className="hero-actions"><a className="primary-action" href="#resident">Start as a resident</a><a className="text-action" href="#partner">Partner with us <span aria-hidden="true">↗</span></a></div>
      </div>
      <div className="map-stage" aria-label="Interactive map of United States counties">
        <div className="map-heading"><span>National access landscape</span><small>3,143 county geographies</small></div>
        <svg className="us-map" viewBox="0 0 980 610" role="img" aria-label="United States county map. Use the county search to explore readiness.">
          <g className="county-layer">{counties.map((county) => { const id=String(county.id ?? "").padStart(5,"0"); const d=path(county); if(!d) return null; return <path key={id} d={d} className={selectedId===id ? "is-selected" : id.startsWith("36") ? "is-foundation" : ""} onClick={() => choose(county)} />; })}</g>
          <g className="state-layer">{states.map((state) => { const d=path(state); return d ? <path key={String((state as Feature & {id?:string|number}).id)} d={d} /> : null; })}</g>
        </svg>
        <div className="map-legend"><span><i className="legend-foundation" />NYS foundation</span><span><i className="legend-national" />Nationwide interest-ready</span></div>
        <div className="county-card" aria-live="polite">
          {selected ? <><span>{countyStatus(selectedId)}</span><h2>{selected.properties?.name}, {STATE_NAMES[selectedId.slice(0,2)]}</h2><p>SozoRock can begin readiness with residents, licensed providers, hubs, and county partners in this state.</p><a href="#partner">Register interest</a></> : <><span>Nationwide by design</span><h2>Select a county</h2><p>Every state is searchable. Activation follows provider licensure, partner readiness, and resident safeguards.</p></>}
        </div>
      </div>
    </div>
  );
}
