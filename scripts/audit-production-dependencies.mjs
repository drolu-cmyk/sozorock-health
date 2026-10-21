import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { root, verifyBackports } from './verify-dependency-backports.mjs';

const ranks = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

export function evaluateAudit(report, verified, lock) {
  assert.equal(report.auditReportVersion, 2, 'Unsupported npm audit response');
  assert(report.vulnerabilities && typeof report.vulnerabilities === 'object' && !Array.isArray(report.vulnerabilities));
  assert(report.metadata?.vulnerabilities && !report.error, 'Incomplete npm audit response');
  const entries = Object.entries(report.vulnerabilities);
  const counts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0 };
  for (const [name, entry] of entries) {
    assert.equal(entry.name, name);
    assert(Object.hasOwn(ranks, entry.severity));
    counts[entry.severity]++;
    assert(Array.isArray(entry.via) && entry.via.length > 0);
    assert(Array.isArray(entry.nodes) && entry.nodes.length > 0);
    for (const node of entry.nodes) assert(Object.hasOwn(lock.packages, node), 'Audit path is not in the lockfile');
  }
  for (const [severity, count] of Object.entries(counts)) assert.equal(report.metadata.vulnerabilities[severity], count);
  assert.equal(report.metadata.vulnerabilities.total, entries.length);

  const unresolved = [];
  let repairedEntries = 0;
  for (const [name, entry] of entries) {
    if (ranks[entry.severity] < ranks.moderate) continue;
    const pending = [name];
    const seen = new Set();
    let repaired = true;
    let roots = 0;
    while (pending.length > 0) {
      const current = pending.pop();
      if (seen.has(current)) continue;
      seen.add(current);
      const dependency = report.vulnerabilities[current];
      if (!dependency) { repaired = false; break; }
      for (const via of dependency.via) {
        if (typeof via === 'string') { pending.push(via); continue; }
        roots++;
        const policy = verified.get(current);
        if (!policy || !via || via.name !== current || via.dependency !== current ||
            via.source !== policy.source_id || via.url !== `https://github.com/advisories/${policy.advisory}` ||
            !dependency.nodes.every(node => policy.nodes.has(node))) repaired = false;
      }
    }
    if (repaired && roots > 0) repairedEntries++;
    else unresolved.push(name);
  }
  return { unresolved, repairedEntries, registryFindings: entries.length };
}

async function main() {
  const flags = process.argv.slice(2);
  assert(flags.every(flag => flag === '--include-optional'), 'Unknown audit option');
  const { verified, lock } = await verifyBackports();
  const args = ['audit', '--omit=dev', '--audit-level=moderate', '--json'];
  if (!flags.includes('--include-optional')) args.push('--omit=optional');
  const audit = spawnSync('npm', args, { cwd: root, encoding: 'utf8', timeout: 180_000, maxBuffer: 10_000_000 });
  assert(audit.status === 0 || audit.status === 1, 'npm audit did not complete');
  const report = JSON.parse(audit.stdout);
  const aboveThreshold = ['moderate', 'high', 'critical'].some(level => report.metadata?.vulnerabilities?.[level] > 0);
  assert.equal(audit.status === 1, aboveThreshold, 'Inconsistent npm audit exit status');
  const directory = path.join(root, 'output/security');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'npm-production-audit.raw.json'), audit.stdout);
  const result = evaluateAudit(report, verified, lock);
  await writeFile(path.join(directory, 'npm-production-audit.evaluated.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Registry findings: ${result.registryFindings}; verified backport entries: ${result.repairedEntries}; unresolved at moderate or higher: ${result.unresolved.length}.`);
  if (result.repairedEntries) console.log('Upstream versions remain flagged. Installed source integrity and exploit regressions passed; package identities and versions are unchanged.');
  assert.equal(result.unresolved.length, 0, `Unresolved dependency findings: ${result.unresolved.join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Production dependency audit blocked: ${error.message}`); process.exitCode = 1; });
}
