import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const root = new URL('../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');
const tags = ['Ref', 'Sub', 'GetAtt', 'Join', 'If', 'Equals', 'Not', 'And', 'Or', 'Select', 'GetAZs', 'ImportValue', 'FindInMap', 'Condition'];
const schema = yaml.DEFAULT_SCHEMA.extend(tags.flatMap((tag) => ['scalar', 'sequence', 'mapping'].map((kind) =>
  new yaml.Type(`!${tag}`, { kind, construct: (value) => ({ [tag]: value }) }))));
const parse = (path) => yaml.load(source(path), { schema });
const list = (value) => Array.isArray(value) ? value : [value];
const denied = ['rds:Create*', 'rds:Restore*', 'rds:Start*', 'rds:Modify*', 'rds:Copy*', 'rds:Promote*'];

test('every historical RDS template rejects all deployments without a parameter escape', () => {
  let found = 0;
  for (const file of readdirSync(new URL('infrastructure/cloudformation/', root))) {
    if (!/\.ya?ml$/.test(file)) continue;
    const template = parse(`infrastructure/cloudformation/${file}`);
    if (!Object.values(template.Resources ?? {}).some((r) => r.Type?.startsWith('AWS::RDS::'))) continue;
    found++;
    const rule = template.Rules?.RdsPermanentlyRetired;
    assert.ok(rule, `${file} can provision RDS`);
    assert.equal(rule.RuleCondition, undefined, `${file} retirement must be unconditional`);
    assert.deepEqual(rule.Assertions[0].Assert, { 'Fn::Equals': ['rds-retired', 'rds-enabled'] });
  }
  assert.ok(found > 0, 'retained historical templates were examined');
});

test('database provisioning and bootstrap jobs cannot obtain AWS credentials or run', () => {
  for (const [file, job] of [['explore-production.yml', 'deploy-explore'], ['milestone-10-staging.yml', 'isolated-staging'], ['bootstrap-cbcap-agentic.yml', 'bootstrap']]) {
    const workflow = parse(`.github/workflows/${file}`);
    assert.equal(workflow.jobs[job].if, '${{ false }}', file);
    assert.notEqual(workflow.permissions?.['id-token'], 'write', file);
    for (const definition of Object.values(workflow.jobs)) assert.notEqual(definition.permissions?.['id-token'], 'write', file);
    const rejection = workflow.jobs['retired-release'] ?? workflow.jobs.finalize;
    assert.ok(rejection, `${file} must report a failed retired release`);
    assert.match(JSON.stringify(rejection), /exit 1|test .*BOOTSTRAP_RESULT.*success/);
  }
  for (const file of readdirSync(new URL('.github/workflows/', root))) {
    if (!/\.ya?ml$/.test(file)) continue;
    const text = source(`.github/workflows/${file}`);
    assert.doesNotMatch(text, /cost-controls-20261016|apply-cost-controls\.py/, file);
    for (const [name, job] of Object.entries(parse(`.github/workflows/${file}`).jobs)) {
      const commands = (job.steps ?? []).map((step) => step.run ?? '').join('\n');
      if (/aws\s+rds(?:-data)?\s|--template-file\s+infrastructure\/cloudformation\/evidence-core\.yml/.test(commands)) {
        assert.equal(job.if, '${{ false }}', `${file}:${name} contains an active RDS operation`);
      }
    }
  }
});

test('current policy sources prohibit database recreation in the caller and CloudFormation roles', () => {
  const bootstrap = parse('infrastructure/cloudformation/cbcap-agentic-deployment-bootstrap.yml');
  const policies = [JSON.parse(source('infrastructure/iam/github-amplify-bootstrap-policy.json'))];
  for (const role of Object.values(bootstrap.Resources)) {
    for (const policy of role.Properties?.Policies ?? []) policies.push(policy.PolicyDocument);
  }
  assert.equal(policies.length, 3);
  for (const policy of policies) {
    assert.ok(policy.Statement.some((s) => s.Effect === 'Deny' && s.Resource === '*' && denied.every((a) => list(s.Action).includes(a))));
    for (const s of policy.Statement.filter((s) => s.Effect === 'Allow')) {
      assert.ok(!list(s.Action).some((a) => /^rds:(?!Describe|List)/i.test(a) || /^rds-data:/i.test(a)), s.Sid);
      assert.notEqual(s.Sid, 'ManageEvidenceDatabaseSecret');
    }
  }
});

test('repository maintenance cannot automatically publish to AWS before the account review', () => {
  const workflow = parse('.github/workflows/deploy.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.jobs.deploy.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'");
  assert.match(source('.github/workflows/deploy.yml'), /evidence-deployment-environment\.mjs/);
  assert.match(source('.github/workflows/deploy.yml'), /sozorock-explore-collaboration-production/);
});
