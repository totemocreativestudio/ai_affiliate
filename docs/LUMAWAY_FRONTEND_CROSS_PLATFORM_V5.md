# Lumaway Frontend & Mobile Cross-Platform System

## Production web stack

Lumaway production remains **Next.js + React + Supabase**. The V5 visual layer adds reusable React/SVG data-visualization primitives and a CMS-style UI system without changing business logic, APIs, RLS, billing, or authentication.

### Visual foundation

- CSS design tokens are the production source of truth today.
- `app/lumaway-visual-system-v5.css` controls the new dashboard/chart/table/sidebar visual language.
- `tailwind.config.mjs` mirrors the same tokens so Tailwind can be introduced incrementally instead of rewriting the whole production interface at once.
- Typography: DM Sans / existing production fallback stack.
- Primary visual language: navy + white + Lumaway violet/blue/pink/orange gradient accents.
- Motion: short 150–240 ms interactions, respecting `prefers-reduced-motion`.

## Iconography

**Source: Lucide Icons, MIT/free.**

Lumaway does not use generated AI icons for navigation. `LumaIcon.tsx` is a local adapter whose SVG geometry is sourced from the Lucide open-source icon set while preserving the existing Lumaway icon API.

This approach gives:
- consistent stroke and sizing;
- no runtime icon CDN;
- no external request at render time;
- one icon vocabulary across user dashboard, admin dashboard, PWA, and future native apps.

## Charts & visual analytics

Current production V5 uses lightweight React + SVG/CSS primitives:
- area/line trend chart;
- secondary trend line;
- horizontal ranking bars;
- donut/contribution chart;
- KPI micro bars;
- responsive legends and chart labels.

The chart values come from Supabase aggregates, not decorative/mock data.

### Recommended expansion

For more complex visualization later:
- **Recharts**: strong default for React dashboard charts.
- **Apache ECharts**: useful for dense BI dashboards and advanced interactions.
- **Visx**: lower-level option when Lumaway needs a fully custom chart language.

Do not introduce multiple chart engines on the same screen.

## CMS / back-office

Lumaway Owner Control Center acts as the internal operational CMS for:
- users/workspaces;
- content/tutorial;
- broadcast/promo;
- provider/integration state;
- billing/subscription;
- system/issues;
- social moderation.

If Lumaway later needs a separate editorial CMS for public landing/blog content, recommended choices are:
- Payload CMS when self-hosted/TypeScript-first control is preferred;
- Sanity when collaborative editorial workflows are the priority;
- Strapi when a conventional self-hosted headless CMS is preferred.

Do not replace the existing operational Admin Control Center with an editorial CMS.

## Tailwind strategy

The current application is CSS-heavy and already in production. A forced one-shot Tailwind rewrite would create unnecessary regression risk.

Recommended adoption:
1. Keep V5 tokens as the design contract.
2. Activate Tailwind in the build pipeline.
3. Build all **new** components with Tailwind utilities.
4. Gradually move stable legacy screens component-by-component.
5. Keep `lumaway-visual-system-v5.css` as the compatibility and chart layer until migration is complete.

The provided `tailwind.config.mjs` already maps Lumaway brand tokens for this transition.

## Mobile cross-platform recommendation

### Primary recommendation: React Native + Expo

Use a separate mobile workspace/package while sharing design tokens and API contracts with Lumaway Web.

Recommended mobile stack:
- React Native + Expo;
- Expo Router;
- NativeWind for Tailwind-like utilities;
- gluestack-ui for accessible cross-platform UI primitives;
- Lucide React Native for icon parity with web;
- react-native-svg for custom Lumaway chart primitives;
- Victory Native or a single chosen RN chart engine for advanced charts;
- Lottie React Native for onboarding, success, upload-processing, and lightweight status animation;
- Supabase client with the same tenant/session model as web.

### Lottie rules

Use Lottie only for:
- upload processing;
- empty-success states;
- onboarding/tutorial;
- short completion feedback.

Do not use Lottie for navigation icons, KPI icons, or every loading state. Those remain SVG/Lucide + skeleton UI.

### NativeWind + gluestack

Recommended mapping:
- NativeWind = layout/spacing/typography/responsive utility layer.
- gluestack-ui = Button, Input, Sheet, Modal, Toast, Tabs, FormControl.
- Lumaway design tokens = brand source of truth.
- Lucide React Native = icons.

### Flutter

Flutter is viable only if Lumaway intentionally chooses a separate Dart application team/codebase. For the current React/Next.js product, React Native provides substantially better component/token/API reuse and is therefore the preferred path.

## Responsive product targets

- Desktop: full sidebar + dense BI canvas.
- Tablet: collapsible sidebar + 2-column analytics.
- Mobile/PWA: drawer navigation + 2-column/1-column KPIs + horizontally scrollable data tables + stacked chart legends.
- Native mobile: bottom navigation for the five primary journeys — Dashboard, Upload, Insight, Creator/Customer, Report.

## V5 navigation taxonomy

### User
- Dashboard
- Data & Intelligence
- Insights & Analysis
- Affiliate & Creator
- Product & Commerce
- Growth & Workflow
- Support & Billing
- Content & Community

### Owner/Admin
- Overview
- Business Operations
- Intelligence & Cost
- Content & Community
- Financial Reports
- Integrations
- System & Issues

Routes and business logic remain unchanged; only information architecture and presentation are reorganized.
