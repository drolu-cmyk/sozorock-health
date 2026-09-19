import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const templateUrl = new URL('../../../infrastructure/cloudformation/cbcap-agentic-deployment-bootstrap.yml', import.meta.url);
const workflowUrl = new URL('../../../.github/workflows/bootstrap-cbcap-agentic.yml', import.meta.url);
const bootstrapAuthorityPolicyUrl = new URL('../../../infrastructure/iam/github-cbcap-agentic-bootstrap-authority-policy.json', import.meta.url);

test('CB-CAP deployment role can inspect the cluster before fail-closed shutdown', async () => {
  const template = await readFile(templateUrl, 'utf8');
  assert.match(template, /- ecs:DescribeClusters/);
  assert.match(template, /- ecs:UpdateService/);
});

test('CB-CAP deployment role can resolve only the governed contact-stack model reference', async () => {
  const template = await readFile(templateUrl, 'utf8');
  assert.match(template, /- Sid: ReadGovernedModelSecretReference/);
  assert.match(template, /Action: cloudformation:DescribeStacks/);
  assert.match(template, /stack\/sozorock-health-contact\/\*/);
  assert.match(template, /- secretsmanager:DescribeSecret/);
  assert.match(template, /- cognito-idp:DescribeUserPoolDomain/);
});

test('CB-CAP failed-first-create recovery authority is bounded and recoverable', async () => {
  const template = await readFile(templateUrl, 'utf8');
  const workflow = await readFile(workflowUrl, 'utf8');
  const deployRole = template.slice(template.indexOf('  GitHubDeployRole:'));
  assert.match(template, /FailedFirstCreateStackArn:/);
  assert.match(template, /FailedFirstCreateUserPoolArn:/);
  assert.match(deployRole, /Sid: DeleteExactFailedFirstCreateStack[\s\S]*Resource: !Ref FailedFirstCreateStackArn/);
  assert.match(deployRole, /Sid: UpdateExactFailedFirstCreateUserPool[\s\S]*Resource: !Ref FailedFirstCreateUserPoolArn/);
  assert.match(workflow, /FAILED_FIRST_CREATE_STACK_ARN: arn:aws:cloudformation:us-east-1:791860731989:stack\/cbcap-agentic-production\/[0-9a-f-]{36}/);
  assert.match(workflow, /FAILED_FIRST_CREATE_USER_POOL_ARN: arn:aws:cognito-idp:us-east-1:791860731989:userpool\/[A-Za-z0-9_-]+/);
  assert.match(workflow, /FailedFirstCreateStackArn="\$FAILED_FIRST_CREATE_STACK_ARN"/);
  assert.match(workflow, /FailedFirstCreateUserPoolArn="\$FAILED_FIRST_CREATE_USER_POOL_ARN"/);
  assert.doesNotMatch(deployRole, /secretsmanager:DeleteSecret/);
  assert.doesNotMatch(deployRole, /logs:DeleteLogGroup/);
  assert.doesNotMatch(deployRole, /kms:ScheduleKeyDeletion/);
  assert.doesNotMatch(deployRole, /cognito-idp:.*:userpool\/\*/);
});

test('newest approved CB-CAP bootstrap supersedes stale queued bootstrap requests', async () => {
  const workflow = await readFile(workflowUrl, 'utf8');
  const template = await readFile(templateUrl, 'utf8');
  assert.match(workflow, /group: cbcap-agentic-bootstrap-production/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /repo:drolu-cmyk@271617784\/sozorock-health-agentic@1313269615:environment:production/);
  assert.match(template, /token\.actions\.githubusercontent\.com:sub: !Ref GitHubSubject/);
});

test('one-time CB-CAP bootstrap authority is restricted to the bootstrap stack and two exact roles', async () => {
  const policy = JSON.parse(await readFile(bootstrapAuthorityPolicyUrl, 'utf8'));
  const statements = policy.Statement;
  assert.equal(statements.length, 2);

  const stackStatement = statements.find((statement) => statement.Sid === 'ManageOnlyCbcapAgenticBootstrapStack');
  assert.ok(stackStatement);
  assert.deepEqual(stackStatement.Resource, [
    'arn:aws:cloudformation:us-east-1:791860731989:stack/cbcap-agentic-deployment-bootstrap/*',
    'arn:aws:cloudformation:us-east-1:791860731989:changeSet/*/*',
  ]);
  assert.ok(stackStatement.Action.includes('cloudformation:DescribeStacks'));
  assert.ok(stackStatement.Action.includes('cloudformation:CreateStack'));
  assert.ok(!stackStatement.Action.includes('cloudformation:DeleteStack'));

  const roleStatement = statements.find((statement) => statement.Sid === 'CreateOnlyCbcapAgenticBootstrapRoles');
  assert.ok(roleStatement);
  assert.deepEqual(roleStatement.Resource, [
    'arn:aws:iam::791860731989:role/cbcap-agentic-cloudformation',
    'arn:aws:iam::791860731989:role/cbcap-agentic-github-deploy',
  ]);
  assert.ok(roleStatement.Action.includes('iam:CreateRole'));
  assert.ok(roleStatement.Action.includes('iam:PutRolePolicy'));
  assert.ok(!roleStatement.Action.includes('iam:PassRole'));
  assert.ok(!roleStatement.Action.includes('iam:AttachRolePolicy'));
});
