import assert from 'node:assert/strict';
import test from 'node:test';
import {publications} from '../app/lib/publications.ts';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

test('publication records preserve DOI and private-delivery associations',()=>{
  for(const [slug,series,doi] of [
    ['rural-equity-blueprint-volume-1','Rural Equity Blueprint Series (REBS)','10.65473/rebs-v1-2025'],
    ['rethinking-rural-governance-volume-1','Rethinking Rural Governance Series (RRG)','10.65473/rrg-v1-2025'],
  ]){
    const p=publications.find(p=>p.slug===slug);
    assert.equal(p.title,`${series}, Volume 1`);
    assert.equal(p.doi,doi);
    assert.equal(p.author,'Dr. Oluwabiyi Adeyemo');
    assert.equal(p.assetKey,`${slug}.pdf`);
    assert.ok(p.limitations);
  }
});

test('MapLibre production worker and relative module match installed bytes',async()=>{
  execFileSync(process.execPath,['../../scripts/copy-maplibre-worker.mjs']);
  for(const file of ['maplibre-gl-worker.mjs','maplibre-gl-shared.mjs']){
    const [source,output]=await Promise.all([
      readFile(new URL(`../../../node_modules/maplibre-gl/dist/${file}`,import.meta.url)),
      readFile(new URL(`../public/maplibre/${file}`,import.meta.url)),
    ]);
    assert.deepEqual(output,source);
  }
  const license=await readFile(new URL('../public/maplibre/LICENSE.txt',import.meta.url),'utf8');
  assert.match(license,/Copyright/);
});
