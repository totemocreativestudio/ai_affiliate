# PR #85F — Contextual Tutorial

## Goal
Tutorial must follow the user into the feature they are currently using.

## UX
Add a member-only contextual help button available across workspace pages.

When opened:
- identify the active Lumaway section from the current route
- show 3–6 concise steps specific to that section
- explain What / Why / Expected Result
- provide CTA to open the full Tutorial Center
- provide CTA to open the current feature action when helpful

## Initial coverage
- Dashboard
- Upload Center
- Listings
- Product Master
- Campaign Tracker
- Live Streaming
- Affiliate 360
- Goal & Forecast
- Automation Rules
- Scheduled Reports
- Shipping

## Live Streaming contextual flow
- Upload file
- Auto Detect
- Preview normalized
- Import
- Data Health
- Analytics
- Product Intelligence

## Requirements
- no decorative AI/sparkle icon
- member-only; never expose owner/admin information
- mobile bottom sheet / desktop side drawer
- keyboard Esc closes
- context updates on lumaway-routechange
- progress indicator
- full tutorial CTA
