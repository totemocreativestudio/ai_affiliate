# Lumaway UI System V4

## Visual references

Primary references:
- v0 CmsFullForm Admin Dashboard: modular administration, clarity, extensibility, responsive content management.
- v0 CampaignHub: compact marketing workspace, collapsible navigation, blue-violet analytics UI, responsive collaboration patterns.

Lumaway does not copy those templates. The references are translated into Lumaway's own brand system and existing production information architecture.

## Brand direction

- Base: navy, white, soft neutral gray.
- Primary accent: Lumaway violet.
- Data accent: blue.
- Positive state: green.
- Attention: amber.
- Critical: red.
- Typography: DM Sans / existing production typography stack.
- Radius: 11–20 px depending on component hierarchy.
- Motion: 150–240 ms, subtle, with prefers-reduced-motion support.

## V4 coverage

1. Owner/Admin Control Center
   - modular premium panels;
   - differentiated page header;
   - compact KPI cards;
   - quick-access cards;
   - table density and sticky headers.

2. Analytics and charts
   - target/forecast bars;
   - report charts and KPI blocks;
   - Customer 360 progress indicators;
   - consistent violet-to-blue data language.

3. Contextual detail surfaces
   - Creator 360;
   - analysis details;
   - document preview;
   - confirmation dialogs;
   - Product Master inline contextual editor.

4. Loading and empty states
   - shell-first skeleton blocks;
   - structured empty state;
   - reduced perceived waiting;
   - no long decorative animation.

5. Error and maintenance states
   - branded system-status card;
   - readable error reference;
   - clear retry action;
   - mobile-safe layout.

6. Responsive interaction
   - owner metrics collapse to 3/2/1 columns;
   - modal/drawer becomes full-height workspace on tablet/mobile;
   - chart labels become stacked when necessary;
   - Product Master retains horizontal table scroll without breaking page width.

## Implementation rule

V4 is a visual layer only. It must not replace:
- Supabase RPC/query names;
- RLS behavior;
- API routes;
- auth/session logic;
- payment flow;
- component IDs used for navigation;
- existing events and business logic.

All V4 changes must continue through branch -> PR -> Lumaway CI Gate -> merge -> Vercel Production.
