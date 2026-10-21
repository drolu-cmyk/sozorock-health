import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function roleAccount(roleArn) {
  const match = /^arn:aws:iam::([0-9]{12}):role\/([\x21-\x7e]+)$/.exec(roleArn ?? '');
  assert(match, 'A configured IAM deployment role is required');
  const resource = match[2];
  const lastSlash = resource.lastIndexOf('/');
  const roleName = resource.slice(lastSlash + 1);
  const rolePath = '/' + resource.slice(0, lastSlash + 1);
  assert(/^[A-Za-z0-9+=,.@_-]{1,64}$/.test(roleName) && rolePath.length <= 512,
    'The configured IAM role path or name is invalid');
  return match[1];
}

export function configuredAwsAccount(roleArn, authorityArn) {
  const actual = roleAccount(roleArn);
  const identity = /^arn:aws:ses:[a-z0-9-]+:([0-9]{12}):identity\/[\x21-\x7e]+$/.exec(authorityArn ?? '');
  const expected = identity ? identity[1] : roleAccount(authorityArn);
  assert.equal(actual, expected, 'The deployment role differs from the independently configured account');
  return expected;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(configuredAwsAccount(process.env.EXPECTED_DEPLOY_ROLE_ARN, process.env.EXPECTED_ACCOUNT_AUTHORITY_ARN)); }
  catch { console.error('The configured deployment role is invalid.'); process.exitCode = 1; }
}
