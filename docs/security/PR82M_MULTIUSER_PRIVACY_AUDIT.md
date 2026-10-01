# PR #82M — Multi-User Privacy Audit & Regression Gate

Purpose:
Make privacy a continuously verifiable owner-only control after PR #82L.

Checks:
1. luma_platform_settings SELECT is admin-only.
2. luma_provider_accounts is admin-only.
3. luma_payment_provider_settings denies client access.
4. profiles SELECT never exposes other profiles to ordinary authenticated users.
5. safe assignee RPC exists.
6. safe assignee RPC definition does not return full_name, email, username, membership_role, or owner role.
7. owner-only RPC inventory remains admin guarded.
8. no known sensitive settings table has an authenticated SELECT policy containing an unconditional TRUE.

Output:
- PASS / REVIEW
- total checks
- failed checks
- finding details
- timestamp

Owner UI:
Add a compact Multi-User Privacy card inside Owner Platform Health.
This card is owner-only and must never be mounted in member mode.
