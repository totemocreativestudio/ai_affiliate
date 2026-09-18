drop policy if exists subscription_plans_admin on public.luma_subscription_plans;

create policy subscription_plans_admin
on public.luma_subscription_plans
for all
to authenticated
using (public.luma_is_admin())
with check (public.luma_is_admin());
