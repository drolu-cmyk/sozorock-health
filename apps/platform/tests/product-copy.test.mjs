import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../app/', import.meta.url);
const contract = JSON.parse(readFileSync(new URL('product-contract.json', root), 'utf8'));
function publicFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => {
    const next = join(path, entry.name);
    if (entry.isDirectory()) return entry.name === 'api' || entry.name === 'lib' ? [] : publicFiles(next);
    return /\.(tsx|json)$/.test(entry.name) ? [next] : [];
  });
}
test('public content rejects unsupported claims and generic promotional language', () => {
  const prohibited = /HIPAA safe|real.time access pattern|service demand forecasting|grant.ready|all hub types flow|AI.powered|actionable insights|\bunlock\b|\breimagine\b|\bseamless\b|\bholistic\b|future.ready|custom metric tracking/i;
  for (const file of publicFiles(root.pathname)) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), prohibited, file);
  }
});
test('copy contract preserves planning, resource and human-review meanings', () => {
  const text = JSON.stringify(contract).toLowerCase();
  for (const term of ['county planning for health access', 'public evidence preview', 'funding fit', 'budget & funding', 'workforce & capacity', 'test options', 'what changed', 'sources', 'human review']) assert.ok(text.includes(term), term);
  assert.equal(contract.products.placeIntelligence, 'Open public evidence exploration.');
  assert.ok(!contract.workspaceNavigation.includes('AI'));
});
test('capability records have explicit dependency and production-proof boundaries', () => {
  const status = JSON.parse(readFileSync(new URL('../../../docs/cbcap-capability-status.json', root), 'utf8'));
  for (const item of status.capabilities) {
    for (const key of ['publicPreviewStatus', 'institutionalUiStatus', 'backendStatus']) assert.ok(contract.capabilityStates.includes(item[key]), `${item.id}: ${key}`);
    for (const key of ['evidenceDependency', 'authenticationDependency', 'productionDependency', 'ownerSourceOfTruth']) assert.ok(item[key], `${item.id}: ${key}`);
    assert.notEqual(item.institutionalUiStatus, 'LIVE', 'No institutional production proof has been established');
  }
});
