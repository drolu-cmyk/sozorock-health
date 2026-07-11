"use client";

import {geoAlbersUsa, geoPath} from "d3-geo";
import {feature} from "topojson-client";
import countiesAtlas from "us-atlas/counties-10m.json";
import {countyAccessSeed} from "@sozorock/domain";

export default function AccessMap({records,onSelect}:{records:typeof countyAccessSeed;onSelect:(fips:string)=>void}) {
  const atlas:any=countiesAtlas;
  const geometry:any=feature(atlas,atlas.objects.counties);
  const path=geoPath(geoAlbersUsa().scale(1280).translate([487.5,305]));
  const countiesByFips=new Map(geometry.features.map((county:any)=>[String(county.id).padStart(5,"0"),county]));
  return <div className="map-frame" data-testid="county-choropleth"><svg className="county-map" viewBox="0 0 975 610" role="img" aria-label="Interactive United States county access map. Use Tab to focus represented counties."><path d={path(geometry)??""} className="county county-base" aria-hidden="true"/>{records.map((record)=>{const county=countiesByFips.get(record.fips);if(!county)return null;return <path key={record.fips} d={path(county as any)??""} className="county has-data" style={{fill:`hsl(82 25% ${82-record.accessIndex/2}%)`}} tabIndex={0} role="button" data-testid={`county-${record.fips}`} aria-label={`${record.county}, ${record.state}: access index ${record.accessIndex}`} onClick={()=>onSelect(record.fips)} onKeyDown={(event)=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(record.fips);}}}><title>{`${record.county}, ${record.state} - Access index ${record.accessIndex}`}</title></path>;})}</svg>{!records.length&&<p>No counties match these filters.</p>}</div>;
}
