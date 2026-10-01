# PR #82I — Follow-Up PIC & Targeted Reminder

Continue PR #82G/#82H by assigning creator follow-ups to a specific workspace member.

## Data
Add `follow_up_owner_user_id uuid` to listings.

## UX
- Listing form: PIC Follow Up dropdown populated from workspace_members + profiles
- Listing detail shows PIC
- Follow-Up Queue shows PIC
- preserve existing channel, priority, next follow-up schedule

## Reminder
When scheduled sync runs:
- Action Center metadata includes PIC
- if follow-up is due within 24 hours or overdue and PIC exists, create one in-app notification for that user
- notification dedupe key must be based on listing id + current next_follow_up_at
- rescheduling creates a new reminder only for the new schedule
- marking done does not create another reminder

## Safety
- notification is in-app only
- no automatic WhatsApp/DM/email outreach to creator
- PIC must be a member of the same workspace
