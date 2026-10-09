-- PR87C: workspace-owner subscriptions apply to authorized team members.
-- Retain the existing direct-subscription fallback semantics.
create or replace function public.luma_my_access_state_v1()
returns table(locked boolean,has_subscription boolean,current_status text,
 effective_starts_at timestamptz,effective_ends_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_uid uuid:=auth.uid();
 v_is_admin boolean:=false;
 v_status text;
 v_starts timestamptz;
 v_ends timestamptz;
 v_has boolean:=false;
 v_shared_status text;
 v_shared_starts timestamptz;
 v_shared_ends timestamptz;
begin
 if v_uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 v_is_admin:=public.luma_is_admin();
 select true,s.status,s.starts_at,s.ends_at
 into v_has,v_status,v_starts,v_ends
 from public.luma_user_subscriptions s
 where s.user_id=v_uid
 order by
   case when lower(coalesce(s.status,'')) in ('active','trialing')
       and s.starts_at<=now() and s.ends_at>now() then 0 else 1 end,
   s.ends_at desc
 limit 1;
 -- Only real workspace owner memberships, not a self-asserted role, can share an active subscription.
 -- No membership -> never inherit another person's subscription.
 if not v_is_admin then
   select s.status,s.starts_at,s.ends_at
   into v_shared_status,v_shared_starts,v_shared_ends
   from public.workspace_members member
   join public.workspace_members owner
     on owner.workspace_id=member.workspace_id
     and owner.membership_role='owner'
     and owner.user_id<>v_uid
   join public.workspaces w
     on w.id=member.workspace_id and w.status='active'
   join public.luma_user_subscriptions s
     on s.user_id=owner.user_id
   where member.user_id=v_uid
     and lower(coalesce(s.status,'')) in ('active','trialing')
     and s.starts_at<=now() and s.ends_at>now()
   order by s.ends_at desc
   limit 1;
 end if;
 if v_shared_ends is not null and
    not (lower(coalesce(v_status,'')) in ('active','trialing') and v_starts<=now() and v_ends>now()) then
   v_has:=true;
   v_status:='workspace_'||v_shared_status;
   v_starts:=v_shared_starts;
   v_ends:=v_shared_ends;
 end if;
 return query select
  case
   when v_is_admin then false
   when not coalesce(v_has,false) then false
   when lower(coalesce(v_status,'')) in ('active','trialing','workspace_active','workspace_trialing')
      and v_starts<=now() and v_ends>now() then false
   else true
  end,
  coalesce(v_has,false),v_status,v_starts,v_ends;
end $$;
revoke all on function public.luma_my_access_state_v1() from public,anon;
grant execute on function public.luma_my_access_state_v1() to authenticated;

create or replace function public.luma_affiliate_validate_program_links_v1()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare v_workspace uuid;
begin
 if new.program_id is not null then
   select workspace_id into v_workspace from public.luma_affiliate_programs where id=new.program_id;
   if v_workspace is distinct from new.workspace_id then
      raise exception 'Program must belong to this workspace' using errcode='23514';
   end if;
 end if;
 return new;
end $$;
drop trigger if exists luma_affiliate_agreement_program_guard on public.agreements;
create trigger luma_affiliate_agreement_program_guard
 before insert or update of program_id,workspace_id on public.agreements
 for each row execute function public.luma_affiliate_validate_program_links_v1();
drop trigger if exists luma_affiliate_listing_program_guard on public.listings;
create trigger luma_affiliate_listing_program_guard
 before insert or update of program_id,workspace_id on public.listings
 for each row execute function public.luma_affiliate_validate_program_links_v1();
