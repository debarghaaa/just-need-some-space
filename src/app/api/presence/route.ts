import { requireActor } from '@/server/game';
import { GameError, PLAYER_ERROR, describeError, logEvent } from '@/server/errors';
import { allowKeys, assertSameOrigin, clampNumber, enforceIpLimit, enforceLimit, fail, methodNotAllowed, ok, optionalGameId, readJsonObject } from '@/server/http';
import { PRESENCE_STALE_MS } from '@/game/rules';

export const dynamic = 'force-dynamic';

/**
 * /api/presence  (route contract, spec 46.24)
 *
 * POST  heartbeat. Who: any signed-in player. Input: JSON object, max 8 KB:
 *         { systemId?: game id | null, planetId?: game id | null, x?, y?: number (clamped), facing?: 1|-1, action?: 'wave' | null }
 *       Unknown fields rejected. Location ids are validated as deterministic game ids.
 *       Writes: own presence row (upsert on player_id). Reads: other players active in the same
 *       area within PRESENCE_STALE_MS, their public profile fields and rocket cosmetics.
 *       Frequency: 60 / min / player (client sends 15 / min), 240 / min / IP.
 * DELETE leave. Removes own presence row only. No body.
 * Authn: requireActor(). Authz: player_id is always actor.userId. CSRF: Origin must match.
 */
export interface PresenceRow {
  player_id: string;
  username: string;
  display_name: string;
  system_id: string | null;
  planet_id: string | null;
  x: number;
  y: number;
  facing: number;
  action: string | null;
  action_at: string | null;
  last_active: string;
  rocket: { body: string; engine: string; fins: string; color: string; accent: string; decal: string; engine_color?: string | null; fin_color?: string | null; decal_color?: string | null } | null;
  suit: { suit_primary: string; suit_secondary: string; suit_visor: string; suit_pack: string } | null;
}

function dbFail(what: string, userId: string, error: { message: string; code?: string }): never {
  logEvent('error', 'db.presence', { what, userId, ...describeError(error) });
  throw new GameError(500, PLAYER_ERROR.generic.sub, 'db');
}

/**
 * Presence transport. On Vercel + hosted Supabase the same `presence` table is also broadcast via
 * Supabase Realtime (postgres_changes on public.presence); this polling route is the fallback and
 * the only transport in the local stack. Both read the same rows, so the data model is identical.
 */
export async function POST(req: Request) {
  const ctx = { route: 'presence', userId: undefined as string | undefined };
  try {
    assertSameOrigin(req);
    enforceIpLimit(req);
    const actor = await requireActor();
    ctx.userId = actor.userId;
    enforceLimit('PRESENCE', actor.userId);

    const b = await readJsonObject(req);
    allowKeys(b, ['systemId', 'planetId', 'x', 'y', 'facing', 'action']);
    const systemId = optionalGameId(b.systemId, 'system');
    const planetId = optionalGameId(b.planetId, 'planet');
    if (planetId && !systemId) throw new GameError(400, 'Bad location id.', 'game_id');
    if (b.action != null && b.action !== 'wave') throw new GameError(400, 'Unknown action.', 'action');
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      player_id: actor.userId,
      system_id: systemId,
      planet_id: planetId,
      x: clampNumber(b.x, -1000, 1000, 0),
      y: clampNumber(b.y, -1000, 1000, 0),
      facing: b.facing === -1 ? -1 : 1,
      last_active: now,
    };
    if (b.action === 'wave') {
      row.action = 'wave';
      row.action_at = now;
    }
    const { error } = await actor.service.from('presence').upsert(row, { onConflict: 'player_id' });
    if (error) dbFail('upsert', actor.userId, error);

    // Everyone else active in the same area (system-wide when in orbit, planet-wide when landed)
    const since = new Date(Date.now() - PRESENCE_STALE_MS).toISOString();
    let q = actor.service
      .from('presence')
      .select('player_id,system_id,planet_id,x,y,facing,action,action_at,last_active,player_profiles!inner(username,display_name,current_rocket_id,suit_primary,suit_secondary,suit_visor,suit_pack)')
      .gte('last_active', since)
      .neq('player_id', actor.userId);
    if (planetId) q = q.eq('planet_id', planetId);
    else if (systemId) q = q.eq('system_id', systemId);
    else q = q.is('system_id', null);
    const { data, error: readErr } = await q.limit(40);
    if (readErr) dbFail('read', actor.userId, readErr);

    const rocketIds = (data ?? []).map((r) => (r.player_profiles as unknown as { current_rocket_id: string | null }).current_rocket_id).filter(Boolean) as string[];
    const rockets = rocketIds.length ? (await actor.service.from('rockets').select('id,body,engine,fins,color,accent,decal,engine_color,fin_color,decal_color').in('id', rocketIds)).data ?? [] : [];
    const rocketById = new Map(rockets.map((r) => [r.id as string, r]));

    const others: PresenceRow[] = (data ?? []).map((r) => {
      const p = r.player_profiles as unknown as { username: string; display_name: string; current_rocket_id: string | null; suit_primary: string; suit_secondary: string; suit_visor: string; suit_pack: string };
      const rk = p.current_rocket_id ? rocketById.get(p.current_rocket_id) : null;
      return {
        player_id: r.player_id as string,
        username: p.username,
        display_name: p.display_name,
        system_id: r.system_id as string | null,
        planet_id: r.planet_id as string | null,
        x: r.x as number,
        y: r.y as number,
        facing: r.facing as number,
        action: r.action as string | null,
        action_at: r.action_at as string | null,
        last_active: r.last_active as string,
        rocket: rk ? { body: rk.body, engine: rk.engine, fins: rk.fins, color: rk.color, accent: rk.accent, decal: rk.decal, engine_color: rk.engine_color, fin_color: rk.fin_color, decal_color: rk.decal_color } : null,
        suit: p.suit_primary ? { suit_primary: p.suit_primary, suit_secondary: p.suit_secondary, suit_visor: p.suit_visor, suit_pack: p.suit_pack } : null,
      };
    });
    return ok({ others, serverTime: now }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return fail(e, ctx);
  }
}

/** Leaving: remove my presence row so others stop seeing me immediately. */
export async function DELETE(req: Request) {
  const ctx = { route: 'presence.delete', userId: undefined as string | undefined };
  try {
    assertSameOrigin(req);
    enforceIpLimit(req);
    const actor = await requireActor();
    ctx.userId = actor.userId;
    enforceLimit('PRESENCE', actor.userId);
    const { error } = await actor.service.from('presence').delete().eq('player_id', actor.userId);
    if (error) dbFail('delete', actor.userId, error);
    return ok({ ok: true });
  } catch (e) {
    return fail(e, ctx);
  }
}

const ALLOW = ['POST', 'DELETE'];
export function GET() { return methodNotAllowed(ALLOW); }
export function PUT() { return methodNotAllowed(ALLOW); }
export function PATCH() { return methodNotAllowed(ALLOW); }
