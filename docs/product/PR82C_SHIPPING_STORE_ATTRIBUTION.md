# PR #82C — Shipping Store Attribution

Continue PR #82B by making Operations Shipping attributable to marketplace store/shop.

Requirements:
- add store_name to shipping
- shipping form has Store / Shop field
- suggest known store names from sales data when available
- shipping list/search/export includes store
- Dashboard Store filter includes Operations Shipping only when shipping.store_name matches active store
- no store filter: include all non-cancelled Operations Shipping
- platform filter remains respected
- Shipping Spend = shipping_cost + insurance_amount
- COD remains excluded
- cancelled rows remain excluded
- historical shipping rows with null store_name remain counted globally but not against a specific store filter
