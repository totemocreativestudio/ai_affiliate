# PR #82L — Multi-User Privacy Boundary

## Problem
Multi-user/member UI must never expose Lumaway owner identity, owner/admin operational data, infrastructure/provider configuration, internal business funnel information, or privileged platform settings.

The current Listing PIC selector derives labels from profile full_name/email/username. This can surface a real owner/member identity in a normal multi-user screen.

A database audit also found `luma_platform_settings` SELECT policy effectively allowed all authenticated users through `luma_is_admin() OR true`.

## Privacy rules
### Member-facing UI
- never query profile full_name/email/username for PIC labels
- never expose owner/admin name in Listings, Follow-Up Queue, Follow-Up Calendar, Quick Message variables, or member-facing workload
- assignee labels are privacy-safe aliases:
  - current user: `Saya`
  - other members: `PIC 01`, `PIC 02`, ...
- UUID remains internal and is not rendered

### Sensitive administration
Non-admin users must not read:
- luma_platform_settings
- provider configuration
- payment provider settings
- owner monitoring/admin-only control tables
- secret/key configuration
- internal integration/provider details

### Admin routes
- administration UI stays role-gated by profile.role='admin'
- member route navigation must continue redirecting /administration to /dashboard

## Implementation
- create SECURITY DEFINER safe assignee RPC that returns only user_id + safe_label + is_self
- update Listings to use that RPC
- update Follow-Up Queue and Calendar RPCs to emit safe labels only
- remove member-facing dependency on profile names for PIC display
- change luma_platform_settings SELECT policy to admin-only
- no real owner name/email/username should be returned by the safe assignee RPC
