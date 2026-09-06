-- JUST NEED SOME SPACE. : initial schema
-- Run in the Supabase SQL editor or with `supabase db push`.
--
-- Design notes
--  * The universe is generated deterministically in application code. Only player-generated state
--    lives here. `systems` and `planets` are registries of *seen* generated objects (id + seed +
--    attributes snapshot) so the Codex can show "discovered by" without regenerating on the server.
--  * Points are never written by clients. All awards go through SECURITY DEFINER functions that
--    insert into `point_events` (an append-only ledger) and bump the cached `player_profiles.points`.
--  * Every table has RLS. Players can read their own rows and public profile/codex data; writes to
--    progression tables are only possible through the RPCs below, which are executed by the server
--    (service role) after it has verified the user's session.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles
create table if not exists public.player_profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name     text not null check (char_length(display_name) between 1 and 32),
  planet_name      text check (planet_name is null or char_length(planet_name) between 1 and 32),
  avatar_seed      integer not null default 0,
  points           integer not null default 0 check (points >= 0),
  discovery_count  integer not null default 0 check (discovery_count >= 0),
  current_rocket_id uuid,
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------------ rockets
create table if not exists public.rockets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.player_profiles(user_id) on delete cascade,
  name       text not null default 'Unnamed' check (char_length(name) between 1 and 24),
  body       text not null check (body in ('stub','needle','barrel')),
  engine     text not null check (engine in ('single','twin','wide')),
  fins       text not null check (fins in ('swept','box','blade')),
  color      text not null check (color in ('cream','rust','moss','slate','ochre','navy')),
  accent     text not null check (accent in ('cream','rust','moss','slate','ochre','navy')),
  decal      text not null check (decal in ('none','stripe','ring','number')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rockets_owner_idx on public.rockets(owner_id);

alter table public.player_profiles
  drop constraint if exists player_profiles_current_rocket_fk,
  add constraint player_profiles_current_rocket_fk
    foreign key (current_rocket_id) references public.rockets(id) on delete set null;

-- ------------------------------------------------------------------ generated-object registries
create table if not exists public.systems (
  id          text primary key,            -- "system:3"
  seed        bigint not null,
  name        text not null,
  attributes  jsonb not null default '{}',
  first_visited_by uuid references public.player_profiles(user_id) on delete set null,
  first_visited_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists public.planets (
  id          text primary key,            -- "planet:3:1"
  system_id   text not null references public.systems(id),
  seed        bigint not null,
  name        text not null,
  attributes  jsonb not null default '{}', -- biome, atmosphere, gravity, temperature, rarity, palette
  first_discovered_by uuid references public.player_profiles(user_id) on delete set null,
  first_discovered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists planets_system_idx on public.planets(system_id);

create table if not exists public.resources (
  id     text primary key,                 -- slug, e.g. "iron-grit"
  name   text not null,
  rarity text not null check (rarity in ('common','rare','exotic'))
);

-- ------------------------------------------------------------------ progression
create table if not exists public.discoveries (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.player_profiles(user_id) on delete cascade,
  discovery_type text not null check (discovery_type in ('system','planet','site','resource')),
  entity_id      text not null,            -- system/planet/site id, or resource slug
  planet_id      text references public.planets(id),
  system_id      text references public.systems(id),
  name           text not null,
  rarity         text not null default 'common',
  attributes     jsonb not null default '{}',
  first_find     boolean not null default false,
  discovered_at  timestamptz not null default now(),
  unique (player_id, discovery_type, entity_id)
);
create index if not exists discoveries_player_idx on public.discoveries(player_id, discovered_at desc);

create table if not exists public.inventory (
  player_id    uuid not null references public.player_profiles(user_id) on delete cascade,
  resource_id  text not null references public.resources(id),
  quantity     integer not null default 0 check (quantity >= 0),
  updated_at   timestamptz not null default now(),
  primary key (player_id, resource_id)
);

-- each harvested node is recorded so a node can only be collected once per player
create table if not exists public.collections (
  player_id    uuid not null references public.player_profiles(user_id) on delete cascade,
  node_id      text not null,              -- "res:3:1:4"
  planet_id    text not null references public.planets(id),
  resource_id  text not null references public.resources(id),
  quantity     integer not null,
  collected_at timestamptz not null default now(),
  primary key (player_id, node_id)
);

create table if not exists public.point_rules (
  event  text primary key,
  points integer not null
);
insert into public.point_rules(event, points) values
  ('planet_discovered', 100),
  ('system_visited', 150),
  ('planet_fully_scanned', 75),
  ('site_discovered', 40),
  ('resource_common', 5),
  ('resource_rare', 25),
  ('resource_exotic', 50)
on conflict (event) do update set points = excluded.points;

create table if not exists public.point_events (
  id         bigint generated always as identity primary key,
  player_id  uuid not null references public.player_profiles(user_id) on delete cascade,
  event      text not null references public.point_rules(event),
  points     integer not null,
  source_id  text not null,
  created_at timestamptz not null default now(),
  unique (player_id, event, source_id)   -- idempotency: the same source never pays twice
);
create index if not exists point_events_player_idx on public.point_events(player_id, created_at desc);

-- ------------------------------------------------------------------ social
create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.player_profiles(user_id) on delete cascade,
  receiver_id  uuid not null references public.player_profiles(user_id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (requester_id <> receiver_id),
  unique (requester_id, receiver_id)
);
create index if not exists friendships_receiver_idx on public.friendships(receiver_id, status);

-- ------------------------------------------------------------------ presence (where everyone is right now)
create table if not exists public.presence (
  player_id   uuid primary key references public.player_profiles(user_id) on delete cascade,
  system_id   text,
  planet_id   text,
  x           real not null default 0,
  y           real not null default 0,
  facing      smallint not null default 1,
  action      text,                        -- 'wave' etc, short-lived
  action_at   timestamptz,
  last_active timestamptz not null default now()
);
create index if not exists presence_area_idx on public.presence(system_id, planet_id, last_active desc);

-- ------------------------------------------------------------------ updated_at triggers
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Players may edit their display fields, but points / discovery_count are owned by the scoring
-- functions. Any non-service request that tries to change them is rejected, not silently ignored.
create or replace function public.guard_profile_columns() returns trigger language plpgsql as $$
declare v_claim_role text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  -- inside the SECURITY DEFINER scoring functions current_user is the function owner, not the caller
  if v_claim_role <> 'service_role' and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if new.points is distinct from old.points
       or new.discovery_count is distinct from old.discovery_count
       or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at then
      raise exception 'points and discovery_count are computed server-side' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'player_profiles_touch') then
    create trigger player_profiles_touch before update on public.player_profiles for each row execute function public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'player_profiles_guard') then
    create trigger player_profiles_guard before update on public.player_profiles for each row execute function public.guard_profile_columns();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'rockets_touch') then
    create trigger rockets_touch before update on public.rockets for each row execute function public.touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'friendships_touch') then
    create trigger friendships_touch before update on public.friendships for each row execute function public.touch_updated_at();
  end if;
