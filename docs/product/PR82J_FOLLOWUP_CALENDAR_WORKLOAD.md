# PR #82J — Follow-Up Calendar & Team Workload

Continue PR #82G/#82I with a visual planning layer for creator follow-ups.

## Goals
- month calendar for all scheduled listing follow-ups
- week/day readability without turning Listings into a heavy project-management screen
- filter by PIC, platform, channel, and priority
- drag-and-drop a follow-up card to another date to reschedule
- retain original time-of-day when moving to another date
- show overdue items in a dedicated strip
- team workload summary by PIC for the selected month
- no creator outreach is sent automatically

## Calendar event
Use listings:
- creator_name
- platform
- product_name / sku
- follow_up_channel
- next_follow_up_at
- follow_up_priority
- follow_up_owner_user_id
- stage

## Workload
For each PIC:
- scheduled follow-ups in selected month
- overdue count
- due today count
- urgent/high count
- completed follow-ups in selected month

## UX
- compact month navigation
- drag card between calendar days
- click card opens Listing detail
- filters are sticky/compact
- mobile uses horizontal calendar scroll, not tiny unreadable cells

## Rules
- drag/reschedule clears follow_up_completed_at
- Action Center sync will pick up the new schedule on its next 30-minute run
- terminal listings only appear when they still have a schedule
- workspace isolation via existing RLS / RPC checks
