'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LinkButton } from '@/components/ui';
import { LoadingScreen } from '@/components/site/LoadingScreen';
import { COPY } from '@/game/copy';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase/cookies';

function sessionCookieStored(): boolean {
  // @supabase/ssr splits large sessions into `<name>.0`, `<name>.1`, ... chunks.
  return new RegExp(`(^|;\\s*)${AUTH_COOKIE_OPTIONS.name}(\\.\\d+)?=`).test(document.cookie);
}

/**
 * Loop guard. A game page sends visitors without a session back here; if that happens again
 * seconds after a session was issued, the browser holds a cookie the server never receives, and
 * retrying would only issue guest after guest behind a loading screen that never ends.
 */
const ATTEMPT_KEY = 'jnss-enter-attempt';
const ATTEMPT_WINDOW_MS = 15_000;
function recentAttempt(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(ATTEMPT_KEY) ?? 0) < ATTEMPT_WINDOW_MS;
  } catch {
    return false;
  }
}
function markAttempt(): void {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()));
  } catch {
    // storage unavailable: no guard, the cookie check below still applies
  }
}

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/universe';
  return raw;
}

/**
 * Guest entry: creates an anonymous Supabase user (a real account row, real RLS, no email) and
 * sends the visitor on. While the session is issued the page shows the one-word loading screen.
 * If the backend refuses anonymous sign-ins the failure is shown plainly with the normal login and
 * sign-up routes.
 */
export function GuestEntry() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const sb = getBrowserSupabase();
    if (!sb) { setError('Backend not configured.'); return; }
    (async () => {
      if (recentAttempt() && sessionCookieStored()) { setError(COPY.guest.bounced); return; }
      const { data: existing } = await sb.auth.getSession();
      let signedIn = false;
      if (existing.session) {
        // The server has to accept this session too (a stale one would bounce straight back here).
        signedIn = !(await sb.auth.getUser()).error;
        if (!signedIn) await sb.auth.signOut({ scope: 'local' });
      }
      if (!signedIn) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) { setError(error.message); return; }
        // The session travels in a cookie the server must see on the next request. If the browser
        // refused to store it (cookies blocked for this site), the destination would only send the
        // visitor straight back here: stop after this one attempt and say so instead of looping.
        if (!sessionCookieStored()) { setError(COPY.guest.blocked); return; }
      }
      markAttempt();
      // Full document navigation on purpose: the client router may hold a prefetched copy of the
      // target that was fetched before the session existed (a redirect back here).
      window.location.replace(next);
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, [next]);

  if (error) {
    return (
      <div className="wrap-narrow section" style={{ textAlign: 'center' }}>
        <h1>{COPY.guest.failed.head}</h1>
        <p className="lede" style={{ marginInline: 'auto' }}>{COPY.guest.failed.sub}</p>
        <p className="mono small muted">{error}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
          <LinkButton href={`/login?next=${encodeURIComponent(next)}`} variant="primary">Log in</LinkButton>
          <LinkButton href="/signup" variant="ghost">Create account</LinkButton>
          <LinkButton href="/" variant="ghost">Home</LinkButton>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap">
      <LoadingScreen />
      <p className="small muted" style={{ textAlign: 'center', marginTop: '-1rem' }}>
        <span className="display-xs" style={{ color: 'var(--color-text-secondary)' }}>{COPY.guest.entering.head}</span> {COPY.guest.entering.sub}
      </p>
    </div>
  );
}
