# PR #78C — Payment & Promotion E2E Guardrail

Audit date: 2026-09-30

## Production transactional test

The test was executed against production Supabase inside a transaction and rolled back.

Passed:
- first promo reservation succeeds
- second concurrent reservation for a one-use-per-user promo is rejected
- failed/terminal payment releases the reservation
- promo can be reserved again after a failed order releases the first reservation
- successful redemption changes the matching reservation to applied
- duplicate redemption for the same promo/user/target is rejected by a unique guard
- duplicate Mayar webhook claim returns claimed=false after the first event is marked processed

No synthetic payment test rows were committed.

## Guardrails added

- unique redemption target guard
- reservation expiry index
- checkout intent expiry index
- webhook processing state, attempts, processed timestamp and error fields
- atomic webhook claim RPC with advisory lock
- webhook completion RPC
- server-only payment maintenance RPC for stale reservations/intents/orders
- Mayar webhook uses atomic claim before processing

## Expected lifecycle

Checkout:
preview promo -> reserve atomically -> create payment -> wait for webhook.

Paid:
verified provider invoice -> complete order idempotently -> write redemption -> reservation becomes applied.

Failed/cancelled/expired:
order becomes terminal -> reservation becomes released; stale reservations can also expire through maintenance.

Duplicate webhook:
first request claims the event. Once processed, subsequent deliveries return duplicate=true without repeating fulfillment.
