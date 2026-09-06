# JUST NEED SOME SPACE. : security and deployment hardening (section 46)

This document records what is enforced, where it is enforced, how it was verified, and what the
platform cannot do. Nothing below is aspirational: every checked item has code or SQL behind it and
was exercised against the production build (`node scripts/security-probes.mjs`, 73 probes, plus
the guest end-to-end flow).

Last verified: 2026-09-05 against `next build` + `next start`, local Supabase-compatible stack
(real GoTrue + PostgREST + PostgreSQL 17) with migrations 0001 to 0004 applied.

## 1. Architecture in one paragraph

Identity comes from the Supabase session cookie only. Every API route runs the same prologue:
Origin check (state-changing methods) -> per-IP limit -> `requireActor()` (session -> user id,
service client) -> per-player limit -> size-limited JSON object body -> action enum -> allow-listed
keys -> typed validators. Progression writes go through `SECURITY DEFINER` Postgres functions that
read point values from `point_rules` and are idempotent per `(player, event, source)`. Row level
security is on for every table and the `anon` role has no table privileges at all. Players see
in-tone errors; the server logs one redacted JSON line per failure.

## 2. Route contracts (46.24)

| Route | Methods | Who | Input | Reads | Writes | Limits |
|---|---|---|---|---|---|---|
| `POST /api/game` | POST only (others 405) | signed-in player | `{action, systemId\|planetId, siteIndex\|nodeIndex}`; game ids re-derived from the seed | discoveries, collections | systems, planets, discoveries, collections, inventory, point_events, player_profiles (via RPC) | 60/min, 40 point actions/min, 250/10 min |
| `POST /api/profile` | POST only | signed-in player | onboard / save_rocket / save_customization / update / delete_account; catalogue ids only | own profile, own rocket | own profile display fields, own rocket, own auth user (delete) | 12/min; delete 3/h |
| `POST, DELETE /api/presence` | others 405 | signed-in player | location game ids, clamped x/y, facing, `wave` | others' presence + public profile/rocket cosmetics | own presence row | 60/min |
| `GET, POST /api/friends` | others 405 | signed-in player | uuids only | own friendships | friendships where caller is a party | invites 10/10 min, ops 30/min, reads 60/min |
| `GET /api/health` | GET | anyone | none | none | one 2.5 s GET to the auth service health endpoint | shared IP limit not applied (uptime probe); discloses only `backend` mode and a boolean `backendUp`; 503 when the backend does not answer |
| `GET /auth/callback` | GET | email-link follower | `code`, same-origin `next` | Supabase code exchange | session cookie | 20/10 min/IP |

All routes share a 240 requests/min/IP ceiling and an 8 KB body cap (`src/server/limits.ts`).
Every constant is documented next to its value and can be tuned without touching route code.

## 3. Checklists

### 46.27 Database security

- [x] RLS enabled on all 12 tables (`pg_class.relrowsecurity` verified).
- [x] Every policy reviewed: 23 policies, each scoped to `auth.uid()` or an explicit public read
      (`profiles`, `rockets`, `systems`, `planets`, `resources`, `point_rules`, `discoveries`, `presence`
      are readable by signed-in players because the game shows them; nothing is world-readable).
      No `using (true)` write policies exist.
- [x] No cross-user access: probes read another player's `inventory` and `point_events` (empty),
      patched another player's profile and rocket (0 rows), re-owned discoveries (permission denied).
- [x] Privileged credentials server-only: `SUPABASE_SERVICE_ROLE_KEY` read in one `server-only`
      module; client bundle grep for the key value, the variable name and `service_role` returned 0 hits.
- [x] Foreign keys, uniques, indexes: every FK column now has an index (0003); uniques on username,
      `(player, discovery_type, entity)`, `(player, event, source)`, `(requester, receiver)`.
- [x] Points unforgeable: direct `PATCH points` -> `42501` from the guard trigger; `award_points` and
      friends executable by `service_role` only; `point_events` / `inventory` / `collections` /
      `discoveries` have no client write privilege and no client write policy.
