import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabase, getSessionUser } from '@/lib/supabase/server';
import { GameError, PLAYER_ERROR, describeError, logEvent } from './errors';
import { universeSeed } from '@/lib/env';
import { resolvePlanet, resolveSystem, type Planet, type StarSystem } from '@/game/universe';

/**
 * Server-side game actions. Every function:
 *   1. verifies the caller's session (cookie) and loads their id,
 *   2. regenerates the relevant object from the seed (never trusting ids/values from the client
 *      beyond "which object"),
 *   3. calls a SECURITY DEFINER Postgres function with the service role, which awards points
 *      from the `point_rules` table and enforces idempotency.
 */

export { GameError } from './errors';

export interface Actor {
  userId: string;
  service: SupabaseClient;
}

export async function requireActor(): Promise<Actor> {
  const user = await getSessionUser();
  if (!user) throw new GameError(401, PLAYER_ERROR.unauthenticated.sub, 'unauthenticated');
  const service = getServiceSupabase();
  if (!service) throw new GameError(503, PLAYER_ERROR.unavailable.sub, 'unavailable');
  return { userId: user.id, service };
}

export function requireSystem(id: string): StarSystem {
  const s = resolveSystem(universeSeed(), id);
  if (!s) throw new GameError(404, 'No such system.');
  return s;
}

export function requirePlanet(id: string): { system: StarSystem; planet: Planet } {
  const r = resolvePlanet(universeSeed(), id);
  if (!r) throw new GameError(404, 'No such planet.');
  return r;
}

export function systemAttributes(s: StarSystem) {
  return { starClass: s.starClass, starColor: s.starColor, planetCount: s.planets.length, mapX: s.mapX, mapY: s.mapY };
}

export function planetAttributes(p: Planet) {
  return {
    biome: p.biome,
    atmosphere: p.atmosphere,
    gravity: p.gravity,
    temperature: p.temperature,
    ring: p.ring,
    moons: p.moons,
    hazards: p.hazards,
    palette: p.palette.ramp,
    siteCount: p.sites.length,
    nodeCount: p.nodes.length,
  };
}

/**
 * Calls a scoring function. Database errors are logged (redacted) and surfaced to the player as the
 * generic in-tone failure: PostgREST messages contain constraint and function names.
 */
async function rpc<T>(actor: Actor, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await actor.service.rpc(fn, args);
  if (error) {
    logEvent('error', 'db.rpc', { fn, userId: actor.userId, ...describeError(error) });
    throw new GameError(500, PLAYER_ERROR.generic.sub, 'db');
  }
  return (Array.isArray(data) ? data[0] : data) as T;
}

export async function visitSystem(actor: Actor, systemId: string) {
  const s = requireSystem(systemId);
  return rpc<{ points_awarded: number; first_visit: boolean }>(actor, 'visit_system', {
    p_player: actor.userId,
    p_system: s.id,
    p_seed: s.seed,
    p_name: s.name,
    p_attributes: systemAttributes(s),
  });
}

export async function discoverPlanet(actor: Actor, planetId: string) {
  const { system, planet } = requirePlanet(planetId);
  return rpc<{ points_awarded: number; newly_discovered: boolean; first_find: boolean }>(actor, 'discover_planet', {
    p_player: actor.userId,
    p_planet: planet.id,
    p_system: system.id,
    p_seed: planet.seed,
    p_name: planet.name,
    p_rarity: planet.rarity,
    p_attributes: planetAttributes(planet),
    p_system_seed: system.seed,
    p_system_name: system.name,
    p_system_attributes: systemAttributes(system),
  });
}

export async function discoverSite(actor: Actor, planetId: string, siteIndex: number) {
  const { system, planet } = requirePlanet(planetId);
  const site = planet.sites[siteIndex];
  if (!site) throw new GameError(404, 'No such site.');
  const res = await rpc<{ points_awarded: number; newly_discovered: boolean }>(actor, 'discover_site', {
    p_player: actor.userId,
    p_site: site.id,
    p_planet: planet.id,
    p_system: system.id,
    p_name: site.name,
    p_rarity: site.rarity,
    p_attributes: { kind: site.kind, tx: site.tx, ty: site.ty },
  });
  const fullScan = await rpc<number>(actor, 'check_full_scan', { p_player: actor.userId, p_planet: planet.id, p_site_count: planet.sites.length });
  return { ...res, site, full_scan_points: fullScan ?? 0 };
}

export async function collectNode(actor: Actor, planetId: string, nodeIndex: number) {
  const { system, planet } = requirePlanet(planetId);
  const node = planet.nodes[nodeIndex];
  if (!node) throw new GameError(404, 'No such resource node.');
  const res = await rpc<{ points_awarded: number; collected: boolean; new_resource: boolean }>(actor, 'collect_node', {
    p_player: actor.userId,
    p_node: node.id,
    p_planet: planet.id,
    p_system: system.id,
    p_resource: node.resource.id,
    p_resource_name: node.resource.name,
    p_rarity: node.resource.tier,
    p_quantity: node.amount,
  });
  return { ...res, node };
}

/** Which sites/nodes on this planet has the player already handled? Lets the client render state. */
export async function planetProgress(actor: Actor, planetId: string) {
  const { planet } = requirePlanet(planetId);
  const [sites, nodes, discovered] = await Promise.all([
    actor.service.from('discoveries').select('entity_id').eq('player_id', actor.userId).eq('discovery_type', 'site').eq('planet_id', planet.id),
    actor.service.from('collections').select('node_id').eq('player_id', actor.userId).eq('planet_id', planet.id),
    actor.service.from('discoveries').select('id').eq('player_id', actor.userId).eq('discovery_type', 'planet').eq('entity_id', planet.id).maybeSingle(),
  ]);
  return {
    scannedSites: (sites.data ?? []).map((r) => r.entity_id as string),
    collectedNodes: (nodes.data ?? []).map((r) => r.node_id as string),
    planetDiscovered: Boolean(discovered.data),
  };
}
