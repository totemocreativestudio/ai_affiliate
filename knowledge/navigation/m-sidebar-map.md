---
id: m-sidebar-map
title: Sidebar Navigation Map
type: mapping
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [navigation, sidebar, map, routes, groups]
relationships:
  - type: references
    target: a-shell-architecture
    description: "References shell architecture zones"
  - type: references
    target: a-route-mapping
    description: "Derived from route mapping"
  - type: relates-to
    target: m-group-defaults
    description: "Relates to group defaults"
  - type: relates-to
    target: m-progressive-triggers
    description: "Relates to progressive triggers"
  - type: references
    target: sk-sidebar-management
    description: "Referenced by sidebar management skill"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Sidebar Navigation Map — Complete Feature × Route × Component Matrix

## Overview

28 workspace features organized into 8 groups. All features preserved — no deletion. Progressive disclosure controls visibility.

## Full Matrix

| # | Feature | Route | Component | Group | Default | Progressive Trigger | Role Access |
|---|---------|-------|-----------|-------|---------|---------------------|-------------|
| 1 | Dashboard | `/dashboard` | `LegacyDashboard` | Data & Intelligence | OPEN | — | All |
| 2 | Upload Center | `/upload` | `UploadCenter` | Data & Intelligence | OPEN | — | All |
| 3 | Database | `/database` | `DatabaseCenter` | Data & Intelligence | OPEN | — | All |
| 4 | Data Health | `/data-health` | `DataHealthCenter` | Data & Intelligence | CLOSED | Inline expand from Database row | All |
| 5 | Excel Sync | `/excel-sync` | (inline) | Data & Intelligence | CLOSED | Inline expand from Upload Center row | All |
| 6 | Tutorial Upload | `/tutorial` | `TutorialCenter` | Data & Intelligence | CLOSED | Onboarding → Help menu | New users |
| 7 | AI Analytics | `/ai-analytics` | `AIAnalytics` | Insights & Analysis | OPEN | — | All |
| 8 | Recommendations | `/ai-analytics?tab=recommendation` | (sub-tab) | Insights & Analysis | CLOSED | Tab in AI Analytics | All |
| 9 | Performance Insights | `/ai-analytics?tab=performance` | (sub-tab) | Insights & Analysis | CLOSED | Tab in AI Analytics | All |
| 10 | Product Insights | `/ai-analytics?tab=product` | (sub-tab) | Insights & Analysis | CLOSED | Tab in AI Analytics | All |
| 11 | Creator Insights | `/ai-analytics?tab=creator` | (sub-tab) | Insights & Analysis | CLOSED | Tab in AI Analytics | All |
| 12 | Affiliate 360 | `/affiliate-360` | `Affiliate360Search` | Affiliate & Creator | OPEN | — | All |
| 13 | Agreement | `/agreements` | `AffiliateProgramWorkspace` | Affiliate & Creator | OPEN | — | All |
| 14 | Affiliate Support | `/affiliate-support` | `AffiliateProgramWorkspace` | Affiliate & Creator | OPEN | — | All |
| 15 | Creator Samples | `/creator-samples` | `CreatorSamples` | Affiliate & Creator | CLOSED | Side drawer from Affiliate 360 row | All |
| 16 | Ratecard Master | `/ratecard` | `RatecardMaster` | Affiliate & Creator | CLOSED | Modal from Product Master/Listings | All |
| 17 | Live Streaming | `/live-streaming` | `LiveStreamingCenter` | Live Streaming | CLOSED | — | Specialist |
| 18 | Product Master | `/product-master` | `ProductMaster` | Product & Commerce | CLOSED | — | Merchant/Ops |
| 19 | Listings | `/listings` | `Listings` | Product & Commerce | CLOSED | — | Merchant/Ops |
| 20 | Shipping | `/shipping` | `Shipping` | Product & Commerce | CLOSED | — | Merchant/Ops |
| 21 | Spending | `/spending` | `SpendingCenter` | Product & Commerce | CLOSED | — | Merchant/Ops |
| 22 | Daily Brief | `/daily-brief` | `DailyBriefCenter` | Growth & Workflow | CLOSED | Notification bell badge | All |
| 23 | Automation Rules | `/automation-rules` | `AutomationRulesCenter` | Growth & Workflow | CLOSED | Dashboard header "⚙️ Otomatisasi" | Power users |
| 24 | Goal & Forecast | `/goal-forecast` | `GoalForecastCenter` | Growth & Workflow | CLOSED | Dashboard KPI "Tampilkan Forecast" | All |
| 25 | Scheduled Report | `/scheduled-reports` | `ScheduledReportCenter` | Growth & Workflow | CLOSED | "📅 Jadwalkan" in Campaign/AI | All |
| 26 | Campaign Tracker | `/campaign-tracker` | `CampaignTracker` | Growth & Workflow | CLOSED | — | Marketing |
| 27 | Promo Studio | `/campaign-tracker?tab=promo` | (tab) | Growth & Workflow | CLOSED | Tab in Campaign Tracker | Marketing |
| 28 | Kanban | `/kanban` | `KanbanBoard` | Growth & Workflow | CLOSED | — | All |
| 29 | Ticket Status | `/support-tickets` | `UserTicketCenter` | Support & Billing | CLOSED | Notification bell | All |
| 30 | Billing & Token | `/billing` | `SubscriptionBilling` | Support & Billing | CLOSED | — | All |
| 31 | Luma Affiliate | `/luma-affiliate` | `LumaAffiliateCenter` | Support & Billing | CLOSED | Avatar menu "Program Referral" | All |
| 32 | Insight & Blog | `/content-hub` | `ContentHub` | Content & Community | CLOSED | — | All |
| 33 | Social Lumaway | `/content-hub?tab=social` | (tab) | Content & Community | CLOSED | Tab in Content Hub | All |

