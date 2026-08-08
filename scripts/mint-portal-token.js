/**
 * Mints a portal hand-off token for local testing.
 *
 * Development only. In production the REPL portal does this server-side, taking
 * the employee code from its own session user — this script exists because there
 * is no portal in front of `npm run dev`, so there is nothing to hand a token
 * over. It is deliberately not imported by the app: the AES key must never reach
 * the browser bundle, since a key in page source is a key anyone can mint tokens
 * with.
 *
 * The format matches the portal's encryptEmpCode() and what
 * PortalTokenService.empCodeFrom() reads back:
 *
 *   base64url( AES-128-CBC( "empCode|timestampMillis" ) ), IV = the key bytes
 *
 * Usage:
 *   node scripts/mint-portal-token.js 101099
 *   node scripts/mint-portal-token.js 101099 --expired     # 11 minutes old
 *   node scripts/mint-portal-token.js 101099 --key OTHER_16_BYTE_KEY
 *
 * The key must match portal.token.secret in the backend's application.properties.
 */

// import, not require: package.json sets "type": "module", so a .js file here is
// an ES module.
import crypto from 'node:crypto';

const DEFAULT_KEY = 'REPL_EOB_2024_SK';
const DEFAULT_ORIGIN = 'http://localhost:5173';
const BASE_PATH = '/compliance';

// Must stay past the backend's window (TOKEN_VALIDITY_MS in PortalTokenService,
// currently 30 minutes) or --expired quietly mints a perfectly valid token and
// the refusal path goes untested.
const EXPIRED_AGE_MS = 31 * 60 * 1000;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const empCode = process.argv[2];
const key = arg('key', DEFAULT_KEY);
const origin = arg('origin', DEFAULT_ORIGIN);
const issuedAt = process.argv.includes('--expired')
  ? Date.now() - EXPIRED_AGE_MS
  : Date.now();

if (!empCode || !/^\d+$/.test(empCode)) {
  console.error('Usage: node scripts/mint-portal-token.js <empCode> [--expired] [--key KEY] [--origin URL]');
  process.exit(1);
}

// AES-128 takes exactly 16 bytes and the portal reuses them as the IV, so a key
// of any other length fails here rather than producing a token the backend will
// only reject later with a misleading "could not be decrypted".
const keyBytes = Buffer.from(key, 'utf8');
if (keyBytes.length !== 16) {
  console.error(`Key must be exactly 16 bytes for AES-128; "${key}" is ${keyBytes.length}.`);
  process.exit(1);
}

const cipher = crypto.createCipheriv('aes-128-cbc', keyBytes, keyBytes);
const token = Buffer
  .concat([cipher.update(`${empCode}|${issuedAt}`, 'utf8'), cipher.final()])
  // 'base64url' already emits the unpadded form the portal produces, which is
  // what Java's Base64.getUrlDecoder() reads on the other side.
  .toString('base64url');

console.log(`\nemp code : ${empCode}`);
console.log(`issued   : ${new Date(issuedAt).toLocaleString()}${issuedAt < Date.now() - 1000 ? '  (deliberately stale)' : ''}`);
console.log(`token    : ${token}`);
console.log(`\nOpen:  ${origin}${BASE_PATH}/${token}\n`);
