# Lumaway production integration environment

This document defines the environment contract for the Lumaway Next.js production app.

> Never paste production secrets into source code, Git commits, screenshots, tickets, or browser-side variables. Values in `.env.example` are placeholders only.

## 1. Vercel environment variables

Configure these under **Vercel → Project → Settings → Environment Variables** for Production. Add to Preview only when intentionally testing preview deployments.

### Browser-safe variables

```bash
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Only variables prefixed with `NEXT_PUBLIC_` are available in the browser. Never put privileged keys in them.

### Server-only variables

```bash
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=

WHATSAPP_PROVIDER=flowkirim
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BASE_URL=https://scan.flowkirim.com
WHATSAPP_DEVICE_ID=

CONVIA_API_KEY=
CONVIA_BASE_URL=https://api.convia.id/api/v1/public
CONVIA_OTP_TEMPLATE=luma_otp
CONVIA_WHATSAPP_PHONE_NUMBER_ID=

WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_OTP_TEMPLATE=luma_otp
WHATSAPP_TEMPLATE_LANGUAGE=id
WHATSAPP_GRAPH_VERSION=v24.0
WHATSAPP_CHANNEL_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

`SUPABASE_SECRET_KEY` must be a real privileged Supabase server secret/service-role-equivalent key. A publishable key must never be reused as this value.

The runtime also accepts `SUPABASE_SERVICE_ROLE_KEY` as a compatibility alias for `SUPABASE_SECRET_KEY`.

## 2. Supabase authentication

Lumaway uses Supabase Auth for the application session and workspace access.

Required runtime variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Setup checklist:

1. In Supabase, confirm the project URL and publishable key.
2. Obtain the real server secret / service-role-equivalent key for server routes.
3. In **Authentication → URL Configuration**, set the Lumaway production site URL.
4. Add Lumaway production and intended preview redirect URLs.
5. Do not expose the server secret to the browser.

## 3. Google login through Supabase Auth

Lumaway calls `supabase.auth.signInWithOAuth({ provider: "google" })`. Google credentials are configured in the Supabase Google provider; they are not read by browser code.

Google Cloud setup:

