---
id: p-tab-conversion
title: Tab Conversion Pattern (Menu → Tab)
type: pattern
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [patterns, tabs, conversion, navigation, progressive]
relationships:
  - type: extends
    target: p-progressive-disclosure
    description: "Extends base progressive disclosure pattern"
  - type: references
    target: m-progressive-triggers
    description: "References trigger mappings"
  - type: references
    target: sk-progressive-ui
    description: "Implemented by progressive UI skill"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# Tab Conversion Pattern — Sidebar Menu → In-Page Tab

## When to Use

A feature was a **top-level sidebar menu item** but is better as a **tab within a related parent page** because:
- It's a **sub-function** of the parent (not standalone workflow)
- Users **context-switch** between parent and feature frequently
- Feature is **secondary** (used by < 20% of parent page visitors)
- Reduces **sidebar clutter** and navigation depth

## Conversion Rule

| Before (Sidebar) | After (Tab) | Parent Page |
|------------------|-------------|-------------|
| `/promo-studio` (menu) | Tab "Promo Builder" | `/campaign-tracker` |
| `/social-lumaway` (menu) | Tab "Community" | `/content-hub` |
| `/ratecard` (menu) | *Modal from header* | `/product-master`, `/listings` |
| `/creator-samples` (menu) | *Drawer from row* | `/affiliate-360` |
| `/scheduled-reports` (menu) | *Slide-over panel* | `/campaign-tracker`, `/ai-analytics` |

## Implementation

### Tab Component (using existing pattern)

```tsx
interface TabConfig {
  value: string;
  label: string;
  icon?: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  props?: Record<string, any>;
}

function TabContainer({ 
  tabs, defaultTab, onTabChange, className 
}: { 
  tabs: TabConfig[]; 
  defaultTab: string;
  onTabChange?: (tab: string) => void;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  const handleChange = (value: string) => {
    setActiveTab(value);
    onTabChange?.(value);
  };

  return (
    <div className={`tab-container ${className || ""}`}>
      <div className="tab-list" role="tablist" aria-label="Tab navigation">
        {tabs.map(tab => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            aria-controls={`panel-${tab.value}`}
            id={`tab-${tab.value}`}
            className={`tab-trigger ds-progressive-trigger ${activeTab === tab.value ? "active" : ""}`}
            onClick={() => handleChange(tab.value)}
            type="button"
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="tab-panels">
        {tabs.map(tab => (
          <div
            key={tab.value}
            role="tabpanel"
            id={`panel-${tab.value}`}
            aria-labelledby={`tab-${tab.value}`}
            className={`tab-panel ${activeTab === tab.value ? "active" : ""}`}
            hidden={activeTab !== tab.value}
          >
            <Suspense fallback={<TabPanelSkeleton />}>
              <tab.component {...tab.props} />
            </Suspense>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### CampaignTracker (Promo Studio → Tab)

```tsx
// CampaignTracker.tsx
const CAMPAIGN_TABS = [
  { value: "tracker", label: "Tracker", icon: <LumaIcon name="performance" />, component: lazy(() => import("./CampaignTrackerContent")), props: { workspaceId } },
  { value: "promo", label: "Promo Builder", icon: <LumaIcon name="broadcast" />, component: PromoStudioV2, props: { workspaceId } },
] as const;

export function CampaignTracker({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="campaign-tracker-page legacy-page-anchor">
      <PageHead title="Campaign Tracker" subtitle="Kelola dan pantau kampanye afiliasi" actions={<CampaignActions />} />
      <TabContainer tabs={CAMPAIGN_TABS} defaultTab="tracker" />
    </div>
  );
}
```

### ContentHub (Social Lumaway → Tab)

```tsx
// ContentHub.tsx
const CONTENT_TABS = [
  { value: "insights", label: "Insight & Blog", icon: <LumaIcon name="content" />, component: lazy(() => import("./ContentHubInsights")), props: { workspaceId, userId } },
  { value: "social", label: "Community", icon: <LumaIcon name="community" />, component: SocialLumaway, props: { workspaceId, userId } },
] as const;

export function ContentHub({ workspaceId, userId }: { workspaceId: string; userId: string }) {
  return (
    <div className="content-hub-page legacy-page-anchor">
      <PageHead title="Content Hub" subtitle="Kelola konten dan komunitas" actions={<ContentActions />} />
      <TabContainer tabs={CONTENT_TABS} defaultTab="insights" />
    </div>
  );
}
```

## CSS (Restyle Layer)

```css
.tab-container { display: flex; flex-direction: column; gap: var(--ds-space-4); }
.tab-list { display: inline-flex; gap: var(--ds-space-1); background: var(--ds-bg); padding: var(--ds-space-1); border-radius: var(--ds-radius-sm); border: 1px solid var(--ds-line); }
.tab-trigger { 
  display: inline-flex; align-items: center; gap: var(--ds-space-2); 
  padding: var(--ds-space-2) var(--ds-space-4); 
  font-size: var(--ds-text-sm); font-weight: 600; 
  color: var(--ds-muted); background: transparent; border: none; 
  border-radius: var(--ds-radius-sm); cursor: pointer; 
  transition: color 0.15s ease, background 0.15s ease;
}
.tab-trigger:hover { color: var(--ds-ink); background: var(--ds-card); }
.tab-trigger.active { color: var(--ds-primary); background: var(--ds-primary-soft); }
.tab-trigger:focus-visible { outline: 2px solid var(--ds-primary); outline-offset: 2px; }
.tab-icon { display: inline-flex; flex-shrink: 0; }
.tab-panels { min-height: 200px; }
.tab-panel { animation: ds-fade-in 0.15s ease both; }
.tab-panel[hidden] { display: none; }
```

## URL State (Optional)

For deep-linking and browser history:

```tsx
function useTabUrl(tabValue: string, tabs: TabConfig[]) {
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return tabs[0].value;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    return tabs.some(t => t.value === tab) ? tab : tabs[0].value;
  });

  const handleChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState({}, "", url);
  };

  return [activeTab, handleChange] as const;
}
```

## Accessibility

- `role="tablist"` on container
- `role="tab"` on triggers, `aria-selected`
- `role="tabpanel"` on panels, `aria-labelledby`
- `aria-controls` linking tab → panel
- Keyboard: Left/Right arrows navigate, Home/End jump
- Focus management on tab change

## Migration Checklist

- [ ] Remove feature from sidebar (`LumaSidebar.tsx`)
- [ ] Add tab to parent page component
- [ ] Update route mapping (`lib/luma-navigation.ts`) — keep route for deep links, redirect to parent?tab=X
- [ ] Update `m-sidebar-map.md` — mark as "Tab Conversion"
- [ ] Update `m-progressive-triggers.md` — map trigger
- [ ] Test deep links (`/campaign-tracker?tab=promo`)
- [ ] Test browser back/forward
- [ ] Verify lazy loading works
- [ ] Verify analytics track tab views

## Examples in Lumaway

| Feature | Converted To | Parent Page | Status |
|---------|--------------|-------------|--------|
| Promo Studio | Tab "Promo Builder" | Campaign Tracker | ✅ Planned |
| Social Lumaway | Tab "Community" | Content Hub | ✅ Planned |
| Ratecard Master | Modal from header | Product Master / Listings | ✅ Planned |
| Creator Samples | Side Drawer | Affiliate 360 | ✅ Planned |
| Scheduled Report | Slide-Over Panel | Campaign Tracker / AI Analytics | ✅ Planned |