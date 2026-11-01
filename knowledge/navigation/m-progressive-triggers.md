---
id: m-progressive-triggers
title: Progressive Disclosure Triggers
type: mapping
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [navigation, progressive, disclosure, triggers, patterns]
relationships:
  - type: relates-to
    target: m-sidebar-map
    description: "Triggers map to sidebar features"
  - type: references
    target: p-progressive-disclosure
    description: "References progressive disclosure patterns"
  - type: references
    target: sk-progressive-ui
    description: "Referenced by progressive UI skill"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Progressive Disclosure Triggers — Feature × Trigger × Pattern Matrix

## Overview

Maps each "hidden" feature to its trigger location, pattern type, and implementation component. All features preserved — just accessed progressively.

## Trigger Matrix

| Feature | Hidden From | Trigger Location | Trigger UI | Pattern | Target Component |
|---------|-------------|------------------|------------|---------|------------------|
| **Data Health** | Sidebar (group closed) | Database row in sidebar | 🩺 icon (right) | Inline Expand | `DataHealthCenter` |
| **Excel Sync** | Sidebar (group closed) | Upload Center row in sidebar | 📊 icon (right) | Inline Expand | (inline component) |
| **Tutorial Upload** | Sidebar (group closed) | Help dropdown / Onboarding complete | "Tutorial" link | Modal Drawer | `TutorialCenter` |
| **Creator Samples** | Sidebar (group closed) | Affiliate 360 table row | Click row / 👁️ icon | Side Drawer (320px) | `CreatorSamples` |
| **Ratecard Master** | Sidebar (group closed) | Product Master header / Listings header | "Kelola Ratecard" button | Modal Full-Screen | `RatecardMaster` |
| **Scheduled Report** | Sidebar (group closed) | Campaign Tracker toolbar / AI Analytics header | "📅 Jadwalkan" button | Slide-Over Panel (right) | `ScheduledReportCenter` |
| **Goal & Forecast** | Sidebar (group closed) | Dashboard KPI grid header | "Tampilkan Forecast" toggle | Expandable Card | `GoalForecastCenter` |
| **Automation Rules** | Sidebar (group closed) | Dashboard header | "⚙️ Otomatisasi" button | Side Panel (md: drawer, lg: inline) | `AutomationRulesCenter` |
| **Promo Studio** | Sidebar (group closed) | Campaign Tracker tabs | Tab "Promo Builder" | Tab Conversion | `CampaignTracker` |
| **Daily Brief** | Sidebar (group closed) | Notification bell | Badge count + auto 09:00 | Banner + Drawer | `DailyBriefCenter` |
| **Ticket Status** | Sidebar (group closed) | Notification bell | Click ticket notification | Modal Drawer | `UserTicketCenter` |
| **Luma Affiliate** | Sidebar (group closed) | Avatar dropdown | "Program Referral" | Modal Drawer | `LumaAffiliateCenter` |
| **Social Lumaway** | Sidebar (group closed) | Content Hub tabs | Tab "Community" | Tab Conversion | `ContentHub` |
| **Insight & Blog** | Sidebar (group closed) | — | — | External Link | `www.lumaway.online/blog` |

## Pattern Definitions

| Pattern | Component | Animation | Width/Height | Backdrop | Close On |
|---------|-----------|-----------|--------------|----------|----------|
| **Inline Expand** | `ProgressivePanel` | `ds-slide-down/up` | Full width, auto height | None | Click outside / Escape |
| **Side Drawer** | `ProgressiveDrawer` | `ds-slide-right` | 320px (max 90vw) | Semi-transparent | Click backdrop / Escape / Swipe |
| **Modal Full-Screen** | `ProgressiveDrawer` | `ds-fade-in/out` | 100vw × 100vh | Dark 0.5 | Click backdrop / Escape / Close btn |
| **Slide-Over Panel** | `ProgressiveDrawer` | `ds-slide-right` | 480px (md), 100% (sm) | Semi-transparent | Click backdrop / Escape |
| **Expandable Card** | `ProgressivePanel` | `ds-expand/collapse-height` | Auto | None | Toggle button |
| **Side Panel** | `ProgressiveDrawer` | `ds-slide-right` | 360px (lg inline) | None (lg) / backdrop (md) | Click outside / Escape |
| **Tab Conversion** | Native tabs | `ds-fade-in` | N/A | N/A | Tab switch |
| **Banner + Drawer** | `ProgressivePanel` + `ProgressiveDrawer` | `ds-slide-down` + `ds-slide-right` | Banner: full width; Drawer: 360px | Banner: none; Drawer: semi | Banner: dismiss; Drawer: backdrop/Escape |
| **Modal Drawer** | `ProgressiveDrawer` | `ds-fade-in/out` | 400px centered | Dark 0.4 | Click backdrop / Escape / Close btn |
| **External Link** | `<a target="_blank">` | None | N/A | N/A | N/A |

