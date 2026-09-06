-- 0003_security_hardening.sql
-- Section 46: production backend hardening. Idempotent; safe to re-run on hosted Supabase and
-- on the local stack. Nothing here changes game rules; it tightens who can touch what and makes
-- the remaining lookups indexed.

-- ------------------------------------------------------------------ 1. privileges (defence in depth under RLS)
-- The `anon` role (visitors with no session) has no business reading or writing game tables.
-- RLS already returns nothing for it because every policy targets `authenticated`, but 46.7 asks
-- for that to be explicit rather than implied.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Signed-in players only ever get what the policies allow, and never DDL-ish rights.
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;

-- Reference tables are read-only for everyone except the service role / migrations.
revoke insert, update, delete on public.systems, public.planets, public.resources, public.point_rules from authenticated;

-- Tables that only the scoring functions write. RLS has no insert/update/delete policy on them
-- (so clients are refused already); revoking the privilege makes the intent explicit in \dp too.
revoke insert, update, delete on public.inventory, public.collections, public.point_events, public.discoveries from authenticated;

-- Scoring functions: only the service role (called from the API after the session check) may execute.
do $$
declare f text;
begin
  foreach f in array array['award_points','visit_system','discover_planet','discover_site','collect_node','check_full_scan','register_planet','register_system']
  loop
    execute format('revoke all on function public.%I from public, anon, authenticated', f);
    execute format('grant execute on function public.%I to service_role', f);
  end loop;
end $$;

-- Trigger functions are never called directly by clients.
revoke all on function public.guard_profile_columns() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;

-- ------------------------------------------------------------------ 2. search_path pinned on every function we own
-- SECURITY DEFINER functions already pin search_path=public (0001). Trigger functions run as the
-- invoking role; pinning them too closes the last search_path hijack avenue.
alter function public.guard_profile_columns() set search_path = public;
alter function public.touch_updated_at() set search_path = public;

-- ------------------------------------------------------------------ 3. codex view runs with the reader's own rights
-- With security_invoker the view is subject to the caller's RLS on discoveries / player_profiles
-- (both are readable by authenticated, which is the intended public Codex) instead of the owner's.
alter view public.codex_entries set (security_invoker = true);
revoke all on public.codex_entries from anon, authenticated;
grant select on public.codex_entries to authenticated, service_role;

-- ------------------------------------------------------------------ 4. missing foreign-key indexes (46.1 / 46.27)
create index if not exists player_profiles_current_rocket_idx on public.player_profiles(current_rocket_id);
create index if not exists systems_first_visited_by_idx on public.systems(first_visited_by);
create index if not exists planets_first_discovered_by_idx on public.planets(first_discovered_by);
create index if not exists discoveries_planet_idx on public.discoveries(planet_id);
create index if not exists discoveries_system_idx on public.discoveries(system_id);
create index if not exists inventory_resource_idx on public.inventory(resource_id);
create index if not exists collections_resource_idx on public.collections(resource_id);
create index if not exists collections_planet_idx on public.collections(planet_id);
create index if not exists point_events_event_idx on public.point_events(event);
create index if not exists friendships_requester_idx on public.friendships(requester_id, status);
create index if not exists presence_last_active_idx on public.presence(last_active);

-- ------------------------------------------------------------------ 5. presence: no impersonation, no stale-in-the-future rows
-- Presence rows are written by the API with the service role; if a client ever writes directly
-- the policies already scope player_id to auth.uid(). These checks keep the cosmetic fields sane.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'presence_position_check') then
    alter table public.presence add constraint presence_position_check check (x between -1000 and 1000 and y between -1000 and 1000 and facing in (-1, 1));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'presence_action_check') then
    alter table public.presence add constraint presence_action_check check (action is null or action in ('wave'));
  end if;
end $$;

-- ------------------------------------------------------------------ 6. friendships: no self-friendship rows
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'friendships_not_self_check') then
    alter table public.friendships add constraint friendships_not_self_check check (requester_id <> receiver_id);
  end if;
end $$;

-- ------------------------------------------------------------------ 7. rockets and profiles: guard updated_at / owner changes from clients
-- Owners may restyle their rocket but never hand it to someone else.
create or replace function public.guard_rocket_owner() returns trigger language plpgsql set search_path = public as $$
declare v_claim_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if v_claim_role <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
      raise exception 'rocket ownership is fixed' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_rocket_owner() from public, anon, authenticated;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'rockets_guard_owner') then
    create trigger rockets_guard_owner before update on public.rockets for each row execute function public.guard_rocket_owner();
  end if;
end $$;

-- ------------------------------------------------------------------ 8. document the policy set (no "allow all" anywhere)
comment on table public.player_profiles is 'RLS: authenticated may read all (public directory), insert/update only own row; points/discovery_count/user_id/created_at guarded by trigger; writes with rules go through the API.';
comment on table public.rockets is 'RLS: authenticated may read all (rockets are visible in multiplayer), insert/update/delete only own; owner_id guarded by trigger.';
comment on table public.inventory is 'RLS: own rows only. Quantities are written exclusively by collect_node (SECURITY DEFINER, service role).';
comment on table public.point_events is 'RLS: own rows only, read-only. Written exclusively by award_points. unique(player,event,source) makes awards idempotent.';
comment on table public.discoveries is 'RLS: authenticated may read all (Codex); no client insert/update/delete. Written by the discovery functions only.';
comment on table public.collections is 'RLS: own rows only, read-only for clients.';
comment on table public.friendships is 'RLS: parties only; requester inserts, receiver updates status, either deletes. No self rows.';
comment on table public.presence is 'RLS: authenticated may read all (multiplayer), write own row only. API writes with service role after session check.';
comment on table public.systems is 'Reference data written by register_system; read-only for players.';
comment on table public.planets is 'Reference data written by register_planet; read-only for players.';
comment on table public.resources is 'Reference data; read-only for players.';
comment on table public.point_rules is 'Point values per event; read-only for players, edited by migrations only.';

notify pgrst, 'reload schema';
