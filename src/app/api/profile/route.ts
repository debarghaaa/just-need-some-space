import { requireActor } from '@/server/game';
import { GameError, PLAYER_ERROR, describeError, logEvent } from '@/server/errors';
import { actionOf, allowKeys, assertSameOrigin, enforceIpLimit, enforceLimit, fail, methodNotAllowed, ok, readJsonObject, str } from '@/server/http';
import { normalizeDisplayName, validateRocket, validateSuit } from '@/game/rockets';
import type { SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/profile  (route contract, spec 46.24)
 *
 * Who:        any signed-in player (guest or permanent). Identity from the session cookie only.
 * Input:      JSON object, max 8 KB, exactly one of:
 *               { action: 'onboard', username, displayName, planetName, rocketName, rocket }
 *               { action: 'save_rocket', rocketName, rocket }
 *               { action: 'save_customization', displayName, rocketName?, rocket, suit }
 *               { action: 'update', displayName?, planetName? }
 *               { action: 'delete_account' }
 *             `rocket` / `suit` must be catalogue ids (validateRocket / validateSuit); names are
 *             length-limited plain text; unknown fields are rejected.
 * Authn:      requireActor(). Missing/expired session -> 401.
 * Authz:      every write is scoped to actor.userId (own profile row, own rocket via owner_id).
 *             points / discovery_count are never accepted here and are guarded by a trigger too.
 * Reads:      player_profiles (own + username uniqueness check), rockets (own).
 * Writes:     player_profiles (display fields only), rockets (own), auth.users (delete own account).
 * Frequency:  12 writes / min / player; account deletion 3 / hour; 240 requests / min / IP.
 * CSRF:       Origin must match this deployment.
 */
const USERNAME = /^[a-z0-9_]{3,20}$/;
const ROCKET_NAME_MAX = 24;
const PLANET_NAME_MAX = 32;

function rocketColumns(cfg: NonNullable<ReturnType<typeof validateRocket>>) {
  return { body: cfg.body, engine: cfg.engine, fins: cfg.fins, color: cfg.color, accent: cfg.accent, decal: cfg.decal, engine_color: cfg.engineColor, fin_color: cfg.finColor, decal_color: cfg.decalColor };
}

function requireRocket(v: unknown) {
  const cfg = validateRocket(v);
  if (!cfg) throw new GameError(400, 'That rocket has parts we have never heard of.', 'rocket');
  return cfg;
}

function requireDisplayName(v: unknown): string {
  if (typeof v !== 'string') throw new GameError(400, 'Display name must be text.', 'type');
  const check = normalizeDisplayName(v);
  if (check.error) throw new GameError(400, check.error, 'display_name');
  return check.value;
}

function planetName(v: unknown): string {
  const name = str(v, PLANET_NAME_MAX, 'Planet name');
  if (name.toLowerCase() === 'earth') throw new GameError(400, 'Please choose something better than Earth.', 'earth');
  return name;
}

/** Database failure on a write: log the redacted detail, tell the player something honest and safe. */
function dbFail(what: string, userId: string, error: { message: string; code?: string }): never {
  logEvent('error', 'db.write', { what, userId, ...describeError(error) });
  throw new GameError(500, PLAYER_ERROR.generic.sub, 'db');
}

async function currentRocketId(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data: profile, error } = await db.from('player_profiles').select('current_rocket_id').eq('user_id', userId).maybeSingle();
  if (error) dbFail('profile.read', userId, error);
  if (!profile) throw new GameError(400, 'Finish onboarding first.', 'onboarding');
  return (profile.current_rocket_id as string | null) ?? null;
}

async function upsertRocket(db: SupabaseClient, userId: string, rocketId: string | null, patch: Record<string, unknown>, nameForNew: string): Promise<string> {
  if (rocketId) {
    const { data, error } = await db.from('rockets').update(patch).eq('id', rocketId).eq('owner_id', userId).select('id').maybeSingle();
    if (error) dbFail('rocket.update', userId, error);
    if (data) return rocketId;
    // The profile pointed at a rocket that is not ours or no longer exists: fall through and create one.
  }
  const { data, error } = await db.from('rockets').insert({ owner_id: userId, name: nameForNew, ...patch }).select('id').single();
  if (error) dbFail('rocket.insert', userId, error);
  const { error: linkErr } = await db.from('player_profiles').update({ current_rocket_id: data.id }).eq('user_id', userId);
  if (linkErr) dbFail('profile.link_rocket', userId, linkErr);
  return data.id as string;
}

