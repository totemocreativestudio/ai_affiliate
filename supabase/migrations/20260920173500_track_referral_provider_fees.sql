alter table public.referral_withdrawals add column if not exists provider_fee numeric(18,2) not null default 0;
alter table public.referral_withdrawals add column if not exists provider_fee_currency text not null default 'IDR';
