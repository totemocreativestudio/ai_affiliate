-- PR87H: consistent import channel, completed-report filtering, 30-day claim window.
CREATE OR REPLACE FUNCTION public.luma_affiliate_submit_claim_v2(p_workspace_id uuid, p_program_id uuid, p_creator_id bigint, p_period_no integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 p public.luma_affiliate_programs%rowtype;
 v_period_start date;
 v_period_end date;
 v_actual numeric:=0;
 v_qty numeric:=0;
 v_total numeric:=0;
 v_tier_name text:='';
 v_rows bigint:=0;
 v_incomplete bigint:=0;
 v_claim_id uuid;
 v_target numeric;
 v_latest numeric;
begin
 if auth.uid() is null then raise exception 'Login diperlukan' using errcode='42501'; end if;
 if not public.luma_is_workspace_admin(p_workspace_id) then
   raise exception 'Hanya owner/admin workspace yang dapat mengajukan reward' using errcode='42501';
 end if;
 select * into p from public.luma_affiliate_programs
  where id=p_program_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'Program tidak ditemukan';end if;
 if p.status not in ('active','closed') then raise exception 'Aktifkan program dahulu sebelum klaim';end if;
 if p_period_no is null or p_period_no<1 or p_period_no>least(p.claim_limit,24) then
  raise exception 'Nomor periode melampaui batas klaim program';
 end if;
 v_period_start:=(p.start_date + make_interval(months=>p_period_no-1))::date;
 v_period_end:=least(p.end_date,(p.start_date+make_interval(months=>p_period_no))::date-1);
 if v_period_start>p.end_date then raise exception 'Periode klaim tidak termasuk masa program';end if;
 if current_date<=v_period_end then raise exception 'Periode belum selesai. Klaim bisa diajukan mulai hari setelah periode berakhir';end if;
 if current_date>public.luma_affiliate_claim_deadline_effective_v1(p.end_date,p.claim_deadline) then raise exception 'Masa klaim sudah habis';end if;
 if not exists(select 1 from public.luma_affiliate_program_participants pp where pp.program_id=p.id
   and pp.workspace_id=p_workspace_id and pp.creator_id=p_creator_id and pp.status='active') then
   raise exception 'Creator belum aktif sebagai peserta program';end if;
 if exists(select 1 from public.luma_affiliate_reward_claims c where c.program_id=p.id
   and c.creator_id=p_creator_id and c.claim_no=p_period_no) then
   raise exception 'Klaim untuk creator dan periode ini sudah tercatat';end if;
 select count(*) into v_incomplete
 from public.luma_affiliate_program_performance perf
 join public.luma_affiliate_program_imports imp on imp.id=perf.import_id
 where perf.workspace_id=p_workspace_id and perf.program_id=p.id
 and perf.creator_id=p_creator_id and perf.metric_date between v_period_start and v_period_end
 and imp.status not in ('completed');
 if v_incomplete>0 then raise exception 'Masih ada upload partial/processing/failed; rekonsiliasi sebelum klaim';end if;

 select coalesce(sum(case p.metric
   when 'qty_net' then perf.qty_net
   when 'gmv_net' then perf.gmv_net
   when 'orders' then perf.orders
   when 'videos' then perf.videos
   when 'live_count' then perf.live_count
   when 'views' then perf.views
   when 'ads_spend' then perf.ads_spend
   else 0 end),0),
   coalesce(sum(perf.qty_net),0),
   count(*)
 into v_actual,v_qty,v_rows
 from public.luma_affiliate_program_performance perf
 join public.luma_affiliate_program_imports imp on imp.id=perf.import_id
 where perf.workspace_id=p_workspace_id and perf.program_id=p.id and perf.creator_id=p_creator_id
   and perf.metric_date between v_period_start and v_period_end and imp.status='completed'
   and (p.product_master_id is null or perf.product_master_id=p.product_master_id)
   and (p.store_id is null or perf.store_id=p.store_id)
   and (p.channel='all' or perf.source_channel=p.channel);

 if v_rows=0 then raise exception 'Belum ada data performa valid pada periode ini';end if;
 if jsonb_array_length(p.tier_rules)>0 then
  select nullif(btrim(x->>'tier'),''),coalesce((x->>'reward_value')::numeric,0),
         (x->>'target')::numeric
   into v_tier_name,v_total,v_target
  from jsonb_array_elements(p.tier_rules) x
  where (x->>'target')::numeric<=v_actual
  order by (x->>'target')::numeric desc limit 1;
  if not found then raise exception 'Creator belum memenuhi salah satu target tier';end if;
 else
  if p.target_value<=0 or v_actual<p.target_value then
     raise exception 'Pencapaian belum memenuhi target dasar';
  end if;
  v_total:=p.reward_value; v_tier_name:='Target dasar';
 end if;
 v_total:=greatest(0,v_total+case when p.metric='qty_net' then v_qty*p.extra_incentive_per_unit else 0 end);
 if v_total<=0 then raise exception 'Nilai reward harus lebih dari nol untuk klaim';end if;
 insert into public.luma_affiliate_reward_claims(
   workspace_id,program_id,creator_id,claim_no,bonus_amount,reward_type,status,
   period_start,period_end,achievement,tier_name,source_rows,submitted_by,updated_at
 ) values(p_workspace_id,p.id,p_creator_id,p_period_no,v_total,p.reward_type,'pending',
          v_period_start,v_period_end,v_actual,v_tier_name,v_rows,auth.uid(),now())
 returning id into v_claim_id;
 return jsonb_build_object('ok',true,'claim_id',v_claim_id,'status','pending',
       'period_start',v_period_start,'period_end',v_period_end,'achievement',v_actual,
       'bonus',v_total,'source_rows',v_rows);
end $function$
;
CREATE OR REPLACE FUNCTION public.luma_affiliate_program_leaderboard_v1(p_workspace_id uuid, p_program_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p record; v_result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
   raise exception 'Workspace access denied' using errcode='42501';end if;
 select * into p from public.luma_affiliate_programs
 where id=p_program_id and workspace_id=p_workspace_id;
 if not found then raise exception 'Program not found' using errcode='22023';end if;
 with activity as(
   select a.creator_id,
    coalesce(sum(perf.qty_net),0) qty_net,coalesce(sum(perf.gmv_net),0) gmv_net,
    coalesce(sum(perf.orders),0) orders,coalesce(sum(perf.videos),0) videos,
    coalesce(sum(perf.live_count),0) live_count,coalesce(sum(perf.views),0) views,
    coalesce(sum(perf.ads_spend),0) ads_spend,coalesce(sum(perf.commission),0) platform_commission
   from public.luma_affiliate_program_participants a
   left join public.luma_affiliate_program_performance perf
    on perf.program_id=a.program_id and perf.creator_id=a.creator_id
    and perf.metric_date between p.start_date and p.end_date
    and (p.product_master_id is null or perf.product_master_id=p.product_master_id)
    and (p.store_id is null or perf.store_id=p.store_id)
    and (p.channel='all' or perf.source_channel=p.channel)
    and exists (select 1 from public.luma_affiliate_program_imports imported where imported.id=perf.import_id and imported.status='completed')
   where a.program_id=p.id and a.workspace_id=p_workspace_id and a.status='active'
   group by a.creator_id
 ), scored as(
  select a.*,
   case p.metric when 'qty_net' then a.qty_net when 'gmv_net' then a.gmv_net
        when 'orders' then a.orders when 'videos' then a.videos
        when 'live_count' then a.live_count when 'views' then a.views
        when 'ads_spend' then a.ads_spend else 0 end actual
  from activity a
 ), ranked as (
  select s.*,coalesce(c.name,c.username,c.creator_code,'Creator') creator_name,
   coalesce((select (r->>'reward_value')::numeric from jsonb_array_elements(p.tier_rules) r
       where (r->>'target')::numeric<=s.actual
       order by (r->>'target')::numeric desc limit 1),
       case when s.actual>=p.target_value and p.target_value>0 then p.reward_value else 0 end) tier_reward,
   coalesce((select r->>'tier' from jsonb_array_elements(p.tier_rules) r
       where (r->>'target')::numeric<=s.actual
       order by (r->>'target')::numeric desc limit 1),'') tier_name
  from scored s left join public.creators c on c.id=s.creator_id
 ), final as (
  select r.*,case when r.tier_reward>0 then r.tier_reward+
       (case when p.metric='qty_net' then r.qty_net*p.extra_incentive_per_unit else 0 end) else 0 end
       estimated_reward,
    case when r.tier_reward>0 and current_date>public.luma_affiliate_claim_deadline_effective_v1(p.end_date,p.claim_deadline) then 'claim_expired'
         when r.tier_reward>0 then 'qualified'
         when current_date>p.end_date then 'not_qualified'
         else 'in_progress' end qualification
  from ranked r
 )
 select jsonb_build_object(
  'program',jsonb_build_object('id',p.id,'name',p.program_name,'metric',p.metric,'target',p.target_value,'start_date',p.start_date,'end_date',p.end_date,'claim_deadline',public.luma_affiliate_claim_deadline_effective_v1(p.end_date,p.claim_deadline),'status',p.status,'claim_limit',p.claim_limit),
  'leaderboard',coalesce((select jsonb_agg(to_jsonb(f) order by f.actual desc,f.creator_name) from final f),'[]'::jsonb),
  'summary',jsonb_build_object('participants',(select count(*) from final),
    'qualified',(select count(*) from final where qualification='qualified'),
    'expired',(select count(*) from final where qualification='claim_expired'),
    'estimated_bonus',(select coalesce(sum(estimated_reward),0) from final where qualification='qualified'))
 ) into v_result;
 return v_result;
end $function$
;
