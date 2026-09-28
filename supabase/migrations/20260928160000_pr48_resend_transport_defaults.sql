-- PR48 Resend transport defaults. No secret values are stored in this migration.
insert into public.luma_platform_settings(setting_key,setting_value,updated_at)
values
  ('email_provider','resend',now()),
  ('email_smtp_host','smtp.resend.com',now()),
  ('email_smtp_port','465',now()),
  ('email_smtp_user','resend',now()),
  ('email_smtp_security','ssl',now())
on conflict(setting_key) do update
set setting_value=excluded.setting_value,
    updated_at=now();
