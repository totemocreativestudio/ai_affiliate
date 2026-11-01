---
id: i-component-inventory
title: Component Inventory
type: inventory
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [inventory, components, catalog, react]
relationships:
  - type: relates-to
    target: a-shell-architecture
    description: "Components used in shell architecture"
  - type: references
    target: k-dashstack-tokens
    description: "Components use design tokens"
governance:
  review-cycle: 30d
  last-reviewed: 2026-11-01
---

# Component Inventory — `app/components/` Catalog

## Overview

80+ React components in `app/components/`. Categorized by domain. All components preserved — no deletion.

## Component Categories

### Shell & Layout (6)
| Component | File | Size | Purpose | Dependencies |
|-----------|------|------|---------|--------------|
| `LumaSidebar` | `LumaSidebar.tsx` | 13KB | Main navigation, collapsible, mobile drawer | `LumaIcon`, `OwnerSidebarMenu`, `OwnerSidebarFooter`, `PWAInstallButton`, `luma-navigation` |
| `LumawayWorkspaceApp` | `LumawayWorkspaceApp.tsx` | ~20KB | Root workspace shell, auth, routing | All page components, `LumaSidebar`, `Supabase` |
| `LumawayAuthExperience` | `LumawayAuthExperience.tsx` | 24KB | Login/register/forgot flow | `Supabase`, `LumaIcon` |
| `LumawayExperienceLayer` | `LumawayExperienceLayer.tsx` | 3KB | Background effects | — |
| `PerformanceExperienceLayer` | `PerformanceExperienceLayer.tsx` | 2KB | Perf monitoring | — |
| `LumawayWorkspaceSkeleton` | (inline) | — | Loading skeleton | — |

### Navigation & UI Primitives (12)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `LumaIcon` | `LumaIcon.tsx` | 8KB | Icon system (SVG sprites) |
| `LumaMotionState` | `LumaMotionState.tsx` | 2KB | Animation state manager |
| `PWAInstallButton` | `PWAInstallButton.tsx` | 2KB | PWA install prompt |
| `PWAOperationalStatus` | `PWAOperationalStatus.tsx` | 2KB | Online/offline indicator |
| `BackgroundTaskCenter` | `BackgroundTaskCenter.tsx` | 3KB | Background job monitor |
| `NotificationCenter` | `NotificationCenter.tsx` | 16KB | Notification bell + dropdown |
| `GlobalCommandCenter` | `GlobalCommandCenter.tsx` | 10KB | Cmd+K command palette |
| `TableSortEnhancer` | `TableSortEnhancer.tsx` | 3KB | Table sorting enhancement |
| `SystemStatusGate` | `SystemStatusGate.tsx` | 1KB | System status banner |
| `ReferralCapture` | `ReferralCapture.tsx` | 1KB | Referral tracking |
| `MobileQuickNav` | `MobileQuickNav.tsx` | 2KB | Mobile bottom nav |
| `DashboardReminder` | `DashboardReminder.tsx` | 3KB | Dashboard nudge |

### Data & Intelligence (6)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `LegacyDashboard` | `LegacyDashboard.tsx` | 41KB | Main dashboard, KPI grid, rankings |
| `UploadCenter` | `UploadCenter.tsx` | 23KB | File upload, import wizard |
| `DatabaseCenter` | `DatabaseCenter.tsx` | 17KB | Data browser, filters, export |
| `DataHealthCenter` | `DataHealthCenter.tsx` | 12KB | Data quality metrics |
| `CreatorIdentityCenter` | `CreatorIdentityCenter.tsx` | 17KB | Creator profiles, verification |
| `ExcelSync` | (inline) | — | Excel import sync |

### AI & Analytics (4)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `AIAnalytics` | `AIAnalytics.tsx` | 26KB | AI insights, recommendations |
| `LumawayDataViz` | `LumawayDataViz.tsx` | 8KB | Charts, visualizations |
| `GoalForecastCenter` | `GoalForecastCenter.tsx` | 8KB | Goal setting, forecasting |
| `DailyBriefCenter` | `DailyBriefCenter.tsx` | 8KB | Daily summary, briefings |

### Affiliate & Creator (7)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `Affiliate360Search` | `Affiliate360Search.tsx` | 7KB | Creator search, attribution |
| `AffiliateProgramWorkspace` | `AffiliateProgramWorkspace.tsx` | 23KB | Affiliate program management |
| `AffiliateBatchEvidencePanel` | `AffiliateBatchEvidencePanel.tsx` | 13KB | Batch evidence review |
| `AffiliateRewardClaims` | `AffiliateRewardClaims.tsx` | 8KB | Reward claims |
| `Creator360Modal` | `Creator360Modal.tsx` | 39KB | Creator detail modal |
| `CreatorAttributionCenter` | `CreatorAttributionCenter.tsx` | 16KB | Attribution tracking |
| `CreatorSamples` | `CreatorSamples.tsx` | 20KB | Sample management |

