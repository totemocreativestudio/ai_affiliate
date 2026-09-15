# LUMA Affiliate Intelligence

LUMA is a Next.js + Supabase multi-user affiliate intelligence application deployed with Vercel.

Current production modules include authentication, workspace isolation, dashboard analytics, Upload Center, creator/store database, Creator 360, AI Analytics, Promo Studio, Kanban, private Google Sheets integration, affiliate referral, billing/token wallet, notifications, Insight & Blog, Social Lumaway, user profile, and Lumaway Owner Control.

## Data architecture

- Next.js App Router for UI and server routes.
- Supabase Auth for login and account identity.
- Supabase PostgreSQL as source of truth with workspace-scoped RLS.
- Supabase Storage for user/application files.
- Vercel for deployment.
- OpenAI integration is server-side only.
- Payment/payout integration is server-side only.

## Creator & store intelligence

- Ranking Creator opens Creator 360.
- Creator 360 combines creator profile, sales, commission, product performance, sample/shipping value, points, agreement, targets, manual ads support, rating, program status, last-video links, and affiliated stores.
- Store Intelligence is populated from uploaded transaction/performance files when a store column is present (`Store Name`, `Shop Name`, `Nama Toko`, `Toko`, `Seller Name`, `Store ID`, etc.).
- Owner Monitoring 360 aggregates users, workspaces, creators, stores, sales, storage, tokens, API usage, referral payouts, and paid service subscriptions.

Production changes should only be treated as complete after the Vercel build succeeds and the affected flow is browser-tested.
