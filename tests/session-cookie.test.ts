import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AUTH_COOKIE_OPTIONS, sessionCookieOptions } from '@/lib/supabase/cookies';
import { LOADING_WORD } from '@/components/site/LoadingScreen';

describe('session cookie', () => {
  it('uses one explicit cookie name so browser, server and middleware clients always agree', () => {
    // Without a fixed name @supabase/ssr derives it from each client's URL. Behind the preview
    // proxy the browser client uses the same-origin /local-backend rewrite while the server uses
    // the stack URL, so the names diverged and every game page bounced back to /enter forever.
    expect(AUTH_COOKIE_OPTIONS.name).toBe('jnss-auth');
    expect(AUTH_COOKIE_OPTIONS.path).toBe('/');
    expect(AUTH_COOKIE_OPTIONS.sameSite).toBe('lax');
    for (const f of ['src/lib/supabase/browser.ts', 'src/lib/supabase/server.ts', 'src/lib/supabase/middleware.ts']) {
      expect(readFileSync(f, 'utf8').includes('cookieOptions: AUTH_COOKIE_OPTIONS')).toBe(true);
    }
    // the security probes forge sessions under the same name
    expect(readFileSync('scripts/security-probes.mjs', 'utf8').includes("const COOKIE = 'jnss-auth'")).toBe(true);
  });

  it('survives being opened inside a frame on another site (the preview embeds the app)', () => {
    // A SameSite=Lax cookie is neither stored nor sent in a cross-site frame, so guest entry signed
    // in, the server saw nothing and bounced the visitor back to /enter forever. Production uses
    // SameSite=None; Secure; Partitioned; development stays Lax because None requires HTTPS.
    const prod = sessionCookieOptions(true);
    expect(prod).toMatchObject({ name: 'jnss-auth', path: '/', sameSite: 'none', secure: true, partitioned: true });
    const dev = sessionCookieOptions(false);
    expect(dev).toMatchObject({ name: 'jnss-auth', path: '/', sameSite: 'lax', secure: false, partitioned: false });
    // guest entry stops after one attempt instead of looping when the cookie does not come back
    const entry = readFileSync('src/components/site/GuestEntry.tsx', 'utf8');
    expect(entry.includes('sessionCookieStored()')).toBe(true);
    expect(entry.includes('recentAttempt()')).toBe(true);
  });
});

describe('loading screen', () => {
  it('shows only the one requested word', () => {
    expect(LOADING_WORD).toBe('HARNESSMOGGING');
    const src = readFileSync('src/components/site/LoadingScreen.tsx', 'utf8');
    expect(src.includes("'use client'")).toBe(false); // no client JavaScript, nothing to wait for
    expect(src.includes('nextLoadingLine')).toBe(false);
    expect(src.includes('setInterval')).toBe(false);
  });
});
