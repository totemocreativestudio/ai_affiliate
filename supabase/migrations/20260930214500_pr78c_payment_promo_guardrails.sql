-- PR78C: Payment and promotion guardrails

alter table public.luma_payment_webhook_events
  add column if not exists processing_status text not null default 'received'
    check(processing_status in ('received','processing','processed','failed')),
  add column if not exists processed_at timestamptz,
  add column if not exists last_error text,
  add column if not exists attempts integer not null default 1;


create unique index if not exists uq_luma_promo_redemption_target
  on public.luma_promo_redemptions(promo_id,user_id,target_type,target_reference);

create index if not exists idx_luma_promo_reservations_expiry
  on public.luma_promo_reservations(status,expires_at)
  where status='reserved';

create index if not exists idx_luma_checkout_intents_expiry
  on public.luma_payment_checkout_intents(status,expires_at)
  where status in ('processing','ready');

create or replace function public.luma_payment_maintenance_v1()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_reservations integer:=0;
  v_intents integer:=0;
  v_sub_orders integer:=0;
  v_topup_orders integer:=0;
begin
  update public.luma_promo_reservations
  set status='expired',updated_at=now()
  where status='reserved' and expires_at<=now();
  get diagnostics v_reservations=row_count;

  update public.luma_payment_checkout_intents
  set status='expired',updated_at=now()
  where status in ('processing','ready')
    and expires_at is not null
    and expires_at<=now();
  get diagnostics v_intents=row_count;

  update public.luma_subscription_orders
  set status='expired'
  where status='pending'
    and expires_at is not null
    and expires_at<=now();
  get diagnostics v_sub_orders=row_count;

  update public.luma_topup_orders
  set status='expired'
  where status='pending'
    and expires_at is not null
    and expires_at<=now();
  get diagnostics v_topup_orders=row_count;

  return jsonb_build_object(
    'ok',true,
    'expired_reservations',v_reservations,
    'expired_checkout_intents',v_intents,
    'expired_subscription_orders',v_sub_orders,
    'expired_topup_orders',v_topup_orders,
    'ran_at',now()
  );
end
$$;

revoke all on function public.luma_payment_maintenance_v1() from public,anon,authenticated;
grant execute on function public.luma_payment_maintenance_v1() to service_role;

comment on function public.luma_payment_maintenance_v1() is
'Server-only maintenance for expiring stale promo reservations, checkout intents, and pending payment orders.';


create or replace function public.luma_claim_payment_webhook_event_v1(
  p_provider text,
  p_event_key text,
  p_order_code text default null,
  p_status text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_row public.luma_payment_webhook_events%rowtype;
  v_lock bigint;
begin
  if nullif(trim(coalesce(p_provider,'')),'') is null or nullif(trim(coalesce(p_event_key,'')),'') is null then
    raise exception 'provider and event_key are required';
  end if;

  v_lock:=hashtextextended(lower(trim(p_provider))||'|'||trim(p_event_key),0);
  perform pg_advisory_xact_lock(v_lock);

  select * into v_row
  from public.luma_payment_webhook_events
  where provider=lower(trim(p_provider))
    and event_key=trim(p_event_key)
  for update;

  if found and v_row.processing_status='processed' then
    update public.luma_payment_webhook_events
    set attempts=attempts+1,updated_at=coalesce(updated_at,now())
    where id=v_row.id;
    return jsonb_build_object('claimed',false,'duplicate',true,'event_id',v_row.id,'processing_status','processed');
  end if;

  if found then
    update public.luma_payment_webhook_events
    set
      order_code=coalesce(nullif(trim(p_order_code),''),order_code),
      status=coalesce(nullif(trim(p_status),''),status),
      payload=coalesce(p_payload,payload),
      processing_status='processing',
      last_error=null,
      attempts=attempts+1
    where id=v_row.id
    returning * into v_row;
  else
    insert into public.luma_payment_webhook_events(
      provider,event_key,order_code,status,payload,processing_status,attempts
    ) values (
      lower(trim(p_provider)),trim(p_event_key),nullif(trim(p_order_code),''),
      nullif(trim(p_status),''),coalesce(p_payload,'{}'::jsonb),'processing',1
    )
    returning * into v_row;
  end if;

  return jsonb_build_object('claimed',true,'duplicate',false,'event_id',v_row.id,'processing_status',v_row.processing_status);
end
$$;

create or replace function public.luma_finish_payment_webhook_event_v1(
  p_event_id bigint,
  p_ok boolean,
  p_order_code text default null,
  p_status text default null,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  update public.luma_payment_webhook_events
  set
    order_code=coalesce(nullif(trim(p_order_code),''),order_code),
    status=coalesce(nullif(trim(p_status),''),status),
    processing_status=case when p_ok then 'processed' else 'failed' end,
    processed_at=case when p_ok then now() else processed_at end,
    last_error=case when p_ok then null else left(coalesce(p_error,'Unknown webhook error'),500) end
  where id=p_event_id;
end
$$;

revoke all on function public.luma_claim_payment_webhook_event_v1(text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.luma_finish_payment_webhook_event_v1(bigint,boolean,text,text,text) from public,anon,authenticated;
grant execute on function public.luma_claim_payment_webhook_event_v1(text,text,text,text,jsonb) to service_role;
grant execute on function public.luma_finish_payment_webhook_event_v1(bigint,boolean,text,text,text) to service_role;

comment on function public.luma_claim_payment_webhook_event_v1(text,text,text,text,jsonb) is
'Atomically claims a payment webhook event using an advisory lock. Already processed events return duplicate=true.';
comment on function public.luma_finish_payment_webhook_event_v1(bigint,boolean,text,text,text) is
'Marks an atomically claimed payment webhook event processed or failed.';