export async function POST(req: Request) {
  const ctx = { route: 'profile', userId: undefined as string | undefined };
  try {
    assertSameOrigin(req);
    enforceIpLimit(req);
    const actor = await requireActor();
    ctx.userId = actor.userId;
    const db = actor.service;

    const body = await readJsonObject(req);
    const action = actionOf(body, ['onboard', 'save_rocket', 'save_customization', 'update', 'delete_account'] as const);
    enforceLimit(action === 'delete_account' ? 'ACCOUNT_DELETE' : 'PROFILE_WRITES', actor.userId);

    if (action === 'onboard') {
      allowKeys(body, ['action', 'username', 'displayName', 'planetName', 'rocketName', 'rocket']);
      const username = str(body.username, 20, 'Username').toLowerCase();
      if (!USERNAME.test(username)) throw new GameError(400, 'Usernames are 3 to 20 characters: lowercase letters, numbers, underscores.', 'username');
      const displayName = requireDisplayName(body.displayName);
      const planet = planetName(body.planetName);
      const cfg = requireRocket(body.rocket);
      const rocketName = str(body.rocketName, ROCKET_NAME_MAX, 'Rocket name');

      const { data: taken, error: takenErr } = await db.from('player_profiles').select('user_id').eq('username', username).maybeSingle();
      if (takenErr) dbFail('username.check', actor.userId, takenErr);
      if (taken && taken.user_id !== actor.userId) throw new GameError(409, 'That username is taken. Space is large; names are not.', 'username_taken');

      const { error: pErr } = await db.from('player_profiles').upsert(
        { user_id: actor.userId, username, display_name: displayName, planet_name: planet, onboarded_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      );
      if (pErr) {
        if (pErr.code === '23505') throw new GameError(409, 'That username is taken. Space is large; names are not.', 'username_taken');
        dbFail('profile.upsert', actor.userId, pErr);
      }
      const { data: existing } = await db.from('player_profiles').select('current_rocket_id').eq('user_id', actor.userId).maybeSingle();
      await upsertRocket(db, actor.userId, (existing?.current_rocket_id as string | null) ?? null, { name: rocketName, ...rocketColumns(cfg) }, rocketName);
      logEvent('info', 'player.onboarded', { userId: actor.userId });
      return ok({ ok: true });
    }

    if (action === 'save_rocket') {
      allowKeys(body, ['action', 'rocketName', 'rocket']);
      const cfg = requireRocket(body.rocket);
      const rocketName = str(body.rocketName, ROCKET_NAME_MAX, 'Rocket name');
      const rocketId = await currentRocketId(db, actor.userId);
      const id = await upsertRocket(db, actor.userId, rocketId, { name: rocketName, ...rocketColumns(cfg) }, rocketName);
      return ok({ ok: true, id });
    }

    if (action === 'save_customization') {
      allowKeys(body, ['action', 'displayName', 'rocketName', 'rocket', 'suit']);
      // Profile (name + suit) then rocket. Success is only reported after both writes return
      // without error, so the client never claims a save the database did not confirm.
      const displayName = requireDisplayName(body.displayName);
      const suit = validateSuit(body.suit);
      if (!suit) throw new GameError(400, 'That suit uses a colour we do not stock.', 'suit');
      const cfg = requireRocket(body.rocket);
      const rocketName = body.rocketName === undefined ? undefined : str(body.rocketName, ROCKET_NAME_MAX, 'Rocket name');
      const rocketId = await currentRocketId(db, actor.userId);
      const { error: pErr } = await db
        .from('player_profiles')
        .update({ display_name: displayName, suit_primary: suit.primary, suit_secondary: suit.secondary, suit_visor: suit.visor, suit_pack: suit.pack })
        .eq('user_id', actor.userId);
      if (pErr) dbFail('profile.customize', actor.userId, pErr);
      const patch: Record<string, unknown> = { ...rocketColumns(cfg) };
      if (rocketName !== undefined) patch.name = rocketName;
      const id = await upsertRocket(db, actor.userId, rocketId, patch, rocketName ?? 'The Sensible One');
      return ok({ ok: true, id, displayName });
    }

    if (action === 'update') {
      allowKeys(body, ['action', 'displayName', 'planetName']);
      const patch: Record<string, string> = {};
      if (body.displayName !== undefined) patch.display_name = requireDisplayName(body.displayName);
      if (body.planetName !== undefined) patch.planet_name = planetName(body.planetName);
      if (Object.keys(patch).length === 0) throw new GameError(400, 'Nothing to update.', 'empty');
      const { error } = await db.from('player_profiles').update(patch).eq('user_id', actor.userId);
      if (error) dbFail('profile.update', actor.userId, error);
      return ok({ ok: true });
    }

    // delete_account
    allowKeys(body, ['action']);
    const { error } = await db.auth.admin.deleteUser(actor.userId);
    if (error) dbFail('account.delete', actor.userId, error);
    logEvent('info', 'player.deleted', { userId: actor.userId });
    return ok({ ok: true });
  } catch (e) {
    return fail(e, ctx);
  }
}

const ALLOW = ['POST'];
export function GET() { return methodNotAllowed(ALLOW); }
export function PUT() { return methodNotAllowed(ALLOW); }
export function PATCH() { return methodNotAllowed(ALLOW); }
export function DELETE() { return methodNotAllowed(ALLOW); }
