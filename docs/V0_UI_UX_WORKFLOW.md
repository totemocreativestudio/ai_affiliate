# Lumaway UI/UX workflow with v0

## Goal

Use v0 as a UI/UX design and implementation workspace without allowing generated code to bypass Lumaway's existing auth, Supabase RLS, payment, routing, or release controls.

## Source of truth

- GitHub repository: `totemocreativestudio/ai_affiliate`
- Production application: `https://app.lumaway.online`
- Public landing page target: `https://www.lumaway.online`
- Production release: PR -> Lumaway CI Gate -> merge main -> Vercel Production

## Recommended v0 flow

1. In v0 create/import a Project from the GitHub repository.
2. Never work directly on `main`. Create a dedicated branch, for example `ui/v0-dashboard-refresh`.
3. Give v0 screenshots and a narrow scope per pass:
   - shell/sidebar/topbar,
   - dashboard cards,
   - table/list views,
   - forms/modals,
   - loading/empty/error states,
   - responsive/mobile.
4. Tell v0 to preserve:
   - existing API routes,
   - Supabase queries/RPC names,
   - component props and data contracts,
   - IDs used by navigation,
   - auth/session logic,
   - billing/payment logic,
   - event names such as `lumaway-database-updated`.
5. Prefer changing presentation components/CSS first. Do not let v0 replace business logic with mock data.
6. Open a PR from v0/GitHub.
7. Merge only after Lumaway CI Gate passes TypeScript, production build, route validation, migration validation, and HTTP smoke tests.
8. Preview on Vercel before production merge for large visual changes.

## Master prompt for v0

> Refresh Lumaway's UI/UX while preserving all production business logic. This is a multi-user Next.js + Supabase SaaS. Do not replace API calls, Supabase RPCs, RLS-dependent queries, payment logic, authentication, route IDs, component IDs, or existing event names. Do not use mock data in production components. Focus on visual hierarchy, spacing, typography, card/table/form consistency, responsive behavior, loading/empty/error states, accessibility, and perceived performance. Use the existing Lumaway brand colors and assets. Keep the interface professional and human-designed; avoid generic AI visual motifs. Work only on the requested screen and open a PR instead of pushing directly to main.

## Safe migration order

1. Design tokens and global spacing.
2. Sidebar/topbar/application shell.
3. Dashboard.
4. Creator management.
5. Data/upload.
6. AI Analytics.
7. Billing/Profile/Community.
8. Admin Owner Control.
9. Mobile/responsive.
10. Error/loading/offline states.

This keeps visual changes reviewable and prevents a large generated refactor from breaking production behavior.
