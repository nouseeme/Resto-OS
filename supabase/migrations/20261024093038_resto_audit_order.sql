create or replace function public.resto_snapshot() returns jsonb
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
    'audit', coalesce((select jsonb_agg(body order by body->>'at',key) from resto_private.audit),'[]'),
    'bans', coalesce((select jsonb_agg(body order by position,key) from resto_private.bans),'[]'),
    'requests', coalesce((select jsonb_agg(body order by position,key) from resto_private.requests),'[]'),
    'login_attempts', coalesce((select jsonb_agg(body order by position,key) from resto_private.login_attempts),'[]')
  )) from resto_private.revision r where r.id;
$$;

