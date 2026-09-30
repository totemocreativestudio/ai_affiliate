-- PR78C: Payment and promotion guardrails

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
