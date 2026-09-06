import 'server-only';

/**
 * Server-side rate limiting (spec 46.12 / 46.13).
 *
 * Every limit below is a tunable constant with the reasoning next to it. Normal play never comes
 * close: the presence heartbeat runs every 4 seconds (15/min) and a fast player scanning a planet
 * issues well under one game action per second.
 *
 * Implementation: fixed windows kept in process memory. This is deliberate (no extra service, no
 * library added for show) but it has a documented limitation: on Vercel each serverless instance
 * keeps its own counters, so a very distributed attacker sees a limit that is roughly
 * `limit x instances`. Everything the limiter protects is ALSO protected by something that does not
 * depend on it: session checks, ownership checks, RLS, idempotent point events and Supabase Auth's
 * own per-IP limits on sign-in / sign-up / anonymous sign-in / recovery. If a shared store is ever
 * needed, `consume()` is the single seam to swap.
 */

export const LIMITS = {
  /** All /api routes together, per client IP. A browser tab issues at most ~20/min while playing. */
  API_PER_IP: { max: 240, windowMs: 60_000 },
  /** Gameplay reads + writes per player (visit, land, scan, collect, progress). */
  GAME_ACTIONS: { max: 60, windowMs: 60_000 },
  /** Subset of the above that can award points. A full planet has at most ~40 things to do. */
  POINT_ACTIONS: { max: 40, windowMs: 60_000 },
  /** Longer window for point-awarding actions: catches slow scripted farming. */
  POINT_ACTIONS_LONG: { max: 250, windowMs: 10 * 60_000 },
  /** Presence heartbeats: client sends one every 4 s, plus one on each screen change. */
  PRESENCE: { max: 60, windowMs: 60_000 },
  /** Profile / rocket / suit writes. Saving is a deliberate click. */
  PROFILE_WRITES: { max: 12, windowMs: 60_000 },
  /** Account deletion. */
  ACCOUNT_DELETE: { max: 3, windowMs: 60 * 60_000 },
  /** Friend invites sent. */
  FRIEND_INVITES: { max: 10, windowMs: 10 * 60_000 },
  /** Accept / reject / remove. */
  FRIEND_OPS: { max: 30, windowMs: 60_000 },
  /** Friends list reads (the panel refreshes after each action). */
  FRIEND_READS: { max: 60, windowMs: 60_000 },
  /** Auth callback (PKCE code exchange) per IP. Only email links hit it. */
  AUTH_CALLBACK_PER_IP: { max: 20, windowMs: 10 * 60_000 },
} as const;

/** Largest JSON body any route accepts. The biggest legitimate payload (onboarding) is under 1 KB. */
export const MAX_JSON_BODY_BYTES = 8 * 1024;

export type LimitName = keyof typeof LIMITS;

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number): void {
  // Cheap housekeeping so the map cannot grow without bound.
  if (now - lastSweep < 60_000 && windows.size < 20_000) return;
  lastSweep = now;
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  /** Whole seconds until the window resets. Sent as Retry-After when ok is false. */
  retryAfterSec: number;
}

/** Counts one hit against `name` for `key` and reports whether it is still within the limit. */
export function consume(name: LimitName, key: string): LimitResult {
  const { max, windowMs } = LIMITS[name];
  const now = Date.now();
  sweep(now);
  const id = `${name}:${key}`;
  let w = windows.get(id);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    windows.set(id, w);
  }
  w.count += 1;
  const retryAfterSec = Math.max(1, Math.ceil((w.resetAt - now) / 1000));
  return { ok: w.count <= max, remaining: Math.max(0, max - w.count), retryAfterSec };
}

/**
 * Best-effort client address. Vercel sets x-real-ip / x-forwarded-for from its own edge and strips
 * client-supplied values, so they are trustworthy there. Locally (no proxy) everything shares one key.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 64);
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim().slice(0, 64) || 'unknown';
  return 'unknown';
}

/** Test hook: clears every window. Not used by production code paths. */
export function resetLimits(): void {
  windows.clear();
}
