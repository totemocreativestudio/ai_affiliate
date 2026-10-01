# PR #85H — Notification Center 2.0

## Goal
Turn notifications into a calm, prioritized inbox instead of a stream of equal-weight alerts.

## Priority
Three user-facing levels:
- Critical
- Action
- Info

Priority is derived from notification category/kind and may later be provided explicitly.

Examples:
Critical:
- payment_failed
- withdrawal_failed
- maintenance
- campaign_overdue

Action:
- campaign_due
- task_due
- listing_follow_up
- payment_pending
- ticket_reply
- upload issues

Info:
- payment_success
- shipping_delivered
- system_update
- promotion
- education

## User controls
Per-user state:
- snooze until later
- archive/hide
- read/unread remains supported
- category filter
- priority filter
- Today / Earlier grouping
- Mark all read

## Preferences
Per-user notification preferences:
- toast_enabled
- critical_toast_only
- operational_enabled
- marketing_enabled

Default:
- toast enabled
- only Critical/Action may become toast
- Info remains in inbox without intrusive toast

## UX
Notification popover:
- summary chips: Critical / Action / Info / Unread
- Today and Earlier sections
- priority badge + category
- Open
- Snooze 1 hour
- Snooze until tomorrow morning
- Archive
- Preferences panel

## Privacy
All user state and preferences are user_id scoped.
No owner/admin information is exposed in member notifications.

## Acceptance
1. Info notifications do not automatically interrupt users.
2. Critical/Action can toast when preferences allow.
3. Snoozed notifications disappear until due.
4. Archived notifications stay hidden.
5. Existing broadcast/direct read tracking continues working.
6. No user can update another user's notification state.
