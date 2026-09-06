/**
 * Scoring rules. Points are only ever awarded inside Postgres functions (see supabase/migrations),
 * which read these same values from the `point_rules` table. This file is the human-readable
 * source of truth that the migration seeds from, plus the client-side preview.
 */
export const POINT_RULES = {
  planet_discovered: 100,
  system_visited: 150,
  planet_fully_scanned: 75,
  site_discovered: 40,
  resource_common: 5,
  resource_rare: 25,
  resource_exotic: 50,
} as const;

export type PointEvent = keyof typeof POINT_RULES;

export const POINT_RULE_LABELS: Record<PointEvent, string> = {
  planet_discovered: 'Discover a planet',
  system_visited: 'Visit a new system',
  planet_fully_scanned: 'Fully scan a planet',
  site_discovered: 'Discover a point of interest',
  resource_common: 'Collect a common resource',
  resource_rare: 'Collect a rare resource',
  resource_exotic: 'Collect an exotic resource',
};

/** Tiles the player has to be within to interact with a node or site. */
export const INTERACT_RANGE_TILES = 1.6;

/** Presence heartbeat cadence (ms) and the window after which a player is considered offline. */
export const PRESENCE_HEARTBEAT_MS = 4000;
export const PRESENCE_STALE_MS = 15000;

/** Tiles per second on foot. */
export const WALK_SPEED = 4.2;
