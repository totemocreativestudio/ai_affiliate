# PR #82N — Stable Member Aliases & Owner Exclusion

Continue PR #82L/#82M.

## Goal
Make member-facing assignment labels stable and prevent privileged platform-admin accounts from appearing as operational PIC options.

## Rules
- member UI never renders profile full_name, email, username, membership_role, or platform-admin identity
- current user label = Saya
- other eligible workspace users = PIC 01, PIC 02, ... using persisted aliases
- aliases must not reshuffle when members are added/removed
- profiles.role='admin' is excluded from member-facing PIC directory
- membership_role remains backend-only and is never returned by safe assignee RPC
- alias table is not readable directly by ordinary members; they use the safe RPC only

## Data
Create luma_workspace_member_aliases:
- workspace_id
- user_id
- alias_code
- created_at
unique per workspace/user and workspace/alias

## Sync
Safe assignee RPC lazily creates missing aliases for eligible non-admin workspace members using the next available PIC number.

## Result
Listings, Follow-Up Queue, Calendar, workload, and Quick Message continue using only safe_label values.
