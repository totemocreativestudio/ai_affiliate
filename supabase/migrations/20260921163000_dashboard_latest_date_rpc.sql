create or replace function public.get_dashboard_latest_date(
  p_workspace_id uuid,
  p_platform text default null
)
returns date
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_date date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if not (
    public.luma_is_admin()
    or exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id=p_workspace_id
        and wm.user_id=auth.uid()
    )
  ) then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  select max(s.data_date)
  into v_date
  from public.sales s
  where s.workspace_id=p_workspace_id
    and (p_platform is null or p_platform='' or lower(s.platform)=lower(p_platform));

  return v_date;
end
$function$;

grant execute on function public.get_dashboard_latest_date(uuid,text) to authenticated;
