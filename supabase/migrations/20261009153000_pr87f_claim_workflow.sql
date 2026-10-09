-- PR 87F · Auditable reward claim lifecycle and channel-aware performance.
alter table public.luma_affiliate_program_performance
  add column if not exists source_channel text not null default 'all'
  check (source_channel in ('all','video','live','product','ads'));
alter table public.luma_affiliate_reward_claims
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists achievement numeric not null default 0,
  add column if not exists tier_name text,
  add column if not exists source_rows bigint not null default 0,
  add column if not exists approver_note text,
  add column if not exists payment_reference text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

-- Client may view claims, but can only mutate through role-checked, atomic database functions.
revoke insert,update,delete on public.luma_affiliate_reward_claims from authenticated;
create index if not exists luma_affiliate_claims_program_idx
  on public.luma_affiliate_reward_claims(workspace_id,program_id,status,created_at desc);

create or replace function public.luma_affiliate_submit_claim_v2(
 p_workspace_id uuid,p_program_id uuid,p_creator_id bigint,p_period_no integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
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
 if current_date>coalesce(p.claim_deadline,p.end_date) then raise exception 'Masa klaim sudah habis';end if;
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
end $$;
revoke all on function public.luma_affiliate_submit_claim_v2(uuid,uuid,bigint,integer) from public,anon;
grant execute on function public.luma_affiliate_submit_claim_v2(uuid,uuid,bigint,integer) to authenticated;

create or replace function public.luma_affiliate_review_claim_v2(
 p_workspace_id uuid,p_claim_id uuid,p_action text,p_note text default null,p_payment_reference text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_claim public.luma_affiliate_reward_claims%rowtype;v_status text;
begin
 if auth.uid() is null or not public.luma_is_workspace_admin(p_workspace_id) then
  raise exception 'Hanya owner/admin workspace yang dapat menyetujui atau menyalurkan reward' using errcode='42501';
 end if;
 select * into v_claim from public.luma_affiliate_reward_claims
   where id=p_claim_id and workspace_id=p_workspace_id for update;
 if not found then raise exception 'Klaim tidak ditemukan';end if;
 if p_action='approve' then
  if v_claim.status<>'pending' then raise exception 'Hanya klaim pending yang dapat disetujui';end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'Catatan persetujuan wajib diisi';end if;
  v_status:='approved';
 elsif p_action='reject' then
  if v_claim.status<>'pending' then raise exception 'Hanya klaim pending yang dapat ditolak';end if;
  if nullif(btrim(coalesce(p_note,'')),'') is null then raise exception 'Alasan penolakan wajib diisi';end if;
  v_status:='rejected';
 elsif p_action='fulfill' then
  if v_claim.status<>'approved' then raise exception 'Setujui klaim sebelum mencatat penyaluran';end if;
  if nullif(btrim(coalesce(p_payment_reference,'')),'') is null then
    raise exception 'Nomor referensi pembayaran / pengiriman wajib diisi';end if;
  v_status:='paid';
 else raise exception 'Aksi tidak dikenal';end if;
 update public.luma_affiliate_reward_claims set
  status=v_status,reviewed_by=auth.uid(),reviewed_at=now(),
  approver_note=case when p_action='fulfill' then approver_note else btrim(p_note) end,
  payment_reference=case when p_action='fulfill' then btrim(p_payment_reference) else payment_reference end,
  fulfilled_at=case when p_action='fulfill' then now() else fulfilled_at end,
  updated_at=now()
 where id=p_claim_id and workspace_id=p_workspace_id;
 return jsonb_build_object('ok',true,'claim_id',p_claim_id,'status',v_status);
end $$;
revoke all on function public.luma_affiliate_review_claim_v2(uuid,uuid,text,text,text) from public,anon;
grant execute on function public.luma_affiliate_review_claim_v2(uuid,uuid,text,text,text) to authenticated;
