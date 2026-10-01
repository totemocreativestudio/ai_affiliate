# PR #86C — Production Data Reconciliation & Regression Suite

## Goal
Fix current production mismatches and create permanent regression checks so the same issues do not return.

## Current production issues
1. Affiliate 360 search can return "creator not found" even when matching creator rows exist.
2. Dashboard Cost Breakdown can differ from Spending Center for the same filter.
3. HPP for products sent as affiliate samples is not included in Affiliate cost.
4. Floating "Bantuan" contextual tutorial overlaps the Luma Help Desk launcher.

## Affiliate 360
Root cause to prevent:
- creator de-duplication must not happen before the search filter, otherwise a matching duplicate identity can disappear when a different row wins the rank.

Search requirements:
- name
- username with or without @
- Creator Code
- Affiliate ID
- platform
- fallback creator identity referenced by Affiliate sales

The returned ID must remain a valid Creator Master ID usable by get_creator_360.

## Affiliate Cost Canonical Source
Create one canonical cost function used by Dashboard and Spending.

Components:
- sales_hpp
- sample_hpp
- creator_commission
- affiliate_shipping
- operations_shipping
- operations_insurance
- ads_spend
- total_spending

### Sample HPP
For creator_samples in the active filter:
1. if mapped Product Master has cost_price > 0:
   sample_hpp = qty × Product Master cost_price
2. otherwise use creator_samples.product_value
3. do not use Live product facts
4. do not use Affiliate GMV as product cost

### Shipping
Operations Shipping comes from public.shipping:
- exclude cancelled
- include shipping_cost
- include insurance_amount
- respect date/platform/store filters

Dashboard and Spending must return the same shipping total for the same filter.

## Dashboard
Upgrade dashboard metric RPC to v6:
- total_cost_product = sales_hpp + sample_hpp
- total_shipping = affiliate_shipping + operations_shipping + operations_insurance
- total_spend includes the same canonical components

## Spending Center
Upgrade to v2:
- use the same canonical component function
- expose Sales HPP and Sample HPP separately
- preserve existing shipping detail table
- total must reconcile with Dashboard for identical filters

## Regression Suite
Add owner/workspace-safe RPC:
luma_data_reconciliation_v1

Checks:
- dashboard total_shipping == canonical shipping
- dashboard HPP == canonical sales_hpp + sample_hpp
- spending total == canonical total
- creator master search coverage against active Affiliate creator identities
- sample mapping coverage
- shipping cost coverage
- no Live tables referenced by Affiliate cost function

Statuses:
- EXACT
- DIFFERENCE
- REVIEW

## Help bubble
Contextual Tutorial and Luma Help Desk must not overlap.
Desktop:
- Luma Help Desk remains bottom-right primary chat launcher
- Contextual "Bantuan" sits above it with clear separation
Mobile:
- both remain above Mobile Quick Nav
- no clipping outside viewport
- minimum 44px touch target

## Acceptance
- known creator queries return results.
- @username and username behave the same.
- identical Dashboard/Spending filters produce identical HPP/shipping/total components.
- sample HPP appears when creator_samples has mapped HPP/product_value.
- no double-counting with Live Streaming.
- Help and chat launchers are both fully visible.
