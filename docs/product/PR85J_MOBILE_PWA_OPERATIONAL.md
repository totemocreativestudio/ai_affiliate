# PR #85J — Mobile & PWA Operational Mode

## Goal
Make Lumaway usable as an operational mobile app, not just a compressed desktop dashboard.

## Mobile workflow
Bottom navigation:
- Today / Dashboard
- Follow Up / Listings
- Live
- Upload
- More

## PWA
- correct manifest start_url for current route system
- service worker registration
- offline fallback page
- cache only static shell/assets
- navigation network-first
- stale-while-revalidate for safe static assets
- never cache authenticated API responses, Supabase API responses, payment routes, or sensitive JSON
- show Online / Offline state
- show PWA update available state and reload action

## Offline behavior
When offline:
- existing rendered data may remain visible
- navigation to uncached pages shows friendly offline fallback
- write actions must not pretend success
- no queued payment/auth operations

## Mobile UX
- bottom nav optimized for daily operator workflow
- touch targets >= 40px
- avoid desktop-width table dependence where cards/scroll are available
- contextual tutorial remains reachable
- notifications remain available from topbar

## Security
Do not cache:
- /api/*
- Supabase endpoints
- auth
- payment
- notification payloads
- user-specific HTML beyond browser's normal in-memory state

## Acceptance
1. Installable PWA uses /dashboard start URL.
2. Offline status visibly changes.
3. Service worker does not cache authenticated API data.
4. Mobile nav prioritizes operational tasks.
5. New version can prompt user to reload.