1. Create/select the Google Cloud project for Lumaway.
2. Configure the OAuth consent screen / Google Auth Platform audience.
3. Create an **OAuth 2.0 Web application** client.
4. Add Lumaway production domain to Authorized JavaScript origins.
5. Add the Supabase callback URL to Authorized redirect URIs:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback
```

6. Copy the Google Client ID and Client Secret into **Supabase → Authentication → Providers → Google**.
7. Move the Google app out of Testing when it is ready for all Lumaway users and complete any verification Google requires.

`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` may be retained in Vercel as server-side configuration references if desired, but Supabase Auth itself uses the values configured in the Supabase Google provider.

## 4. OpenAI

Runtime secret:

```bash
OPENAI_API_KEY=
```

Lumaway server routes read `OPENAI_API_KEY` first. The Owner Control OpenAI integration can alternatively store the API key in the existing secure Supabase Vault-backed integration.

Rules:

- Server-side only.
- Never use `NEXT_PUBLIC_OPENAI_API_KEY`.
- Never commit the key.
- Rotate a key immediately after accidental disclosure.

## 5. Xendit billing and token top-up

Runtime secrets:

```bash
XENDIT_SECRET_KEY=
XENDIT_WEBHOOK_TOKEN=
```

Current Lumaway checkout uses Xendit hosted payment sessions, so the Xendit public key is not required by the current server-side checkout implementation.

Flow:

1. User selects a token package.
2. `/api/payments/checkout` creates the Xendit payment session server-side.
3. User is redirected to Xendit hosted checkout.
4. Xendit sends payment events to Lumaway.
5. `/api/payments/webhook` validates `x-callback-token` against `XENDIT_WEBHOOK_TOKEN`.
6. Successful payment calls the database top-up completion function and credits the token wallet.

Configure the Xendit webhook to the Lumaway production route:

```text
https://<LUMAWAY_PRODUCTION_DOMAIN>/api/payments/webhook
```

Never expose `XENDIT_SECRET_KEY` in frontend code.

## 6. WhatsApp OTP — FlowKirim

Lumaway supports FlowKirim as a WhatsApp OTP provider.

```bash
WHATSAPP_PROVIDER=flowkirim
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_BASE_URL=https://scan.flowkirim.com
WHATSAPP_DEVICE_ID=
```

`WHATSAPP_DEVICE_ID` is required and must be copied from the FlowKirim **Perangkat** page. Do not confuse it with the dynamic `session_id`.

OTP request flow:

1. Lumaway generates a random 6-digit OTP.
2. Only a salted SHA-256 hash is stored in `luma_otp_challenges`.
3. OTP expires after 5 minutes and is limited to 5 verification attempts.
4. Server requests the active FlowKirim session using the Device ID.
5. Server sends the OTP to the normalized WhatsApp JID.
6. After the user submits the correct OTP, Lumaway marks the phone/WhatsApp number verified in Supabase Auth and the Lumaway profile.

## 7. WhatsApp CRM + optional OTP — Convia

Convia is available as an alternative provider for CRM messaging and as an optional OTP provider.

```bash
CONVIA_API_KEY=
CONVIA_BASE_URL=https://api.convia.id/api/v1/public
CONVIA_OTP_TEMPLATE=luma_otp
CONVIA_WHATSAPP_PHONE_NUMBER_ID=
```

The key can also be saved from **LUMAWAY OWNER CONTROL → Integrations → WhatsApp CRM & OTP**. It is stored server-side in Supabase Vault under the Lumaway server-secret layer and is never returned to the browser.

### CRM use cases

Lumaway exposes an authenticated server route:

```text
POST /api/whatsapp/crm/send
```

Supported purposes:

- `promotion`
- `verification`
- `information`
- `payment`
- `utility`
- `support`

Supported Convia WhatsApp message types:

- `text`
- `image`
- `document`
- `audio`
- `video`
- `template`
- `interactive`

The route is restricted to workspace manager/admin/owner access and records usage in `luma_api_usage_events`.

For messages outside the WhatsApp 24-hour customer-service window, use an approved WhatsApp template. Marketing, Utility and Authentication templates should be managed/approved in Convia/Meta before production sends.

### Convia OTP

Set:

```bash
WHATSAPP_PROVIDER=convia
```

Lumaway keeps the existing 6-digit OTP UX. The server generates the code and sends it through a Convia approved Authentication template (`CONVIA_OTP_TEMPLATE`, default `luma_otp`). The OTP hash, 5-minute expiry and maximum 5 attempts remain controlled by Lumaway.

Owner **Test Connection** calls Convia's WhatsApp verification pricing endpoint. Do not hardcode transaction cost in Lumaway; use the provider response/current Meta pricing because pricing can change.

### Convia API notes

- Base endpoint: `https://api.convia.id/api/v1/public`
- Authentication: `Authorization: Bearer <CONVIA_API_KEY>`
- Standard send endpoint: `/messages/send`
- A primary Convia WhatsApp number is used automatically; `CONVIA_WHATSAPP_PHONE_NUMBER_ID` is optional for multi-number setups.

## 8. Optional Meta Cloud API fallback

These variables remain supported if `WHATSAPP_PROVIDER=meta`:

```bash
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_OTP_TEMPLATE=luma_otp
WHATSAPP_TEMPLATE_LANGUAGE=id
WHATSAPP_GRAPH_VERSION=v24.0
WHATSAPP_CHANNEL_URL=
```

## 9. Deployment order

Recommended production order:

1. Configure Supabase public + server variables.
2. Confirm email/password Supabase Auth.
3. Configure Google OAuth in Google Cloud and Supabase Auth.
4. Add OpenAI server key and test Owner Control integration.
5. Add Xendit secret + webhook token and configure the webhook.
6. Configure at least one OTP provider: FlowKirim, Convia, or Meta.
7. Add Convia if CRM messaging is required even when another OTP provider remains active.
8. Redeploy Production after changing Vercel environment variables.
9. Test from a non-owner user account.

## 10. Production smoke test

- Email/password sign-in works.
- Google sign-in returns to Lumaway without 403.
- User and owner receive the correct dashboards.
- AI Analytics can produce one server-side analysis.
- Xendit checkout creates a payment URL.
- Xendit test payment credits the correct token wallet exactly once.
- Selected WhatsApp OTP provider reaches the requested number.
- Wrong OTP fails; expired OTP fails; valid OTP verifies the phone.
- Convia Test Connection succeeds when configured.
- A Convia CRM text/template test can be sent from an authorized workspace manager flow.
- No server secret is visible in browser DevTools, page source, client JS, or Git history.
