import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function productionReviewAction(account) {
  if (account?.ProductionAccessEnabled === true) return 'READY';
  if (account?.ProductionAccessEnabled !== false) return 'INVALID';
  const status = account.Details?.ReviewDetails?.Status;
  if (status == null || status === 'FAILED') return 'REQUEST';
  if (status === 'PENDING' || status === 'DENIED') return status;
  if (status === 'GRANTED') return 'AWAITING_ACTIVATION';
  return 'INVALID';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(productionReviewAction(JSON.parse(readFileSync(0, 'utf8')))); }
  catch { console.error('Cannot read SES account review state.'); process.exitCode = 1; }
}
