-- Bounded retention is important for a sub-minute scheduler on the Free plan.
select cron.schedule('resto-cron-log-retention','*/10 * * * *',
  $job$delete from cron.job_run_details where end_time < now() - interval '1 hour'$job$);

create function resto_private.cleanup_sessions() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from resto_private.revision where id for update;
  delete from resto_private.sessions where (body->>'expiresAt')::timestamptz < now();
  delete from resto_private.login_attempts where not exists (
    select 1 from jsonb_array_elements_text(body->'value') value where value::bigint > extract(epoch from now() - interval '2 minutes')*1000
  );
  update resto_private.revision set version=version+1 where id;
end $$;
revoke all on function resto_private.cleanup_sessions() from public,anon,authenticated;
select cron.schedule('resto-session-cleanup','17 * * * *','select resto_private.cleanup_sessions()');
