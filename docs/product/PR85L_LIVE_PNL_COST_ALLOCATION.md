# PR #85L — Live P&L & Cost Allocation

## Core rule
Live P&L is a Live Streaming financial domain. It must never include Affiliate commission, Affiliate creator cost, or Affiliate product performance.

## Revenue source
Platform-aware Live revenue:
- TikTok: live_daily_performance.gmv_attributed
- Shopee: prefer live_period_overview.gmv_created for covered periods; fall back to live_session_performance.gmv_created only when Overview is absent

Avoid double counting Shopee Overview + Session data.

## HPP
Use only Live product facts:
- live_product_performance.qty_created
- mapped Product Master cost_price

If a Live product is unmapped or Product Master HPP is missing:
- do not invent HPP
- show HPP Coverage %
- mark contribution as Partial Coverage

## Live cost categories
Manual cost ledger:
- host_cost
- studio_cost
- live_ads
- production_cost
- voucher_promo
- other

Each entry:
- workspace
- cost_date
- platform optional
- session_id optional
- category
- amount
- note
- created_by

## P&L
Live Revenue
- Known Live HPP
= Gross Contribution Before Operational Cost
- Host Cost
- Studio Cost
- Live Ads
- Production Cost
- Voucher/Promo Cost
- Other Live Cost
= Live Contribution Margin

Show:
- contribution margin amount
- margin %
- HPP coverage
- revenue by platform
- cost breakdown
- daily/monthly cost history

## UI
Replace Production & Budget placeholder with full Live P&L:
- date/platform filter
- scorecards
- cost breakdown
- add/edit/delete cost entry
- cost history
- data coverage warning
- badge LIVE FINANCE ONLY

## Acceptance
- no public.sales query
- no Affiliate commission query
- Shopee is not double counted
- TikTok and Shopee remain source-aware
- partial HPP is labeled
- all writes workspace-scoped/RLS protected
