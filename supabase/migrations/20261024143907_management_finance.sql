-- Private expense records share the application's optimistic transaction lock.
create table resto_private.expenses (
  key text primary key,
  position bigint not null default 0,
  body jsonb not null check(jsonb_typeof(body)='object'),
  amount bigint generated always as ((body->>'amount')::bigint) stored not null check(amount>0 and amount<=1000000000000),
  check(body ? 'at' and body ? 'categoryId' and body ? 'methodId')
);
alter table resto_private.expenses enable row level security;
revoke all on resto_private.expenses from public,anon,authenticated;
grant select,insert,update,delete on resto_private.expenses to service_role;
create unique index expenses_request on resto_private.expenses((body->>'requestId'));
create index expenses_date on resto_private.expenses((body->>'at'));

do $migration$
declare definition text;
begin
  perform 1 from resto_private.revision where id for update;
  definition:=pg_get_functiondef('public.resto_snapshot()'::regprocedure);
  if position('''expenses''' in definition)=0 then
    definition:=replace(definition,
      '''payments'', coalesce((select jsonb_agg(body order by position,key) from resto_private.payments),''[]''),',
      '''payments'', coalesce((select jsonb_agg(body order by position,key) from resto_private.payments),''[]''), ''expenses'', coalesce((select jsonb_agg(body order by position,key) from resto_private.expenses),''[]''),');
    if position('''expenses''' in definition)=0 then raise exception 'Unexpected snapshot definition'; end if;
    execute definition;
  end if;
  definition:=pg_get_functiondef('public.resto_commit(bigint,jsonb)'::regprocedure);
  definition:=replace(definition,'''payments'',','''expenses'',''payments'',');
  execute definition;
  update resto_private.settings set body=body||jsonb_build_object(
    'expenseCategories',coalesce(body->'expenseCategories','[{"id":"expense-0","name":"Bahan baku","active":true},{"id":"expense-1","name":"Peralatan","active":true},{"id":"expense-2","name":"Gaji","active":true},{"id":"expense-3","name":"Kemasan","active":true},{"id":"expense-4","name":"Lain-lain","active":true}]'::jsonb),
    'paymentMethods',coalesce(body->'paymentMethods','[{"id":"method-0","name":"Tunai","active":true},{"id":"method-1","name":"Transfer","active":true}]'::jsonb)
  );
  update resto_private.revision set version=version+1 where id;
end $migration$;
revoke all on function public.resto_snapshot(),public.resto_commit(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.resto_snapshot(),public.resto_commit(bigint,jsonb) to service_role;
notify pgrst,'reload schema';
