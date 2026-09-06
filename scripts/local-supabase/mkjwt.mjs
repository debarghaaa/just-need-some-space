// Mints the anon / service_role JWTs for the local stack, the same shape Supabase issues.
// usage: node mkjwt.mjs <secret> <role>
import { createHmac } from 'node:crypto';

const [secret, role] = process.argv.slice(2);
if (!secret || !role) {
  console.error('usage: mkjwt.mjs <secret> <role>');
  process.exit(1);
}
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64({ alg: 'HS256', typ: 'JWT' });
const payload = b64({ iss: 'supabase-local', ref: 'local', role, iat: now, exp: now + 60 * 60 * 24 * 365 * 5 });
const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
process.stdout.write(`${header}.${payload}.${sig}`);
