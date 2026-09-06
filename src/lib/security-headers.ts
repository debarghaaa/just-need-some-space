/**
 * Content Security Policy (spec 46.10 / 46.18). Built per request in the middleware because
 * script-src uses a nonce: Next.js reads the nonce from the request's Content-Security-Policy
 * header and stamps it on every script it emits (bootstrap chunks and the inline RSC payload).
 *
 * Directive notes (the documented exceptions):
 *  - script-src: 'self' + nonce + 'strict-dynamic'. No 'unsafe-inline', no 'unsafe-eval', no
 *    third-party script hosts (fonts are self-hosted, there is no analytics or chat widget).
 *  - style-src 'unsafe-inline': React server-renders `style=` attributes for pixel positioning
 *    and a nonce cannot cover attributes. CSS injection is not reachable anyway: no user content
 *    is ever rendered as HTML or CSS. This is the one relaxation and it is deliberate.
 *  - img-src data: blob:: rocket and astronaut sprites are drawn on canvases and exported as data
 *    URLs; there are no remote images.
 *  - connect-src: this origin plus the Supabase project (https + wss for Realtime). Nothing else.
 *  - frame-ancestors 'none': the app is never embedded. object-src 'none', base-uri 'self',
 *    form-action 'self' close the remaining injection sinks.
 *  - upgrade-insecure-requests only when the backend itself is https (production); the local
 *    stack is plain http on the loopback interface.
 */
export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function buildCsp(nonce: string, backendUrl: string | null): string {
  const connect = ["'self'"];
  let secureBackend = false;
  if (backendUrl) {
    try {
      const u = new URL(backendUrl);
      connect.push(u.origin);
      connect.push(`${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}`);
      secureBackend = u.protocol === 'https:';
    } catch {
      // Misconfigured URL: the app already renders "backend not configured"; keep the policy tight.
    }
  }
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "media-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (secureBackend) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}
