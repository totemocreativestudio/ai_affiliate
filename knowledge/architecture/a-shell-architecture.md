---
id: a-shell-architecture
title: Lumaway Shell Architecture
type: architecture
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [architecture, shell, layout, sidebar, topbar, content]
relationships:
  - type: implements
    target: s-design-spec
    description: "Shell architecture implements design specification"
  - type: references
    target: k-dashstack-tokens
    description: "References design tokens for spacing, color, typography"
  - type: relates-to
    target: a-css-layer-strategy
    description: "Related to CSS layer strategy"
  - type: relates-to
    target: m-sidebar-map
    description: "Sidebar map references this architecture"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# Lumaway Shell Architecture

## Overview

The Lumaway workspace uses a **three-zone shell** architecture: **Sidebar** (fixed left), **Topbar** (sticky top), **Content** (scrollable main). All zones are wrapped in `.luma-app` root.

## Zone Definitions

### 1. Sidebar (`.sidebar`)
- **Position**: Fixed, left: 0, top: 0, bottom: 0
- **Width**: 264px (desktop), collapsible to 72px (`is-collapsed`), mobile drawer (max 304px)
- **Z-index**: 30 (`--ds-z-sidebar`)
- **Background**: `--ds-card` (white), border-right: `--ds-line`
- **Content**: Brand, navigation groups (collapsible `<details>`), user chip, logout
- **Responsive**: Mobile drawer slides in/out (`mobile-open`), backdrop overlay

### 2. Topbar (`.topbar`)
- **Position**: Sticky, top: 0, left: 0 (or 264px with sidebar)
- **Height**: 66px (desktop), 64px (mobile)
- **Z-index**: 20 (`--ds-z-sticky`)
- **Background**: `--ds-card` (white), border-bottom: `--ds-line`
- **Content**: Left: kicker + title; Right: PWA install, background tasks, notifications, connection pill
- **Responsive**: Mobile hides kicker, compresses padding

### 3. Content (`.content` inside `.app-shell`)
- **Container**: `.app-shell` with `margin-left: 264px` (desktop), 0 (mobile)
- **Max-width**: 1480px, centered
- **Padding**: 26px top, 30px horizontal, 64px bottom
- **Scroll**: Native page scroll (not inner scroll)
- **Typography**: Base 14px, line-height 1.65 (Nunito Sans)

## Layout CSS (from `luma-production.css` + restyle layer)

```css
/* Root */
.luma-app { min-height: 100vh; background: var(--ds-bg); }

/* Sidebar */
.sidebar {
  position: fixed; left: 0; top: 0; bottom: 0; width: 264px;
  background: var(--ds-card); border-right: 1px solid var(--ds-line);
  padding: 16px 12px 14px; z-index: var(--ds-z-sidebar);
  display: flex; flex-direction: column;
}
.sidebar.is-collapsed { width: 72px; }
@media (max-width: 1024px) {
  .sidebar { transform: translateX(-105%); width: min(88vw, 304px); }
  .sidebar.mobile-open { transform: translateX(0); }
}

/* App Shell */
.app-shell { margin-left: 264px; min-height: 100vh; }
.sidebar.is-collapsed ~ .app-shell { margin-left: 72px; }
@media (max-width: 1024px) {
  .app-shell, .sidebar.is-collapsed ~ .app-shell { margin-left: 0; }
}

/* Topbar */
.topbar {
  height: 66px; position: sticky; top: 0; z-index: var(--ds-z-sticky);
  background: var(--ds-card); border-bottom: 1px solid var(--ds-line);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 30px;
}
@media (max-width: 1024px) { .topbar { height: 64px; padding: 0 16px; } }

/* Content */
.content { max-width: 1480px; margin: 0 auto; padding: 26px 30px 64px; }
```

## Route-to-Section Mapping

Defined in `lib/luma-navigation.ts` and reflected in sidebar (`LumaSidebar.tsx`):

