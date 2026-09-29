revoke all on function public.get_dashboard_daily_trend_v1(uuid,date,date,text,text) from anon;
revoke all on function public.get_dashboard_daily_trend_v1(uuid,date,date,text,text) from public;
grant execute on function public.get_dashboard_daily_trend_v1(uuid,date,date,text,text) to authenticated;
