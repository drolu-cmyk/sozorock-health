import assert from 'node:assert/strict';
import test from 'node:test';
import { currentContextSources } from '../app/lib/evidence-source-selection.ts';

test('current context does not merge withdrawn historical designations or superseded estimates', () => {
  const row=(id,sourceId,releaseDate,retrievedAt=releaseDate)=>({id,sourceId,releaseDate,retrievedAt});
  const linked=[row('hrsa-old','hrsa-workforce','2026-08-26'),row('cdc-pinned','cdc-places','2025-12-04'),row('hrsa-current','hrsa-workforce','2026-09-08'),row('acs-old','census-acs5','2025-12-11','2026-07-23'),row('acs-current','census-acs5','2025-12-11','2026-08-26'),row('geography','census-geography','2025-01-01')];
  const copy=structuredClone(linked);
  assert.deepEqual(currentContextSources(linked).map(x=>x.id),['cdc-pinned','hrsa-current','acs-current','geography']);
  assert.deepEqual(linked,copy,'selection must retain input history');
  assert.deepEqual(new Set(currentContextSources([...linked].reverse()).map(x=>x.id)),new Set(['cdc-pinned','hrsa-current','acs-current','geography']));
});

test('release date takes precedence over a later retrieval of an older release',()=>{
  const sources=[{id:'old-retrieved-later',sourceId:'ahrq-clh',releaseDate:'2023-01-01',retrievedAt:'2026-09-08'},{id:'current-release',sourceId:'ahrq-clh',releaseDate:'2024-01-01',retrievedAt:'2026-08-26'}];
  assert.equal(currentContextSources(sources)[0].id,'current-release');
});

test('a reviewed provenance correction wins over a legacy copy with the same release and retrieval',()=>{
  const common={sourceId:'census-acs5',releaseDate:'2026-01-29',retrievedAt:'2026-07-26 16:08:38.509+00'};
  const sources=[{...common,id:'6bd-legacy',reviewedAt:'2026-07-30 05:56:50+00'},{...common,id:'b47-corrected',reviewedAt:'2026-09-08 03:43:27+00'}];
  assert.equal(currentContextSources(sources)[0].id,'b47-corrected');
});