## Trigger UI Specifications

### Inline Expand (Sidebar Rows)
```tsx
// In LumaSidebar.tsx — Database row
<a className={subActive("database")} ...>
  <NavIcon name="master" />
  <span className="nav-label">Database</span>
  <button 
    className="progressive-trigger"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInline("data-health"); }}
    aria-label="Data Health"
    aria-expanded={isInlineOpen("data-health")}
  >
    <LumaIcon name="health" className={isInlineOpen("data-health") ? "ds-chevron rotated" : "ds-chevron"} />
  </button>
</a>

// Inline panel (rendered in side-subnav)
<ProgressivePanel 
  open={isInlineOpen("data-health")} 
  onClose={() => toggleInline("data-health")}
  className="ds-progressive-panel"
>
  <DataHealthCenter workspaceId={workspace.id} />
</ProgressivePanel>
```

### Side Drawer (Creator Samples)
```tsx
// In Affiliate360Search.tsx — table row
<TableRow onClick={() => openDrawer("creator-samples", creatorId)}>
  ...
</TableRow>

// Drawer component
<ProgressiveDrawer
  open={drawerId === "creator-samples"}
  onClose={() => setDrawerId(null)}
  size="md"  // 320px
  className="ds-drawer"
>
  <CreatorSamples workspaceId={workspace.id} creatorId={selectedCreatorId} />
</ProgressiveDrawer>
```

### Modal Full-Screen (Ratecard)
```tsx
// In ProductMaster.tsx / Listings.tsx header
<Button variant="secondary" onClick={() => openModal("ratecard")}>
  Kelola Ratecard
</Button>

// Modal
<ProgressiveDrawer
  open={modalId === "ratecard"}
  onClose={() => setModalId(null)}
  size="full"
  className="ds-drawer ds-fade"
>
  <RatecardMaster workspaceId={workspace.id} />
</ProgressiveDrawer>
```

### Slide-Over Panel (Scheduled Report)
```tsx
// In CampaignTracker.tsx / AIAnalytics.tsx toolbar
<Button onClick={() => openPanel("scheduled-reports")}>
  <LumaIcon name="calendar" /> Jadwalkan
</Button>

// Panel
<ProgressiveDrawer
  open={panelId === "scheduled-reports"}
  onClose={() => setPanelId(null)}
  size="lg"  // 480px desktop, full mobile
  className="ds-drawer"
>
  <ScheduledReportCenter workspaceId={workspace.id} />
</ProgressiveDrawer>
```

### Expandable Card (Goal & Forecast)
```tsx
// In LegacyDashboard.tsx KPI header
<div className="kpi-header">
  <h3>Key Metrics</h3>
  <Button 
    variant="ghost" 
    size="sm"
    onClick={() => setShowForecast(!showForecast)}
    className="ds-progressive-trigger"
  >
    {showForecast ? "Sembunyikan" : "Tampilkan"} Forecast
    <LumaIcon name="chevron" className={showForecast ? "ds-chevron rotated" : "ds-chevron"} />
  </Button>
</div>

// Forecast card (hidden by default)
<ProgressivePanel open={showForecast} className="kpi-row-hidden ds-expand">
  <GoalForecastCenter workspaceId={workspace.id} />
</ProgressivePanel>
```

