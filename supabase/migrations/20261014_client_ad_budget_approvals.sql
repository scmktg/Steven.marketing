-- Applied to Supabase production with migration client_advertising_budget_approvals_20261014.
-- Client approval is a separate auditable budget authorisation; this migration NEVER adjusts Google Ads.
create table if not exists public.client_ad_budget_settings (
 client_id uuid primary key references public.clients(id) on delete cascade,
 initial_testing_budget_aud numeric(12,2) not null check(initial_testing_budget_aud>=0 and initial_testing_budget_aud<=10000000),
 approved_monthly_limit_aud numeric(12,2) check(approved_monthly_limit_aud>=0 and approved_monthly_limit_aud<=10000000),
 objectives text not null default '' check(char_length(objectives)<=1200),
 phase text not null default 'testing' check(phase in ('testing','optimising','scaling')),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now()
);
create table if not exists public.client_ad_budget_requests (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null references public.clients(id) on delete cascade,
 proposed_monthly_limit_aud numeric(12,2) not null check(proposed_monthly_limit_aud>=0 and proposed_monthly_limit_aud<=10000000),
 previous_monthly_limit_aud numeric(12,2) check(previous_monthly_limit_aud>=0),
 reason text not null check(char_length(reason) between 12 and 1200),
 status text not null default 'pending' check(status in ('pending','approved','declined','withdrawn')),
 proposed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 constraint budget_decision_consistency check(
   (status in ('pending','withdrawn') and decided_at is null and decided_by is null) or
   (status in ('approved','declined') and decided_at is not null and decided_by is not null)
 )
);
create unique index if not exists client_ad_budget_only_one_pending on public.client_ad_budget_requests(client_id) where status='pending';
create index if not exists client_ad_budget_requests_history on public.client_ad_budget_requests(client_id,created_at desc);
alter table public.client_ad_budget_settings enable row level security;
alter table public.client_ad_budget_requests enable row level security;
revoke all on public.client_ad_budget_settings from public,anon,authenticated;
revoke all on public.client_ad_budget_requests from public,anon,authenticated;
grant select,insert on public.client_ad_budget_settings to authenticated;
grant update(initial_testing_budget_aud,objectives,phase,updated_by,updated_at)
 on public.client_ad_budget_settings to authenticated;
grant select on public.client_ad_budget_requests to authenticated;

create policy "Agency admins and client members see budget requests" on public.client_ad_budget_requests
 for select to authenticated
 using (((EXISTS ( SELECT 1
   FROM agency_admins a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM client_memberships m
  WHERE ((m.client_id = client_ad_budget_requests.client_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))))
 ;

create policy "Agency admins and client members see budget settings" on public.client_ad_budget_settings
 for select to authenticated
 using (((EXISTS ( SELECT 1
   FROM agency_admins a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM client_memberships m
  WHERE ((m.client_id = client_ad_budget_settings.client_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))))
 ;

create policy "Agency admins edit nonapproval budget information" on public.client_ad_budget_settings
 for update to authenticated
 using ((EXISTS ( SELECT 1
   FROM agency_admins a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))))
 with check ((EXISTS ( SELECT 1
   FROM agency_admins a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid)))));

create policy "Only agency admins create proposed settings" on public.client_ad_budget_settings
 for insert to authenticated
 
 with check (((approved_monthly_limit_aud IS NULL) AND (EXISTS ( SELECT 1
   FROM agency_admins a
  WHERE (a.user_id = ( SELECT auth.uid() AS uid))))));

CREATE OR REPLACE FUNCTION public.decide_ad_budget_request(p_request_id uuid, p_approve boolean)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_request public.client_ad_budget_requests%rowtype;
  v_current numeric(12,2);
  v_uid uuid := (select auth.uid());
  v_status text;
begin
  if v_uid is null then raise exception 'Sign in required'; end if;
  select * into v_request from public.client_ad_budget_requests
    where id=p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'This proposal is no longer awaiting approval';
  end if;
  if not exists (
    select 1 from public.client_memberships m
    where m.client_id=v_request.client_id and m.user_id=v_uid and m.role='owner'
  ) or exists (
    select 1 from public.agency_admins a where a.user_id=v_uid
  ) then raise exception 'Only an authorised client owner can decide this request';
  end if;
  select approved_monthly_limit_aud into v_current
    from public.client_ad_budget_settings
    where client_id=v_request.client_id for update;
  if not found then raise exception 'Budget settings missing'; end if;
  if v_current is distinct from v_request.previous_monthly_limit_aud then
    raise exception 'Budget changed since this proposal was prepared';
  end if;
  if p_approve then
    update public.client_ad_budget_settings
      set approved_monthly_limit_aud=v_request.proposed_monthly_limit_aud,
          updated_by=v_uid,updated_at=now()
      where client_id=v_request.client_id;
    v_status:='approved';
  else
    v_status:='declined';
  end if;
  update public.client_ad_budget_requests
    set status=v_status, decided_by=v_uid,decided_at=now()
    where id=v_request.id;
  return v_status;
end;
$function$;

CREATE OR REPLACE FUNCTION public.propose_ad_budget(p_client_id uuid, p_limit numeric, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_current numeric(12,2);
  v_id uuid;
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists(select 1 from public.agency_admins a where a.user_id=v_uid) then
    raise exception 'Agency authorisation required';
  end if;
  if p_limit is null or p_limit<0 or p_limit>10000000 or p_limit<>round(p_limit,2)
     or p_reason is null or char_length(btrim(p_reason)) not between 12 and 1200 then
    raise exception 'Enter a valid spending limit and clear reason';
  end if;
  select approved_monthly_limit_aud into v_current
    from public.client_ad_budget_settings
    where client_id=p_client_id for update;
  if not found then raise exception 'Configure this client budget first'; end if;
  if v_current is not distinct from p_limit then
    raise exception 'Proposed limit must differ from the current approved limit';
  end if;
  insert into public.client_ad_budget_requests(client_id,proposed_monthly_limit_aud,
    previous_monthly_limit_aud,reason,proposed_by)
  values(p_client_id,p_limit,v_current,btrim(p_reason),v_uid)
  returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_ad_budget_proposal(p_request_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not exists(select 1 from public.agency_admins a where a.user_id=v_uid) then
    raise exception 'Agency authorisation required';
  end if;
  update public.client_ad_budget_requests set status='withdrawn'
  where id=p_request_id and status='pending';
  return found;
end;
$function$;

revoke all on function public.decide_ad_budget_request(uuid,boolean) from public,anon;
grant execute on function public.decide_ad_budget_request(uuid,boolean) to authenticated;
revoke all on function public.propose_ad_budget(uuid,numeric,text) from public,anon;
grant execute on function public.propose_ad_budget(uuid,numeric,text) to authenticated;
revoke all on function public.withdraw_ad_budget_proposal(uuid) from public,anon;
grant execute on function public.withdraw_ad_budget_proposal(uuid) to authenticated;
comment on table public.client_ad_budget_settings is 'Monthly advertising spending authority, independent of Google Ads configuration. Approved limit changes only by client-owner decision.';
comment on table public.client_ad_budget_requests is 'Auditable budget proposals and client approvals. No automatic live campaign changes.';
