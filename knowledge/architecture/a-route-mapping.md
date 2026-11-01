---
id: a-route-mapping
title: Route Mapping
type: architecture
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [architecture, routes, navigation, mapping]
relationships:
  - type: implements
    target: s-design-spec
    description: "Route mapping implements navigation spec"
  - type: references
    target: a-shell-architecture
    description: "References shell architecture zones"
  - type: relates-to
    target: m-sidebar-map
    description: "Sidebar map derives from route mapping"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# Route Mapping — Complete Route Table

All routes in the Lumaway workspace, mapped to sections, components, and sidebar entries.

## Route Structure

```
/
├── /login                    # Auth (standalone, no shell)
├── /register                 # Auth (standalone, no shell)
├── /auth/callback            # OAuth callback
├── /auth/confirm             # Email confirmation
├── /auth/reset-password      # Password reset
├── /dashboard                # Workspace root → redirects to /dashboard
├── /dashboard                # LegacyDashboard
├── /upload                   # UploadCenter
├── /database                 # DatabaseCenter
├── /data-health              # DataHealthCenter
├── /excel-sync               # (inline expand from Database)
├── /tutorial                 # TutorialCenter
├── /ai-analytics             # AIAnalytics
├── /affiliate-360            # Affiliate360Search
├── /agreements               # AffiliateProgramWorkspace
├── /affiliate-support        # AffiliateProgramWorkspace
├── /creator-samples          # CreatorSamples
├── /ratecard                 # RatecardMaster
├── /live-streaming           # LiveStreamingCenter
├── /product-master           # ProductMaster
├── /listings                 # Listings
├── /shipping                 # Shipping
├── /spending                 # SpendingCenter
├── /daily-brief              # DailyBriefCenter
├── /automation-rules         # AutomationRulesCenter
├── /goal-forecast            # GoalForecastCenter
├── /scheduled-reports        # ScheduledReportCenter
├── /campaign-tracker         # CampaignTracker
├── /promo-studio             # **Tab in CampaignTracker**
├── /kanban                   # KanbanBoard
├── /support-tickets          # UserTicketCenter
├── /billing                  # SubscriptionBilling
├── /luma-affiliate           # LumaAffiliateCenter
├── /content-hub              # ContentHub
├── /social-lumaway           # **Tab in ContentHub**
├── /profile                  # UserProfile
├── /administration/*         # Admin routes (owner only)
│   ├── /overview             # AdminDashboardV3
│   ├── /creators             # CreatorAttributionCenter
│   ├── /listings             # AdminDashboardV3
│   ├── /finance              # OwnerFinanceControl
│   ├── /monitoring           # OwnerMonitoring360
│   ├── /incidents            # OwnerIncidentCenter
│   └── /settings             # OwnerSystemControl
├── /api/*                    # API routes (not in shell)
├── /blog                     # Public blog (marketing)
├── /insights                 # Public insights
├── /web/*                    # Marketing site (www.lumaway.online)
└── /_next/*                  # Next.js internals
```

## Route-to-Section Mapping (Sidebar)

Defined in `lib/luma-navigation.ts`:

```typescript
export const sectionRoutes: Record<string, string> = {
  "dashboard": "/dashboard",
  "upload": "/upload",
  "database": "/database",
  "data-health": "/data-health",
  "excel-sync": "/excel-sync",
  "tutorial": "/tutorial",
  "ai-analytics": "/ai-analytics",
  "recommendation": "/ai-analytics?tab=recommendation",
  "performance": "/ai-analytics?tab=performance",
  "product": "/ai-analytics?tab=product",
  "creator": "/ai-analytics?tab=creator",
  "affiliate-360": "/affiliate-360",
  "agreements": "/agreements",
  "affiliate-support": "/affiliate-support",
  "creator-samples": "/creator-samples",
  "ratecard": "/ratecard",
  "live-streaming": "/live-streaming",
  "product-master": "/product-master",
  "listings": "/listings",
  "shipping": "/shipping",
  "spending": "/spending",
  "daily-brief": "/daily-brief",
  "automation-rules": "/automation-rules",
  "goal-forecast": "/goal-forecast",
  "scheduled-reports": "/scheduled-reports",
  "campaign-tracker": "/campaign-tracker",
  "promo-studio": "/campaign-tracker?tab=promo",
  "kanban": "/kanban",
  "support-tickets": "/support-tickets",
  "billing": "/billing",
  "luma-affiliate": "/luma-affiliate",
  "content-hub": "/content-hub",
  "social-lumaway": "/content-hub?tab=social",
  "profile": "/profile",
};
```

