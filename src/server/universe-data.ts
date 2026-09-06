import 'server-only';
import { getServerSupabase } from '@/lib/supabase/server';

export interface DiscoveryLite {
  entity_id: string;
  discovery_type: string;
  discovered_at: string;
}

/** The signed-in player's own discovery ids, used to mark discovered vs undiscovered on maps. */
export async function myDiscoveries(userId: string): Promise<{ systems: Set<string>; planets: Set<string>; sites: Set<string> }> {
  const supabase = await getServerSupabase();
  const out = { systems: new Set<string>(), planets: new Set<string>(), sites: new Set<string>() };
  if (!supabase) return out;
  const { data } = await supabase.from('discoveries').select('entity_id,discovery_type').eq('player_id', userId).in('discovery_type', ['system', 'planet', 'site']);
  for (const d of data ?? []) {
    if (d.discovery_type === 'system') out.systems.add(d.entity_id);
    else if (d.discovery_type === 'planet') out.planets.add(d.entity_id);
    else out.sites.add(d.entity_id);
  }
  return out;
}

/** Who found each planet first (public, for the codex + system map). */
export async function firstFinders(planetIds: string[]): Promise<Map<string, { username: string; at: string }>> {
  const supabase = await getServerSupabase();
  const map = new Map<string, { username: string; at: string }>();
  if (!supabase || planetIds.length === 0) return map;
  const { data } = await supabase.from('planets').select('id,first_discovered_at,player_profiles!planets_first_discovered_by_fkey(username)').in('id', planetIds);
  for (const row of data ?? []) {
    const p = row.player_profiles as unknown as { username: string } | null;
    if (p && row.first_discovered_at) map.set(row.id as string, { username: p.username, at: row.first_discovered_at as string });
  }
  return map;
}
