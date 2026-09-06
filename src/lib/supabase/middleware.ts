import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicBackendConfig } from '@/lib/env';
import { buildCsp, makeNonce } from '@/lib/security-headers';
import { AUTH_COOKIE_OPTIONS } from './cookies';

const GAME_PREFIXES = ['/universe', '/system', '/planet', '/rocket', '/codex', '/profile', '/settings', '/onboarding', '/customize'];
const AUTH_PAGES = ['/login', '/signup'];

/**
 * Runs on every page and API request:
 *  1. builds the per-request Content-Security-Policy (nonce) and forwards it to the renderer,
 *  2. refreshes the Supabase session cookie,
 *  3. sends visitors without a session who open a game route to /enter (guest entry), and
 *     signed-in permanent players away from the login / signup pages.
 *
 * Login is not required to play: /enter issues a guest session (Supabase anonymous sign-in) and
 * continues to the requested page. Guests are real rows with real RLS; they can attach an email later.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const cfg = getPublicBackendConfig();
  const nonce = makeNonce();
  const csp = buildCsp(nonce, cfg?.url ?? null);

  // Request headers seen by the app: Next.js reads the nonce from Content-Security-Policy.
  // Built lazily so cookie refreshes performed below are included in the forwarded `cookie` header.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp);
    return NextResponse.next({ request: { headers } });
  };
  const finish = (res: NextResponse) => {
    res.headers.set('content-security-policy', csp);
    return res;
  };

  const { pathname } = request.nextUrl;
  const isGame = GAME_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!cfg) {
    // No backend: game pages render their own "backend not configured" notice.
    return finish(next());
  }

  let response = next();
  const supabase = createServerClient(cfg.url, cfg.anonKey, {
    cookieOptions: AUTH_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isGame) {
    const url = request.nextUrl.clone();
    url.pathname = '/enter';
    url.search = '';
    url.searchParams.set('next', pathname + request.nextUrl.search);
    return finish(NextResponse.redirect(url));
  }
  if (user && !isAnonymous(user) && AUTH_PAGES.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/universe';
    url.search = '';
    return finish(NextResponse.redirect(url));
  }
  return finish(response);
}

function isAnonymous(user: { is_anonymous?: boolean; email?: string | null }): boolean {
  return Boolean(user.is_anonymous) || !user.email;
}