- [x] Discovery ownership fixed: no update policy or privilege on `discoveries`.
- [x] Inventory: written only by `collect_node`; quantities come from the seeded node, not the client.
- [x] `anon` role: zero table privileges; direct anon read of `player_profiles` -> 401.
- [x] Reference tables (`systems`, `planets`, `resources`, `point_rules`) read-only for players.
- [x] Codex view runs as `security_invoker` (reader's own RLS).
- [x] Migration 0003 is idempotent and was applied twice locally without error.

### 46.28 Secret security

- [x] No hardcoded secrets: working-tree scan (source, `.env*`, config, JSON/YAML, scripts, docs)
      for key/token/password patterns and JWT shapes found only the gitignored, machine-generated
      `.env.local` for the local stack.
- [x] `.env`, `.env.local`, `.env*.local`, `.vercel`, `scripts/local-supabase/.run` are gitignored.
- [x] `.env.example` contains names and placeholders only, split into PUBLIC and SERVER ONLY.
- [x] Client bundle clean (see above); browser source maps off (`productionBrowserSourceMaps: false`, 0 `.map` files in `.next/static`).
- [x] `UNIVERSE_SEED` is documented as configuration, not a secret (it is handed to the renderer by design).
- [ ] Commit history scan: **not possible here**. This workspace has no `.git` directory. Before the
      first push, run `gitleaks detect --source .` (or GitHub secret scanning on the repo). If a real
      key was ever committed anywhere, rotate it in the Supabase dashboard; rotation is the only fix.

### 46.29 Web security

- [x] HTTPS: Vercel terminates TLS; HSTS `max-age=63072000; includeSubDomains` is sent
      (`preload` deliberately omitted: submitting the domain to the preload list is the owner's call).
- [x] Cookies: `Secure`, `SameSite=None`, `Partitioned` (production; `SameSite=Lax` on plain-http
      localhost), `Path=/` and one fixed name (`jnss-auth`) on the session cookie via a shared
      `AUTH_COOKIE_OPTIONS`; verified on a refreshed session response. `None` + `Partitioned` because the
      app is also opened inside a frame on another site (preview embeds), where a `Lax` cookie is never
      stored and guest entry looped; CSRF protection rests on the Origin check, not on SameSite. The
      fixed name matters: `@supabase/ssr` otherwise derives the name from each client's URL, and behind
      a proxy the browser and server clients can disagree, leaving the server blind to the session.
      `HttpOnly` is **not** set: `@supabase/ssr` needs the browser client to read the session for guest
      entry, "keep this explorer" and log out. Mitigations: nonce CSP, no third-party scripts, no HTML
      rendering of user content.
- [x] CORS: no `Access-Control-Allow-Origin` header is emitted by any API route (browsers therefore
      refuse cross-origin reads), and every state-changing request must carry an Origin equal to the
      deployment's own origin. The local gateway's `*` CORS is loopback-only development plumbing;
      production talks to Supabase's own API.
- [x] CSP: `script-src 'self' 'nonce-…' 'strict-dynamic'` (per-request nonce, applied to all 38
      scripts on the home page), `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
      `frame-ancestors 'none'`, `connect-src` limited to self + the Supabase origin (https + wss).
      Documented exception: `style-src 'unsafe-inline'` because pixel positioning uses React `style`
      attributes; there is no CSS injection surface (no user content reaches styles).
- [x] `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Permissions-Policy` (camera, mic, geolocation, payment, usb, sensors, topics off),
      `X-Frame-Options: DENY`, `Cross-Origin-Opener-Policy: same-origin`, `X-DNS-Prefetch-Control: off`,
      `X-Powered-By` removed.
- [x] XSS: no `dangerouslySetInnerHTML` / `innerHTML` / `eval`; a stored `<img onerror>` display
      name renders escaped on `/profile`; names travel to other players as JSON and are drawn as text on canvas.
- [x] SQL injection: Supabase client only; ids used in PostgREST `.or()` filters are uuid-validated
      first (a filter-injection payload returns 400). SQL-shaped game ids are rejected by `parseId`.
- [x] CSRF: Origin / `Sec-Fetch-Site` check on POST/DELETE (cross-origin with a valid cookie -> 403;
      missing Origin -> 403 unless `Sec-Fetch-Site: same-origin`), JSON bodies only; the `Partitioned`
      cookie is additionally never sent from another top-level site.
- [x] Rate limiting: 429 with `Retry-After` and the in-tone body (`EASY THERE.`) at request 61/min
      for game actions and 11/10 min for invites; a realistic 30-request play sequence is never limited.
- [x] Request size limits: 8 KB JSON cap (413 on a 20 KB body); Server Actions capped at 64 KB.
- [x] File uploads: none exist, none were added (46.14).

### 46.20 / 46.21 Production configuration

- [x] No debug endpoints, mock auth, fake DB adapters, test credentials or admin bypasses in `src/`
      (grep for debug/mock/TODO/test@/password returned nothing).
- [x] No `console.*` outside the structured logger; the logger redacts keys named like
      password/token/secret/key/authorization/cookie/session/jwt/email and JWT/opaque strings.
- [x] Unhandled errors return `{ head: 'SIGNAL LOST.', error: 'The universe is still here. Your connection isn't.', ref }`
      with a correlation id; PostgREST messages, constraint names and stacks stay in the server log.
- [x] Local-only plumbing (`/local-backend` rewrite, loopback proxy in the browser client) is
      compiled in only when `NEXT_PUBLIC_BACKEND_MODE=local` at build time; production builds have no rewrites.
- [x] Local `.env.local` header says "Do not deploy these values".
- [x] `npm audit --omit=dev`: 2 advisories, both in `postcss@8.4.31` vendored inside `next@15.5.25`
      (build-time CSS tooling, not shipped or executed at runtime). The only offered fix is `next@16`
      (breaking major). Accepted for now; re-check on each Next 15.5.x patch release.

### 46.5 / 46.25 Admin

There is **no admin surface** in this product: no admin pages, routes, roles or flags. Point values
live in `point_rules` and are changed by migrations. This is documented rather than invented.

### 46.4 Authentication

Real Supabase Auth: email/password sign-up (with confirmation callback), login, logout, password
recovery via `/auth/callback` (PKCE), anonymous guest sessions upgraded to permanent accounts from
Settings. The middleware refreshes sessions and redirects logged-out visitors from game routes to
`/enter`; API routes independently call `getUser()` (server-side verification against Supabase,
not a cookie parse). Garbage and tampered session cookies -> 401 (probed). Supabase Auth applies
its own per-IP limits to sign-in, sign-up, anonymous sign-in and recovery emails; on hosted
Supabase keep **Auth > Rate Limits** at the defaults or lower and enable **Allow anonymous sign-ins**.

## 4. Honest limitations

1. **In-memory rate limits are per instance.** On Vercel serverless each warm instance keeps its
   own counters, so a distributed attacker sees roughly `limit x instances`. Every limited action is
   also protected by something that does not depend on the limiter (session, ownership, RLS,
   idempotent point events, Supabase Auth's own limits). `consume()` in `src/server/limits.ts` is
   the single seam if a shared store (Upstash, Vercel KV) is ever wanted.
2. **`HttpOnly` cannot be set** on the Supabase session cookie without abandoning the browser
   client. Documented above with mitigations.
3. **`style-src 'unsafe-inline'`** remains (React inline styles). No user content reaches styles.
4. **No git history** in this workspace: history scanning must happen in the real repository.
5. **`postcss` advisory** inside Next's build tooling: not runtime-reachable; fix requires Next 16.
6. **Supabase Realtime** is not used by the client (presence polls the API), so `wss:` in
   `connect-src` is forward-looking, not an active surface.

## 5. How to re-verify

```
npm run typecheck && npm test && npm run lint:copy
npm run build && npm start &          # production build
node scripts/security-probes.mjs      # 73 probes: authn, authz, input, XSS, RLS, rate limits, CSRF, headers, redirects
```

The probe script creates throwaway guest accounts against the configured backend and prints one
PASS/FAIL line per check. It exits non-zero on any failure.
