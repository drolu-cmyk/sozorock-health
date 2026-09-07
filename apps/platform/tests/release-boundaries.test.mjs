import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const workflow = name => readFileSync(new URL(`../../../.github/workflows/${name}`, import.meta.url), 'utf8');
test('Health and CB-CAP releases have separate queues and protected targets', () => {
  const health = workflow('deploy.yml');
  const cbcap = workflow('deploy-cbcap.yml');
  const group = text => text.match(/group: (.+)/)?.[1];
  assert.ok(group(health));
  assert.ok(group(cbcap));
  assert.notEqual(group(health), group(cbcap), 'A Health release must not cancel or block CB-CAP');
  for (const text of [health, cbcap]) assert.match(text, /environment: production/);
  const deploy = health.slice(health.indexOf('- name: Deploy public site'));
  const targetGuard = deploy.indexOf('if [[ "$PUBLIC_APP_ID" == "d307qqji18y8il" ]]');
  assert.ok(targetGuard >= 0 && targetGuard < deploy.indexOf('aws '), 'Reject the CB-CAP target before public-site cloud actions');
});
