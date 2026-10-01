# PR #82O — Owner/Admin Client Bundle Isolation

## Goal
Continue PR #82L–#82N by reducing privileged implementation details delivered to ordinary member browsers.

## Problem
Even when admin UI is not rendered, static client imports can place owner-only navigation labels and admin components in chunks reachable from the normal workspace bundle.

## Requirements
- split owner sidebar/navigation into a dynamically loaded owner-only chunk
- remove owner integration/provider labels from the normal member sidebar source path
- dynamically load AdminDashboard only when isAdmin=true
- member dashboard must not fetch the owner admin component chunk during normal render
- existing route guard remains: non-admin /administration -> /dashboard
- no change to normal member navigation
- no sensitive credential is ever client-side; this PR is defense-in-depth for implementation metadata/UI strings

## Acceptance
Member-facing bundle path contains no rendered owner navigation list and does not mount/fetch AdminDashboard in member mode.
