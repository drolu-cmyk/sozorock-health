"use client";
import { useEffect, useState } from "react";
import { publicCountyMeasures, type PublicCountyGroup } from "../lib/public-county-measures";
import type { PublicCountyEvidence, PublicEstimate } from "../lib/public-county-evidence";

type Choice = {fips:string;name:string;state:string;stateFips:string};
function useCounty(id:string, initial:PublicCountyEvidence|null=null) {
  const [result,setResult]=useState<{id:string;county:PublicCountyEvidence|null;error:string}>({id:initial?.fips??"",county:initial,error:""});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!id) return;
    const controller=new AbortController();
    fetch(`/api/public-counties?geoid=${encodeURIComponent(id)}`,{signal:controller.signal})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??"County evidence is temporarily unavailable.");if(data.county?.fips!==id)throw new Error("County evidence did not match the requested county.");return data;})
      .then(data=>{if(!controller.signal.aborted)setResult({id,county:data.county,error:""});})
      .catch(error=>{if(!controller.signal.aborted)setResult({id,county:null,error:error.message});});
    return ()=>controller.abort();
  },[id,retry]);
  return {county:result.id===id?result.county:null,error:result.id===id?result.error:"",retry:()=>setRetry(r=>r+1)};
}
function CountySelect({label,choices,value,onChange,optional=false}:{label:string;choices:Choice[];value:string;onChange:(id:string)=>void;optional?:boolean}) {
  const [state,setState]=useState(choices.find(c=>c.fips===value)?.stateFips??"36");
  const activeState=choices.find(c=>c.fips===value)?.stateFips??state;
  const states=[...new Map(choices.map(c=>[c.stateFips,c.state])).entries()];
  const id=label.toLowerCase().replaceAll(" ","-");
  return <fieldset className="public-county-choice"><legend>{label}</legend>
    <label htmlFor={`${id}-state`}>State</label><select id={`${id}-state`} value={activeState} onChange={e=>{setState(e.target.value);onChange("");}}>{states.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>
    <label htmlFor={`${id}-county`}>County or county equivalent</label><select id={`${id}-county`} value={value} onChange={e=>onChange(e.target.value)}><option value="">{optional?"No comparison":"Choose a county"}</option>{choices.filter(c=>c.stateFips===activeState).map(c=><option key={c.fips} value={c.fips}>{c.name}</option>)}</select>
  </fieldset>;
}
function Estimate({estimate,label}:{estimate:PublicEstimate|undefined;label:string}) {
  const value=estimate?.value;
  return <div className="public-county-estimate"><strong>{value==null?"Not available":`${value.toFixed(1)}%`}</strong>
    {value!=null&&<div className="public-county-track" role="img" aria-label={`${label}: ${value.toFixed(1)} percent, on a zero to 100 percent scale`}><span style={{width:`${value}%`}}/></div>}
    <small>{estimate?.ci ? `95% CI: ${estimate.ci[0].toFixed(1)}–${estimate.ci[1].toFixed(1)}%` : "No published confidence interval"}</small>
  </div>;
}
export function PublicCountyExplorer({choices,initialCounty,initialEvidence,notice="",candidates=[]}:{choices:Choice[];initialCounty:string;initialEvidence:PublicCountyEvidence|null;notice?:string;candidates?:Choice[]}) {
  const [selected,setSelected]=useState(initialCounty),[comparison,setComparison]=useState("");
  const [group,setGroup]=useState<PublicCountyGroup>("conditions"),[copyStatus,setCopyStatus]=useState("");
  const primary=useCounty(selected,initialEvidence),secondary=useCounty(comparison);
  const measures=publicCountyMeasures.filter(m=>m.group===group);
  const name=(c:PublicCountyEvidence|null)=>c?`${c.name}, ${c.stateCode}`:"Choose a county";
  const exportCsv=()=>{
    const rows=[["County","FIPS","Measure","Percent","95% CI lower","95% CI upper","Survey year","Population","Source"]];
    for(const county of [primary.county,secondary.county])if(county)for(const m of publicCountyMeasures){const e=county[m.group][m.key];rows.push([name(county),county.fips,m.label,String(e.value??""),String(e.ci?.[0]??""),String(e.ci?.[1]??""),String(m.year),m.population,"CDC PLACES, 2025 release"]);}
    const csv=rows.map(row=>row.map(v=>`"${v.replaceAll('"','""')}"`).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="sozorock-county-evidence.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="public-county-explorer shell">
    <header><p className="eyebrow">Data and maps</p><h1>Health data for every county.</h1><p>Explore health conditions, access and preventive care. Compare two counties and follow every measure to its source.</p></header>
    {notice&&<p className="public-county-notice">{notice}</p>}
    {candidates.length>0&&<div className="public-county-candidates"><span>Counties intersecting this location:</span>{candidates.map(c=><button type="button" key={c.fips} onClick={()=>setSelected(c.fips)}>{c.name}, {c.state}</button>)}</div>}
    <div className="public-county-selectors"><CountySelect label="Your county" choices={choices} value={selected} onChange={setSelected}/><CountySelect label="Compare with" choices={choices} value={comparison} onChange={setComparison} optional/></div>
    <nav className="public-county-groups" aria-label="Evidence measures">{([["conditions","Health conditions"],["barriers","Access and daily life"],["prevention","Preventive care"]] as const).map(([key,label])=><button key={key} type="button" aria-pressed={group===key} onClick={()=>setGroup(key)}>{label}</button>)}</nav>
    <div aria-live="polite">{[primary,secondary].map((item,i)=>item.error?<p role="alert" key={i}>{item.error} <button type="button" onClick={item.retry}>Try again</button></p>:null)}{selected&&!primary.county&&!primary.error&&<p>Loading county evidence…</p>}{comparison&&!secondary.county&&!secondary.error&&<p>Loading comparison…</p>}</div>
    {primary.county&&<><div className="public-county-actions"><button type="button" onClick={exportCsv}>Download county data</button><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/explore?kind=county&geoid=${selected}`);setCopyStatus("County link copied.");}catch{setCopyStatus("Copy this county link from the address bar after opening it below.");}}}>Copy county link</button><a href={`/explore?kind=county&geoid=${selected}`}>Open county link</a><span role="status">{copyStatus}</span></div>
    <p className="fine">Crude prevalence · All bars use 0–100% · Intervals show uncertainty, not county rankings.</p>
    <h2 className="public-county-caption">{name(primary.county)}{secondary.county?` compared with ${name(secondary.county)}`:""}</h2>{secondary.county&&<p className="public-county-scroll-hint">On a small screen, scroll the table sideways to see both counties.</p>}<div className="public-county-table-scroll" role="region" aria-label="County comparison table" tabIndex={0}><table className="public-county-table"><caption className="public-county-screen-reader">{name(primary.county)}{secondary.county?` compared with ${name(secondary.county)}`:""}</caption><thead><tr><th scope="col">Measure and population</th><th scope="col">{name(primary.county)}</th>{secondary.county&&<th scope="col">{name(secondary.county)}</th>}</tr></thead><tbody>{measures.map(m=><tr key={m.key}><th scope="row">{m.label}<small>{m.population} · {m.year}</small></th><td><Estimate estimate={primary.county?.[m.group][m.key]} label={name(primary.county)}/></td>{secondary.county&&<td><Estimate estimate={secondary.county[m.group][m.key]} label={name(secondary.county)}/></td>}</tr>)}</tbody></table></div></>}
    <section className="public-county-methods"><h2>Read the figures with their limits.</h2><p>Source: <a href="https://data.cdc.gov/500-Cities-Places/PLACES-County-Data-GIS-Friendly-Format-2025-releas/i46a-9kgh">CDC PLACES, 2025 release</a>, released December 4, 2025. These are modeled population estimates, not diagnoses or records of individual residents. Most measures use 2023 survey data; dental visits, colorectal screening and mammography use 2022.</p><p>County estimates do not describe a whole city or ZIP area that crosses county boundaries. Missing values stay unavailable. Differences do not establish causes or a statistically significant ranking. Disability is accessibility context, not a measure of personal disadvantage.</p><p><a href="https://www.cdc.gov/places/methodology/">CDC methodology</a> · <a href="https://www.cdc.gov/places/measure-definitions/">Measure definitions</a> · <a href="/evidence">More SozoRock evidence and methods</a></p></section>
  </div>;
}
