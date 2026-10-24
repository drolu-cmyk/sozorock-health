import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { buildSync } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
function component(file, name) {
 const compiled=buildSync({entryPoints:[new URL(`../app/components/${file}`,import.meta.url).pathname],bundle:true,platform:"node",format:"cjs",jsx:"automatic",packages:"external",write:false}).outputFiles[0].text;
 const componentModule={exports:{}};vm.runInNewContext(compiled,{module:componentModule,exports:componentModule.exports,require,console});
 return renderToStaticMarkup(React.createElement(componentModule.exports[name]));
}
const html=component("PrimaryCareAccessPage.jsx","PrimaryCareAccessPage");
test("the dedicated program page retains the approved facts and working next steps",()=>{
 assert.equal((html.match(/<h1[ >]/g)||[]).length,1);
 for(const fact of ["Care for every ZIP Code.","up to 25 New Yorkers","January 2027","12 months","64 or younger","financial need","one per household","62 counties","Dr. Michael Purcell","Purcell Integrative Osteopathic Care","Clifton Park","not health insurance","$108,000","$4,320","$5,000","$10,000","$25,000","$50,000","rounded down","do not select participants or influence clinical care"] ) assert.ok(html.includes(fact),fact);
 assert.equal((html.match(/>Proposed</g)||[]).length,3);
 assert.doesNotMatch(html,/January\s+\d{1,2}(?:,|\s)+2027|TODO|deployment|editorial|review cut|implementation|concept/);
 assert.match(html,/href="\/interest"/);assert.match(html,/href="https:\/\/www.sozorockfoundation.org\/support"/);
 for(const value of ["46.75%","35.42%","83.2%","82.6%","60.0%","58.7%","55.5%","11.5%","1.8M"])assert.ok(html.includes(value),value);
 assert.ok(html.includes("National total includes New York"));assert.ok(html.includes("SozoRock population-weighted calculation"));
});
test("the map has a keyboard and touch equivalent for every county",()=>{
 const data=JSON.parse(readFileSync(new URL("../app/lib/ny-county-map.json",import.meta.url)));
 assert.equal(data.counties.length,62);assert.equal(new Set(data.counties.map(c=>c.fips)).size,62);
 assert.equal((html.match(/<option value="36/g)||[]).length,62);
 assert.equal((html.match(/<th scope="row">/g)||[]).length,62);
 assert.match(html,/aria-pressed="true"/);assert.match(html,/aria-pressed="false"/);
 assert.equal((html.match(/<path /g)||[]).length,62);
 for(const metric of ['diabetes','bphigh']){
  const v=data.counties.reduce((sum,c)=>sum+c.adults*c[metric],0)/data.counties.reduce((sum,c)=>sum+c.adults,0);
  assert.equal(v.toFixed(1),metric==='diabetes'?'11.5':'32.6');
  for(const c of data.counties){const ci=c[metric+'CI'];assert.ok(ci[0]<=c[metric]&&ci[1]>=c[metric]);}
 }
});
test("the branch film retains native playback, captions and descriptions",()=>{
 const video=html.match(/<video\b[^>]+>/)?.[0]||'';
 assert.match(video,/controls=""/);assert.match(video,/playsInline=""/i);assert.match(video,/preload="none"/);assert.doesNotMatch(video,/autoPlay|autoplay/);
 assert.match(html,/sozorock-health-care-for-every-zip-code.mp4/);assert.match(html,/kind="captions"/);assert.match(html,/kind="descriptions"/);assert.match(html,/care-for-every-zip-code.transcript.txt/);
});
test("the homepage tells the health access story and links to every program",()=>{
 const home=component("HealthStory.jsx","HealthStory");
 assert.equal((home.match(/<h1[ >]/g)||[]).length,1);
 for(const href of ["/primary-care-access","/interest","/explore","/contact"])assert.match(home,new RegExp(`href="${href}"`),href);
 for(const fact of ["up to 25","January 2027","46.75%","35.42%","$108,000","Health Equity Hubs","Place Intelligence"])assert.ok(home.includes(fact),fact);
 assert.doesNotMatch(home,/Proposed|proposed| \u2014 | \u2013 /);
 assert.match(home,/hero-community-desktop-v2\.webp/);
});
