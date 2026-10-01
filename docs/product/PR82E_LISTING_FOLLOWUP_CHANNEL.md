# PR #82E — Listing Follow-Up Channel

## Goal
Add a clear follow-up channel to User Dashboard → Listings so teams know how each creator was contacted.

## Channels
- WhatsApp
- DM Instagram
- DM TikTok
- Email
- Telepon
- Shopee Chat
- TikTok Shop Chat
- Agency / PIC
- Offline
- Lainnya

## Data model
Add `follow_up_channel` to:
- `listings`: default / latest preferred channel for the listing
- `listing_activities`: actual channel used for each Reach Out / Follow Up / Negotiation activity

## UX
### Listing form
Add "Follow Up Via" beside Next Action.

### Follow-up modal
Add required/selectable channel for Reach Out / Follow Up / Negotiation.
Default from listing.follow_up_channel.

### Table & detail
- show compact channel badge beside Latest / Next
- detail profile shows "Follow Up Via"
- activity timeline shows channel per activity

### Filtering
- add Follow Up Via filter
- search includes follow_up_channel

## Rules
- activity channel is historical and must not be overwritten
- when a new follow-up activity is saved, update listings.follow_up_channel to that channel
- non-follow-up activities may leave channel null
