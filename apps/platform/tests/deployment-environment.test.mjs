import test from 'node:test';
import assert from 'node:assert/strict';
import { environmentMismatches } from '../../../scripts/verify-cbcap-environment.mjs';
const expected = {
  NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE: 'https://api.cbcap.sozorockfoundation.org',
  NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN: '',
  NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID: '',
  NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI: 'https://cbcap.sozorockfoundation.org/auth/callback',
};
test('public-only readback accepts omitted optional identity values without weakening required URLs', () => {
  const actual = {...expected};
  delete actual.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN;
  delete actual.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID;
  assert.deepEqual(environmentMismatches(actual, expected), []);
  actual.NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE = '';
  assert.deepEqual(environmentMismatches(actual, expected), ['NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE']);
});
test('stale or malformed identity values fail public-only verification', () => {
  for (const value of ['old-client', false, 0, {}]) {
    assert.deepEqual(environmentMismatches({...expected, NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID:value}, expected), ['NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID']);
  }
});
test('configured sign-in requires exact domain and client readback', () => {
  const configured = {...expected, NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN:'https://identity.example.org', NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID:'reviewedclient'};
  assert.deepEqual(environmentMismatches(configured, configured), []);
  assert.equal(environmentMismatches(expected, configured).length, 2);
  assert.throws(() => environmentMismatches(expected, {...expected, NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID:'partial'}), /Incomplete expected identity/);
});
test('required callback and malformed environment responses fail closed', () => {
  assert.deepEqual(environmentMismatches({...expected, NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI:'https://unexpected.example'}, expected), ['NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI']);
  for (const invalid of [null, [], 'unexpected']) assert.throws(() => environmentMismatches(invalid, expected), /Invalid environment response/);
  assert.deepEqual(environmentMismatches({...expected, UNRELATED_SETTING:'preserved'}, expected), []);
});
