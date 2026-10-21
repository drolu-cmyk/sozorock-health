import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";
import { NextRequest } from "next/server.js";
import { publicCountyEvidence, publicCountyChoices, publicCountySource } from "../app/lib/public-county-evidence.ts";
import { publicCountyMeasures } from "../app/lib/public-county-measures.ts";
const require=createRequire(import.meta.url);

test("the public projection includes only published estimates, with missing values intact",()=>{
  assert.equal(publicCountyChoices.length,3144);
  assert.equal(new Set(publicCountyChoices.map(c=>c.fips)).size,3144);
  assert.equal(publicCountyEvidence("99999"),null);
  assert.equal(publicCountyEvidence("36001' OR 1=1"),null);
  const county=publicCountyEvidence("36001");
  assert.equal(county.name,"Albany County");assert.equal(county.conditions.diabetes.value,9.2);
  assert.deepEqual(Object.keys(county).sort(),["fips","name","state","stateCode","conditions","barriers","prevention"].sort());
  for(const c of publicCountyChoices){const data=publicCountyEvidence(c.fips);for(const m of publicCountyMeasures){const e=data[m.group][m.key];assert.ok(e.value===null||(e.value>=0&&e.value<=100));if(e.ci)assert.ok(e.ci[0]<=e.value&&e.value<=e.ci[1]);}}
  assert.equal(publicCountyEvidence("42001").conditions.diabetes.value,null);
  assert.equal(publicCountyMeasures.find(m=>m.key==="mammography").year,2022);
  assert.equal(publicCountyMeasures.find(m=>m.key==="colorectalScreening").population,"Adults aged 45–75");
  assert.match(publicCountySource.source,/CDC PLACES/);
});

test("the public endpoint validates identifiers and preserves rate-limit failure boundaries",async()=>{
  let allowed=true,retryAfter=null,fail=false,calls=0;
  const compiled=await build({entryPoints:[new URL("../app/api/public-counties/route.ts",import.meta.url).pathname],bundle:true,platform:"node",format:"cjs",packages:"external",write:false,plugins:[{name:"test-boundaries",setup(b){
    b.onResolve({filter:/public-county-evidence$/},()=>({path:"public",namespace:"test"}));
    b.onResolve({filter:/evidence-rate-limit$/},()=>({path:"rate",namespace:"test"}));
    b.onLoad({filter:/.*/,namespace:"test"},args=>({contents:args.path==="public"?"export const publicCountyEvidence=globalThis.publicCountyEvidence;export const publicCountySource=globalThis.publicCountySource;":"export const enforceEvidenceRateLimit=globalThis.rate;",loader:"js"}));
  }}]});
  const mod={exports:{}};vm.runInNewContext(compiled.outputFiles[0].text,{module:mod,exports:mod.exports,require,publicCountyEvidence,publicCountySource,rate:async()=>{calls++;if(fail)throw new Error("private service details");return{allowed,retryAfter};}});
  const get=id=>mod.exports.GET(new NextRequest(`https://health.sozorockfoundation.org/api/public-counties?geoid=${encodeURIComponent(id)}`));
  let response=await get("36001");assert.equal(response.status,200);assert.match(response.headers.get("cache-control"),/s-maxage=3600/);assert.equal((await response.json()).county.fips,"36001");
  response=await get("36001' OR 1=1");assert.equal(response.status,400);assert.equal(calls,1);
  response=await get("99999");assert.equal(response.status,404);assert.equal(calls,1);
  allowed=false;retryAfter=300;response=await get("36001");assert.equal(response.status,429);assert.equal(response.headers.get("retry-after"),"300");assert.equal(response.headers.get("cache-control"),"no-store");
  retryAfter=null;response=await get("36001");assert.equal(response.status,503);assert.equal(response.headers.get("cache-control"),"no-store");
  fail=true;response=await get("36001");assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private service details/);
});
