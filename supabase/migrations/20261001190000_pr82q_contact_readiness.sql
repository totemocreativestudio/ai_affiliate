-- PR82Q: Creator contact readiness

create or replace function public.luma_listing_contact_readiness_v1(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.luma_has_workspace(p_workspace_id) and not public.luma_is_admin() then
    raise exception 'Workspace access denied' using errcode='42501';
  end if;

  with base as (
    select
      l.id,l.creator_id,l.creator_name,l.platform,l.stage,l.follow_up_channel,
      l.next_follow_up_at,l.next_action,l.product_name,l.sku,
      nullif(trim(c.phone),'') phone,
      coalesce(c.social_links,'{}'::jsonb) social_links,
      (nullif(trim(c.phone),'') is not null) whatsapp_ready,
      (
        nullif(trim(coalesce(c.social_links->>'instagram','')),'') is not null
        or nullif(trim(coalesce(c.social_links->>'tiktok','')),'') is not null
        or nullif(trim(coalesce(c.social_links->>'youtube','')),'') is not null
        or nullif(trim(coalesce(c.social_links->>'facebook','')),'') is not null
        or nullif(trim(coalesce(c.profile_url,'')),'') is not null
      ) social_ready
    from public.listings l
    left join public.creators c
      on c.id=l.creator_id and c.workspace_id=l.workspace_id
    where l.workspace_id=p_workspace_id
  ),
  scored as (
    select *,
      case
        when follow_up_channel='WhatsApp' then whatsapp_ready
        when follow_up_channel='DM Instagram' then nullif(trim(coalesce(social_links->>'instagram','')),'') is not null
        when follow_up_channel='DM TikTok' then nullif(trim(coalesce(social_links->>'tiktok','')),'') is not null
        when follow_up_channel='Email' then false
        else true
      end channel_ready
    from base
  ),
  blocked as (
    select *
    from scored
    where next_follow_up_at is not null
      and next_follow_up_at<=now()+interval '7 days'
      and channel_ready=false
    order by next_follow_up_at asc
    limit 100
  )
  select jsonb_build_object(
    'generated_at',now(),
    'summary',jsonb_build_object(
      'total',count(*),
      'whatsapp_ready',count(*) filter(where whatsapp_ready),
      'social_ready',count(*) filter(where social_ready),
      'both_ready',count(*) filter(where whatsapp_ready and social_ready),
      'missing_all',count(*) filter(where not whatsapp_ready and not social_ready),
      'channel_mismatch',count(*) filter(where channel_ready=false),
      'blocked_due_7d',(select count(*) from blocked)
    ),
    'blocked',coalesce((select jsonb_agg(to_jsonb(x) order by x.next_follow_up_at) from blocked x),'[]'::jsonb)
  )
  into result
  from scored;

  return coalesce(result,'{}'::jsonb);
end
$$;

revoke all on function public.luma_listing_contact_readiness_v1(uuid) from public,anon;
grant execute on function public.luma_listing_contact_readiness_v1(uuid) to authenticated,service_role;
