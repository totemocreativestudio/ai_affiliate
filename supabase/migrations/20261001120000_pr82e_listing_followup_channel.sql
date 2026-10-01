-- PR82E: Listing follow-up channel

alter table public.listings
  add column if not exists follow_up_channel text;

alter table public.listing_activities
  add column if not exists follow_up_channel text;

create index if not exists listings_workspace_followup_channel_idx
  on public.listings(workspace_id,follow_up_channel);

create index if not exists listing_activities_workspace_channel_date_idx
  on public.listing_activities(workspace_id,follow_up_channel,activity_date desc);

comment on column public.listings.follow_up_channel
is 'Latest/preferred outreach channel for the listing, e.g. WhatsApp, DM Instagram, DM TikTok.';

comment on column public.listing_activities.follow_up_channel
is 'Historical channel actually used for a listing activity.';
