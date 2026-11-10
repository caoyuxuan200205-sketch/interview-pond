-- Additive migration. Does not alter unrelated tables or copy local users.
begin;
create schema pond_private;
revoke all on schema pond_private from public, anon;
grant usage on schema pond_private to authenticated,service_role;
create table public.pond_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '', created_at timestamptz not null default now()
);
create table public.pond_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  state_key text not null, value jsonb not null, revision bigint not null default 1,
  updated_at timestamptz not null default now(), primary key(user_id,state_key)
);
create table public.pond_fish (
  user_id uuid not null references auth.users(id) on delete cascade,
  fish_id text not null, data jsonb not null, created_at timestamptz not null default now(),
  primary key(user_id,fish_id),
  check (length(fish_id) between 1 and 99),
  check (jsonb_typeof(data)='object' and data->>'id'=fish_id)
);
create table public.pond_worlds (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null, revision bigint not null default 1,
  lease_id uuid, lease_until timestamptz,
  updated_at timestamptz not null default now()
);
create table public.pond_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null, at bigint not null, data jsonb not null,
  primary key(user_id,event_id)
);
create index pond_events_recent on public.pond_events(user_id,at desc,event_id desc);
create table public.pond_relationships (
  user_id uuid not null references auth.users(id) on delete cascade,
  from_id text not null, to_id text not null, data jsonb not null,
  primary key(user_id,from_id,to_id), check(from_id<>to_id),
  foreign key(user_id,from_id) references public.pond_fish(user_id,fish_id) on delete cascade,
  foreign key(user_id,to_id) references public.pond_fish(user_id,fish_id) on delete cascade
);
create table public.pond_memories (
  user_id uuid not null, fish_id text not null, event_id text not null,
  primary key(user_id,fish_id,event_id),
  foreign key(user_id,fish_id) references public.pond_fish(user_id,fish_id) on delete cascade,
  foreign key(user_id,event_id) references public.pond_events(user_id,event_id) on delete cascade
);
create index pond_memories_event on public.pond_memories(user_id,event_id);
create index pond_relationships_target on public.pond_relationships(user_id,to_id);
create table public.pond_demo_archive (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null, archived_at timestamptz not null default now()
);
create table public.pond_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null, kind text not null, requests integer not null default 0,
  primary key(user_id,day,kind), check(kind in ('interview','social'))
);
-- No direct client writes to canonical records. All writes go through bounded RPCs.
do $$ declare t text; begin
  foreach t in array array['pond_profiles','pond_state','pond_fish','pond_worlds','pond_events','pond_relationships','pond_memories','pond_demo_archive','pond_ai_usage'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
    execute format('create policy own_rows on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  end loop;
end $$;

create function pond_private.read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); vals jsonb; revs jsonb; fish jsonb;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  insert into public.pond_profiles(user_id,nickname) values(u,coalesce(auth.jwt()->'user_metadata'->>'name','塘主')) on conflict do nothing;
  select coalesce(jsonb_object_agg(state_key,value),'{}'),coalesce(jsonb_object_agg(state_key,revision),'{}') into vals,revs from public.pond_state where user_id=u;
  select coalesce(jsonb_agg(data order by created_at,fish_id),'[]') into fish from public.pond_fish where user_id=u;
  return jsonb_build_object('userId',u,'values',vals||jsonb_build_object('pond-fish-v1',fish),'revisions',revs);
end $$;

create function pond_private.save_state(p_key text,p_value jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); r bigint; prior jsonb;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_key is null or p_key not in ('pond-favorites-v1','pond-preferences-v1','pond-read-v1','pond-draft-v1','pond-vote-v1','pond-comments-v1','pond-audio-v1','pond-onboarding-v1') or p_value is null or octet_length(p_value::text)>524288 or p_revision is null or p_revision<0 then raise exception 'invalid state' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select revision,value into r,prior from public.pond_state where user_id=u and state_key=p_key;
  -- A retry after a lost response is successful if the persisted value is identical.
  if r is not null and prior=p_value then return jsonb_build_object('revision',r); end if;
  if coalesce(r,0)<>p_revision then raise exception 'state conflict' using errcode='40001'; end if;
  r:=coalesce(r,0)+1;
  insert into public.pond_state values(u,p_key,p_value,r,now()) on conflict(user_id,state_key) do update set value=excluded.value,revision=excluded.revision,updated_at=excluded.updated_at;
  return jsonb_build_object('revision',r);
end $$;

create function pond_private.create_fish(p_fish jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); prior jsonb; n integer;
begin
  if u is null then raise exception 'authentication required' using errcode='28000'; end if;
  if p_fish is null or jsonb_typeof(p_fish)<>'object' or octet_length(p_fish::text)>32768
    or not(p_fish ?& array['id','name','role','category','rarity','quote','description','traits','sprite'])
    or coalesce(p_fish->>'id','') !~ '^fish-[a-zA-Z0-9-]{8,90}$'
    or length(coalesce(p_fish->>'name','')) not between 1 and 40
    or jsonb_typeof(p_fish->'traits')<>'array' or jsonb_array_length(p_fish->'traits')>12
    or coalesce(p_fish->>'sprite','') !~ '^(0|[1-9]|10|11)$'
    or (p_fish ? 'skin' and p_fish->'skin'<>'null'::jsonb and coalesce(p_fish->>'skin','') !~ '^([0-9]|1[0-6])$')
  then raise exception 'invalid fish' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select data into prior from public.pond_fish where user_id=u and fish_id=p_fish->>'id';
  if prior is not null then
    if prior->'sprite' is distinct from p_fish->'sprite' or prior->'skin' is distinct from p_fish->'skin' then raise exception 'birth appearance is immutable' using errcode='40001'; end if;
    return jsonb_build_object('fish',prior,'created',false,'state',pond_private.read_state());
  end if;
  select count(*) into n from public.pond_fish where user_id=u;
  if n>=188 then raise exception 'pond capacity reached' using errcode='22023'; end if;
  insert into public.pond_fish(user_id,fish_id,data) values(u,p_fish->>'id',p_fish);
  return jsonb_build_object('fish',p_fish,'created',true,'state',pond_private.read_state());
end $$;

create function public.pond_read_state() returns jsonb language sql security invoker set search_path='' as $$ select pond_private.read_state(); $$;
create function public.pond_save_state(p_key text,p_value jsonb,p_revision bigint) returns jsonb language sql security invoker set search_path='' as $$ select pond_private.save_state(p_key,p_value,p_revision); $$;
create function public.pond_create_fish(p_fish jsonb) returns jsonb language sql security invoker set search_path='' as $$ select pond_private.create_fish(p_fish); $$;

-- Server-only worker leases prevent two Node instances advancing the same pond.
create function public.pond_claim_world(p_user uuid,p_lease uuid,p_initial jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.pond_worlds;
begin
  insert into public.pond_worlds(user_id,state) values(p_user,p_initial) on conflict do nothing;
  select * into w from public.pond_worlds where user_id=p_user for update;
  if w.lease_id is distinct from p_lease and w.lease_until>now() then raise exception 'world is active on another worker' using errcode='55P03'; end if;
  update public.pond_worlds set lease_id=p_lease,lease_until=now()+interval '30 seconds' where user_id=p_user;
  return jsonb_build_object('state',w.state,'revision',w.revision);
end $$;

create function public.pond_save_world(p_user uuid,p_lease uuid,p_revision bigint,p_state jsonb,p_events jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.pond_worlds; ev jsonb; rel jsonb; fid text;
begin
  select * into w from public.pond_worlds where user_id=p_user for update;
  if w.user_id is null or w.lease_id is distinct from p_lease or w.lease_until<now() or w.revision<>p_revision then raise exception 'world lease conflict' using errcode='40001'; end if;
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

create function public.pond_use_ai(p_user uuid,p_kind text,p_limit integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare d date:=(now() at time zone 'Asia/Shanghai')::date; n integer;
begin
  if p_kind not in ('interview','social') or p_limit not between 1 and 1000 then raise exception 'invalid quota' using errcode='22023'; end if;
  insert into public.pond_ai_usage values(p_user,d,p_kind,1)
    on conflict(user_id,day,kind) do update set requests=public.pond_ai_usage.requests+1 where public.pond_ai_usage.requests<p_limit returning requests into n;
  return n is not null;
end $$;

revoke all on function public.pond_read_state(),public.pond_save_state(text,jsonb,bigint),public.pond_create_fish(jsonb) from public,anon;
grant execute on function public.pond_read_state(),public.pond_save_state(text,jsonb,bigint),public.pond_create_fish(jsonb) to authenticated;
revoke all on function pond_private.read_state(),pond_private.save_state(text,jsonb,bigint),pond_private.create_fish(jsonb) from public,anon;
grant execute on function pond_private.read_state(),pond_private.save_state(text,jsonb,bigint),pond_private.create_fish(jsonb) to authenticated;
revoke all on function public.pond_claim_world(uuid,uuid,jsonb),public.pond_save_world(uuid,uuid,bigint,jsonb,jsonb),public.pond_use_ai(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.pond_claim_world(uuid,uuid,jsonb),public.pond_save_world(uuid,uuid,bigint,jsonb,jsonb),public.pond_use_ai(uuid,text,integer) to service_role;
commit;
