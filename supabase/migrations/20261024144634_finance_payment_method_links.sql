-- Link existing known methods while retaining the original payment label.
do $migration$
begin
  perform 1 from resto_private.revision where id for update;
  update resto_private.payments p
    set body=p.body||jsonb_build_object('methodId',m.value->>'id')
    from resto_private.settings s
    cross join lateral jsonb_array_elements(s.body->'paymentMethods') m
    where not (p.body ? 'methodId') and p.body->>'method'=m.value->>'name';
  update resto_private.revision set version=version+1 where id;
end $migration$;
