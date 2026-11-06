import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
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

test('the unresolved Zod advisory cannot be cleared by a partial backport', async () => {
  const manifest = JSON.parse(await readFile(path.join(root, 'scripts/dependency-backports.json'), 'utf8'));
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(Object.hasOwn(manifest.packages, 'zod'), false);
  assert.doesNotMatch(packageJson.scripts.postinstall, /apply-workspace-security-backports/);
  const node = 'apps/mobile/node_modules/zod';
  const report = {
    auditReportVersion: 2,
    vulnerabilities: { zod: { name: 'zod', severity: 'high', nodes: [node], via: [{
      name: 'zod', dependency: 'zod', source: 1243066,
      url: 'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5',
    }] } },
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
  };
  const verified = new Map(Object.entries(manifest.packages));
  assert.deepEqual(evaluateAudit(report, verified, { packages: { [node]: {} } }).unresolved, ['zod']);
});

test('the dependency lock does not include vulnerable Zod versions', async () => {
  const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const copies = Object.entries(lock.packages).filter(([name]) => /(?:^|\/)node_modules\/zod$/.test(name));
  assert(copies.length > 0, 'expected the supported Zod dependency to remain installed');
  assert(copies.every(([, metadata]) => metadata.version === '4.6.6'));
});

test('Zod does not pass unvalidated array values to a refinement', () => {
  const require = createRequire(import.meta.url);
  const z = require(path.join(root, 'node_modules/zod'));
  const schema = z.array(z.string()).max(2).superRefine(items => items[0].toUpperCase());
  assert.equal(schema.safeParse([1, 2, 3]).success, false);
  assert.equal(schema.safeParse(['county']).success, true);
  assert.deepEqual(z.array(z.string()).parse(['county', 'source']), ['county', 'source']);
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

test('a below-threshold advisory does not block a repaired moderate metavulnerability', () => {
  const { report, verified, lock } = fixture();
  report.vulnerabilities.low = {
    name: 'low', severity: 'low', nodes: ['node_modules/low'], via: [{
      name: 'low', dependency: 'low', source: 1,
      url: 'https://github.com/advisories/GHSA-low', severity: 'low',
    }],
  };
  report.vulnerabilities.consumer = {
    name: 'consumer', severity: 'high', nodes: ['node_modules/consumer'], via: ['braces', 'low'],
  };
  lock.packages['node_modules/low'] = {};
  lock.packages['node_modules/consumer'] = {};
  report.metadata.vulnerabilities.low = 1;
  report.metadata.vulnerabilities.high = 2;
  report.metadata.vulnerabilities.total = 3;
  assert.deepEqual(evaluateAudit(report, verified, lock).unresolved, []);
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

