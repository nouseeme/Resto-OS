-- Auth tables remain private. Only this fixed-purpose, server-only helper can
-- validate an application session against the provider's current account state.
create function resto_private.session_context(session_key text) returns jsonb
language sql stable security definer set search_path='' as $$
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
revoke all on function resto_private.session_context(text) from public,anon,authenticated;
grant execute on function resto_private.session_context(text) to service_role;
create or replace function public.resto_context(session_key text default null) returns jsonb
language sql stable security invoker set search_path='' as $$
  select resto_private.session_context(session_key);
$$;
revoke all on function public.resto_context(text) from public,anon,authenticated;
grant execute on function public.resto_context(text) to service_role;
notify pgrst,'reload schema';
