-- Separate marketing storage. No changes to existing workspace/auth/billing tables.
create table if not exists public.marketing_leads (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 created_at timestamptz not null default now(),
 kind text not null check (kind in ('demo','sales','newsletter','waitlist','resource')),
 email text not null check (length(email) <= 254),
 name text not null default '',
 company text not null default '',
 consent boolean not null check (consent = true),
 marketing_consent boolean not null default false,
 payload jsonb not null,
 fingerprint text not null check (length(fingerprint)=64),
 status text not null default 'new' check (status in ('new','reviewed','contacted','closed'))
);
create index if not exists marketing_leads_fingerprint_created_idx on public.marketing_leads(fingerprint,created_at desc);
create index if not exists marketing_leads_created_idx on public.marketing_leads(created_at desc);
create table if not exists public.marketing_lead_outbox (
 id uuid primary key default gen_random_uuid(),
 lead_id uuid not null unique references public.marketing_leads(id) on delete cascade,
 created_at timestamptz not null default now(),
 state text not null default 'pending' check (state in ('pending','delivered','failed')),
 attempts integer not null default 0,
 delivered_at timestamptz
);
alter table public.marketing_leads enable row level security;
alter table public.marketing_lead_outbox enable row level security;
revoke all on public.marketing_leads,public.marketing_lead_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.marketing_leads,public.marketing_lead_outbox to service_role;
-- No public policy: only the server service role can access marketing data.
create or replace function public.marketing_capture_lead(p_payload jsonb,p_fingerprint text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
 v_request uuid := (p_payload->>'requestId')::uuid;
 v_existing public.marketing_leads%rowtype;
 v_id uuid;
 v_count integer;
begin
 if current_user not in ('service_role','postgres') then raise exception 'marketing_forbidden'; end if;
 if length(p_fingerprint)<>64 or p_payload->>'consent'<>'true'
    or p_payload->>'email' is null or length(p_payload->>'email')>254
    or jsonb_typeof(p_payload)<>'object' or length(p_payload::text)>16000
 then raise exception 'marketing_invalid_payload'; end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-request:'||v_request::text,0));
 select * into v_existing from public.marketing_leads where request_id=v_request;
 if found then
  if v_existing.payload<>p_payload then raise exception 'marketing_idempotency_conflict'; end if;
  return v_existing.id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('marketing-rate:'||p_fingerprint,0));
 select count(*) into v_count from public.marketing_leads where fingerprint=p_fingerprint and created_at>now()-interval '1 hour';
 if v_count>=5 then raise exception 'marketing_rate_limit'; end if;
 insert into public.marketing_leads(request_id,kind,email,name,company,consent,marketing_consent,payload,fingerprint)
 values(v_request,p_payload->>'kind',lower(p_payload->>'email'),coalesce(p_payload->>'name',''),coalesce(p_payload->>'company',''),true,coalesce((p_payload->>'marketingConsent')::boolean,false),p_payload,p_fingerprint)
 returning id into v_id;
 insert into public.marketing_lead_outbox(lead_id) values(v_id);
 return v_id;
end;
$$;
revoke all on function public.marketing_capture_lead(jsonb,text) from public,anon,authenticated;
grant execute on function public.marketing_capture_lead(jsonb,text) to service_role;
comment on table public.marketing_lead_outbox is 'CRM/email integration staging. No messages sent automatically. Configure an authorized consumer before delivery.';
