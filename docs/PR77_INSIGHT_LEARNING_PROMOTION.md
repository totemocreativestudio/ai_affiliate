# PR #77 — Lumaway Insight, Learning & Promotion Platform

## Objective
Build a production-ready global content and promotion layer for Lumaway that can be managed by Owner/Admin, consumed by every authenticated user/workspace, and surfaced on the main marketing site.

## A. Admin CMS

### Insight & Blog
Provide:
- title, slug, excerpt, category, tags
- SEO title, SEO description, focus keywords
- cover image, GIF/motion URL, short video URL
- long video/social embed URL
- article HTML
- author, reading time
- featured/global toggles
- publish/unpublish
- content metrics

Categories:
- Tutorial Lumaway
- Product Knowledge
- Business & Growth
- Affiliate & Creator
- Marketplace & E-commerce
- Data & Analytics
- Campaign & Promotion
- Lifestyle & Productivity
- News & Updates
- Operations

### Learning / Tutorial
Provide:
- title + slug
- description + category
- difficulty + estimated minutes
- target feature route
- picture/cover
- GIF/motion visual
- short video URL
- YouTube / Instagram / TikTok links
- global/featured flags
- ordered tutorial steps

Each tutorial step supports:
- title
- description
- image
- GIF/motion
- short video
- CTA label
- CTA route

### Media Library
Support:
- image
- gif
- video
- embed
- promotion portrait poster
- promotion landscape poster

## B. User / Multi-user Learning Hub

Menu:
INSIGHT · LEARNING · PROMOTION

Tabs:
- Insight & Artikel
- Learning / Tutorial
- Promotion

All published global content must be visible to all authenticated Lumaway users independent of workspace ownership.

Tutorial UX:
- searchable/filterable cards
- media cover
- tutorial detail overlay
- ordered steps
- completion tracking
- CTA directly into the relevant Lumaway module
- embedded YouTube / Instagram / TikTok video when a valid URL is available
- responsive mobile layout

Article UX:
- category + reading time
- cover image
- excerpt
- deep link to https://lumaway.online/insights/<slug>
- SEO content stored centrally in Supabase so the marketing site and app use the same source

## C. Promotion Engine

Support:
- subscription percentage discount
- subscription fixed discount
- token percentage/fixed discount
- free tokens
- extend active days

Required promotion controls:
- code
- campaign title/label
- description
- start/end time
- total quota
- per-user quota
- applicable plans/token packages
- minimum purchase
- new-user only
- renewal-only
- allowed weekdays
- portrait poster
- landscape poster
- featured/published
- short terms + full terms

Monetary safety:
- percentage discount capped at Rp12,000
- fixed monetary promo cannot exceed Rp12,000
- limits are enforced server-side, not only in UI

## D. Anti-double / Concurrency Rules

Promo lifecycle:
1. Preview only validates.
2. Checkout creates an atomic reservation.
3. Reservation counts against global and per-user quota.
4. Paid payment creates redemption and marks reservation applied.
5. Failed/cancelled/expired checkout releases reservation.
6. Concurrent requests must not allow the same user to exceed per-user limits.
7. Free claim promotions use the same reservation model.

Use database locking/advisory locking for quota integrity.

## E. Seed Content

Seed:
- 12 global tutorials, minimum 4 steps each
- 20 published SEO articles
- 8 promotion campaigns

Initial promo set:
- LUMAHEMAT5
- WELCOME10
- LUMA7K
- LUMA10K
- WEEKEND8
- RENEW10
- BONUS7HARI
- BONUS14DAY

All monetary discount benefits must remain <= Rp12,000.

## F. Media Assets

Each initial tutorial:
- dashboard-style picture cover
- motion/GIF-ready visual
- fields for short video
- fields for long social video

Each promotion:
- portrait poster
- landscape poster

Important:
Generated picture/motion assets are starter media. Real screen-recorded GIF/video should be produced after UI freeze and uploaded through Admin CMS; never fabricate a recording of functionality that was not actually captured.

## G. Main Website Integration

Published articles must be readable by lumaway.online using the same DB source.
The marketing site should expose:
- /insights
- /insights/<slug>
- SEO metadata from DB
- article cover image
- canonical URL support
- JSON-LD/FAQ support when FAQ data exists

## H. Security / RLS

- Blog publish/update/delete: owner/admin only
- Global published blog read: public/anon as currently allowed
- Global tutorials: authenticated users
- Workspace tutorials: workspace members
- Tutorial step writes: owner/admin only
- Media writes: owner/admin only
- Promo management: owner/admin only
- Promo redemption records: only owner/admin and owning user may read
- Checkout and promo reservation must be server-side

## I. Acceptance Criteria

### Content
- 12 tutorials visible to every user
- 48 tutorial steps load correctly
- 20 published articles resolve through the main website data source
- article SEO fields are populated
- tutorial categories/search work
- tutorial completion persists

### Promotion
- 8 promo cards load globally
- posters render on desktop/mobile
- Copy Promo works
- Use in Billing fills Billing promo input
- invalid/expired/quota-exhausted promo is rejected
- new-user / renewal / weekday eligibility works
- fixed/percentage discount never exceeds Rp12,000
- one user cannot consume the same 1x promo twice
- concurrent checkouts cannot exceed quota
- failed/expired payment releases reservation
- successful payment converts reservation to applied redemption

### Platform
- TypeScript passes
- production build passes
- migration validation passes
- existing payment webhooks remain idempotent
- all existing workspaces can consume global content
- runtime errors remain clear after production deployment

## J. Media Production Follow-up
After this PR:
1. freeze tutorial screens
2. record actual desktop + mobile walkthroughs
3. export short MP4/WebM and optimized GIF/WebP
4. upload to media storage/CDN
5. add long-form YouTube/Instagram/TikTok URLs from Admin
6. validate embeds and mobile playback