end $$;

-- ------------------------------------------------------------------ row level security
alter table public.player_profiles enable row level security;
alter table public.rockets         enable row level security;
alter table public.systems         enable row level security;
alter table public.planets         enable row level security;
alter table public.resources       enable row level security;
alter table public.discoveries     enable row level security;
alter table public.inventory       enable row level security;
alter table public.collections     enable row level security;
alter table public.point_rules     enable row level security;
alter table public.point_events    enable row level security;
alter table public.friendships     enable row level security;
alter table public.presence        enable row level security;

-- profiles: everyone signed in can read public profile fields; only the owner can update their own
drop policy if exists "profiles are readable by signed-in players" on public.player_profiles;
create policy "profiles are readable by signed-in players" on public.player_profiles for select to authenticated using (true);
drop policy if exists "players insert their own profile" on public.player_profiles;
create policy "players insert their own profile" on public.player_profiles for insert to authenticated with check (auth.uid() = user_id and points = 0 and discovery_count = 0);
drop policy if exists "players update their own profile" on public.player_profiles;
create policy "players update their own profile" on public.player_profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- rockets: readable by all signed-in players (you can see other rockets), writable by owner
drop policy if exists "rockets readable" on public.rockets;
create policy "rockets readable" on public.rockets for select to authenticated using (true);
drop policy if exists "rockets owner insert" on public.rockets;
create policy "rockets owner insert" on public.rockets for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists "rockets owner update" on public.rockets;
create policy "rockets owner update" on public.rockets for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "rockets owner delete" on public.rockets;
create policy "rockets owner delete" on public.rockets for delete to authenticated using (auth.uid() = owner_id);

-- registries + rules: read-only for players; written by RPCs
drop policy if exists "systems readable" on public.systems;
create policy "systems readable" on public.systems for select to authenticated using (true);
drop policy if exists "planets readable" on public.planets;
create policy "planets readable" on public.planets for select to authenticated using (true);
drop policy if exists "resources readable" on public.resources;
create policy "resources readable" on public.resources for select to authenticated using (true);
drop policy if exists "point rules readable" on public.point_rules;
create policy "point rules readable" on public.point_rules for select to authenticated using (true);

-- progression: players read their own; discoveries are also readable by others (codex "discovered by")
drop policy if exists "discoveries readable" on public.discoveries;
create policy "discoveries readable" on public.discoveries for select to authenticated using (true);
drop policy if exists "inventory own" on public.inventory;
create policy "inventory own" on public.inventory for select to authenticated using (auth.uid() = player_id);
drop policy if exists "collections own" on public.collections;
create policy "collections own" on public.collections for select to authenticated using (auth.uid() = player_id);
drop policy if exists "point events own" on public.point_events;
create policy "point events own" on public.point_events for select to authenticated using (auth.uid() = player_id);

