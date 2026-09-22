-- Product Performance metrics required by TikTok/Shopee official exports.
alter table public.sales
  add column if not exists refund_qty numeric not null default 0,
  add column if not exists sales_creator numeric not null default 0,
  add column if not exists flat_fee numeric not null default 0,
  add column if not exists reported_roi numeric not null default 0;

comment on column public.sales.refund_qty is 'Refunded items sold / Produk yang dikembalikan';
comment on column public.sales.sales_creator is 'Reported Sales creator metric from product performance export';
comment on column public.sales.flat_fee is 'Estimated flat fee from product performance export';
comment on column public.sales.reported_roi is 'ROI value reported by marketplace export';
