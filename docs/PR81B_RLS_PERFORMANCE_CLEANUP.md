# PR #81B — RLS / Policy Performance Cleanup

This change addresses Supabase performance-advisor findings without changing intended access rules.

## Changes
- Replaces five overlapping `ALL` admin policies with separate `INSERT`, `UPDATE`, and `DELETE` admin policies.
- Leaves the existing single `SELECT` policy on each table unchanged.
- Removes the confirmed duplicate index `idx_product_master_workspace_sku`; `idx_product_master_sku` remains on the same columns: `(workspace_id, sku_normalized)`.

## Tables
- `luma_content_categories`
- `luma_content_media`
- `luma_promo_codes`
- `luma_promo_reservations`
- `luma_tutorial_steps`

The goal is to avoid evaluating multiple permissive SELECT policies for the same role/action while retaining the exact read behavior and admin write behavior.
