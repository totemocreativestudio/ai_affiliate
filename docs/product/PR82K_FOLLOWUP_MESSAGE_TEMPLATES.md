# PR #82K — Follow-Up Message Templates & Quick Copy

Continue PR #82E–#82J by helping teams communicate consistently without auto-sending messages.

## Goals
- reusable workspace-level follow-up message templates
- channel-aware templates for WhatsApp, DM Instagram, DM TikTok, Email, and Others
- optional stage targeting: Reach Out, Follow Up, Negotiation, Sample Sent, Content In Progress, Uploaded, Live
- variables:
  {{creator_name}}
  {{creator_username}}
  {{product_name}}
  {{sku}}
  {{next_action}}
  {{follow_up_date}}
  {{pic_name}}
- preview rendered against selected Listing
- one-click Copy Message
- no automatic outbound send

## UX
Inside Listings detail:
- Quick Message panel
- channel filter defaults to Listing.follow_up_channel
- stage filter defaults to Listing.stage
- template picker
- live preview
- Copy Message
- Add/Edit Template access

## Safety
- no automatic WhatsApp/Instagram/TikTok send
- no unsupported direct messaging API integration
- workspace RLS
- preserve user control over final message
