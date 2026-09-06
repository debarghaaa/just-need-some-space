import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { logEvent } from '@/server/errors';
import { clientIp, consume } from '@/server/limits';

export const dynamic = 'force-dynamic';

/**
 * GET /auth/callback  (route contract, spec 46.24)
 *
 * Who:       anyone following an email link issued by Supabase Auth (confirmation, recovery).
 * Input:     ?code=<PKCE code> and optional ?next=<same-origin path>.
 * Effect:    exchanges the code for a session cookie (Supabase does the verification; the code is
 *            single-use and bound to the PKCE verifier cookie set when the flow started) and
 *            redirects to `next`, which must be a relative path on this site.
 * Frequency: 20 / 10 min / IP. Only email links produce these requests.
 * Failure:   redirect to /login?error=link. No detail about why is disclosed.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Redirect relative to the origin the browser used (behind Vercel's proxy that is the forwarded host),
  // never the address the server process is bound to.
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? url.host).split(',')[0].trim();
  const proto = (request.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')).split(',')[0].trim();
  const origin = /^[a-z0-9.:\[\]-]+$/i.test(host) && /^https?$/.test(proto) ? `${proto}://${host}` : url.origin;
  const to = (path: string) => NextResponse.redirect(new URL(path, origin), { headers: { 'cache-control': 'no-store' } });

  if (!consume('AUTH_CALLBACK_PER_IP', clientIp(request)).ok) return to('/login?error=busy');

  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));
  if (code && code.length <= 512) {
    const supabase = await getServerSupabase();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return to(next);
      logEvent('warn', 'auth.callback_failed', { reason: error.name });
    }
  }
  return to('/login?error=link');
}

/** Same-origin relative paths only: no protocol-relative (`//evil`), no backslash tricks, no schemes. */
function safeNext(raw: string | null): string {
  if (!raw || raw.length > 512) return '/universe';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || /[\\\r\n]/.test(raw)) return '/universe';
  try {
    const u = new URL(raw, 'https://placeholder.invalid');
    if (u.origin !== 'https://placeholder.invalid') return '/universe';
    return u.pathname + u.search;
  } catch {
    return '/universe';
  }
}
