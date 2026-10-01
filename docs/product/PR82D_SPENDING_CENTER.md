# PR #82D — Spending Center & Reconciliation

Purpose:
Create one transparent workspace page showing where spending comes from, especially Operations Shipping.

Filters:
- start date
- end date
- platform
- store/shop

Cost sources:
1. Product Cost / HPP from Affiliate sales
2. Creator Commission from Affiliate sales
3. Ads Spend Support
4. Affiliate Shipping from Affiliate sales
5. Operations Shipping Cost from Operations > Shipping
6. Operations Insurance from Operations > Shipping

Rules:
- Operations Shipping excludes Cancelled rows
- COD is not spending
- Store filter uses shipping.store_name
- historical shipping without store_name is included globally, but not under a specific store filter
- Total Spending = all six components
- show source totals, percentage share, daily trend and Operations Shipping rows
- allow reconciliation against Dashboard total_spend for the same filters
