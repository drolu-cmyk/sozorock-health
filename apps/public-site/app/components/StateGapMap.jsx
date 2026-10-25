"use client";

import { useState } from "react";

/** Share of primary care need met in designated shortage areas, by state. KFF analysis of HRSA data, December 31, 2025. */
const STATES = [
  ["Alaska","AK",0,0,26.6],
  ["Maine","ME",11,0,60.1],
  ["Vermont","VT",10,1,84.2],
  ["New Hampshire","NH",11,1,78.9],
  ["Washington","WA",1,2,45.4],
  ["Idaho","ID",2,2,47.1],
  ["Montana","MT",3,2,42.3],
  ["North Dakota","ND",4,2,37.7],
  ["Minnesota","MN",5,2,54.4],
  ["Illinois","IL",6,2,44.4],
  ["Wisconsin","WI",7,2,66.0],
  ["Michigan","MI",8,2,47.5],
  ["New York","NY",9,2,35.4],
  ["Rhode Island","RI",10,2,74.3],
  ["Massachusetts","MA",11,2,58.5],
  ["Oregon","OR",1,3,51.3],
  ["Nevada","NV",2,3,43.7],
  ["Wyoming","WY",3,3,53.8],
  ["South Dakota","SD",4,3,33.2],
  ["Iowa","IA",5,3,37.2],
  ["Indiana","IN",6,3,52.2],
  ["Ohio","OH",7,3,48.5],
  ["Pennsylvania","PA",8,3,51.6],
  ["New Jersey","NJ",9,3,70.2],
  ["Connecticut","CT",10,3,74.6],
  ["California","CA",1,4,53.6],
  ["Utah","UT",2,4,65.4],
  ["Colorado","CO",3,4,46.7],
  ["Nebraska","NE",4,4,49.2],
  ["Missouri","MO",5,4,21.5],
  ["Kentucky","KY",6,4,31.4],
  ["West Virginia","WV",7,4,38.3],
  ["Virginia","VA",8,4,57.5],
  ["Maryland","MD",9,4,28.7],
  ["Delaware","DE",10,4,11.2],
  ["Arizona","AZ",2,5,42.2],
  ["New Mexico","NM",3,5,43.7],
  ["Kansas","KS",4,5,41.2],
  ["Arkansas","AR",5,5,53.5],
  ["Tennessee","TN",6,5,58.8],
  ["North Carolina","NC",7,5,47.8],
  ["South Carolina","SC",8,5,78.5],
  ["District of Columbia","DC",9,5,0.2],
  ["Oklahoma","OK",4,6,30.7],
  ["Louisiana","LA",5,6,72.5],
  ["Mississippi","MS",6,6,34.9],
  ["Alabama","AL",7,6,67.0],
  ["Georgia","GA",8,6,39.0],
  ["Hawaii","HI",0,7,66.6],
  ["Texas","TX",4,7,51.0],
  ["Florida","FL",9,7,39.6]
];

const ES_NAMES = { "New York": "Nueva York", "New Jersey": "Nueva Jersey", "New Mexico": "Nuevo México", "New Hampshire": "Nuevo Hampshire", "North Carolina": "Carolina del Norte", "South Carolina": "Carolina del Sur", "North Dakota": "Dakota del Norte", "South Dakota": "Dakota del Sur", "Pennsylvania": "Pensilvania", "Louisiana": "Luisiana", "Missouri": "Misuri", "Mississippi": "Misisipi", "Hawaii": "Hawái", "West Virginia": "Virginia Occidental", "Oregon": "Oregón", "Michigan": "Míchigan", "District of Columbia": "Distrito de Columbia" };

const TEXT = {
  en: { group: "Select a state to see the share of primary care need met", tile: (n, p) => `${n}: ${p}% of need met`, read: "of primary care need met in", src: "Darker means less need met. Select a state. KFF analysis of HRSA data, December 31, 2025." },
  es: { group: "Seleccione un estado para ver qué parte de la necesidad de atención primaria está cubierta", tile: (n, p) => `${n}: ${p}% de la necesidad cubierta`, read: "de la necesidad de atención primaria cubierta en", src: "Más oscuro significa menos necesidad cubierta. Seleccione un estado. Análisis de KFF con datos de HRSA, 31 de diciembre de 2025." },
};

function tone(pct) {
  if (pct < 30) return "t1";
  if (pct < 40) return "t2";
  if (pct < 50) return "t3";
  if (pct < 60) return "t4";
  return "t5";
}

/** @param {{spanish?: boolean}} props */
export function StateGapMap({ spanish = false }) {
  const [selected, setSelected] = useState("NY");
  const state = STATES.find((s) => s[1] === selected) ?? STATES[0];
  const t = spanish ? TEXT.es : TEXT.en;
  const name = (n) => (spanish ? ES_NAMES[n] ?? n : n);
  return <figure className="hx-map">
    <div className="hx-tiles" role="group" aria-label={t.group}>
      {STATES.map(([n, abbr, col, row, pct]) => <button key={abbr} type="button" className={`hx-tile ${tone(pct)}`} style={{ gridColumn: col + 1, gridRow: row + 1 }} aria-pressed={abbr === selected} aria-label={t.tile(name(n), pct)} onClick={() => setSelected(abbr)}>{abbr}</button>)}
    </div>
    <figcaption>
      <p className="hx-map-read" aria-live="polite"><strong>{state[4]}%</strong> {t.read} {name(state[0])}</p>
      <p className="hx-src">{t.src}</p>
    </figcaption>
  </figure>;
}
