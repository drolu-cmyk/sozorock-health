import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const optionalKeys = new Set(['NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN', 'NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID']);
const keys = ['NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE', ...optionalKeys, 'NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI'];

export function environmentMismatches(actual, expected) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) throw new Error('Invalid environment response');
  for (const key of keys) {
    if (typeof expected[key] !== 'string' || (!optionalKeys.has(key) && !expected[key])) throw new Error('Incomplete expected environment');
  }
  if (Boolean(expected.NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN) !== Boolean(expected.NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID)) throw new Error('Incomplete expected identity');
  return keys.filter(key => {
    const value = optionalKeys.has(key) && actual[key] == null ? '' : actual[key];
    return value !== expected[key];
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const expected = {
      NEXT_PUBLIC_CBCAP_AGENTIC_API_BASE: process.env.CBCAP_AGENTIC_API_BASE,
      NEXT_PUBLIC_CBCAP_COGNITO_DOMAIN: process.env.CBCAP_COGNITO_DOMAIN || '',
      NEXT_PUBLIC_CBCAP_COGNITO_CLIENT_ID: process.env.CBCAP_COGNITO_CLIENT_ID || '',
      NEXT_PUBLIC_CBCAP_COGNITO_REDIRECT_URI: process.env.CBCAP_COGNITO_CALLBACK_URI,
    };
    const mismatches = environmentMismatches(JSON.parse(readFileSync(0, 'utf8')), expected);
    if (mismatches.length) {
      console.error(`Environment readback differs for keys: ${mismatches.join(', ')}`);
      process.exitCode = 1;
    }
  } catch {
    console.error('Environment verification requires valid JSON and complete expected configuration.');
    process.exitCode = 1;
  }
}
