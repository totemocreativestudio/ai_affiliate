# PR #82P — Follow-Up Contact Actions + AI Draft + Calendar Fix

## Problems
1. Follow-Up Calendar fails with: column reference "user_id" is ambiguous.
2. Listing detail must surface creator social links and WhatsApp contact more clearly.
3. Clicking WhatsApp must open the creator chat directly.
4. Follow-up copy should be generated from prior listing/activity history.
5. If the creator has no meaningful prior history, AI should generate a first-contact greeting from the brand/user side to the affiliate.

## Calendar fix
- fix ambiguity in luma_safe_workspace_assignees_v1 caused by output parameter user_id colliding with ON CONFLICT column references
- use named constraint for conflict handling
- preserve stable aliases and admin exclusion

## Listing contact UX
- show WhatsApp contact block when creator.phone exists
- normalize Indonesian number formats 08 / 62 / +62 to wa.me-compatible digits
- click WhatsApp action opens the creator chat in a new tab
- show social links as direct clickable actions in the creator detail card
- never expose owner/admin identity

## AI Follow-Up Draft
Create a member-authorized server route:
POST /api/listings/followup-draft

Input:
- workspace_id
- listing_id

Server loads:
- listing
- creator
- listing activities, oldest to newest

Behavior:
- if there is no meaningful prior activity beyond Listing dibuat:
  mode = first_contact
  generate a friendly opening message from the brand/team to the affiliate
- otherwise:
  mode = follow_up
  use prior history, current stage, next action, product/SKU, channel, and recent outcomes
  generate a natural next follow-up message
- do not invent discounts, fees, sample shipment status, deadlines, or commercial terms
- do not reveal internal owner/admin identity
- output Bahasa Indonesia, natural, concise, professional, not robotic
- no automatic message sending
- user must review/copy/open WhatsApp themselves

## UI
Inside Listing Quick Message:
- button: Generate dari History
- show generation mode: Sambutan Pertama / Follow Up History
- editable textarea draft
- Copy Message
- if WhatsApp is available: Open WhatsApp
- if WhatsApp draft exists, prefill the generated message in wa.me link
