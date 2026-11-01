---
id: s-progressive-disclosure-spec
title: Progressive Disclosure Specification
type: spec
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [spec, progressive, disclosure, ui, patterns]
relationships:
  - type: decides
    target: d-002-progressive-disclosure
    description: "Progressive disclosure spec decided by ADR"
  - type: governs
    target: d-003-sidebar-smart-defaults
    description: "Progressive disclosure governed by sidebar defaults decision"
  - type: implements
    target: p-progressive-disclosure
    description: "Base pattern implements this spec"
  - type: implements
    target: p-inline-expand
    description: "Inline expand implements this spec"
  - type: implements
    target: p-drawer-pattern
    description: "Drawer pattern implements this spec"
  - type: implements
    target: p-modal-pattern
    description: "Modal pattern implements this spec"
  - type: implements
    target: p-collapse-pattern
    description: "Collapse pattern implements this spec"
  - type: implements
    target: p-tab-conversion
    description: "Tab conversion implements this spec"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Progressive Disclosure Specification

## 1. Purpose

Define requirements for hiding secondary/advanced features behind progressive disclosure triggers while keeping all 28 workspace features accessible and discoverable.

## 2. Functional Requirements

### REQ-PD-01: Feature Preservation
**All 28 workspace features MUST remain accessible** — no feature deletion, no route removal. Progressive disclosure only changes entry point visibility.

### REQ-PD-02: Trigger Discoverability
Each hidden feature MUST have a visible trigger in a logical parent context:
- Data Health → Database row (🩺 icon)
- Excel Sync → Upload Center row (📊 icon)
- Tutorial → Help dropdown / onboarding complete
- Creator Samples → Affiliate 360 row click
- Ratecard Master → Product Master/Listings header button
- Scheduled Report → Campaign Tracker / AI Analytics toolbar button
- Goal & Forecast → Dashboard KPI header toggle
- Automation Rules → Dashboard header button
- Promo Studio → Campaign Tracker tab
- Daily Brief → Notification bell badge
- Ticket Status → Notification bell click
- Luma Affiliate → Avatar dropdown
- Social Lumaway → Content Hub tab

### REQ-PD-03: Pattern Consistency
Each feature MUST use the designated pattern from `m-progressive-triggers.md`:
- Inline Expand: Data Health, Excel Sync
- Side Drawer (320px): Creator Samples
- Slide-Over Panel (480px): Scheduled Report
- Full-Screen Modal: Ratecard Master
- Expandable Card: Goal & Forecast
- Side Panel (responsive): Automation Rules
- Tab Conversion: Promo Studio, Social Lumaway
- Banner + Drawer: Daily Brief
- Modal Drawer: Ticket Status, Luma Affiliate

### REQ-PD-04: Animation Standards
All progressive components MUST use CSS animations from `k-dashstack-tokens` (restyle Section 18):
- Inline: `ds-slide-down/up` (0.2s/0.15s)
- Drawer: `ds-slide-right` (0.22s) + `ds-fade-in/out` (0.15s) for backdrop
- Collapse: `ds-expand/collapse-height` (0.25s/0.2s)
- Fade: `ds-fade-in/out` (0.15s)

### REQ-PD-05: Accessibility
All progressive components MUST meet WCAG 2.1 AA:
- Focus trap when open (modals, drawers)
- Focus returns to trigger on close
- Escape key closes
- `aria-expanded` on triggers
- `aria-controls` linking trigger → panel
- `role="dialog"` + `aria-modal="true"` for modals/drawers
- Screen reader announcements (live region)
- Keyboard navigation (Tab, Escape, arrows)

### REQ-PD-06: Lazy Loading
All progressive content MUST be lazy-loaded via `React.lazy` + `Suspense`:
- Content components loaded only when panel opens
- Skeleton fallback during load
- No bundle size increase for hidden features

### REQ-PD-07: URL State (Optional)
For tab conversions and major panels:
- URL reflects state (`?tab=promo`, `?panel=scheduled-reports`)
- Browser back/forward works
- Deep links work

### REQ-PD-08: Persistence
Sidebar group open/closed state persisted in `localStorage`:
- Key: `lumaway_sidebar_groups` (JSON)
- Per-user, synced across devices via localStorage
- Mobile/desktop sync

### REQ-PD-09: Role-Based Defaults
Sidebar group defaults per role (see `m-group-defaults.md`):
- Admin: Data + Administration
- Creator Manager: Data + AI + Affiliate
- Merchant: Data + Commerce
- Marketing: Data + Growth
- Default: Data + AI + Affiliate

### REQ-PD-10: Mobile Behavior
- Groups closed by default on mobile (<1024px)
- Mobile drawer for sidebar
- Bottom sheet animation for drawers on mobile
- Touch targets ≥ 44×44px

## 3. Non-Functional Requirements

### NFR-PD-01: Performance
- Lazy load all progressive content (`React.lazy`)
- Skeleton fallback during load
- No bundle size increase for hidden features
- Animations 60fps, GPU-accelerated
- Respect `prefers-reduced-motion`

### NFR-PD-02: Bundle Size
- Progressive disclosure components < 5KB gzipped
- No duplicate code across patterns

### NFR-PD-03: Animation Quality
- 60fps sustained
- Smooth easing (cubic-bezier)
- No layout shift during animation

## 4. Acceptance Criteria

| ID | Criterion | Test |
|-----|-----------|------|
| AC-PD-01 | All 28 features accessible | Manual audit + route check |
| AC-PD-02 | Each hidden feature has trigger | Manual audit per `m-progressive-triggers.md` |
| AC-PD-03 | Correct pattern per feature | Visual + code review |
| AC-PD-04 | Animations use design tokens | CSS audit |
| AC-PD-04 | Accessibility passes | axe-core + manual |
| AC-PD-05 | Lazy loading works | Network tab + bundle analyzer |
| AC-PD-06 | Sidebar defaults per role | Role switch test |
| AC-PD-07 | Persistence works | Reload + cross-tab test |
| AC-PD-08 | Mobile touch targets 44px | Playwright mobile |
| AC-PD-09 | `npm run verify` passes | CI |
| AC-PD-10 | `npm run build` passes | CI |

## 5. Traceability

| Requirement | Pattern | Component | Knowledge |
|-------------|---------|-----------|-----------|
| REQ-PD-01 | All | All preserved | `m-sidebar-map.md` |
| REQ-PD-02 | All | Triggers in parent | `m-progressive-triggers.md` |
| REQ-PD-03 | Per feature | `p-*` patterns | `m-progressive-triggers.md` |
| REQ-PD-04 | All | CSS animations | `k-dashstack-tokens.md` |
| REQ-PD-05 | All | `p-*` patterns | `p-progressive-disclosure.md` |
| REQ-PD-06 | All | `React.lazy` | `sk-progressive-ui` |
| REQ-PD-07 | Tabs/Panels | URL sync | `p-tab-conversion.md` |
| REQ-PD-08 | Sidebar | `localStorage` | `sk-sidebar-management` |
| REQ-PD-09 | Sidebar | Role config | `m-group-defaults.md` |
| REQ-PD-10 | All | Responsive CSS | `p-*` patterns |