-- friendships: both parties can read; requester inserts; receiver updates status
drop policy if exists "friendships visible to parties" on public.friendships;
create policy "friendships visible to parties" on public.friendships for select to authenticated using (auth.uid() in (requester_id, receiver_id));
drop policy if exists "friendships requester insert" on public.friendships;
create policy "friendships requester insert" on public.friendships for insert to authenticated with check (auth.uid() = requester_id);
drop policy if exists "friendships receiver responds" on public.friendships;
create policy "friendships receiver responds" on public.friendships for update to authenticated using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);
drop policy if exists "friendships requester withdraw" on public.friendships;
create policy "friendships requester withdraw" on public.friendships for delete to authenticated using (auth.uid() in (requester_id, receiver_id));

-- presence: everyone signed in can read (that is the point); players write only their own row
drop policy if exists "presence readable" on public.presence;
create policy "presence readable" on public.presence for select to authenticated using (true);
drop policy if exists "presence own insert" on public.presence;
create policy "presence own insert" on public.presence for insert to authenticated with check (auth.uid() = player_id);
drop policy if exists "presence own update" on public.presence;
create policy "presence own update" on public.presence for update to authenticated using (auth.uid() = player_id) with check (auth.uid() = player_id);
drop policy if exists "presence own delete" on public.presence;
create policy "presence own delete" on public.presence for delete to authenticated using (auth.uid() = player_id);

-- realtime: presence rows are broadcast to subscribers (Supabase Realtime "postgres_changes")
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'presence') then
      alter publication supabase_realtime add table public.presence;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
      alter publication supabase_realtime add table public.friendships;
    end if;
  end if;
end $$;
alter table public.presence replica identity full;

-- ------------------------------------------------------------------ scoring RPCs (SECURITY DEFINER)
-- Called by the Next.js server with the service role after verifying the user's session.
-- Each function is idempotent: repeating a call never awards points twice.

