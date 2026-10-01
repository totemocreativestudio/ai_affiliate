# PR #85M — Product Experience QA

## Goal
Treat Lumaway as a product experienced by different personas, not only as a collection of technically working modules.

## Personas
- New User
- Affiliate Staff
- Live Team
- SPV / Manager
- Finance
- Owner/Admin

## Critical journey questions
### New User
- Within 10 seconds, can the user identify what to do next?
- Can they find Upload, Help, and Action Center?
- Empty states explain the next step.

### Affiliate Staff
- Upload Affiliate data.
- Find creator.
- Open Listing.
- Follow up through correct channel.
- Set next follow-up/PIC.
- Confirm Action Center receives due work.

### Live Team
- Upload Shopee/TikTok export.
- Auto detection works.
- Preview is understandable.
- Import succeeds.
- Data Health shows reconciliation.
- Analytics uses source-aware semantics.
- Product Intelligence remains separated from Affiliate.
- Live P&L never reads Affiliate commission/performance.

### SPV
- Action Center prioritizes work.
- Goal/Forecast can be understood.
- Campaign deadlines are visible.
- Saved Views restore personal filters.

### Finance
- Spending is traceable.
- Live P&L cost entry and contribution can be reviewed.
- Partial HPP coverage is clearly labeled.

### Owner/Admin
- Member privacy boundary holds.
- Admin/provider/business-internal data is not visible to members.
- Production QA/release gate is usable.

## Device journeys
Run critical journeys on:
- desktop
- tablet
- mobile/PWA
- online
- offline fallback

## Performance perception
Manual check:
- no blank page during route transition
- route feedback immediate
- skeleton/progress visible
- large tables remain usable

## Release rule
Critical manual failures block production readiness.
Major manual failures require REVIEW.

## Evidence
QA evidence should record:
- browser/device
- route
- test data used
- screenshot/video reference if available
- notes
