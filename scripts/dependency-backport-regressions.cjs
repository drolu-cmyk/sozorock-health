const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

function checkForge(directory, forge = require(directory)) {
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 3 });
  const modulusBytes = Math.ceil(keys.publicKey.asymmetricKeyDetails.modulusLength / 8);
  const publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({ type: 'spki', format: 'pem' }));
  const privateKey = forge.pki.privateKeyFromPem(keys.privateKey.export({ type: 'pkcs1', format: 'pem' }));
  const message = Buffer.from('SozoRock dependency verification');
  const tlv = (tag, bytes, long = false) => Buffer.concat([
    Buffer.from(long ? [tag, 0x81, bytes.length] : [tag, bytes.length]), bytes,
  ]);
  const seq = (...items) => tlv(0x30, Buffer.concat(items));
  const sha256 = crypto.createHash('sha256').update(message).digest();
  const oid = Buffer.from('0609608648016503040201', 'hex');
  const nil = Buffer.from([5, 0]);
  const digest = tlv(4, sha256);
  const canonical = seq(seq(oid, nil), digest);
  const signature = info => {
    const padding = Buffer.alloc(modulusBytes - info.length - 3, 0xff);
    assert(padding.length >= 8);
    return crypto.privateEncrypt({ key: keys.privateKey, padding: crypto.constants.RSA_NO_PADDING },
      Buffer.concat([Buffer.from([0, 1]), padding, Buffer.from([0]), info])).toString('binary');
  };
  assert.equal(publicKey.verify(sha256.toString('binary'), signature(canonical)), true);
  assert.equal(publicKey.verify(sha256.toString('binary'), signature(seq(seq(oid), digest))), true);
  const malformed = [
    seq(seq(oid, nil, tlv(2, Buffer.from([8, 8]))), digest),
    seq(seq(oid, tlv(2, Buffer.from([8, 8]))), digest),
    seq(seq(oid, tlv(5, Buffer.from('garbage'))), digest),
    seq(seq(oid, nil), digest, tlv(2, Buffer.from([8]))),
    tlv(0x30, Buffer.concat([seq(oid, nil), digest]), true),
    seq(tlv(0x30, Buffer.concat([oid, nil]), true), digest),
    seq(seq(tlv(6, oid.subarray(2), true), nil), digest),
    seq(seq(oid, nil), tlv(4, sha256, true)),
    seq(seq(oid, tlv(5, Buffer.alloc(0), true)), digest),
    Buffer.concat([canonical, Buffer.from([0])]),
  ];
  for (const info of malformed) {
    let accepted = false;
    try { accepted = publicKey.verify(sha256.toString('binary'), signature(info)); } catch {}
    assert.equal(accepted, false, 'Malformed DigestInfo was accepted');
  }
  assert.equal(publicKey.verify(Buffer.alloc(32).toString('binary'), signature(canonical)), false);
  for (const algorithm of ['sha1', 'sha256', 'sha512']) {
    const md = forge.md[algorithm].create().update(message.toString('binary'));
    const signed = privateKey.sign(md);
    assert.equal(publicKey.verify(md.digest().getBytes(), signed), true);
  }
  const certificates = require('@expo/code-signing-certificates');
  const keyPair = { publicKey, privateKey };
  const certificate = certificates.generateSelfSignedCodeSigningCertificate({
    keyPair, commonName: 'Local verification fixture',
    validityNotBefore: new Date(Date.now() - 60_000),
    validityNotAfter: new Date(Date.now() + 60_000),
  });
  certificates.validateSelfSignedCertificate(certificate, keyPair);
  const signed = certificates.signBufferRSASHA256AndVerify(privateKey, certificate, message);
  assert(crypto.verify('sha256', message, keys.publicKey, Buffer.from(signed, 'base64')));
  const csr = certificates.generateCSR(keyPair, 'Local verification fixture');
  assert.equal(csr.verify(), true);
}

function checkBraces(directory) {
  const braces = require(directory);
  const nested = (depth, open = '{', close = '}') => open.repeat(depth) + 'a,b' + close.repeat(depth);
  for (const [open, close] of [['{', '}'], ['(', ')'], ['{(', ')}']]) {
    const limit = open.length === 2 ? 50 : 100;
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.doesNotThrow(() => braces[method](nested(limit, open, close)));
      assert.throws(() => braces[method](nested(limit + 1, open, close)), /exceeds max depth/);
      assert.throws(() => braces[method](nested(101), { maxDepth: Infinity }), /exceeds max depth/);
      assert.throws(() => braces[method](nested(101), { maxDepth: 10_000 }), /exceeds max depth/);
      assert.throws(() => braces[method](nested(2), { maxDepth: 1.5 }), /exceeds max depth/);
      assert.doesNotThrow(() => braces[method](nested(1), { maxDepth: 1.5 }));
    }
  }
  const ast = depth => {
    let node = { type: 'text', value: 'a' };
    for (let i = 0; i < depth; i++) node = { type: 'brace', nodes: [node] };
    return { type: 'root', nodes: [node] };
  };
  for (const method of ['compile', 'expand', 'stringify']) {
    assert.doesNotThrow(() => braces[method](ast(100)));
    assert.throws(() => braces[method](ast(101)), /exceeds max depth/);
    const cycle = { type: 'brace', nodes: [] }; cycle.nodes.push(cycle);
    assert.throws(() => braces[method](cycle), /exceeds max depth/);
  }
  const parent = { type: 'paren', nodes: [] }; parent.parent = parent;
  assert.throws(() => braces.expand(parent), /cycle/);
  assert.throws(() => braces.compile(nested(4096, '(', ')')), /exceeds max depth/);
  assert.deepEqual(braces.expand('file-{a,b}-{1..3}.js'), [
    'file-a-1.js', 'file-a-2.js', 'file-a-3.js', 'file-b-1.js', 'file-b-2.js', 'file-b-3.js',
  ]);
  assert.equal(braces.stringify('{{a,b},c}', { escapeInvalid: true }), '{{a,b},c}');
  assert.equal(braces.compile('src/{a,b}.js'), 'src/(a|b).js');
  const micromatch = require('micromatch');
  assert.deepEqual(micromatch(['src/a.js', 'src/b.js', 'src/c.ts'], 'src/{a,b}.js'), ['src/a.js', 'src/b.js']);
}

const [name, directory] = process.argv.slice(2);
try {
if (name === 'node-forge') {
  checkForge(path.resolve(directory));
  for (const file of ['forge.min.js', 'forge.all.min.js']) {
    const browser = { setTimeout, clearTimeout, crypto: crypto.webcrypto, jQuery: {} };
    browser.self = browser; browser.window = browser;
    vm.runInNewContext(fs.readFileSync(path.join(directory, 'dist', file), 'utf8'), browser, { timeout: 5000 });
    checkForge(path.resolve(directory), browser.forge);
  }
}
else if (name === 'braces') checkBraces(path.resolve(directory));
else throw new Error('Unknown dependency regression suite');
console.log(`${name}: malformed inputs rejected; compatibility checks passed.`);
} catch (error) {
  console.error(`${name}: regression failed: ${error.message}`);
  process.exitCode = 1;
}