| Route | Section ID | Sidebar Group | Component |
|-------|------------|---------------|-----------|
| `/dashboard` | `dashboard` | Data & Intelligence | `LegacyDashboard` |
| `/upload` | `upload` | Data & Intelligence | `UploadCenter` |
| `/database` | `database` | Data & Intelligence | `DatabaseCenter` |
| `/data-health` | `data-health` | Data & Intelligence | `DataHealthCenter` |
| `/excel-sync` | `excel-sync` | Data & Intelligence | (inline expand) |
| `/tutorial` | `tutorial` | Data & Intelligence | `TutorialCenter` |
| `/ai-analytics` | `ai-analytics` | Insights & Analysis | `AIAnalytics` |
| `/affiliate-360` | `affiliate-360` | Affiliate & Creator | `Affiliate360Search` |
| `/agreements` | `agreements` | Affiliate & Creator | `AffiliateProgramWorkspace` |
| `/affiliate-support` | `affiliate-support` | Affiliate & Creator | `AffiliateProgramWorkspace` |
| `/creator-samples` | `creator-samples` | Affiliate & Creator | `CreatorSamples` |
| `/ratecard` | `ratecard` | Affiliate & Creator | `RatecardMaster` |
| `/live-streaming` | `live-streaming` | Live Streaming | `LiveStreamingCenter` |
| `/product-master` | `product-master` | Product & Commerce | `ProductMaster` |
| `/listings` | `listings` | Product & Commerce | `Listings` |
| `/shipping` | `shipping` | Product & Commerce | `Shipping` |
| `/spending` | `spending` | Product & Commerce | `SpendingCenter` |
| `/daily-brief` | `daily-brief` | Growth & Workflow | `DailyBriefCenter` |
| `/automation-rules` | `automation-rules` | Growth & Workflow | `AutomationRulesCenter` |
| `/goal-forecast` | `goal-forecast` | Growth & Workflow | `GoalForecastCenter` |
| `/scheduled-reports` | `scheduled-reports` | Growth & Workflow | `ScheduledReportCenter` |
| `/campaign-tracker` | `campaign-tracker` | Growth & Workflow | `CampaignTracker` |
| `/promo-studio` | `promo-studio` | Growth & Workflow | **Tab in CampaignTracker** |
| `/kanban` | `kanban` | Growth & Workflow | `KanbanBoard` |
| `/support-tickets` | `support-tickets` | Support & Billing | `UserTicketCenter` |
| `/billing` | `billing` | Support & Billing | `SubscriptionBilling` |
| `/luma-affiliate` | `luma-affiliate` | Support & Billing | `LumaAffiliateCenter` |
| `/content-hub` | `content-hub` | Content & Community | `ContentHub` |
| `/social-lumaway` | `social-lumaway` | Content & Community | **Tab in ContentHub** |
| `/profile` | `profile` | (User menu) | `UserProfile` |

## Admin Routes (Owner Sidebar)

| Route | Section | Component |
|-------|---------|-----------|
| `/administration/overview` | Administration | `AdminDashboardV3` |
| `/administration/creators` | Administration | `CreatorAttributionCenter` |
| `/administration/listings` | Administration | `AdminDashboardV3` |
| `/administration/finance` | Administration | `OwnerFinanceControl` |
| `/administration/monitoring` | Administration | `OwnerMonitoring360` |
| `/administration/incidents` | Administration | `OwnerIncidentCenter` |
| `/administration/settings` | Administration | `OwnerSystemControl` |

## CSS Layer Strategy

Critical for cascade management. Import order in `app/layout.tsx` (root) and `app/LumawayWorkspaceApp.tsx` (workspace):

```typescript
// app/layout.tsx (root layout - 16 files)
import "./luma-v2.css";
import "./luma-social.css";
// ... 12 more ...
import "./lumaway-hallmark.css";
import "./luma-layout-standard.css";
import "./lumaway-dashstack-restyle.css";  // LAST — wins cascade

// app/LumawayWorkspaceApp.tsx (workspace - 31 files)
import "./luma-production.css";
import "./luma-legacy-extra.css";
// ... 28 more ...
import "./lumaway-ops-pr87.css";
import "./lumaway-dashstack-restyle.css";  // LAST — wins cascade
```

**Restyle layer wins** via:
1. Imported LAST in both entry points
2. All selectors prefixed with `body` / `html body` (specificity 0,1,1 vs legacy 0,1,0)
3. Uses `!important` matching legacy

## Light-Only Mode

App is **light-only** (dark mode disabled):
```javascript
// In layout.tsx and LumaSidebar.tsx
document.documentElement.dataset.theme = "light";
localStorage.removeItem("lumaway_theme");
```
All `html[data-theme="dark"]` rules in legacy CSS are dormant but preserved.

## PWA & Offline

- Service Worker: `public/sw.js` (CACHE_VERSION v7)
- Precaches: static assets only
- Shell (`/`, `/dashboard`) **NOT** cached offline-first — always network-first for fresh UI
- Manifest: `/manifest.webmanifest`