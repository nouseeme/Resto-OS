-- Additive rollout: old clients retain the original snapshot/commit contract.
alter table resto_private.revision add column catalog_version bigint not null default 0;

create function public.resto_context(session_key text default null) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce((
    select jsonb_build_object('session',s.body,'staff',u.body-'password')
    from resto_private.sessions s
    join resto_private.users u on u.key=s.user_id
    join auth.users a on a.id::text=s.body->>'authUserId'
    where s.key=session_key and (s.body->>'expiresAt')::timestamptz>now()
      and a.email_confirmed_at is not null and (a.banned_until is null or a.banned_until<=now())
    limit 1
  ),'{}'::jsonb);
$$;

create function public.resto_view(read_scope text, guest_key text default null, known_version text default null, period_start text default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare result jsonb; stamp text; guest jsonb; active_ids text[]; chosen_orders text[]; chosen_tabs text[]; start_at timestamptz;
begin
  if read_scope not in ('portal','kitchen','waiter','manager','manager-overview','manager-history','manager-finance','manager-menu','manager-settings') then raise exception 'Invalid read scope'; end if;
  start_at:=period_start::timestamptz;
  if read_scope='portal' then
    with recursive owners as (
      select key as original_key,position,key,body, array[key] as visited from resto_private.tabs where body->>'token'=guest_key
      union all
      select o.original_key,o.position,t.key,t.body,o.visited||t.key from owners o join resto_private.tabs t on t.key=o.body->>'mergedInto' where not t.key=any(o.visited)
    )
    select jsonb_build_object('key',original_key,'status',case when body->>'closedAt' is null then 'active' else 'closed' end,'tabId',case when body->>'closedAt' is null then key end,'name',case when body->>'closedAt' is null then body->>'name' end)
      into guest from owners where body->>'mergedInto' is null order by (body->>'closedAt' is null) desc,position desc,key desc limit 1;
    guest:=coalesce(guest,'{"status":"new","key":null,"tabId":null,"name":null}'::jsonb);
  end if;
  select case when read_scope='portal' then 'catalog:'||catalog_version||':'||coalesce(guest->>'key','')||':'||coalesce(guest->>'tabId','')||':'||coalesce(guest->>'name','') else version::text end||':'||read_scope||':'||coalesce(period_start,'') into stamp from resto_private.revision where id;
  if stamp=known_version then return jsonb_build_object('version',stamp,'unchanged',true); end if;
  select coalesce(array_agg(key),'{}'::text[]) into active_ids from resto_private.tabs where body->>'closedAt' is null and body->>'mergedInto' is null;
  select coalesce(array_agg(o.key),'{}'::text[]) into chosen_orders from resto_private.orders o where
    read_scope in ('manager','manager-history')
    or (read_scope='waiter' and o.tab_id=any(active_ids))
    or (read_scope='kitchen' and exists(select 1 from resto_private.portions p where p.order_id=o.key and p.body->>'status' in ('waiting','accepted','cooking','ready')))
    or (read_scope='manager-overview' and (start_at is null or (o.body->>'createdAt')::timestamptz>=start_at or o.tab_id=any(active_ids)));
  select coalesce(array_agg(t.key),'{}'::text[]) into chosen_tabs from resto_private.tabs t where t.body->>'mergedInto' is null and (
    read_scope in ('manager','manager-history','manager-finance')
    or (read_scope in ('waiter','manager-overview') and t.key=any(active_ids))
    or exists(select 1 from resto_private.orders o where o.key=any(chosen_orders) and o.tab_id=t.key));
  select jsonb_build_object(
    'settings',coalesce((select jsonb_agg(case when read_scope in ('portal','kitchen') then body-'expenseCategories'-'paymentMethods' when read_scope='waiter' then body-'expenseCategories' else body end order by position,key) from resto_private.settings),'[]'),
    'menu',coalesce((select jsonb_agg(body order by position,key) from resto_private.menu),'[]'),
    'tabs',coalesce((select jsonb_agg(body order by position,key) from resto_private.tabs where key=any(chosen_tabs)),'[]'),
    'orders',coalesce((select jsonb_agg(body-'token' order by position,key) from resto_private.orders where key=any(chosen_orders)),'[]'),
    'portions',coalesce((select jsonb_agg(case when read_scope='kitchen' then body-'price'-'paid'-'paymentId' else body end order by position,key) from resto_private.portions where order_id=any(chosen_orders)),'[]'),
    'payments',coalesce((select jsonb_agg(body order by position,key) from resto_private.payments where read_scope in ('manager','manager-finance') or (read_scope='waiter' and body->>'tabId'=any(active_ids)) or (read_scope='manager-overview' and (start_at is null or (body->>'at')::timestamptz>=start_at))),'[]'),
    'expenses',coalesce((select jsonb_agg(body order by position,key) from resto_private.expenses where read_scope in ('manager','manager-finance') or (read_scope='manager-overview' and (start_at is null or (body->>'at')::timestamptz>=start_at))),'[]'),
    'audit',case when read_scope in ('manager','manager-settings') then coalesce((select jsonb_agg(body order by body->>'at',key) from (select key,body from resto_private.audit order by body->>'at' desc,key desc limit 200)a),'[]') else '[]'::jsonb end,
    'users',case when read_scope in ('manager','manager-settings') then coalesce((select jsonb_agg(body-'password' order by position,key) from resto_private.users),'[]') else '[]'::jsonb end,
    'bans',case when read_scope in ('manager','waiter') then coalesce((select jsonb_agg(body order by position,key) from resto_private.bans),'[]') else '[]'::jsonb end
  ) into result;
  return jsonb_build_object('version',stamp,'rows',result,'portalSession',guest);
end $$;

revoke all on function public.resto_context(text),public.resto_view(text,text,text,text) from public,anon,authenticated;
grant execute on function public.resto_context(text),public.resto_view(text,text,text,text) to service_role;

-- Accept inside the same write, including submissions from an older deployed app.
create function resto_private.accept_on_write() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if tg_table_name='orders' and new.body->>'status'='waiting' then
    new.body:=(new.body-'autoAcceptAt')||jsonb_build_object('status','accepted','acceptedAt',new.body->>'createdAt','acceptedBy','Sistem');
  elsif tg_table_name='portions' and new.body->>'status'='waiting' then
    new.body:=new.body||'{"status":"accepted"}'::jsonb;
  end if;
  return new;
end $$;
revoke all on function resto_private.accept_on_write() from public,anon,authenticated;
create trigger instant_order_accept before insert or update on resto_private.orders for each row execute function resto_private.accept_on_write();
create trigger instant_portion_accept before insert or update on resto_private.portions for each row execute function resto_private.accept_on_write();

create or replace function public.resto_commit(expected_version bigint, changes jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
declare current_version bigint; t text; entry jsonb;
begin
  select version into current_version from resto_private.revision where id for update;
  if current_version<>expected_version then return false; end if;
  foreach t in array array['portions','expenses','payments','sessions','requests','bans','audit','login_attempts','orders','tabs','menu','users','settings'] loop
    execute format('delete from resto_private.%I where key in (select jsonb_array_elements_text($1))',t) using coalesce(changes->t->'delete','[]');
  end loop;
  foreach t in array array['settings','users','menu','tabs','orders','portions','expenses','payments','sessions','audit','bans','requests','login_attempts'] loop
    for entry in select value from jsonb_array_elements(coalesce(changes->t->'upsert','[]')) loop
      execute format('insert into resto_private.%I(key,position,body) values($1,$2,$3) on conflict(key) do update set position=excluded.position,body=excluded.body',t) using entry->>'key',(entry->>'position')::bigint,entry->'body';
    end loop;
  end loop;
  update resto_private.revision set version=version+1,catalog_version=catalog_version+case when changes ? 'menu' or changes ? 'settings' then 1 else 0 end where id;
  return true;
end $$;
revoke all on function public.resto_commit(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.resto_commit(bigint,jsonb) to service_role;

-- Notifications contain revision numbers only. Business data stays behind Express.
create policy resto_broadcast_read on realtime.messages for select to anon,authenticated using (
  extension='broadcast' and (realtime.topic()='resto:catalog' or (realtime.topic()='resto:staff' and (select auth.uid()) is not null))
);
create function resto_private.notify_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  begin
    if new.version<>old.version then perform realtime.send(jsonb_build_object('version',new.version),'changed','resto:staff',true); end if;
    if new.catalog_version<>old.catalog_version then perform realtime.send(jsonb_build_object('version',new.catalog_version),'changed','resto:catalog',true); end if;
  exception when others then
    -- Delivery is advisory; the version check recovers missed notifications.
    -- A notification outage must never roll back a valid order or payment.
    raise warning 'Resto realtime notification deferred: %',sqlstate;
  end;
  return new;
end $$;
revoke all on function resto_private.notify_revision() from public,anon,authenticated;
create trigger broadcast_resto_revision after update on resto_private.revision for each row execute function resto_private.notify_revision();

-- No one-second scheduler is needed once writes are accepted atomically.
do $$declare j record; begin
  perform 1 from resto_private.revision where id for update;
  for j in select jobid from cron.job where jobname='resto-auto-accept' loop perform cron.unschedule(j.jobid); end loop;
  update resto_private.orders set body=(body-'autoAcceptAt')||jsonb_build_object('status','accepted','acceptedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'acceptedBy','Sistem') where body->>'status'='waiting';
  update resto_private.portions set body=body||'{"status":"accepted"}'::jsonb where body->>'status'='waiting';
  update resto_private.settings set body=body||'{"autoAcceptSeconds":0}'::jsonb;
  update resto_private.revision set version=version+1,catalog_version=catalog_version+1 where id;
end $$;
select cron.schedule('resto-cron-log-retention','29 * * * *',$job$delete from cron.job_run_details where end_time<now()-interval '1 day'$job$);
create or replace function resto_private.cleanup_sessions() returns void language plpgsql security invoker set search_path='' as $$
declare n bigint; changed bigint:=0;
begin
  perform 1 from resto_private.revision where id for update;
  delete from resto_private.sessions where (body->>'expiresAt')::timestamptz<now(); get diagnostics n=row_count; changed:=changed+n;
  delete from resto_private.login_attempts where not exists(select 1 from jsonb_array_elements_text(body->'value') value where value::bigint>extract(epoch from now()-interval '2 minutes')*1000); get diagnostics n=row_count;
  if changed+n>0 then update resto_private.revision set version=version+1 where id; end if;
end $$;
notify pgrst,'reload schema';
