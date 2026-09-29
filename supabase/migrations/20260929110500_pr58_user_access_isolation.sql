create or replace function public.luma_my_access_state_v1()
returns table(
  locked boolean,
  has_subscription boolean,
  current_status text,
  effective_starts_at timestamptz,
  effective_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_status text;
  v_starts timestamptz;
  v_ends timestamptz;
  v_has boolean := false;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  v_is_admin := public.luma_is_admin();

  select true, s.status, s.starts_at, s.ends_at
    into v_has, v_status, v_starts, v_ends
  from public.luma_user_subscriptions s
  where s.user_id = v_uid
  order by
    case
      when lower(coalesce(s.status,'')) in ('active','trialing')
       and s.starts_at <= now()
       and s.ends_at > now() then 0
      else 1
    end,
    s.ends_at desc
  limit 1;

  return query
  select
    case
      when v_is_admin then false
      when not coalesce(v_has,false) then false
      when lower(coalesce(v_status,'')) in ('active','trialing')
       and v_starts <= now()
       and v_ends > now() then false
      else true
    end as locked,
    coalesce(v_has,false) as has_subscription,
    v_status as current_status,
    v_starts as effective_starts_at,
    v_ends as effective_ends_at;
end
$$;

revoke all on function public.luma_my_access_state_v1() from public;
revoke all on function public.luma_my_access_state_v1() from anon;
grant execute on function public.luma_my_access_state_v1() to authenticated;
