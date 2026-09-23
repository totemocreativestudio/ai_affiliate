-- PR37: production payment priority.
-- Default checkout order: Mayar.id -> Midtrans -> Xendit.
update public.luma_payment_provider_settings
set priority=case provider
  when 'mayar' then 10
  when 'midtrans' then 20
  when 'xendit' then 30
  else priority
end,
updated_at=now()
where provider in ('mayar','midtrans','xendit');