## Group Definitions

| Group ID | Label | Icon | Sections | Default Open | Role Default |
|----------|-------|------|----------|--------------|--------------|
| `data` | Data & Intelligence | `data` | 1–6 | ✅ | All |
| `ai` | Insights & Analysis | `performance` | 7–11 | ✅ | All |
| `affiliate` | Affiliate & Creator | `creator` | 12–16 | ✅ | All |
| `live` | Live Streaming | `performance` | 17 | ❌ | Specialist |
| `commerce` | Product & Commerce | `product` | 18–21 | ❌ | Merchant/Ops |
| `growth` | Growth & Workflow | `kanban` | 22–28 | ❌ | Marketing |
| `support` | Support & Billing | `ticket` | 29–31 | ❌ | All |
| `content` | Content & Community | `content` | 32–33 | ❌ | All |

## Default Open Logic (per `LumaSidebar.tsx`)

```typescript
const DEFAULT_OPEN_GROUPS = {
  admin: ["data", "administration"],  // OwnerSidebarMenu handles admin
  default: ["data", "ai", "affiliate"],
};

function getDefaultOpenGroups(role: string): string[] {
  if (role === "admin") return DEFAULT_OPEN_GROUPS.admin;
  return DEFAULT_OPEN_GROUPS.default;
}
```

## Persistence

```typescript
// localStorage keys
const STORAGE_KEYS = {
  groups: "lumaway_sidebar_groups",      // { [groupId]: boolean }
  collapsed: "lumaway_sidebar_collapsed", // "0" | "1"
  ownerTab: "lumaway_owner_tab",         // "overview" | "creators" | ...
};

// On mount: read from localStorage, merge with role defaults
// On toggle: write to localStorage immediately
```

## Progressive Triggers Reference

See `m-progressive-triggers.md` for detailed trigger mapping.

## Admin Sidebar (Owner)

Separate menu in `OwnerSidebarMenu.tsx` — not in this map. Routes under `/administration/*`.