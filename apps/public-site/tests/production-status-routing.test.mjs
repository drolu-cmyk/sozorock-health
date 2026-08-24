import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bridgeUrl = new URL('../../../.github/workflows/deploy-production-status.yml', import.meta.url);

test('production Deploy status ignores deliberately skipped PR-triggered runs', async () => {
  const workflow = await readFile(bridgeUrl, 'utf8');
  assert.match(workflow, /github\.event\.workflow_run\.conclusion != 'skipped'/);
  assert.match(workflow, /context 'deploy\/production'/);
});