## Section Groups (Sidebar)

| Group ID | Label | Sections | Default Open |
|----------|-------|----------|--------------|
| `data` | Data & Intelligence | dashboard, upload, database, data-health, excel-sync, tutorial | ✅ OPEN |
| `ai` | Insights & Analysis | ai-analytics (sub: recommendation, performance, product, creator) | ✅ OPEN |
| `affiliate` | Affiliate & Creator | affiliate-360, agreements, affiliate-support, creator-samples, ratecard | ✅ OPEN |
| `live` | Live Streaming | live-streaming | ❌ CLOSED |
| `commerce` | Product & Commerce | product-master, listings, shipping, spending | ❌ CLOSED |
| `growth` | Growth & Workflow | daily-brief, automation-rules, goal-forecast, scheduled-reports, campaign-tracker, promo-studio, kanban | ❌ CLOSED |
| `support` | Support & Billing | support-tickets, billing, luma-affiliate | ❌ CLOSED |
| `content` | Content & Community | content-hub, social-lumaway | ❌ CLOSED |

## Role-Based Defaults

| Role | Default Open Groups |
|------|---------------------|
| Admin/Owner | data, administration (OwnerSidebarMenu) |
| Creator Manager | data, affiliate, ai |
| Merchant/Ops | data, commerce |
| Marketing/Growth | data, growth |
| Default (new) | data, affiliate, ai |

## Progressive Disclosure Triggers

| Hidden Feature | Trigger Location | Pattern |
|----------------|------------------|---------|
| Data Health | Database row → 🩺 icon | Inline expand |
| Excel Sync | Upload Center row → 📊 icon | Inline expand |
| Tutorial | Onboarding completion → Help menu | Modal drawer |
| Creator Samples | Affiliate 360 row → click | Side drawer (320px) |
| Ratecard Master | Product Master/Listings header → "Kelola Ratecard" | Modal full-screen |
| Scheduled Report | Campaign Tracker / AI Analytics → "📅 Jadwalkan" | Slide-over panel |
| Goal & Forecast | Dashboard KPI header → "Tampilkan Forecast" | Expandable card |
| Automation Rules | Dashboard header → "⚙️ Otomatisasi" | Side panel |
| Promo Studio | Campaign Tracker → tab "Promo Builder" | Tab conversion |
| Daily Brief | Notification bell → badge | Banner + drawer |
| Ticket Status | Notification bell → click | Modal drawer |
| Luma Affiliate | Avatar menu → "Program Referral" | Modal drawer |
| Social Lumaway | Content Hub → tab "Community" | Tab conversion |

## URL State Persistence

- Sidebar group open/closed: `localStorage.lumaway_sidebar_groups` (JSON)
- Sidebar collapsed: `localStorage.lumaway_sidebar_collapsed` ("0"|"1")
- Active section: URL path (synced via `popstate` + `lumaway-routechange` event)
- Owner tab: `localStorage.lumaway_owner_tab` + URL `/administration/{tab}`

## Navigation Events

```typescript
// Dispatched on route change
window.dispatchEvent(new CustomEvent("lumaway-routechange", { 
  detail: { section, path } 
}));

// Dispatched on owner nav
window.dispatchEvent(new CustomEvent("luma-owner-nav", { 
  detail: { tab, section } 
}));

// Dispatched on access locked
window.dispatchEvent(new CustomEvent("lumaway-access-locked", { 
  detail: { requestedSection } 
}));

// Dispatched to open mobile sidebar
window.dispatchEvent(new CustomEvent("lumaway-open-sidebar"));
```

## Build-Time Route Validation

`scripts/lumaway-route-check.mjs` validates:
- All sidebar sections have valid routes
- All components exist
- No orphan routes
- Shell structure intact (sidebar, topbar, content)
- Light-only mode enforced
- PWA cache version >= v6