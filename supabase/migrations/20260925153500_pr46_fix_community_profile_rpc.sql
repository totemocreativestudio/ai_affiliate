-- PR46 follow-up: fix ambiguous Community Profile RPC assignment.
-- The production function created by the first PR46 migration used an
-- unqualified social_avatar_url reference inside UPDATE, which conflicts with
-- the RETURNS TABLE output variable of the same name.

create or replace function public.luma_update_social_identity(
  p_alias text,
  p_avatar_url text default null
)
returns table(social_alias text,social_avatar_url text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_alias text:=trim(coalesce(p_alias,''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if char_length(v_alias)<3 or char_length(v_alias)>30 then
    raise exception 'Nama community harus 3-30 karakter.';
  end if;
  if v_alias !~ '^[[:alnum:]_. -]+$' then
    raise exception 'Nama community hanya boleh berisi huruf, angka, spasi, titik, underscore, atau tanda minus.';
  end if;
  if not public.luma_social_text_allowed(v_alias) then
    raise exception 'Nama community tidak boleh berisi kontak atau link.';
  end if;
  if exists(
    select 1
    from public.profiles p
    where lower(p.social_alias)=lower(v_alias)
      and p.id<>(select auth.uid())
  ) then
    raise exception 'Nama community sudah digunakan.';
  end if;

  perform set_config('app.luma_social_identity_rpc','1',true);

  update public.profiles as p
  set social_alias=v_alias,
      social_avatar_url=coalesce(nullif(trim(p_avatar_url),''),p.social_avatar_url),
      updated_at=now()
  where p.id=(select auth.uid());

  return query
  select p.social_alias,p.social_avatar_url
  from public.profiles p
  where p.id=(select auth.uid());
end
$$;

revoke all on function public.luma_update_social_identity(text,text) from public,anon;
grant execute on function public.luma_update_social_identity(text,text) to authenticated,service_role;
