-- Business conflicts use explicit HTTP 409; they are not retryable database outages.
begin;
create or replace function pond_private.save_state(p_key text,p_value jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r bigint; prior jsonb;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_key is null or p_key not in ('pond-favorites-v1','pond-preferences-v1','pond-read-v1','pond-draft-v1','pond-vote-v1','pond-comments-v1','pond-audio-v1','pond-onboarding-v1') or p_value is null or octet_length(p_value::text)>524288 or p_revision is null or p_revision<0 then raise exception 'invalid state' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select revision,value into r,prior from public.pond_state where user_id=u and state_key=p_key;
  -- A retry after a lost response is successful if the persisted value is identical.
  if r is not null and prior=p_value then return jsonb_build_object('revision',r); end if;
  if coalesce(r,0)<>p_revision then raise exception 'state conflict' using errcode='PT409'; end if;
  r:=coalesce(r,0)+1;
  insert into public.pond_state values(u,p_key,p_value,r,now()) on conflict(user_id,state_key) do update set value=excluded.value,revision=excluded.revision,updated_at=excluded.updated_at;
  return jsonb_build_object('revision',r);
end $$;

create or replace function pond_private.create_fish(p_fish jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); prior jsonb; n integer;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_fish is null or jsonb_typeof(p_fish)<>'object' or octet_length(p_fish::text)>32768
    or exists(select 1 from jsonb_each(p_fish) where key in ('id','name','role','category','rarity','quote','description') and jsonb_typeof(value)<>'string')
    or not(p_fish ?& array['id','name','role','category','rarity','quote','description','traits','sprite'])
    or coalesce(p_fish->>'id','') !~ '^fish-[a-zA-Z0-9-]{8,90}$'
    or length(coalesce(p_fish->>'name','')) not between 1 and 40
    or jsonb_typeof(p_fish->'traits')<>'array' or jsonb_array_length(p_fish->'traits')>12
    or exists(select 1 from jsonb_array_elements(case when jsonb_typeof(p_fish->'traits')='array' then p_fish->'traits' else '[]'::jsonb end) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>100)
    or coalesce(p_fish->>'sprite','') !~ '^(0|[1-9]|10|11)$'
    or (p_fish ? 'skin' and p_fish->'skin'<>'null'::jsonb and coalesce(p_fish->>'skin','') !~ '^([0-9]|1[0-6])$')
  then raise exception 'invalid fish' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select data into prior from public.pond_fish where user_id=u and fish_id=p_fish->>'id';
  if prior is not null then
    if prior->'sprite' is distinct from p_fish->'sprite' or prior->'skin' is distinct from p_fish->'skin' then raise exception 'birth appearance is immutable' using errcode='PT409'; end if;
    return jsonb_build_object('fish',prior,'created',false,'state',pond_private.read_state());
  end if;
  select count(*) into n from public.pond_fish where user_id=u;
  if n>=188 then raise exception 'pond capacity reached' using errcode='22023'; end if;
  insert into public.pond_fish(user_id,fish_id,data) values(u,p_fish->>'id',p_fish);
  return jsonb_build_object('fish',p_fish,'created',true,'state',pond_private.read_state());
end $$;

create or replace function public.pond_claim_world(p_user uuid,p_lease uuid,p_initial jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.pond_worlds;
begin
  insert into public.pond_worlds(user_id,state) values(p_user,p_initial) on conflict do nothing;
  select * into w from public.pond_worlds where user_id=p_user for update;
  if w.lease_id is distinct from p_lease and w.lease_until>now() then raise exception 'world is active on another worker' using errcode='PT409'; end if;
  update public.pond_worlds set lease_id=p_lease,lease_until=now()+interval '30 seconds' where user_id=p_user;
  return jsonb_build_object('state',w.state,'revision',w.revision);
end $$;

create or replace function public.pond_save_world(p_user uuid,p_lease uuid,p_revision bigint,p_state jsonb,p_events jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.pond_worlds; ev jsonb; rel jsonb; fid text;
begin
  select * into w from public.pond_worlds where user_id=p_user for update;
  if w.user_id is null or w.lease_id is distinct from p_lease or w.lease_until<now() or w.revision<>p_revision then raise exception 'world lease conflict' using errcode='PT409'; end if;
  for ev in select value from jsonb_array_elements(p_events) loop
    insert into public.pond_events values(p_user,ev->>'id',(ev->>'at')::bigint,ev) on conflict do nothing;
    if ev->>'status'='completed' then
      for fid in select jsonb_array_elements_text(ev->'members') loop
        insert into public.pond_memories values(p_user,fid,ev->>'id') on conflict do nothing;
      end loop;
    end if;
  end loop;
  delete from public.pond_relationships where user_id=p_user;
  for rel in select value from jsonb_each(coalesce(p_state->'relationships','{}')) loop
    insert into public.pond_relationships values(p_user,rel->>'from',rel->>'to',rel);
  end loop;
  update public.pond_worlds set state=p_state,revision=revision+1,updated_at=now(),lease_until=now()+interval '30 seconds' where user_id=p_user;
  return jsonb_build_object('revision',w.revision+1);
end $$;
commit;
