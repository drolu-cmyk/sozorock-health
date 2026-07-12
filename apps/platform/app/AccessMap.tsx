"use client";

import {useMemo, useState} from "react";
import {geoAlbersUsa,geoPath} from "d3-geo";
import {feature} from "topojson-client";
import countiesAtlas from "us-atlas/counties-10m.json";
import type {CountyAccessRecord} from "@sozorock/domain";

type Tip={x:number;y:number;county:string;state:string;index:number}|null;

export default function AccessMap({records,selectedFips,onSelect}:{records:CountyAccessRecord[];selectedFips:string|null;onSelect:(fips:string)=>void}){
  const [tip,setTip]=useState<Tip>(null);
  const {geometry,path,countiesByFips}=useMemo(()=>{const atlas:any=countiesAtlas;const geometry:any=feature(atlas,atlas.objects.counties);const path=geoPath(geoAlbersUsa().scale(1280).translate([487.5,305]));return {geometry,path,countiesByFips:new Map<string,any>(geometry.features.map((county:any)=>[String(county.id).padStart(5,"0"),county]))};},[]);
  const counties=useMemo(()=>{const byFips=new Map<string,CountyAccessRecord[]>();records.forEach((r)=>byFips.set(r.fips,[...(byFips.get(r.fips)??[]),r]));return [...byFips].map(([fips,group])=>({fips,county:group[0].county,state:group[0].state,index:Math.round(group.reduce((sum,r)=>sum+r.accessIndex*r.sampleSize,0)/group.reduce((sum,r)=>sum+r.sampleSize,0)),geometry:countiesByFips.get(fips)})).filter((item)=>item.geometry);},[records,countiesByFips]);
  const color=(index:number)=>index>=70?"#557339":index>=50?"#a9863f":"#a34b35";
  return <div className="map-frame" data-testid="county-choropleth" onPointerLeave={()=>setTip(null)}><svg className="county-map" viewBox="0 0 975 610" role="group" aria-label="Interactive United States county systems-readiness map. Tab to a highlighted county and press Enter for details."><path d={path(geometry)??""} className="county-base" aria-hidden="true"/>{counties.map((item)=><path key={item.fips} d={path(item.geometry)??""} fill={color(item.index)} className={`county-data ${selectedFips===item.fips?"selected":""}`} tabIndex={0} role="button" data-testid={`county-${item.fips}`} aria-label={`${item.county}, ${item.state}: systems readiness ${item.index} out of 100`} onPointerMove={(event)=>{const box=event.currentTarget.ownerSVGElement?.getBoundingClientRect();if(box)setTip({x:event.clientX-box.left,y:event.clientY-box.top,county:item.county,state:item.state,index:item.index});}} onFocus={()=>setTip({x:50,y:40,county:item.county,state:item.state,index:item.index})} onBlur={()=>setTip(null)} onClick={()=>onSelect(item.fips)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(item.fips);}}}><title>{item.county}, {item.state} · Systems readiness {item.index}</title></path>)}</svg>{tip&&<div className="map-tip" style={{left:`${Math.min(tip.x+12,72)}%`,top:`${Math.min(tip.y+12,72)}%`}} role="status"><strong>{tip.county}</strong><span>{tip.state}</span><b>{tip.index}<small>/100</small></b></div>}{!counties.length&&<p className="map-empty">No counties match these filters.</p>}</div>;
}
