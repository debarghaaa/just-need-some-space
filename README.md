# JUST NEED SOME SPACE.

A multiplayer pixel-art universe where you build your rocket, explore strange worlds, collect
resources, meet other explorers, and find somewhere that feels like yours.

Next.js 15 (App Router, TypeScript) + Supabase (Auth, Postgres, RLS) + Vercel.

## What is in the MVP

- One galaxy, five star systems, 3 to 5 planets each, all generated deterministically from `UNIVERSE_SEED`.
  Only player state is stored; the generator takes any index, so widening the window is one constant (`MVP_SYSTEM_COUNT`).
- No login required to play: opening any game route without a session issues a guest explorer (Supabase anonymous
  sign-in, a real `auth.users` row under the same RLS). Guests can add an email + password later in Settings and keep
  everything. Email accounts (sign up, log in, forgot / reset password) still work as before.
- Onboarding: name your planet, pick a username, build a first rocket.
- Rocket builder: 8 hulls (3 classic rockets plus 5 winged ships: Delta, Cruiser, Interceptor, Hauler, Lancer), 3 engines, 3 fins, 8 curated swatches, 3 decals + none, 8 presets. Live pixel preview, saved per player.
- Customize (`/customize`): body, engine, fin, window/accent and decal colours set independently; astronaut suit
  primary, secondary, visor and equipment colours; player display name (shown above the rocket in orbit and above
  the astronaut on planets, never the email). Live preview drawn by the same renderers the game uses.
- Typography: exactly two self-hosted families. Courier Prime (typewriter: regular, bold, italic) for body copy,
  descriptions, navigation drawer text, forms and long-form content; Pixelify Sans (variable) for titles, buttons,
  HUD, names and numbers. See `docs/TYPOGRAPHY.md`.
- Loading screen: a single word, HARNESSMOGGING, with a blinking cursor. No scene, no timers, no client JavaScript,
  so it never adds to the wait. The larger message catalogue in `src/game/copy.ts` (`LOADING`) is kept for reference.
- Universe map (select / inspect / travel), system map (planets on orbits, discovered vs unknown, land), planet surface
  (walk, scan points of interest, collect resources, leave).
- Server-side scoring through `SECURITY DEFINER` Postgres functions and an append-only `point_events` ledger:
  planet +100, new system +150, fully scanned planet +75, point of interest +40, common/rare/exotic resource +5/+25/+50.
  Clients never send point values; a trigger rejects any direct edit to `points`.
- Codex of every discovery (name, type, rarity, date, discovered by, attributes, first find).
- Multiplayer presence: players in the same system or on the same planet see each other's real rocket and username.
  Proximity prompt `PLAYER DETECTED` with Approach / Wave / Invite. Friends: invite, accept, reject, remove, list.
  Every entity is labelled Real player / System / Generated.
- Settings: sound, music (switch present, no music yet, labelled as such), reduce animation, interface scale,
  log out, edit names, delete account.

Out of scope on purpose: chat, trading, combat, guilds, housing, economy.

## Run it locally

```bash
npm install
cp .env.example .env.local      # fill in a Supabase project, OR:
npm run stack:up                # local Supabase-compatible stack, writes .env.local for you
npm run dev
```

`npm run stack:up` boots PostgreSQL 17 + the real Supabase Auth (GoTrue) and PostgREST binaries + a small gateway
that exposes them with Supabase's `/auth/v1` and `/rest/v1` layout, then applies `supabase/migrations`.
No Docker needed. Emails are auto-confirmed locally because there is no SMTP, and anonymous sign-ins are enabled
(`GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true`) so guest entry works. `npm run stack:down` stops it.

Other scripts: `npm run typecheck`, `npm test` (determinism + rules), `npm run lint:copy`
(fails on em dashes, emoji or forbidden marketing phrases), `npm run db:migrate`.

## Deploy (Vercel + Supabase)

1. Create a Supabase project. In the SQL editor run `supabase/migrations/0001_init.sql`, `0002_customization.sql`,
   `0003_security_hardening.sql` (privileges, indexes, constraints; idempotent), then `0004_rocket_hulls.sql`
   (widens the hull check constraint for the five ship hulls).
