import test from 'node:test';
import assert from 'node:assert/strict';
import { createGooglePublicationMailer } from '../app/lib/publication-mail.mjs';

const message = { from: 'contact@sozorockfoundation.org', to: 'reader@example.org', subject: 'Confirm publication access', text: 'A short-lived verification link', html: '<p>A short-lived verification link</p>' };
const credential = JSON.stringify({ user: message.from, pass: 'abcdefghijklmnop' });
function setup(overrides = {}) {
  const options = [], messages = [], reads = [];
  const send = createGooglePublicationMailer({ secretId: 'server-side-secret',
    getSecret: async id => { reads.push(id); return credential; },
    createTransport: settings => { options.push(settings); return { sendMail: async mail => { messages.push(mail); return { accepted: [message.to] }; } }; },
    ...overrides,
  });
  return { send, options, messages, reads };
}
test('Google delivery uses authenticated verified TLS and an aligned sender', async () => {
  const {send, options, messages} = setup(); await send(message);
  assert.equal(options[0].host, 'smtp.gmail.com'); assert.equal(options[0].port, 587);
  assert.equal(options[0].secure, false); assert.equal(options[0].requireTLS, true);
  assert.equal(options[0].tls.rejectUnauthorized, true); assert.equal(options[0].logger, false);
  assert.equal(options[0].disableFileAccess, true); assert.equal(options[0].disableUrlAccess, true);
  assert.deepEqual(messages[0].envelope, {from: message.from, to: [message.to]});
});
test('credentials are cached briefly and reloaded after rotation interval', async () => {
  let clock = 0; const run = setup({now: () => clock});
  await run.send(message); await run.send(message); assert.equal(run.reads.length, 1);
  clock = 300001; await run.send(message); assert.equal(run.reads.length, 2);
});
test('rejects sender mismatch and header injection before transmission', async () => {
  const run = setup();
  await assert.rejects(run.send({...message, from: 'other@sozorockfoundation.org'}));
  await assert.rejects(run.send({...message, subject: 'Title\r\nBcc: other@example.org'}));
  assert.equal(run.messages.length, 0);
});
test('provider rejection is not reported as successful delivery', async () => {
  const run = setup({createTransport: () => ({sendMail: async () => ({accepted: []})})});
  await assert.rejects(run.send(message), {name: 'PublicationDeliveryError'});
});
test('errors cannot leak provider messages, recipients or credentials', async () => {
  const run = setup({getSecret: async () => {throw new Error('secret or private email');}});
  await assert.rejects(run.send(message), error => error.message === 'Google publication delivery failed' && !error.cause);
});
test('invalid credentials cannot select another SMTP server or send anonymously', async () => {
  const run = setup({getSecret: async () => JSON.stringify({user: 'attacker@example.org', pass:'abcdefghijklmnop', host:'untrusted.example'})});
  await assert.rejects(run.send(message)); assert.equal(run.options.length, 0);
});