create or replace function public.award_points(p_player uuid, p_event text, p_source text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_points integer; v_inserted boolean;
begin
  select points into v_points from point_rules where event = p_event;
  if v_points is null then raise exception 'unknown point event %', p_event; end if;
  insert into point_events(player_id, event, points, source_id) values (p_player, p_event, v_points, p_source)
    on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted then
    update player_profiles set points = points + v_points where user_id = p_player;
    return v_points;
  end if;
  return 0;
end $$;

-- register (idempotently) a generated system / planet the server has resolved from the seed
create or replace function public.register_system(p_id text, p_seed bigint, p_name text, p_attributes jsonb)
returns void language sql security definer set search_path = public as $$
  insert into systems(id, seed, name, attributes) values (p_id, p_seed, p_name, p_attributes) on conflict (id) do nothing;
$$;

create or replace function public.register_planet(p_id text, p_system text, p_seed bigint, p_name text, p_attributes jsonb)
returns void language sql security definer set search_path = public as $$
  insert into planets(id, system_id, seed, name, attributes) values (p_id, p_system, p_seed, p_name, p_attributes) on conflict (id) do nothing;
$$;

-- visiting a system: first time for this player pays system_visited
create or replace function public.visit_system(p_player uuid, p_system text, p_seed bigint, p_name text, p_attributes jsonb)
returns table(points_awarded integer, first_visit boolean) language plpgsql security definer set search_path = public as $$
declare v_new boolean; v_pts integer := 0; v_first boolean := false;
begin
  perform register_system(p_system, p_seed, p_name, p_attributes);
  insert into discoveries(player_id, discovery_type, entity_id, system_id, name, rarity, attributes)
    values (p_player, 'system', p_system, p_system, p_name, 'common', p_attributes)
    on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new then
    v_pts := award_points(p_player, 'system_visited', p_system);
    update player_profiles set discovery_count = discovery_count + 1 where user_id = p_player;
    update systems set first_visited_by = p_player, first_visited_at = now() where id = p_system and first_visited_by is null;
    select (first_visited_by = p_player) into v_first from systems where id = p_system;
  end if;
  return query select v_pts, coalesce(v_first, false);
end $$;

-- landing on / scanning a planet
create or replace function public.discover_planet(p_player uuid, p_planet text, p_system text, p_seed bigint, p_name text, p_rarity text, p_attributes jsonb, p_system_seed bigint default 0, p_system_name text default null, p_system_attributes jsonb default '{}')
returns table(points_awarded integer, newly_discovered boolean, first_find boolean) language plpgsql security definer set search_path = public as $$
declare v_new boolean; v_pts integer := 0; v_first boolean := false;
begin
  perform register_system(p_system, p_system_seed, coalesce(p_system_name, p_system), p_system_attributes);
  perform register_planet(p_planet, p_system, p_seed, p_name, p_attributes);
  update planets set first_discovered_by = p_player, first_discovered_at = now() where id = p_planet and first_discovered_by is null;
  select (first_discovered_by = p_player) into v_first from planets where id = p_planet;
  insert into discoveries(player_id, discovery_type, entity_id, planet_id, system_id, name, rarity, attributes, first_find)
    values (p_player, 'planet', p_planet, p_planet, p_system, p_name, p_rarity, p_attributes, coalesce(v_first,false))
    on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new then
    v_pts := award_points(p_player, 'planet_discovered', p_planet);
    update player_profiles set discovery_count = discovery_count + 1 where user_id = p_player;
  end if;
  return query select v_pts, v_new, coalesce(v_first,false);
end $$;

-- scanning a point of interest on a planet
create or replace function public.discover_site(p_player uuid, p_site text, p_planet text, p_system text, p_name text, p_rarity text, p_attributes jsonb)
returns table(points_awarded integer, newly_discovered boolean) language plpgsql security definer set search_path = public as $$
declare v_new boolean; v_pts integer := 0;
begin
  insert into discoveries(player_id, discovery_type, entity_id, planet_id, system_id, name, rarity, attributes)
    values (p_player, 'site', p_site, p_planet, p_system, p_name, p_rarity, p_attributes)
    on conflict do nothing;
  get diagnostics v_new = row_count;
  if v_new then
    v_pts := award_points(p_player, 'site_discovered', p_site);
    update player_profiles set discovery_count = discovery_count + 1 where user_id = p_player;
  end if;
  return query select v_pts, v_new;
end $$;

-- collecting a resource node (once per node per player); first time a resource type is seen also writes a codex entry
create or replace function public.collect_node(p_player uuid, p_node text, p_planet text, p_system text, p_resource text, p_resource_name text, p_rarity text, p_quantity integer)
returns table(points_awarded integer, collected boolean, new_resource boolean) language plpgsql security definer set search_path = public as $$
declare v_new boolean; v_new_res boolean := false; v_pts integer := 0;
begin
  insert into resources(id, name, rarity) values (p_resource, p_resource_name, p_rarity) on conflict (id) do nothing;
  insert into collections(player_id, node_id, planet_id, resource_id, quantity) values (p_player, p_node, p_planet, p_resource, p_quantity)
    on conflict do nothing;
  get diagnostics v_new = row_count;
  if not v_new then return query select 0, false, false; return; end if;
  insert into inventory(player_id, resource_id, quantity) values (p_player, p_resource, p_quantity)
    on conflict (player_id, resource_id) do update set quantity = inventory.quantity + excluded.quantity, updated_at = now();
  v_pts := award_points(p_player, 'resource_' || p_rarity, p_node);
  insert into discoveries(player_id, discovery_type, entity_id, planet_id, system_id, name, rarity, attributes)
    values (p_player, 'resource', p_resource, p_planet, p_system, p_resource_name, p_rarity, jsonb_build_object('firstSeenOn', p_planet))
    on conflict do nothing;
  get diagnostics v_new_res = row_count;
  if v_new_res then update player_profiles set discovery_count = discovery_count + 1 where user_id = p_player; end if;
  return query select v_pts, true, v_new_res;
end $$;

-- a planet counts as fully scanned when every site on it has been discovered by this player
create or replace function public.check_full_scan(p_player uuid, p_planet text, p_site_count integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_found integer;
begin
  select count(*) into v_found from discoveries where player_id = p_player and discovery_type = 'site' and planet_id = p_planet;
  if v_found >= p_site_count and p_site_count > 0 then
    return award_points(p_player, 'planet_fully_scanned', p_planet);
  end if;
  return 0;
end $$;

-- lock the RPCs down: only the service role (server) may call the scoring functions
revoke execute on function public.award_points(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.register_system(text, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.register_planet(text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.visit_system(uuid, text, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.discover_planet(uuid, text, text, bigint, text, text, jsonb, bigint, text, jsonb) from public, anon, authenticated;
revoke execute on function public.discover_site(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.collect_node(uuid, text, text, text, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.check_full_scan(uuid, text, integer) from public, anon, authenticated;

-- ------------------------------------------------------------------ public read model for the codex
create or replace view public.codex_entries as
  select d.id, d.player_id, p.username as discovered_by, d.discovery_type, d.entity_id, d.planet_id, d.system_id,
         d.name, d.rarity, d.attributes, d.first_find, d.discovered_at
  from discoveries d join player_profiles p on p.user_id = d.player_id;
grant select on public.codex_entries to authenticated;
