import { requireActor } from '@/server/game';
import { GameError, PLAYER_ERROR, describeError, logEvent } from '@/server/errors';
import { actionOf, allowKeys, assertSameOrigin, enforceIpLimit, enforceLimit, fail, methodNotAllowed, ok, readJsonObject, uuid } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * /api/friends  (route contract, spec 46.24)
 *
 * GET   my friendships (sent, received, accepted). Who: any signed-in player. No input.
 *       Reads: friendships where I am requester or receiver, plus the other party's public
 *       username / display name. Frequency: 60 / min / player.
 * POST  JSON object, max 8 KB, exactly one of:
 *         { action: 'invite', userId: uuid }      -> insert friendship(requester = me, receiver = userId)
 *         { action: 'accept' | 'reject', id: uuid } -> only the receiver may answer
 *         { action: 'remove', id: uuid }           -> either party may remove
 *       Unknown fields rejected; ids must be uuids (they are used in PostgREST filters).
 *       Frequency: invites 10 / 10 min / player, other ops 30 / min / player; 240 / min / IP.
 * Authn: requireActor(). Authz: every mutation checks that actor.userId is a party to the row.
 * CSRF: Origin must match this deployment for POST.
 */

function dbFail(what: string, userId: string, error: { message: string; code?: string }): never {
  logEvent('error', 'db.friends', { what, userId, ...describeError(error) });
  throw new GameError(500, PLAYER_ERROR.generic.sub, 'db');
}

export async function GET(req: Request) {
  const ctx = { route: 'friends.get', userId: undefined as string | undefined };
  try {
    enforceIpLimit(req);
    const actor = await requireActor();
    ctx.userId = actor.userId;
    enforceLimit('FRIEND_READS', actor.userId);
    const me = uuid(actor.userId, 'User');
    const { data, error } = await actor.service
      .from('friendships')
      .select('id,requester_id,receiver_id,status,created_at,requester:player_profiles!friendships_requester_id_fkey(username,display_name),receiver:player_profiles!friendships_receiver_id_fkey(username,display_name)')
      .or(`requester_id.eq.${me},receiver_id.eq.${me}`)
      .neq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) dbFail('list', actor.userId, error);
    const rows = (data ?? []).map((f) => {
      const mine = f.requester_id === actor.userId;
      const other = (mine ? f.receiver : f.requester) as unknown as { username: string; display_name: string };
      return {
        id: f.id as string,
        status: f.status as 'pending' | 'accepted',
        direction: mine ? 'sent' : 'received',
        otherId: (mine ? f.receiver_id : f.requester_id) as string,
        username: other.username,
        displayName: other.display_name,
        createdAt: f.created_at as string,
      };
    });
    return ok({ friendships: rows }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return fail(e, ctx);
  }
}

export async function POST(req: Request) {
  const ctx = { route: 'friends', userId: undefined as string | undefined };
  try {
    assertSameOrigin(req);
    enforceIpLimit(req);
    const actor = await requireActor();
    ctx.userId = actor.userId;
    const db = actor.service;
    const me = uuid(actor.userId, 'User');

    const body = await readJsonObject(req);
    const action = actionOf(body, ['invite', 'accept', 'reject', 'remove'] as const);

    if (action === 'invite') {
      allowKeys(body, ['action', 'userId']);
      enforceLimit('FRIEND_INVITES', actor.userId);
      const target = uuid(body.userId, 'Player');
      if (target === me) throw new GameError(400, 'You cannot invite yourself. Tempting, though.', 'self');
      const { data: targetProfile, error: tErr } = await db.from('player_profiles').select('user_id').eq('user_id', target).maybeSingle();
      if (tErr) dbFail('target.check', actor.userId, tErr);
      if (!targetProfile) throw new GameError(404, 'No explorer by that id.', 'no_player');
      const { data: exists, error: eErr } = await db
        .from('friendships')
        .select('id,status,requester_id')
        .or(`and(requester_id.eq.${me},receiver_id.eq.${target}),and(requester_id.eq.${target},receiver_id.eq.${me})`)
        .maybeSingle();
      if (eErr) dbFail('invite.check', actor.userId, eErr);
      if (exists && exists.status !== 'rejected') return ok({ ok: true, already: exists.status });
      if (exists) {
        const { error } = await db.from('friendships').delete().eq('id', exists.id);
        if (error) dbFail('invite.reset', actor.userId, error);
      }
      const { error } = await db.from('friendships').insert({ requester_id: me, receiver_id: target });
      if (error) {
        if (error.code === '23505') return ok({ ok: true, already: 'pending' });
        dbFail('invite.insert', actor.userId, error);
      }
      return ok({ ok: true });
    }

    allowKeys(body, ['action', 'id']);
    enforceLimit('FRIEND_OPS', actor.userId);
    const id = uuid(body.id, 'Invite');
    const { data: f, error: fErr } = await db.from('friendships').select('id,requester_id,receiver_id,status').eq('id', id).maybeSingle();
    if (fErr) dbFail('lookup', actor.userId, fErr);
    // Rows the caller is not party to are reported as missing, not as forbidden: no existence oracle.
    if (!f || (f.requester_id !== me && f.receiver_id !== me)) throw new GameError(404, 'No such invite.', 'no_invite');

    if (action === 'accept' || action === 'reject') {
      if (f.receiver_id !== me) throw new GameError(403, 'Only the invited player can answer.', 'not_receiver');
      if (f.status !== 'pending') return ok({ ok: true, already: f.status });
      const { error } = await db.from('friendships').update({ status: action === 'accept' ? 'accepted' : 'rejected' }).eq('id', id).eq('receiver_id', me);
      if (error) dbFail('answer', actor.userId, error);
      return ok({ ok: true });
    }

    // remove: either party
    const { error } = await db.from('friendships').delete().eq('id', id).or(`requester_id.eq.${me},receiver_id.eq.${me}`);
    if (error) dbFail('remove', actor.userId, error);
    return ok({ ok: true });
  } catch (e) {
    return fail(e, ctx);
  }
}

const ALLOW = ['GET', 'POST'];
export function PUT() { return methodNotAllowed(ALLOW); }
export function PATCH() { return methodNotAllowed(ALLOW); }
export function DELETE() { return methodNotAllowed(ALLOW); }
