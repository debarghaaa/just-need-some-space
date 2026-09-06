/**
 * Session cookie attributes shared by the browser, server and middleware clients (spec 46.19).
 *
 * - Secure in production: the cookie is only ever sent over HTTPS (Vercel terminates TLS).
 *   Locally the app runs on http://localhost, where a Secure cookie would never be stored.
 * - SameSite=None + Partitioned in production. The app is also opened inside a frame on another
 *   site (the sandbox preview embeds it), and in that cross-site context browsers refuse to store or
 *   send a SameSite=Lax cookie. Guest entry then signed in, moved on, the server saw no session and
 *   sent the visitor back to /enter: one new guest every second and a loading screen that never
 *   ended. Partitioned (CHIPS) keys the cookie to the embedding site, so it also works where
 *   third-party cookies are blocked; opened directly, it behaves like an ordinary first-party
 *   cookie. CSRF protection does not rest on SameSite: every state-changing route checks Origin /
 *   Sec-Fetch-Site and accepts JSON bodies only. Development keeps SameSite=Lax because None
 *   requires Secure, which plain http does not have.
 * - Path=/ so every route sees the session.
 * - HttpOnly is NOT set. This is a Supabase SSR design constraint, not an oversight: the browser
 *   client (`createBrowserClient`) reads and refreshes the session from the same cookie so that
 *   guest sign-in, "keep this explorer" and log out work without a custom token relay. Mitigation:
 *   the CSP forbids third-party scripts and the app never renders user content as HTML.
 */
export function sessionCookieOptions(production: boolean) {
  return {
    /**
     * One explicit name for every client. Without it @supabase/ssr derives the name from the URL
     * each client was created with (`sb-<first hostname label>-auth-token`). The browser client
     * behind a preview proxy talks to the same-origin `/local-backend` rewrite while the server
     * talks to the stack directly, so the two ended up with different names, the server never saw
     * the session and every game page bounced back to /enter in a loop that looked like an endless
     * loading screen. A fixed name makes the browser, server and middleware agree everywhere.
     */
    name: 'jnss-auth',
    path: '/',
    sameSite: production ? ('none' as const) : ('lax' as const),
    secure: production,
    partitioned: production,
  };
}

export const AUTH_COOKIE_OPTIONS = sessionCookieOptions(process.env.NODE_ENV === 'production');
