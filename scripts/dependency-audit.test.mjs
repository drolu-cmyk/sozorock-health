import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { evaluateAudit } from './audit-production-dependencies.mjs';
import { root, verifyBackports } from './verify-dependency-backports.mjs';

function fixture() {
  const node = 'node_modules/braces';
  const policy = { advisory: 'GHSA-vfj7-8cjw-p6xm', source_id: 1240992, nodes: new Set([node]) };
  const root = { name: 'braces', severity: 'high', nodes: [node], via: [{
    name: 'braces', dependency: 'braces', source: policy.source_id,
    url: `https://github.com/advisories/${policy.advisory}`,
  }] };
  return {
    report: { auditReportVersion: 2, vulnerabilities: { braces: root }, metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 },
    } },
    verified: new Map([['braces', policy]]),
    lock: { packages: { [node]: {} } },
  };
}

test('accepts only a source-verified advisory and reports the registry finding', () => {
  const { report, verified, lock } = fixture();
  assert.deepEqual(evaluateAudit(report, verified, lock), { unresolved: [], repairedEntries: 1, registryFindings: 1 });
  assert.deepEqual(evaluateAudit(report, new Map(), lock).unresolved, ['braces']);
});

test('a new advisory for a patched package still blocks', () => {
  const { report, verified, lock } = fixture();
  report.vulnerabilities.braces.via.push({ ...report.vulnerabilities.braces.via[0], source: 9999999 });
  assert.deepEqual(evaluateAudit(report, verified, lock).unresolved, ['braces']);
});

test('an additional affected copy must be independently source verified', () => {
  const { report, verified, lock } = fixture();
  const node = 'apps/mobile/node_modules/braces';
  report.vulnerabilities.braces.nodes.push(node); lock.packages[node] = {};
  assert.deepEqual(evaluateAudit(report, verified, lock).unresolved, ['braces']);
});

test('metavulnerabilities require every reachable root to be repaired', () => {
  const { report, verified, lock } = fixture();
  report.vulnerabilities.consumer = { name: 'consumer', severity: 'high', nodes: ['node_modules/consumer'], via: ['braces'] };
  lock.packages['node_modules/consumer'] = {};
  report.metadata.vulnerabilities.high = 2; report.metadata.vulnerabilities.total = 2;
  assert.deepEqual(evaluateAudit(report, verified, lock).unresolved, []);
  report.vulnerabilities.consumer.via.push('missing-advisory');
  assert.deepEqual(evaluateAudit(report, verified, lock).unresolved, ['consumer']);
});

test('a dependency cycle without a known root cannot clear a finding', () => {
  const { report, verified, lock } = fixture();
  report.vulnerabilities.braces.via = ['braces'];
  assert.deepEqual(evaluateAudit(report, verified, lock).unresolved, ['braces']);
});

test('malformed, incomplete and inconsistent audit reports block', () => {
  const { report, verified, lock } = fixture();
  for (const value of [{}, { ...report, error: {} }, { ...report, auditReportVersion: 1 },
    { ...report, metadata: { vulnerabilities: { total: 0 } } }]) {
    assert.throws(() => evaluateAudit(value, verified, lock));
  }
  report.vulnerabilities.braces.nodes = ['not-a-locked-package'];
  assert.throws(() => evaluateAudit(report, verified, lock));
});

test('an installed copy outside the lockfile cannot bypass the source gate', async () => {
  const fixture = await mkdtemp(path.join(root, 'node_modules/.backport-copy-test-'));
  try {
    await mkdir(path.join(fixture, 'node_modules/braces'), { recursive: true });
    await assert.rejects(verifyBackports(), /installed copies differ from the lockfile/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});

