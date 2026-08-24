import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const templateUrl = new URL('../../../infrastructure/cloudformation/cbcap-agentic-deployment-bootstrap.yml', import.meta.url);

test('CB-CAP deployment role can inspect the cluster before fail-closed shutdown', async () => {
  const template = await readFile(templateUrl, 'utf8');
  assert.match(template, /- ecs:DescribeClusters/);
  assert.match(template, /- ecs:UpdateService/);
});
