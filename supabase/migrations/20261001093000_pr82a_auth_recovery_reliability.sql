-- PR82A Auth recovery reliability
-- Enable provider failover so a broken FlowKirim session does not stop at the primary provider.
insert into public.luma_platform_settings(setting_key,setting_value,updated_at)
values('whatsapp_failover_enabled','true',now())
on conflict(setting_key) do update set setting_value='true',updated_at=now();
