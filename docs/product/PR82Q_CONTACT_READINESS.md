# PR #82Q — Creator Contact Readiness

Continue PR #82P by making contact-data gaps visible before follow-up work is due.

## Goals
- show whether every Listing has usable WhatsApp and/or social contact
- detect mismatch between Follow Up Via and available contact data
- prioritize scheduled follow-ups that cannot be executed because the required contact is missing
- provide direct shortcut back to the Listing detail

## Readiness rules
- WhatsApp requires creator.phone
- DM Instagram requires creators.social_links.instagram
- DM TikTok requires creators.social_links.tiktok
- Email is considered unavailable unless a future creator email field exists
- Agency / PIC, Offline, Telepon, Shopee Chat, TikTok Shop Chat, Lainnya are informational and do not hard-fail contact readiness
- no owner/admin identity is exposed

## Metrics
- total listings
- WhatsApp ready
- social ready
- both ready
- missing all contact
- follow-up channel mismatch
- due within 7 days + contact blocked

## UX
- compact Contact Readiness panel in Listings
- warning rows for blocked upcoming follow-ups
- click row opens Listing detail
- existing social editor and WhatsApp action are used to fix data
