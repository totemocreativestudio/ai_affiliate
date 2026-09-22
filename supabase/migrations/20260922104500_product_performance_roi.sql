-- Preserve the official Shopee Product Performance ROI field.
alter table public.sales
  add column if not exists roi numeric not null default 0;
