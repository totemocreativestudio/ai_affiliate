# PR #82B — Affiliate 360 Search + Operations Shipping Spend

## Problems
1. Affiliate 360 search field renders but users cannot reliably find/select creators.
2. Operations → Shipping stores shipping_cost, but those costs are not included in Dashboard Ongkir / Spend Budget / Total Spend.

## Affiliate 360
- reuse the server-backed creator search API already used by SmartAutocomplete
- search username, creator name, creator code, platform and Affiliate ID
- normalize leading @ for usernames
- debounce request
- show loading, no-result and API error states
- allow Enter to choose the first result
- preserve workspace isolation
- do not query creators directly from the browser where RLS differences can make results appear empty

## Shipping → Spending
- Dashboard Ongkir = Affiliate sales shipping_cost + Operations Shipping shipping_cost + insurance_amount
- Operations Shipping costs follow active workspace/date/platform filters
- exclude Cancelled shipping rows
- when a Store filter is active, do not attribute unscoped Operations Shipping to a store because Shipping currently has no store_name dimension
- Total Spend and ROI must use the corrected total shipping value
- clarify UI label as Ongkir (Affiliate + Operations)
- Shipping page should show visible Shipping Spend summary

## Safety
- COD is not an expense and must not be added to spending
- do not double-count shipping product/HPP as ongkir