### Live Streaming (6)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `LiveStreamingCenter` | `LiveStreamingCenter.tsx` | 7KB | Live dashboard |
| `LiveHostSessionPanels` | `LiveHostSessionPanels.tsx` | 15KB | Host session management |
| `LiveAnalyticsPanel` | `LiveAnalyticsPanel.tsx` | 10KB | Live analytics |
| `LiveCampaignPanel` | `LiveCampaignPanel.tsx` | 8KB | Campaign live view |
| `LiveDataHealthPanel` | `LiveDataHealthPanel.tsx` | 9KB | Live data health |
| `LiveUploadPanel` | `LiveUploadPanel.tsx` | 16KB | Live upload |
| `LivePnLPanel` | `LivePnLPanel.tsx` | 7KB | Live P&L |
| `LiveProductIntelligence` | `LiveProductIntelligence.tsx` | 11KB | Product intelligence |

### Product & Commerce (5)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `ProductMaster` | `ProductMaster.tsx` | 16KB | Product catalog, CRUD |
| `Listings` | `Listings.tsx` | 69KB | Marketplace listings |
| `Shipping` | `Shipping.tsx` | 29KB | Shipping management |
| `SpendingCenter` | `SpendingCenter.tsx` | 6KB | Spend tracking |
| `RatecardMaster` | `RatecardMaster.tsx` | 16KB | Ratecard management |

### Growth & Workflow (8)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `CampaignTracker` | `CampaignTracker.tsx` | 38KB | Campaign management |
| `AutomationRulesCenter` | `AutomationRulesCenter.tsx` | 7KB | Automation rules |
| `ScheduledReportCenter` | `ScheduledReportCenter.tsx` | 11KB | Scheduled reports |
| `KanbanBoard` | `KanbanBoard.tsx` | 19KB | Kanban board |
| `PromoStudioV2` | `PromoStudioV2.tsx` | 10KB | Promo creation |
| `ContentHub` | `ContentHub.tsx` | 12KB | Content management |
| `SocialLumaway` | `SocialLumaway.tsx` | 29KB | Social features |
| `AffiliateProgramImporter` | `AffiliateProgramImporter.tsx` | 19KB | Program import |

### Support & Billing (5)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `SubscriptionBilling` | `SubscriptionBilling.tsx` | 15KB | Billing, subscriptions |
| `UserTicketCenter` | `UserTicketCenter.tsx` | 3KB | Ticket history |
| `LumaHelpdeskAgent` | `LumaHelpdeskAgent.tsx` | 9KB | Helpdesk chat |
| `LumaHelpDesk` | `LumaHelpDesk.tsx` | 9KB | Helpdesk UI |
| `UserProfile` | `UserProfile.tsx` | 22KB | User profile settings |

### Admin / Owner (16)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `AdminDashboardV2` | `AdminDashboardV2.tsx` | 13KB | Admin dashboard v2 |
| `AdminDashboardV3` | `AdminDashboardV3.tsx` | 13KB | Admin dashboard v3 |
| `AdminDashboard` | `AdminDashboard.tsx` | 0KB | Placeholder |
| `AdminBlog` | `AdminBlog.tsx` | 11KB | Blog management |
| `AdminBroadcast` | `AdminBroadcast.tsx` | 6KB | Broadcast messages |
| `AdminSocialModeration` | `AdminSocialModeration.tsx` | 2KB | Social moderation |
| `AdminSupportDesk` | `AdminSupportDesk.tsx` | 6KB | Support desk |
| `OwnerCommandCenterSummary` | `OwnerCommandCenterSummary.tsx` | 14KB | Owner summary |
| `OwnerFinanceControl` | `OwnerFinanceControl.tsx` | 7KB | Finance control |
| `OwnerFinancialReports` | `OwnerFinancialReports.tsx` | 12KB | Financial reports |
| `OwnerHppCalculator` | `OwnerHppCalculator.tsx` | 8KB | HPP calculator |
| `OwnerIncidentCenter` | `OwnerIncidentCenter.tsx` | 6KB | Incident management |
| `OwnerKnowledgeVault` | `OwnerKnowledgeVault.tsx` | 5KB | Knowledge base |
| `OwnerMonitoring360` | `OwnerMonitoring360.tsx` | 11KB | 360 monitoring |
| `OwnerPlatformHealth` | `OwnerPlatformHealth.tsx` | 21KB | Platform health |
| `OwnerProductionQA` | `OwnerProductionQA.tsx` | 4KB | Production QA |
| `OwnerProviderAccounts` | `OwnerProviderAccounts.tsx` | 4KB | Provider accounts |
| `OwnerReleaseGate` | `OwnerReleaseGate.tsx` | 4KB | Release gate |
| `OwnerSidebarMenu` | `OwnerSidebarMenu.tsx` | 4KB | Owner sidebar menu |
| `OwnerSidebarFooter` | `OwnerSidebarFooter.tsx` | 1KB | Owner sidebar footer |
| `OwnerSubscriptionPromo` | `OwnerSubscriptionPromo.tsx` | 14KB | Subscription promo |
| `OwnerSupportDesk` | `OwnerSupportDesk.tsx` | 6KB | Owner support |
| `OwnerSystemControl` | `OwnerSystemControl.tsx` | 5KB | System control |
| `OwnerTutorialControl` | `OwnerTutorialControl.tsx` | 6KB | Tutorial control |
| `PaymentGatewayControl` | `PaymentGatewayControl.tsx` | 2KB | Payment gateway |

