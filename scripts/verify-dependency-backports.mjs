import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function codeFiles(directory, prefix = '') {
  const files = [];
  for (const item of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isSymbolicLink()) throw new Error('Linked dependency source is not permitted');
    if (item.isDirectory() && item.name !== 'node_modules') files.push(...await codeFiles(directory, relative));
    else if (item.isFile() && (relative.endsWith('.js') || relative === 'package.json')) files.push(relative);
  }
  return files.sort();
}

async function installedCopies(repository, names) {
  const found = new Map(names.map(name => [name, []]));
  async function walk(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
      if (item.name === '.git') continue;
      const child = path.join(directory, item.name);
      if (path.basename(directory) === 'node_modules' && found.has(item.name)) {
        found.get(item.name).push(path.relative(repository, child).split(path.sep).join('/'));
      }
      if (item.isDirectory()) await walk(child);
    }
  }
  await walk(repository);
  return found;
}

export async function verifyBackports({ repository = root, regressions = true } = {}) {
  const manifest = JSON.parse(await readFile(path.join(repository, 'scripts/dependency-backports.json'), 'utf8'));
  assert.equal(manifest.schema, 1);
  const lock = JSON.parse(await readFile(path.join(repository, 'package-lock.json'), 'utf8'));
  const installed = await installedCopies(repository, Object.keys(manifest.packages));
  const verified = new Map();
  for (const [name, policy] of Object.entries(manifest.packages)) {
    assert.equal(sha256(await readFile(path.join(repository, policy.patch))), policy.patch_sha256,
      `${name}: source patch changed without review`);
    const nodes = Object.keys(lock.packages).filter(key => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`));
    assert(nodes.length > 0, `${name}: locked dependency is missing`);
    assert.deepEqual(installed.get(name).sort(), [...nodes].sort(), `${name}: installed copies differ from the lockfile`);
    for (const node of nodes) {
      const entry = lock.packages[node];
      assert.equal(entry.version, policy.version, `${name}: unexpected locked version`);
      assert.equal(entry.integrity, policy.upstream_integrity, `${name}: upstream artifact changed`);
      assert.equal(entry.resolved, `https://registry.npmjs.org/${name}/-/${name}-${policy.version}.tgz`);
      const directory = path.join(repository, node);
      assert.equal(await realpath(directory), directory, `${name}: unexpected linked dependency`);
      const metadata = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
      assert.equal(metadata.name, name);
      assert.equal(metadata.version, policy.version);
      assert.deepEqual(await codeFiles(directory), Object.keys(policy.files).sort(), `${name}: unexpected source inventory`);
      for (const [file, expected] of Object.entries(policy.files)) {
        assert.equal(sha256(await readFile(path.join(directory, file))), expected,
          `${name}: installed source differs at ${file}`);
      }
      if (regressions) {
        const result = spawnSync(process.execPath, [
          path.join(repository, 'scripts/dependency-backport-regressions.cjs'), name, directory,
        ], { cwd: repository, encoding: 'utf8', timeout: 30_000, maxBuffer: 1_000_000 });
        assert.equal(result.status, 0, `${name}: exploit or compatibility regression failed`);
      }
    }
    verified.set(name, { ...policy, nodes: new Set(nodes) });
  }
  return { verified, lock };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { verified } = await verifyBackports();
    console.log(`Verified source integrity and exploit regressions for ${verified.size} dependency backports.`);
  } catch (error) {
    console.error(`Dependency backport verification blocked: ${error.message}`);
    process.exitCode = 1;
  }
}