2. Auth settings: enable Email provider and turn on **Allow anonymous sign-ins** (guest entry depends on it; without
   it `/enter` shows a plain failure with the normal log in / sign up routes). Set Site URL to your Vercel domain and
   add `https://<your-domain>/auth/callback` to redirect URLs. Email confirmation and password reset use that callback.
3. In Vercel, import the repo and set environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; used by `/api/*` after verifying the caller's session)
   - `UNIVERSE_SEED` (optional; changing it changes every generated world)
4. Deploy. `vercel.json` pins the framework; the app is fully dynamic (no ISR needed).

Presence uses `POST /api/presence` polling (4 s) against the `presence` table, which works identically on the
local stack and on hosted Supabase. The migration also adds `presence` and `friendships` to the
`supabase_realtime` publication, so a Realtime subscription can be layered on without a schema change.

## Security model

See `SECURITY.md` for the full section 46 checklist (what is enforced, how it was tested, and the honest limitations).
The short version:

- **Identity** comes only from the Supabase session cookie (`requireActor()`); no route accepts a user id from the client.
- **Row level security** on all 12 tables, every policy scoped to `auth.uid()` or explicitly public read-only.
  `anon` has no table privileges at all. Progression tables (`discoveries`, `inventory`, `collections`,
  `point_events`, `systems`, `planets`) have no client write policies and no client write privileges: writes happen
  only inside the `SECURITY DEFINER` scoring functions, executable by `service_role` only, idempotent per event.
- **Points, rarity, quantities, discovery ownership** are computed server-side from the seed and `point_rules`;
  a trigger rejects any non-service change to `points` / `discovery_count` / `user_id`, another one pins rocket ownership.
- **Input**: every route reads a size-limited JSON object, rejects unknown fields, validates enums, uuids and game ids.
- **CSRF**: an Origin / `Sec-Fetch-Site` check on every state-changing request (JSON bodies only); the session cookie is `Partitioned`, so another site never gets it sent along.
- **Rate limits** per player and per IP on every route (`src/server/limits.ts`, documented constants, 429 + `Retry-After`).
- **Headers**: nonce-based CSP (no `unsafe-inline` scripts), HSTS, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- **Errors**: players see in-tone messages (`SIGNAL LOST.`); the server logs one redacted JSON line with a
  correlation id. No stack traces, SQL or PostgREST payloads leave the server.
- **Secrets**: only `SUPABASE_SERVICE_ROLE_KEY` is secret; it is read in one `server-only` module and never
  imported by client code. `.env*` files are gitignored; `.env.example` has names only.

## Layout

```
src/game        universe generator, rockets, rules, copy, pixel renderers (pure TS, tested)
src/app         routes (pages + /api), icon + apple-icon generated as pixel PNGs from the site mark, a pixel galaxy (src/game/brand-art.ts)
src/components  ui primitives, site chrome, game screens
src/lib         env guard, Supabase clients (browser / server / service), middleware helper
src/server      profile loader, game actions, http helpers
supabase        migrations
scripts         local stack, copy lint, e2e-guest.mjs (Playwright walk-through of guest entry, onboarding, customize, planet)
tests           vitest
```

Legal pages (`/terms`, `/privacy`) describe what the software actually does and clearly mark the fields the
operator must supply (legal entity, jurisdiction, contact, regions, minimum age). They are not finished legal
documents until those are filled in.

## Colour system

The official website colour system (the 47 supplied colours, their roles, the 60 / 20 / 15 / 5 balance, button
states, rarity colours and planet palettes) is documented in `docs/COLOUR-SYSTEM.md`. `src/game/palette.ts` is the
single source of truth; `tests/palette.test.ts` fails on any hex or `rgba()` literal outside the supplied set, on any
computed colour, and on any contrast pair below the floor.

## If the preview stops opening

The sandbox that hosts the preview periodically drops everything that is not a regular workspace file
(installed packages, `node_modules`, the `.next` build, the downloaded Auth / PostgREST binaries and all
background processes). Postgres can also refuse to start afterwards because its empty runtime
directories were not kept. One command restores all of it and leaves the server on :3000:

```
bash scripts/dev-recover.sh
```

It proves the backend with a real anonymous sign-up before building, so `[recover] done` means the
guest flow works. `GET /api/health` returns `ok: true` only when the auth service answers, and 503
otherwise, so an uptime check catches a dead backend instead of a green Next.js shell.
