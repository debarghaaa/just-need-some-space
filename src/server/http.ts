import 'server-only';
import { NextResponse } from 'next/server';
import { parseId } from '@/game/universe';
import { GameError, PLAYER_ERROR, correlationId, describeError, logEvent } from './errors';
import { MAX_JSON_BODY_BYTES, clientIp, consume, type LimitName } from './limits';

export { GameError } from './errors';

// ---------------------------------------------------------------- responses

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

interface ErrorBody {
  error: string;
  head: string;
  code?: string;
  ref?: string;
}

function errorResponse(status: number, body: ErrorBody, extraHeaders?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'cache-control': 'no-store', ...extraHeaders } });
}

/**
 * Maps any thrown value to a player-safe response.
 *  - GameError: its message was written for players, pass it through with its status.
 *  - Everything else: log a structured, redacted summary with a correlation id and answer with the
 *    generic in-tone message. The client never sees stack traces, SQL or PostgREST payloads.
 */
export function fail(err: unknown, ctx: { route: string; userId?: string } = { route: 'unknown' }) {
  if (err instanceof GameError) {
    const head = headFor(err.status);
    if (err.status >= 500) logEvent('error', 'api.error', { route: ctx.route, userId: ctx.userId, status: err.status, code: err.code, message: err.message });
    return errorResponse(err.status, { error: err.message, head, code: err.code }, err.status === 429 ? { 'retry-after': err.code?.startsWith('retry:') ? err.code.slice(6) : '10' } : undefined);
  }
  const ref = correlationId();
  logEvent('error', 'api.unhandled', { route: ctx.route, userId: ctx.userId, ref, ...describeError(err) });
  return errorResponse(500, { error: PLAYER_ERROR.generic.sub, head: PLAYER_ERROR.generic.head, ref });
}

function headFor(status: number): string {
  if (status === 401) return PLAYER_ERROR.unauthenticated.head;
  if (status === 403) return PLAYER_ERROR.forbidden.head;
  if (status === 413) return PLAYER_ERROR.tooLarge.head;
  if (status === 429) return PLAYER_ERROR.rateLimited.head;
  if (status === 405) return PLAYER_ERROR.methodNotAllowed.head;
  if (status === 503) return PLAYER_ERROR.unavailable.head;
  if (status >= 500) return PLAYER_ERROR.generic.head;
  return PLAYER_ERROR.badRequest.head;
}

/** Handler for HTTP methods a route does not implement (46.24). */
export function methodNotAllowed(allow: string[]) {
  return errorResponse(405, { error: PLAYER_ERROR.methodNotAllowed.sub, head: PLAYER_ERROR.methodNotAllowed.head }, { allow: allow.join(', ') });
}

// ---------------------------------------------------------------- request guards

/**
 * Cross-site request forgery guard for cookie-authenticated, state-changing requests (46.15).
 * Browsers attach `Origin` to every POST/PUT/PATCH/DELETE (and `Sec-Fetch-Site` in all current
 * engines). A request whose Origin is not this deployment's own origin is refused before any
 * session is read. Same-origin requests from our own pages always carry a matching Origin.
 * Requests with neither header (non-browser clients) are refused as well: every legitimate caller
 * of these routes is a browser page on this site.
 */
export function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') throw new GameError(403, PLAYER_ERROR.wrongOrigin.sub, 'origin');
  const origin = req.headers.get('origin');
  if (!origin) {
    if (fetchSite === 'same-origin') return; // some privacy modes strip Origin but keep Sec-Fetch-Site
    throw new GameError(403, PLAYER_ERROR.wrongOrigin.sub, 'origin');
  }
  const expected = expectedOrigin(req);
  if (!expected || origin.toLowerCase() !== expected) throw new GameError(403, PLAYER_ERROR.wrongOrigin.sub, 'origin');
}

/** The origin this request was addressed to, as the browser sees it (behind Vercel's proxy the
 *  forwarded headers describe the public host). */
