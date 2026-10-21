import assert from 'node:assert/strict';
import test from 'node:test';
import { configuredAwsAccount } from './configured-aws-account.mjs';

test('deployment account checks use configured role authority and reject malformed roles', () => {
  const account = '1'.repeat(12);
  const authority = `arn:aws:ses:us-east-1:${account}:identity/example.invalid`;
  assert.equal(configuredAwsAccount(`arn:aws:iam::${account}:role/WebsiteDeploy`, authority), account);
  assert.equal(configuredAwsAccount(`arn:aws:iam::${account}:role/team!ops/WebsiteDeploy`, authority), account);
  assert.equal(configuredAwsAccount(`arn:aws:iam::${account}:role/${'x'.repeat(510)}/WebsiteDeploy`, authority), account);
  assert.throws(() => configuredAwsAccount(`arn:aws:iam::${account}:role/${'x'.repeat(511)}/WebsiteDeploy`, authority));
  assert.throws(() => configuredAwsAccount(`arn:aws:iam::${account}:role/${'x'.repeat(65)}`, authority));
  assert.throws(() => configuredAwsAccount(`arn:aws:iam::${'2'.repeat(12)}:role/WebsiteDeploy`, authority));
  assert.throws(() => configuredAwsAccount(`arn:aws:iam::${account}:role/WebsiteDeploy`));
  for (const arn of ['', undefined, `arn:aws:sts::${account}:assumed-role/WebsiteDeploy/session`,
    `arn:aws:iam::${account.slice(1)}:role/WebsiteDeploy`, `arn:aws:iam::${account}:user/WebsiteDeploy`]) {
    assert.throws(() => configuredAwsAccount(arn, authority));
  }
});
