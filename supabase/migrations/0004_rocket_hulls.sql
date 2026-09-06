-- JUST NEED SOME SPACE. : more rocket hulls
-- Additive and idempotent. Widens the hull (body) check constraint on public.rockets so the five
-- ship hulls added to src/game/rockets.ts (delta, cruiser, interceptor, hauler, lancer) can be
-- saved. Engine and fin ids are unchanged. The API validates every id against the catalogue
-- before it reaches the database; this constraint is the second line of defence.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.rockets'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%needle%'
  loop
    execute format('alter table public.rockets drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.rockets
  add constraint rockets_body_check check (body in ('stub','needle','barrel','delta','cruiser','interceptor','hauler','lancer'));

notify pgrst, 'reload schema';
