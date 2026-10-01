# PR #82A — Auth Recovery Reliability

## Problem
Production user reports:
1. Forgot password flow is not completing reliably.
2. WhatsApp login does not deliver OTP.

Production audit found:
- password-reset API returned HTTP 200 and Resend accepted the request, but the user still reports the recovery journey as unusable.
- WhatsApp OTP requests returned HTTP 502.
- provider audit recorded: FlowKirim session not found.

## Build
### Password recovery
- keep secure one-time recovery link as alternate path
- add 6-digit email recovery code in the same email
- allow code verification directly on the login screen
- exchange verified code for a Supabase recovery session
- redirect to create-new-password page
- resend-code action
- 10 minute expiry
- generic responses to avoid email enumeration

### WhatsApp login
- normalize +62 / 62 / 08 account-number variants
- enable provider failover
- FlowKirim → Convia → Meta where configured
- if all WhatsApp providers fail, send the same login OTP to the account email as a recovery channel
- clearly tell the user when fallback email was used
- preserve rate limits and audit events
- never expose provider secrets or raw provider errors to end users

### UX
- OTP field appears after request
- resend action
- explicit expiry/help text
- no dead-end error when one provider is down
