-- Lumaway production schema baseline snapshot
-- Captured from Supabase production on 2026-09-25.
-- Disaster-recovery reference only. DO NOT apply to the existing production database.
-- Customer/business row data is intentionally excluded.

-- luma_is_workspace_member(p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_is_workspace_member(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1
            FROM public.workspace_members wm
            JOIN public.profiles p
              ON p.id = wm.user_id
            WHERE wm.workspace_id = p_workspace_id
              AND wm.user_id = auth.uid()
              AND p.active = true
        );
$function$
;

-- luma_lock_social_identity()
CREATE OR REPLACE FUNCTION public.luma_lock_social_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and auth.uid()=old.id then
    new.social_alias:=old.social_alias;
    new.social_avatar_key:=old.social_avatar_key;
  end if;
  return new;
end;
$function$
;

-- luma_notify_analysis_success()
CREATE OR REPLACE FUNCTION public.luma_notify_analysis_success()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin if new.status='Success' and old.status is distinct from new.status then perform public.luma_notify_user(new.created_by,new.workspace_id,'Analisis selesai','Hasil Lumaway AI tersimpan ke history.','ai_generate','#ai-analytics'); end if; return new; end;$function$
;

-- luma_notify_promo()
CREATE OR REPLACE FUNCTION public.luma_notify_promo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin perform public.luma_notify_user(new.user_id,new.workspace_id,'Materi berhasil dibuat','Output Lumaway AI tersimpan ke riwayat materi.','ai_generate','#promo-studio'); return new; end;$function$
;

-- luma_notify_referral_event()
CREATE OR REPLACE FUNCTION public.luma_notify_referral_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin perform public.luma_notify_user(new.referrer_user_id,new.workspace_id,'Komisi referral tercatat','Komisi referral baru sebesar Rp '||to_char(coalesce(new.commission_amount,0),'FM999G999G999G990')||'.','referral_reward','#luma-affiliate'); return new; end;$function$
;

-- luma_notify_report()
CREATE OR REPLACE FUNCTION public.luma_notify_report()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin perform public.luma_notify_user(new.user_id,new.workspace_id,'Dokumen analisis siap','Dokumen hasil analisis berhasil dibuat.','document_generated','#ai-analytics'); return new; end;$function$
;

-- luma_notify_self(p_workspace_id uuid, p_title text, p_message text, p_kind text, p_action_url text)
CREATE OR REPLACE FUNCTION public.luma_notify_self(p_workspace_id uuid, p_title text, p_message text, p_kind text, p_action_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists(select 1 from public.workspace_members wm where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid()) then raise exception 'Forbidden'; end if;
  insert into public.user_notifications(user_id,workspace_id,title,message,kind,is_read,action_url,created_at)
  values(auth.uid(),p_workspace_id,p_title,p_message,p_kind,false,p_action_url,now());
end;$function$
;

-- luma_notify_social_like()
CREATE OR REPLACE FUNCTION public.luma_notify_social_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare owner_id uuid;
begin select user_id into owner_id from public.luma_community_posts where id=new.post_id; if owner_id is not null and owner_id<>new.user_id then perform public.luma_notify_user(owner_id,null,'Post Anda mendapat like','Seseorang menyukai postingan Anda di Social Lumaway.','social_like','#social-lumaway'); end if; return new; end;$function$
;

-- luma_notify_subscription_status()
CREATE OR REPLACE FUNCTION public.luma_notify_subscription_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if old.status is distinct from new.status and new.status='expired' then
  perform public.luma_notify_user(new.user_id,new.workspace_id,'Masa langganan berakhir','Masa aktif Lumaway Anda telah berakhir. Perpanjang paket untuk melanjutkan status langganan.','subscription_expired','#billing');
 end if;
 return new;
end $function$
;

-- luma_notify_support_reply()
CREATE OR REPLACE FUNCTION public.luma_notify_support_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin if new.sender_type='owner' then perform public.luma_notify_user(new.user_id,new.workspace_id,'Tiket mendapat tanggapan','Support Lumaway telah membalas tiket Anda.','ticket_reply','#support-tickets'); end if; return new; end;$function$
;

-- luma_notify_support_ticket()
CREATE OR REPLACE FUNCTION public.luma_notify_support_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='INSERT' then perform public.luma_notify_user(new.user_id,new.workspace_id,'Tiket bantuan dibuat','Tiket '||new.ticket_code||' telah dibuat.','ticket_created','#support-tickets');
 elsif new.status is distinct from old.status then perform public.luma_notify_user(new.user_id,new.workspace_id,'Status tiket diperbarui','Tiket '||new.ticket_code||' berstatus '||new.status||'.','ticket_status','#support-tickets'); end if;
 return new;
end;$function$
;

-- luma_notify_task_done()
CREATE OR REPLACE FUNCTION public.luma_notify_task_done()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin if lower(coalesce(new.status,''))='done' and lower(coalesce(old.status,''))<>'done' and new.created_by is not null then perform public.luma_notify_user(new.created_by,new.workspace_id,'Task selesai',coalesce(new.title,'Task')||' telah selesai.','kanban_done','#kanban'); end if; return new; end;$function$
;

-- luma_notify_token_transaction()
CREATE OR REPLACE FUNCTION public.luma_notify_token_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.amount < 0 then
    perform public.luma_notify_user(new.user_id,new.workspace_id,'Token digunakan',abs(new.amount)||' token digunakan.','token_usage','#billing');
  elsif new.amount > 0 then
    perform public.luma_notify_user(new.user_id,new.workspace_id,'Token berhasil ditambahkan',new.amount||' token telah masuk ke saldo.','token_topup','#billing');
  end if;
  return new;
end;$function$
;

-- luma_notify_topup_order()
CREATE OR REPLACE FUNCTION public.luma_notify_topup_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare k text; t text; m text;
begin
  if tg_op='INSERT' then
    k:='payment_pending'; t:='Pembayaran token menunggu penyelesaian'; m:='Order '||new.order_code||' masih menunggu pembayaran.';
  elsif new.status is distinct from old.status then
    k:=case lower(coalesce(new.status,'')) when 'paid' then 'payment_success' when 'expired' then 'payment_expired' when 'failed' then 'payment_failed' else 'payment_status' end;
    t:=case lower(coalesce(new.status,'')) when 'paid' then 'Top up berhasil' when 'expired' then 'Pembayaran token kedaluwarsa' when 'failed' then 'Pembayaran token gagal' else 'Status pembayaran diperbarui' end;
    m:='Order '||new.order_code||' berstatus '||coalesce(new.status,'-')||'.';
  else return new; end if;
  perform public.luma_notify_user(new.user_id,new.workspace_id,t,m,k,'#billing'); return new;
end;$function$
;

-- luma_notify_user(p_user_id uuid, p_workspace_id uuid, p_title text, p_message text, p_kind text, p_action_url text)
CREATE OR REPLACE FUNCTION public.luma_notify_user(p_user_id uuid, p_workspace_id uuid, p_title text, p_message text, p_kind text, p_action_url text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_user_id is null then return; end if;
  insert into public.user_notifications(user_id,workspace_id,title,message,kind,is_read,action_url,created_at)
  values(p_user_id,p_workspace_id,p_title,p_message,p_kind,false,p_action_url,now());
end;$function$
;

-- luma_notify_withdrawal()
CREATE OR REPLACE FUNCTION public.luma_notify_withdrawal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if tg_op='INSERT' then perform public.luma_notify_user(new.user_id,new.workspace_id,'Pencairan diajukan','Pengajuan pencairan sedang diproses.','withdrawal_pending','#luma-affiliate');
 elsif new.status is distinct from old.status then perform public.luma_notify_user(new.user_id,new.workspace_id,'Status pencairan diperbarui','Pengajuan pencairan berstatus '||new.status||'.','withdrawal_'||lower(coalesce(new.status,'status')),'#luma-affiliate'); end if;
 return new;
end;$function$
;

-- luma_payment_provider_health(p_provider text, p_ok boolean, p_error text)
CREATE OR REPLACE FUNCTION public.luma_payment_provider_health(p_provider text, p_ok boolean, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  update public.luma_payment_provider_settings
  set health_status=case when p_ok then 'healthy' else 'error' end,
      last_success_at=case when p_ok then now() else last_success_at end,
      last_error_at=case when p_ok then last_error_at else now() end,
      last_error=case when p_ok then null else left(coalesce(p_error,'unknown'),500) end,
      updated_at=now()
  where provider=lower(p_provider);
end
$function$
;

-- luma_provision_customer_workspace(p_user_id uuid)
CREATE OR REPLACE FUNCTION public.luma_provision_customer_workspace(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_workspace_id uuid;
    v_email text;
    v_name text;
    v_slug text;
BEGIN

    SELECT
        u.email,
        COALESCE(
            NULLIF(u.raw_user_meta_data ->> 'full_name', ''),
            NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
            'Luma Customer'
        )
    INTO
        v_email,
        v_name
    FROM auth.users u
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Auth user not found';
    END IF;


    -- Do not create another workspace if user already has one.
    SELECT wm.workspace_id
    INTO v_workspace_id
    FROM public.workspace_members wm
    WHERE wm.user_id = p_user_id
    ORDER BY wm.created_at ASC
    LIMIT 1;

    IF v_workspace_id IS NOT NULL THEN
        RETURN v_workspace_id;
    END IF;


    -- Unique customer workspace slug.
    v_slug :=
        'customer-' ||
        replace(p_user_id::text, '-', '');


    INSERT INTO public.workspaces (
        name,
        slug,
        status
    )
    VALUES (
        v_name || ' Workspace',
        v_slug,
        'active'
    )
    RETURNING id INTO v_workspace_id;


    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        membership_role
    )
    VALUES (
        v_workspace_id,
        p_user_id,
        'owner'
    )
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET
        membership_role = 'owner';


    RETURN v_workspace_id;

END;
$function$
;

-- luma_random_alnum22()
CREATE OR REPLACE FUNCTION public.luma_random_alnum22()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  output text := '';
  i integer;
begin
  for i in 1..22 loop
    output := output || substr(chars, 1 + floor(random() * length(chars))::integer, 1);
  end loop;
  return output;
end
$function$
;

-- luma_ratecard_master_updated_at()
CREATE OR REPLACE FUNCTION public.luma_ratecard_master_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$
;

-- luma_report_download(p_report_id bigint, p_user_id uuid, p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_report_download(p_report_id bigint, p_user_id uuid, p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v public.luma_pdf_reports%rowtype;
  v_spent jsonb;
  v_reference text;
begin
  select * into v from public.luma_pdf_reports where id=p_report_id and user_id=p_user_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'Report not found'; end if;
  v_reference := 'report-download-'||p_report_id||'-'||gen_random_uuid()::text;
  v_spent:=public.luma_consume_tokens(p_user_id,p_workspace_id,10,v_reference,'Download AI report');
  update public.luma_pdf_reports set downloaded_at=now(),download_count=0 where id=p_report_id;
  return jsonb_build_object('charged',true,'cost',10);
end;
$function$
;

-- luma_report_preview(p_report_id bigint, p_user_id uuid, p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_report_preview(p_report_id bigint, p_user_id uuid, p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.luma_pdf_reports%rowtype; v_spent jsonb; begin
  select * into v from public.luma_pdf_reports where id=p_report_id and user_id=p_user_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'Report not found'; end if;
  if v.previewed_at is null then
    v_spent:=public.luma_consume_tokens(p_user_id,p_workspace_id,5,'report-preview-'||p_report_id,'First preview AI report');
    update public.luma_pdf_reports set previewed_at=now() where id=p_report_id;
  end if;
  return jsonb_build_object('charged',v.previewed_at is null,'cost',case when v.previewed_at is null then 5 else 0 end);
end $function$
;

-- luma_report_remove_watermark(p_report_id bigint, p_user_id uuid, p_workspace_id uuid)
CREATE OR REPLACE FUNCTION public.luma_report_remove_watermark(p_report_id bigint, p_user_id uuid, p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v public.luma_pdf_reports%rowtype; v_spent jsonb; begin
  select * into v from public.luma_pdf_reports where id=p_report_id and user_id=p_user_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'Report not found'; end if;
  if v.watermark_removed_at is null then
    v_spent:=public.luma_consume_tokens(p_user_id,p_workspace_id,25,'report-watermark-'||p_report_id,'Remove Lumaway watermark');
    update public.luma_pdf_reports set watermark_removed_at=now() where id=p_report_id;
  end if;
  return jsonb_build_object('charged',v.watermark_removed_at is null,'cost',case when v.watermark_removed_at is null then 25 else 0 end);
end $function$
;

-- luma_request_referral_withdrawal(p_workspace_id uuid, p_amount numeric, p_method text, p_channel_code text, p_account_number text, p_account_name text)
CREATE OR REPLACE FUNCTION public.luma_request_referral_withdrawal(p_workspace_id uuid, p_amount numeric, p_method text, p_channel_code text, p_account_number text, p_account_name text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid:=auth.uid();
  v_earned numeric;
  v_reserved numeric;
  v_id bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not public.luma_has_workspace(p_workspace_id) then raise exception 'Workspace access denied'; end if;
  if p_amount<=0 then raise exception 'Amount must be positive'; end if;
  select coalesce(sum(commission_amount),0) into v_earned from public.referral_events where referrer_user_id=v_user and status in ('confirmed','paid');
  select coalesce(sum(amount),0) into v_reserved from public.referral_withdrawals where user_id=v_user and status in ('pending','processing','paid');
  if p_amount>(v_earned-v_reserved) then raise exception 'Saldo referral tidak cukup. Saldo tersedia Rp %',to_char(greatest(v_earned-v_reserved,0),'FM999G999G999'); end if;
  insert into public.referral_withdrawals(workspace_id,user_id,amount,payout_method,channel_code,account_number,account_name,status,provider)
  values(p_workspace_id,v_user,p_amount,p_method,p_channel_code,p_account_number,p_account_name,'pending','xendit') returning id into v_id;
  return v_id;
end;
$function$
;

-- luma_schema_sync_summary()
CREATE OR REPLACE FUNCTION public.luma_schema_sync_summary()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select jsonb_build_object(
    'registry_rows', count(*),
    'repository_migrations', count(*) filter (where source_status='repository_migration'),
    'production_legacy', count(*) filter (where source_status='production_legacy'),
    'repository_manual_state', count(*) filter (where source_status='repository_manual_state'),
    'production_applied', count(*) filter (where production_applied)
  )
  from public.luma_schema_migration_registry;
$function$
;
