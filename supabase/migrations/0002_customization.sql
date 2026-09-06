-- JUST NEED SOME SPACE. : customization (section 45)
-- Additive and idempotent. Adds per-region rocket colours, astronaut suit colours, widens the
-- swatch set, and lets the profile own the astronaut configuration. Existing rows keep working:
-- the new rocket colour columns are nullable and the renderer falls back to body/accent colours.

-- ------------------------------------------------------------------ swatches
-- The catalogue lives in src/game/rockets.ts; the database mirrors it so a direct write with an
-- unknown id is rejected even if the API were bypassed.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.rockets'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%cream%'
  loop
    execute format('alter table public.rockets drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.rockets
  add column if not exists engine_color text,
  add column if not exists fin_color    text,
  add column if not exists decal_color  text;

alter table public.rockets
  add constraint rockets_color_check       check (color        in ('cream','rust','moss','slate','ochre','navy','sky','starlight')),
  add constraint rockets_accent_check      check (accent       in ('cream','rust','moss','slate','ochre','navy','sky','starlight')),
  add constraint rockets_engine_color_check check (engine_color is null or engine_color in ('cream','rust','moss','slate','ochre','navy','sky','starlight')),
  add constraint rockets_fin_color_check    check (fin_color    is null or fin_color    in ('cream','rust','moss','slate','ochre','navy','sky','starlight')),
  add constraint rockets_decal_color_check  check (decal_color  is null or decal_color  in ('cream','rust','moss','slate','ochre','navy','sky','starlight'));

-- ------------------------------------------------------------------ astronaut suit
alter table public.player_profiles
  add column if not exists suit_primary   text not null default 'cream',
  add column if not exists suit_secondary text not null default 'slate',
  add column if not exists suit_visor     text not null default 'sky',
  add column if not exists suit_pack      text not null default 'navy';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'player_profiles_suit_check') then
    alter table public.player_profiles
      add constraint player_profiles_suit_check check (
        suit_primary   in ('cream','rust','moss','slate','ochre','navy','sky','starlight') and
        suit_secondary in ('cream','rust','moss','slate','ochre','navy','sky','starlight') and
        suit_visor     in ('cream','rust','moss','slate','ochre','navy','sky','starlight') and
        suit_pack      in ('cream','rust','moss','slate','ochre','navy','sky','starlight')
      );
  end if;
end $$;

-- Display names: no control characters, trimmed, 1 to 32 characters (mirrors normalizeDisplayName).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'player_profiles_display_name_clean') then
    alter table public.player_profiles
      add constraint player_profiles_display_name_clean check (
        display_name !~ '[\u0001-\u001f\u007f]' and display_name = btrim(display_name)
      );
  end if;
end $$;

-- Other players need to see suit colours on the surface: presence reads go through the service
-- role in /api/presence, and the existing "profiles readable" select policy already covers them.

notify pgrst, 'reload schema';
