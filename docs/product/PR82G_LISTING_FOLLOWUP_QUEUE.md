# PR #82G — Listing Follow-Up Queue & Reminder

Continue PR #82E/#82F by turning follow-up data into an operational queue.

## Goals
- every listing can have a next follow-up schedule
- teams can instantly see overdue, due today, and upcoming creator follow-ups
- channel from PR #82E is shown together with the schedule
- saving a follow-up activity may update the next follow-up schedule
- completed/won/lost listings do not clutter overdue queue unless a new schedule is explicitly set

## Data
Add to listings:
- next_follow_up_at timestamptz
- follow_up_priority: low / normal / high / urgent
- follow_up_completed_at timestamptz nullable

## Queue states
- overdue: next_follow_up_at < now and not completed
- today: local date = today
- upcoming: next 7 days
- no_schedule

## UX
- Listing form: Next Follow Up date/time + priority
- Follow Up activity modal: optional next follow-up date/time after this activity
- summary cards: Overdue / Today / Next 7 Days / No Schedule
- queue panel sorted by urgency and time
- quick actions: Open detail, Mark Done, Reschedule
- preserve Follow Up Via badge/channel

## Rules
- stage Won / Active or Lost / Inactive clears existing follow-up schedule when activity changes stage there
- a new scheduled follow-up clears follow_up_completed_at
- marking done sets follow_up_completed_at but preserves historical activities
- workspace RLS remains enforced
