# PR #82H — Listing Follow-Up → Action Center Automation

Continue PR #82G by synchronizing scheduled creator follow-ups into Lumaway Action Center.

## Trigger
Every 30 minutes:
- scan listing.next_follow_up_at
- include overdue, due today, and next 7 days
- skip completed follow-ups
- skip terminal Won / Active or Lost / Inactive listings unless they explicitly still have a schedule

## Action Center item
source_type: listing_followup
source_id: listing.id
title: Follow up {creator}
description: channel + next action + product/SKU
severity:
- urgent => critical
- high => high
- normal => normal
- low => low
due_date: Jakarta-local date of next_follow_up_at
action_route: listings
metadata:
- listing_id
- creator_id
- creator_name
- follow_up_channel
- next_follow_up_at
- follow_up_priority
- stage

## Lifecycle
- if an open action already exists for the listing, update it rather than duplicate it
- if follow-up is marked done, schedule removed, or moved beyond 7 days, mark open Action Center item as done
- if rescheduled back into the 7-day window, create/update open action again

## Safety
- service-role only sync function
- workspace isolation preserved in user-facing Action Center
- no direct WhatsApp/DM sending; this is an operational reminder only
