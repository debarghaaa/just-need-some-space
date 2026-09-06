import 'server-only';

/**
 * Centralised error model for the API layer (spec 46.20 / 46.22).
 *
 * `GameError` is the only error type that is allowed to reach a player. Its message is written
 * for players. Anything else (database errors, PostgREST payloads, thrown strings, bugs) is logged
 * server-side with a correlation id and replaced by a generic, in-tone message. Stack traces,
 * SQL text, constraint names and table names never leave the server.
 */
export class GameError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Optional machine-readable code the client may branch on. Never contains internals. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'GameError';
  }
}

/** Player-facing copy for failures that are not the player's fault. Same tone as the rest of the game. */
export const PLAYER_ERROR = {
  generic: { head: 'SIGNAL LOST.', sub: 'The universe is still here. Your connection isn\u2019t.' },
  rateLimited: { head: 'EASY THERE.', sub: 'The universe can only take so much at once. Try again in a moment.' },
  unauthenticated: { head: 'NOT SIGNED IN.', sub: 'Enter the universe first.' },
  forbidden: { head: 'NOT YOURS.', sub: 'That belongs to another explorer.' },
  badRequest: { head: 'THAT DID NOT COMPUTE.', sub: 'The request was not something the universe understands.' },
  tooLarge: { head: 'TOO MUCH AT ONCE.', sub: 'That message was larger than anything we accept.' },
  wrongOrigin: { head: 'WRONG DOOR.', sub: 'That request did not come from this site.' },
  methodNotAllowed: { head: 'NOT THAT WAY.', sub: 'This route does not accept that method.' },
  unavailable: { head: 'SIGNAL LOST.', sub: 'The backend is not configured. Nothing was saved.' },
} as const;

const SENSITIVE_KEY = /pass(word)?|token|secret|key|authorization|cookie|session|jwt|email/i;

/**
 * Removes anything that looks like a credential before it can be logged. Values under sensitive
 * keys are replaced; long opaque strings (JWTs, keys) are replaced wherever they appear.
 */
export function redact(input: unknown, depth = 0): unknown {
  if (depth > 4) return '[depth]';
  if (typeof input === 'string') return redactString(input);
  if (Array.isArray(input)) return input.slice(0, 20).map((v) => redact(v, depth + 1));
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 40)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return input;
}

function redactString(s: string): string {
  return s
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[jwt]')
    .replace(/\b(sb|sbp|sk|pk)_[A-Za-z0-9_-]{16,}\b/g, '[key]')
    .replace(/[A-Za-z0-9+/=_-]{48,}/g, '[opaque]')
    .slice(0, 600);
}

let counter = 0;
/** Short correlation id printed in the log line and returned to the player so support can match them. */
export function correlationId(): string {
  counter = (counter + 1) % 0xffff;
  return `${Date.now().toString(36)}-${counter.toString(16).padStart(4, '0')}`;
}

/**
 * Structured server log. One JSON object per line so log drains (Vercel, Supabase) can index it.
 * Never receives raw request bodies or headers; callers pass only the fields listed here.
 */
export function logEvent(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(redact(fields) as Record<string, unknown>) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

/** Summarises an unknown thrown value for the log without carrying secrets or full stacks. */
export function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: unknown; status?: unknown; details?: unknown; hint?: unknown };
    return {
      name: err.name,
      message: redactString(err.message),
      code: typeof anyErr.code === 'string' || typeof anyErr.code === 'number' ? anyErr.code : undefined,
      // First frame only: enough to locate the failure, not enough to dump the world.
      at: err.stack?.split('\n')[1]?.trim().slice(0, 160),
    };
  }
  if (err && typeof err === 'object') {
    const o = err as { message?: unknown; code?: unknown; details?: unknown };
    return { message: typeof o.message === 'string' ? redactString(o.message) : 'non-error object', code: typeof o.code === 'string' ? o.code : undefined };
  }
  return { message: typeof err === 'string' ? redactString(err) : String(err) };
}
