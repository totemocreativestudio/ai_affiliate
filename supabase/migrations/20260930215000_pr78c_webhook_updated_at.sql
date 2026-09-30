-- PR78C follow-up: webhook event update timestamp used by atomic claim/finish RPCs

alter table public.luma_payment_webhook_events
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_luma_payment_webhook_processing
  on public.luma_payment_webhook_events(processing_status,updated_at desc);

comment on column public.luma_payment_webhook_events.updated_at is
'Last processing-state update timestamp for webhook observability and retry diagnostics.';
