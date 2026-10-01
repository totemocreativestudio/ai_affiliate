# PR #85C — Universal Command Center 2.0

## Goal
Make Ctrl/Cmd+K the fastest way to move through Lumaway without memorizing the sidebar.

## Search domains
Existing:
- Creator
- Product Master / SKU
- Campaign
- Shipping
- Task
- Listing

Add:
- Live Host
- Live Session
- Live Product
- Saved View (current user only)
- Module/menu commands

## Data separation
- Live Product search must read live_product_performance only for Live metrics/context.
- Product Master search is identity/master data.
- Affiliate performance is not silently mixed into Live result subtitles.
- Saved Views only return auth.uid() records.

## Result contract
Use v2 result with entity_id text because Live hosts/sessions use UUID while legacy entities use bigint.

Fields:
- entity_type
- entity_id
- title
- subtitle
- meta
- section
- score

## Command mode
When query is empty or short, show:
- pinned/recent modules
- quick create
- common routes

Quick Create:
- Campaign
- Listing
- Shipping
- Product
- Task
- Live Session

## UX
- keyboard arrows
- Enter opens
- Esc closes
- entity badge
- source-aware result labels
- query debounce
- no owner/admin internal results for members

## Acceptance
1. Search host by name/username.
2. Search Live session title.
3. Search Live product name/SKU without returning Affiliate performance as Live data.
4. Search current user's Saved View.
5. Existing creator/product/campaign/shipping/task/listing search still works.
