import { collectNode, discoverPlanet, discoverSite, planetProgress, requireActor, visitSystem } from '@/server/game';
import { actionOf, allowKeys, assertSameOrigin, enforceIpLimit, enforceLimit, fail, gameId, int, methodNotAllowed, ok, readJsonObject } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/game  (route contract, spec 46.24)
 *
 * Who:        any signed-in player (guest or permanent). Identity comes from the session cookie only.
 * Input:      JSON object, max 8 KB, exactly one of:
 *               { action: 'visit_system', systemId }
 *               { action: 'land',         planetId }
 *               { action: 'scan_site',    planetId, siteIndex 0..64 }
 *               { action: 'collect',      planetId, nodeIndex 0..64 }
 *               { action: 'progress',     planetId }
 *             Ids are deterministic game ids (`system:n`, `planet:n:m`) and are regenerated from the
 *             seed on the server; unknown fields are rejected.
 * Authn:      requireActor() (Supabase session). Missing/expired session -> 401.
 * Authz:      the caller can only ever act as themselves; the SECURITY DEFINER scoring functions
 *             receive actor.userId, never a client-supplied user id.
 * Reads:      discoveries, collections (progress).
 * Writes:     systems, planets, discoveries, collections, inventory, point_events, player_profiles
 *             (points / discovery_count) through award_points & co. Point values come from point_rules.
 * Frequency:  60 game actions / min / player, 40 point-awarding actions / min and 250 / 10 min,
 *             plus 240 requests / min / IP across all API routes.
 * CSRF:       Origin must match this deployment.
 */
export async function POST(req: Request) {
  const ctx = { route: 'game', userId: undefined as string | undefined };
  try {
    assertSameOrigin(req);
    enforceIpLimit(req);
    const actor = await requireActor();
    ctx.userId = actor.userId;
    enforceLimit('GAME_ACTIONS', actor.userId);

    const body = await readJsonObject(req);
    const action = actionOf(body, ['visit_system', 'land', 'scan_site', 'collect', 'progress'] as const);

    if (action !== 'progress') {
      enforceLimit('POINT_ACTIONS', actor.userId);
      enforceLimit('POINT_ACTIONS_LONG', actor.userId);
    }

    switch (action) {
      case 'visit_system':
        allowKeys(body, ['action', 'systemId']);
        return ok(await visitSystem(actor, gameId(body.systemId, 'system')));
      case 'land':
        allowKeys(body, ['action', 'planetId']);
        return ok(await discoverPlanet(actor, gameId(body.planetId, 'planet')));
      case 'scan_site':
        allowKeys(body, ['action', 'planetId', 'siteIndex']);
        return ok(await discoverSite(actor, gameId(body.planetId, 'planet'), int(body.siteIndex, 0, 64, 'Site')));
      case 'collect':
        allowKeys(body, ['action', 'planetId', 'nodeIndex']);
        return ok(await collectNode(actor, gameId(body.planetId, 'planet'), int(body.nodeIndex, 0, 64, 'Node')));
      case 'progress':
        allowKeys(body, ['action', 'planetId']);
        return ok(await planetProgress(actor, gameId(body.planetId, 'planet')));
    }
  } catch (e) {
    return fail(e, ctx);
  }
}

const ALLOW = ['POST'];
export function GET() { return methodNotAllowed(ALLOW); }
export function PUT() { return methodNotAllowed(ALLOW); }
export function PATCH() { return methodNotAllowed(ALLOW); }
export function DELETE() { return methodNotAllowed(ALLOW); }
