-- PR77B security/performance hardening for Learning & Promotion

-- Trigger functions are invoked by PostgreSQL triggers, never by REST callers.
revoke all on function public.luma_apply_promo_reservation_on_redemption() from public;
revoke all on function public.luma_apply_promo_reservation_on_redemption() from anon;
revoke all on function public.luma_apply_promo_reservation_on_redemption() from authenticated;

revoke all on function public.luma_release_promo_reservation_on_order_terminal() from public;
revoke all on function public.luma_release_promo_reservation_on_order_terminal() from anon;
revoke all on function public.luma_release_promo_reservation_on_order_terminal() from authenticated;

-- Cover the promotion/billing relationships introduced or heavily used by PR77.
create index if not exists idx_luma_promo_redemptions_promo_id
  on public.luma_promo_redemptions(promo_id);
create index if not exists idx_luma_promo_redemptions_workspace_id
  on public.luma_promo_redemptions(workspace_id);
create index if not exists idx_luma_subscription_orders_promo_id
  on public.luma_subscription_orders(promo_id);
create index if not exists idx_luma_subscription_orders_workspace_id
  on public.luma_subscription_orders(workspace_id);
create index if not exists idx_luma_subscription_orders_plan_id
  on public.luma_subscription_orders(plan_id);
create index if not exists idx_luma_topup_orders_promo_id
  on public.luma_topup_orders(promo_id);
create index if not exists idx_luma_topup_orders_workspace_id
  on public.luma_topup_orders(workspace_id);
create index if not exists idx_luma_content_events_workspace_id
  on public.luma_content_events(workspace_id);
