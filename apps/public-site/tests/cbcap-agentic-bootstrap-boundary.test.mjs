import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const templateUrl = new URL('../../../infrastructure/cloudformation/cbcap-agentic-deployment-bootstrap.yml', import.meta.url);
const workflowUrl = new URL('../../../.github/workflows/bootstrap-cbcap-agentic.yml', import.meta.url);

test('CB-CAP deployment role can inspect the cluster before fail-closed shutdown', async () => {
  const template = await readFile(templateUrl, 'utf8');
  assert.match(template, /- ecs:DescribeClusters/);
  assert.match(template, /- ecs:UpdateService/);
});

test('newest approved CB-CAP bootstrap supersedes stale queued bootstrap requests', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  assert.match(workflow, /group: cbcap-agentic-bootstrap-production/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
});
