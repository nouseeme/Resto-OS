-- Cron audit row keys must match the domain IDs used by the cloud adapter.
do $migration$
declare definition text;
begin
  definition := pg_get_functiondef('resto_private.auto_accept()'::regprocedure);
  definition := replace(definition, 'declare o record;', 'declare audit_id text; o record;');
  definition := replace(definition,
    'insert into resto_private.audit(key,position,body) values(gen_random_uuid()::text,',
    'audit_id := gen_random_uuid()::text; insert into resto_private.audit(key,position,body) values(audit_id,');
  definition := replace(definition,
    'jsonb_build_object(''id'',gen_random_uuid()::text,''at'',stamp',
    'jsonb_build_object(''id'',audit_id,''at'',stamp');
  execute definition;
end $migration$;
