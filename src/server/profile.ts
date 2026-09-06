import 'server-only';

import { cache } from 'react';

import { getServerSupabase, getSessionUser } from '@/lib/supabase/server';

import {
  rocketFromRow,
  suitFromRow,
  type RocketConfig,
  type SuitConfig,
} from '@/game/rockets';

export interface Profile {
  user_id: string;
  username: string;
  display_name: string;
  planet_name: string | null;
  avatar_seed: number;
  points: number;
  discovery_count: number;
  current_rocket_id: string | null;
  onboarded_at: string | null;
  created_at: string;
  suit_primary?: string | null;
  suit_secondary?: string | null;
  suit_visor?: string | null;
  suit_pack?: string | null;
}

export interface RocketRow {
  id: string;
  name: string;
  body: string;
  engine: string;
  fins: string;
  color: string;
  accent: string;
  decal: string;
  engine_color?: string | null;
  fin_color?: string | null;
  decal_color?: string | null;
  updated_at: string;
}

export interface Viewer {
  userId: string;
  email: string | null;
  profile: Profile | null;
  rocket: RocketRow | null;
  rocketConfig: RocketConfig;
  suit: SuitConfig;
  /** true for accounts created without an email (guest explorers) */
  isGuest: boolean;
}

/** Signed-in user + profile + current rocket for the current request (memoised per request). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const user = await getSessionUser();

  if (!user) return null;

  const supabase = await getServerSupabase();

  if (!supabase) return null;

  const { data: profile, error: profileError } = await supabase
    .from('player_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  console.log('PROFILE CHECK:', {
    userId: user.id,
    profile,
    profileError,
  });

  let rocket: RocketRow | null = null;

  if (profile?.current_rocket_id) {
    const { data } = await supabase
      .from('rockets')
      .select(
        'id,name,body,engine,fins,color,accent,decal,engine_color,fin_color,decal_color,updated_at'
      )
      .eq('id', profile.current_rocket_id)
      .maybeSingle();

    rocket = (data as RocketRow | null) ?? null;
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: (profile as Profile | null) ?? null,
    rocket,
    rocketConfig: rocketFromRow(rocket),
    suit: suitFromRow(profile as Profile | null),
    isGuest:
      Boolean((user as { is_anonymous?: boolean }).is_anonymous) ||
      !user.email,
  };
});