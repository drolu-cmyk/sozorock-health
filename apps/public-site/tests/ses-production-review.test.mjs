import test from 'node:test';
import assert from 'node:assert/strict';
import { productionReviewAction } from '../../../scripts/ses-production-review.mjs';
const account = status => ({ProductionAccessEnabled:false, Details:{ReviewDetails:{Status:status}}});
test('pending and denied SES reviews never submit duplicate production requests', () => {
  assert.equal(productionReviewAction(account('PENDING')), 'PENDING');
  assert.equal(productionReviewAction(account('DENIED')), 'DENIED');
});
test('only absent or failed reviews permit the established access request', () => {
  assert.equal(productionReviewAction(account(undefined)), 'REQUEST');
  assert.equal(productionReviewAction(account('FAILED')), 'REQUEST');
  assert.equal(productionReviewAction(account('unexpected')), 'INVALID');
  assert.equal(productionReviewAction({}), 'INVALID');
});
test('review approval alone is not production activation', () => {
  assert.equal(productionReviewAction(account('GRANTED')), 'AWAITING_ACTIVATION');
  assert.equal(productionReviewAction({...account('GRANTED'), ProductionAccessEnabled:true}), 'READY');
});