### Side Panel (Automation Rules)
```tsx
// In LegacyDashboard.tsx header
<Button onClick={() => openPanel("automation-rules")} variant="ghost">
  <LumaIcon name="settings" /> Otomatisasi
</Button>

// Panel (responsive)
<ProgressiveDrawer
  open={panelId === "automation-rules"}
  onClose={() => setPanelId(null)}
  size="responsive"  // lg: inline right, md: drawer
  className="ds-drawer"
>
  <AutomationRulesCenter workspaceId={workspace.id} />
</ProgressiveDrawer>
```

### Tab Conversion (Promo Studio / Social Lumaway)
```tsx
// In CampaignTracker.tsx
<Tabs defaultValue="tracker" onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="tracker">Tracker</TabsTrigger>
    <TabsTrigger value="promo">Promo Builder</TabsTrigger>
  </TabsList>
  <TabsContent value="tracker">...</TabsContent>
  <TabsContent value="promo">
    <PromoStudioV2 workspaceId={workspace.id} />
  </TabsContent>
</Tabs>

// In ContentHub.tsx
<Tabs defaultValue="insights" onValueChange={setTab}>
  <TabsList>
    <TabsTrigger value="insights">Insight & Blog</TabsTrigger>
    <TabsTrigger value="social">Community</TabsTrigger>
  </TabsList>
  <TabsContent value="insights">...</TabsContent>
  <TabsContent value="social">
    <SocialLumaway workspaceId={workspace.id} userId={profile.id} />
  </TabsContent>
</Tabs>
```

### Banner + Drawer (Daily Brief)
```tsx
// Top banner (auto-show 09:00 if unread)
{showDailyBriefBanner && (
  <div className="daily-brief-banner ds-progressive-panel ds-fade">
    <span>Daily Brief tersedia</span>
    <Button onClick={() => { setShowBanner(false); openDrawer("daily-brief"); }}>
      Baca
    </Button>
    <Button variant="ghost" onClick={() => setShowBanner(false)}>Nanti</Button>
  </div>
)}

// Drawer
<ProgressiveDrawer
  open={drawerId === "daily-brief"}
  onClose={() => setDrawerId(null)}
  size="md"
>
  <DailyBriefCenter workspaceId={workspace.id} />
</ProgressiveDrawer>
```

### Modal Drawer (Ticket, Affiliate, etc.)
```tsx
// Notification bell dropdown
<NotificationItem onClick={() => { openModal("support-tickets"); closeNotifications(); }}>
  <LumaIcon name="ticket" /> Tiket baru: #1234
</NotificationItem>

// Modal
<ProgressiveDrawer
  open={modalId === "support-tickets"}
  onClose={() => setModalId(null)}
  size="md"
  className="ds-drawer ds-fade"
>
  <UserTicketCenter workspaceId={workspace.id} />
</ProgressiveDrawer>
```

## Accessibility Requirements

All progressive components must:
- [ ] Trap focus when open (modals, drawers)
- [ ] Return focus to trigger on close
- [ ] Support Escape to close
- [ ] Announce open/close via ARIA live region
- [ ] `aria-expanded` on trigger buttons
- [ ] `aria-controls` linking trigger to panel
- [ ] `role="dialog"` for modals/drawers
- [ ] `aria-modal="true"` for modals
- [ ] `tabIndex={-1}` on panel content when closed

## CSS Classes (from `lumaway-dashstack-restyle.css` Section 18)

```css
.ds-progressive-panel { animation: ds-slide-down 0.2s ease both; overflow: hidden; }
.ds-progressive-panel.closing { animation: ds-slide-up 0.15s ease both; }
.ds-drawer { animation: ds-slide-right 0.22s ease both; }
.ds-fade { animation: ds-fade-in 0.15s ease both; }
.ds-expand { animation: ds-expand-height 0.25s ease both; }
.ds-collapse { animation: ds-collapse-height 0.2s ease both; }
.ds-chevron { display: inline-flex; transition: transform 0.2s ease; }
.ds-chevron.rotated { transform: rotate(180deg); }
```