### Tutorial & Onboarding (3)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `TutorialCenter` | `TutorialCenter.tsx` | 19KB | Tutorial management |
| `ContextualTutorial` | `ContextualTutorial.tsx` | 15KB | In-app tutorials |
| `WhatsAppOnboarding` | `WhatsAppOnboarding.tsx` | 1KB | WhatsApp onboarding |

### Integrations (8)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `MayarIntegration` | `MayarIntegration.tsx` | 6KB | Mayar payment |
| `OpenAIIntegration` | `OpenAIIntegration.tsx` | 4KB | OpenAI config |
| `ResendIntegration` | `ResendIntegration.tsx` | 6KB | Resend email |
| `WhatsAppIntegration` | `WhatsAppIntegration.tsx` | 12KB | WhatsApp config |
| `XenditIntegration` | `XenditIntegration.tsx` | 3KB | Xendit payment |
| `GoogleCloudIntegration` | `GoogleCloudIntegration.tsx` | 5KB | GCP config |
| `GoogleSheetsPrivate` | `GoogleSheetsPrivate.tsx` | 9KB | Sheets import |
| `EmailIntegrationStatus` | `EmailIntegrationStatus.tsx` | 3KB | Email status |

### Utilities (7)
| Component | File | Size | Purpose |
|-----------|------|------|---------|
| `SmartAutocomplete` | `SmartAutocomplete.tsx` | 8KB | Autocomplete input |
| `SmartEmptyState` | `SmartEmptyState.tsx` | 1KB | Empty state wrapper |
| `InternalExcelGrid` | `InternalExcelGrid.tsx` | 23KB | Excel-like grid |
| `ImportMappingWizard` | `ImportMappingWizard.tsx` | 21KB | Import mapping |
| `ListingQuickMessage` | `ListingQuickMessage.tsx` | 10KB | Quick message |
| `ListingContactReadiness` | `ListingContactReadiness.tsx` | 3KB | Contact readiness |
| `ListingFollowupCalendar` | `ListingFollowupCalendar.tsx` | 13KB | Followup calendar |
| `ListingFollowupInsights` | `ListingFollowupInsights.tsx` | 2KB | Followup insights |
| `ListingFollowupQueue` | `ListingFollowupQueue.tsx` | 4KB | Followup queue |
| `SparkAdsCodes` | `SparkAdsCodes.tsx` | 6KB | Ads codes |
| `ClientErrorReporter` | `ClientErrorReporter.tsx` | 1KB | Error reporting |

### Total: ~80 Components

## Progressive Disclosure Targets

| Component | Progressive Pattern | Target |
|-----------|---------------------|--------|
| `LegacyDashboard` | Expandable Card (Forecast), Side Panel (Automation) | `GoalForecastCenter`, `AutomationRulesCenter` |
| `CampaignTracker` | Tab Conversion (Promo Studio) | `PromoStudioV2` |
| `ContentHub` | Tab Conversion (Social Lumaway) | `SocialLumaway` |
| `ProductMaster` / `Listings` | Modal Drawer (Ratecard) | `RatecardMaster` |
| `Affiliate360Search` | Side Drawer (Creator Samples) | `CreatorSamples` |
| `AIAnalytics` / `CampaignTracker` | Slide-Over Panel (Scheduled Report) | `ScheduledReportCenter` |
| `LumaSidebar` | Inline Expand (Data Health, Excel Sync) | `DataHealthCenter` |
| `NotificationCenter` | Modal Drawer (Tickets) | `UserTicketCenter` |
| `LumaHelpdeskAgent` | Modal Drawer (Chat) | — |

## Token Usage Status

| Component | Uses `--ds-*` Tokens | Notes |
|-----------|---------------------|-------|
| `LumaSidebar` | Partial (restyle layer overrides) | Needs cleanup |
| `LegacyDashboard` | No (legacy CSS) | Restyle layer handles |
| `CampaignTracker` | No | Restyle layer handles |
| `ContentHub` | No | Restyle layer handles |
| `ProductMaster` | No | Restyle layer handles |
| `Listings` | No | Restyle layer handles |
| All others | No | Restyle layer handles |

**All components styled via `lumaway-dashstack-restyle.css` restyle layer** — no direct token imports needed in components.