function expectedOrigin(req: Request): string | null {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host'))?.split(',')[0].trim().toLowerCase();
  if (!host) return null;
  const proto = (req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')).split(',')[0].trim().toLowerCase();
  return `${proto}://${host}`;
}

/** Applies a per-key limit and throws a 429 carrying Retry-After when exceeded. */
export function enforceLimit(name: LimitName, key: string): void {
  const r = consume(name, key);
  if (!r.ok) throw new GameError(429, PLAYER_ERROR.rateLimited.sub, `retry:${r.retryAfterSec}`);
}

/** Per-IP ceiling shared by every API route. Runs before the session lookup so it also protects auth. */
export function enforceIpLimit(req: Request): void {
  enforceLimit('API_PER_IP', clientIp(req));
}

/**
 * Reads a JSON object body with hard limits: declared and actual size, content type, and shape.
 * Only plain objects are accepted; arrays, primitives and non-JSON bodies are rejected.
 */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) throw new GameError(413, PLAYER_ERROR.tooLarge.sub, 'too_large');
  const type = req.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('application/json')) throw new GameError(415, 'Body must be JSON.', 'content_type');
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new GameError(400, 'Body could not be read.', 'body');
  }
  if (text.length > MAX_JSON_BODY_BYTES) throw new GameError(413, PLAYER_ERROR.tooLarge.sub, 'too_large');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GameError(400, 'Body must be JSON.', 'json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new GameError(400, 'Body must be a JSON object.', 'shape');
  return parsed as Record<string, unknown>;
}

/**
 * Rejects bodies that carry fields the action does not define (46.9: no arbitrary JSON).
 * Unknown keys are a strong signal of tampering or a stale client; either way we do not guess.
 */
export function allowKeys(body: Record<string, unknown>, allowed: readonly string[]): void {
  for (const k of Object.keys(body)) {
    if (!allowed.includes(k)) throw new GameError(400, 'Unexpected field in request.', 'field');
  }
}

/** Requires `body.action` to be one of the listed values. */
export function actionOf<const T extends readonly string[]>(body: Record<string, unknown>, actions: T): T[number] {
  const a = body.action;
  if (typeof a !== 'string' || !actions.includes(a)) throw new GameError(400, 'Unknown action.', 'action');
  return a as T[number];
}

// ---------------------------------------------------------------- field validators

/** Non-empty trimmed string with a max length. Control characters are rejected outright. */
export function str(v: unknown, max = 64, label = 'Field'): string {
  if (typeof v !== 'string') throw new GameError(400, `${label} must be text.`, 'type');
  const s = v.trim();
  if (!s || s.length > max) throw new GameError(400, `${label} must be 1 to ${max} characters.`, 'length');
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(s)) throw new GameError(400, `${label} contains characters we cannot store.`, 'chars');
  return s;
}

/** Integer within [min, max]. Numeric strings are NOT accepted: the client sends numbers. */
export function int(v: unknown, min: number, max: number, label = 'Number'): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new GameError(400, `${label} is out of range.`, 'range');
  return v;
}

/** Finite number clamped to [min, max]; used for cosmetic values such as sprite position. */
export function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(min, Math.min(max, n));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Postgres uuid. Everything that names a row (users, friendships) must pass through here. */
export function uuid(v: unknown, label = 'Id'): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new GameError(400, `${label} is not a valid id.`, 'uuid');
  return v.toLowerCase();
}

/** Deterministic game id (`system:3`, `planet:3:1`) of the expected kind. */
export function gameId(v: unknown, type: 'system' | 'planet'): string {
  if (typeof v !== 'string' || v.length > 32) throw new GameError(400, 'Bad location id.', 'game_id');
  const p = parseId(v);
  if (!p || p.type !== type) throw new GameError(400, 'Bad location id.', 'game_id');
  return v;
}

/** Same as gameId but null/undefined is allowed (presence may be nowhere in particular). */
export function optionalGameId(v: unknown, type: 'system' | 'planet'): string | null {
  if (v == null) return null;
  return gameId(v, type);
}

/** Route context for structured logs: which route, which player. */
export function routeContext(route: string, userId?: string) {
  return { route, userId };
}
