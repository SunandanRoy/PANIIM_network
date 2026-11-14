-- pan-iim-network: UNINSTALL. Removes every net_ object and nothing else. Host tables are untouched.
-- Irreversible for module data: run net_retention_delete(true) first if you want the counts.
begin;
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'net\_%'
  loop
    execute format('drop function if exists %s cascade', r.sig);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'net\_%' and c.relkind = 'v'
  loop
    execute format('drop view if exists public.%I cascade', r.relname);
  end loop;
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relname like 'net\_%' and c.relkind = 'r'
  loop
    execute format('drop table if exists public.%I cascade', r.relname);
  end loop;
end $$;
commit;
