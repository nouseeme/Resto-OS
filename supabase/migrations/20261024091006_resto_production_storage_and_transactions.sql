-- Server-only tables. Browsers access the Express API, never these tables.
create schema if not exists resto_private;
revoke all on schema resto_private from public, anon, authenticated;
grant usage on schema resto_private to service_role;
create table resto_private.revision (id boolean primary key default true check(id), version bigint not null default 0);
insert into resto_private.revision(id) values(true);

do $$
declare t text;
begin
  foreach t in array array['settings','menu','tabs','orders','portions','payments','users','sessions','audit','bans','requests','login_attempts'] loop
    execute format('create table resto_private.%I (key text primary key, position bigint not null default 0, body jsonb not null check(jsonb_typeof(body) = ''object''))', t);
    execute format('alter table resto_private.%I enable row level security', t);
  end loop;
end $$;
alter table resto_private.revision enable row level security;
grant select, insert, update, delete on all tables in schema resto_private to service_role;

alter table resto_private.tabs add column normalized_name text generated always as (lower(regexp_replace(btrim(body->>'name'), '\s+', ' ', 'g'))) stored;
create unique index active_customer_name on resto_private.tabs(normalized_name) where body->>'closedAt' is null;
alter table resto_private.orders add column tab_id text generated always as (body->>'tabId') stored references resto_private.tabs(key);
alter table resto_private.portions add column order_id text generated always as (body->>'orderId') stored references resto_private.orders(key);
alter table resto_private.portions add column price bigint generated always as ((body->>'price')::bigint) stored check(price > 0 and price <= 10000000);
alter table resto_private.payments add column order_id text generated always as (body->>'orderId') stored references resto_private.orders(key);
alter table resto_private.payments add column amount bigint generated always as ((body->>'amount')::bigint) stored check(amount > 0);
alter table resto_private.sessions add column user_id text generated always as (body->>'userId') stored references resto_private.users(key);
create unique index staff_username on resto_private.users((body->>'username'));
create index orders_tab on resto_private.orders(tab_id);
create index portions_order on resto_private.portions(order_id);
create index payments_order on resto_private.payments(order_id);
create index sessions_user on resto_private.sessions(user_id);
create index pending_orders on resto_private.orders((body->>'autoAcceptAt')) where body->>'status' = 'waiting';

-- Both RPCs are SECURITY INVOKER and executable only with the server's secret key.
create function public.resto_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('version', r.version, 'rows', jsonb_build_object(
    'settings', coalesce((select jsonb_agg(body order by position,key) from resto_private.settings),'[]'),
    'menu', coalesce((select jsonb_agg(body order by position,key) from resto_private.menu),'[]'),
    'tabs', coalesce((select jsonb_agg(body order by position,key) from resto_private.tabs),'[]'),
    'orders', coalesce((select jsonb_agg(body order by position,key) from resto_private.orders),'[]'),
    'portions', coalesce((select jsonb_agg(body order by position,key) from resto_private.portions),'[]'),
    'payments', coalesce((select jsonb_agg(body order by position,key) from resto_private.payments),'[]'),
    'users', coalesce((select jsonb_agg(body order by position,key) from resto_private.users),'[]'),
    'sessions', coalesce((select jsonb_agg(body order by position,key) from resto_private.sessions),'[]'),
    'audit', coalesce((select jsonb_agg(body order by position,key) from resto_private.audit),'[]'),
    'bans', coalesce((select jsonb_agg(body order by position,key) from resto_private.bans),'[]'),
    'requests', coalesce((select jsonb_agg(body order by position,key) from resto_private.requests),'[]'),
    'login_attempts', coalesce((select jsonb_agg(body order by position,key) from resto_private.login_attempts),'[]')
  )) from resto_private.revision r where r.id;
$$;

create function public.resto_commit(expected_version bigint, changes jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare current_version bigint; t text; entry jsonb;
begin
  select version into current_version from resto_private.revision where id for update;
  if current_version <> expected_version then return false; end if;
  -- Remove children before their parents; insert parents before children.
  foreach t in array array['portions','payments','sessions','requests','bans','audit','login_attempts','orders','tabs','menu','users','settings'] loop
    execute format('delete from resto_private.%I where key in (select jsonb_array_elements_text($1))',t)
      using coalesce(changes->t->'delete','[]');
  end loop;
  foreach t in array array['settings','users','menu','tabs','orders','portions','payments','sessions','audit','bans','requests','login_attempts'] loop
    for entry in select value from jsonb_array_elements(coalesce(changes->t->'upsert','[]')) loop
      execute format('insert into resto_private.%I(key,position,body) values($1,$2,$3) on conflict(key) do update set position=excluded.position, body=excluded.body',t)
        using entry->>'key', (entry->>'position')::bigint, entry->'body';
    end loop;
  end loop;
  update resto_private.revision set version = version + 1 where id;
  return true;
end $$;
revoke all on function public.resto_snapshot() from public, anon, authenticated;
revoke all on function public.resto_commit(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.resto_snapshot(), public.resto_commit(bigint,jsonb) to service_role;

-- Cron holds the same revision lock as application writes; no timer runs on Vercel.
create function resto_private.auto_accept() returns integer
language plpgsql security invoker set search_path = '' as $$
declare o record; accepted integer := 0; stamp text := to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  if not exists(select 1 from resto_private.orders where body->>'status'='waiting' and (body->>'autoAcceptAt')::timestamptz <= clock_timestamp()) then return 0; end if;
  perform 1 from resto_private.revision where id for update;
  for o in select key from resto_private.orders where body->>'status'='waiting' and (body->>'autoAcceptAt')::timestamptz <= clock_timestamp() loop
    update resto_private.orders set body=body || jsonb_build_object('status','accepted','acceptedAt',stamp,'acceptedBy','Otomatis') where key=o.key;
    update resto_private.portions set body=body || '{"status":"accepted"}'::jsonb where order_id=o.key and body->>'status'='waiting';
    insert into resto_private.audit(key,position,body) values(gen_random_uuid()::text, extract(epoch from clock_timestamp())::bigint, jsonb_build_object('id',gen_random_uuid()::text,'at',stamp,'actor','Sistem','action','auto_accept','detail',o.key));
    accepted := accepted + 1;
  end loop;
  if accepted > 0 then update resto_private.revision set version=version+1 where id; end if;
  return accepted;
end $$;
revoke all on function resto_private.auto_accept() from public,anon,authenticated;
create extension if not exists pg_cron;
select cron.schedule('resto-auto-accept','1 second','select resto_private.auto_accept()');

-- Public images, server-only mutations. No browser INSERT/UPDATE/DELETE policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('menu-images','menu-images',true,2097152,array['image/webp'])
on conflict(id) do nothing;
-- The project initially exposed this event-trigger helper; it is not a public API.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
notify pgrst, 'reload schema';
