---
id: d-002-progressive-disclosure
title: Implement Progressive Disclosure for All Secondary Features
type: decision
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [decision, progressive, disclosure, ui, ux]
relationships:
  - type: decides
    target: s-progressive-disclosure-spec
    description: "Decides on progressive disclosure specification"
  - type: governs
    target: p-progressive-disclosure
    description: "Governs base pattern implementation"
  - type: governs
    target: p-inline-expand
    description: "Governs inline expand pattern"
  - type: governs
    target: p-drawer-pattern
    description: "Governs drawer pattern"
  - type: governs
    target: p-modal-pattern
    description: "Governs modal pattern"
  - type: governs
    target: p-collapse-pattern
    description: "Governs collapse pattern"
  - type: governs
    target: p-tab-conversion
    description: "Governs tab conversion pattern"
governance:
  review-cycle: 365d
  last-reviewed: 2026-11-01
---

# ADR 002: Implement Progressive Disclosure for All Secondary Features

## Context

Lumaway sidebar has 28 features in 8 groups. Many features are:
- Secondary workflows (used by < 30% of users daily)
- Context-dependent (only relevant when viewing specific data)
- Advanced/power-user (automation, forecasting, scheduling)
- Occasional (billing, settings, reports)

Current state: All 28 features visible in sidebar simultaneously → cognitive overload, sidebar height issues, difficult discovery.

Owner requirement: "Tidak ada yang dihapus" (nothing deleted) — all features preserved.

## Decision

**Implement Progressive Disclosure for all secondary features** using 5 patterns mapped per feature.

### Pattern Assignment (Per `m-progressive-triggers.md`)

| Feature | Pattern | Trigger Location |
|---------|---------|------------------|
| Data Health | Inline Expand | Database row 🩺 |
| Excel Sync | Inline Expand | Upload Center row 📊 |
| Tutorial | Modal Drawer | Help dropdown / onboarding |
| Creator Samples | Side Drawer (320px) | Affiliate 360 row click |
| Ratecard Master | Full-Screen Modal | Product Master/Listings header |
| Scheduled Report | Slide-Over Panel (480px) | Campaign Tracker / AI Analytics toolbar |
| Goal & Forecast | Expandable Card | Dashboard KPI header toggle |
| Automation Rules | Side Panel (responsive) | Dashboard header button |
| Promo Studio | Tab Conversion | Campaign Tracker tab |
| Daily Brief | Banner + Drawer | Notification bell badge |
| Ticket Status | Modal Drawer | Notification bell click |
| Luma Affiliate | Modal Drawer | Avatar dropdown |
| Social Lumaway | Tab Conversion | Content Hub tab |

### Pattern Definitions (Governed by this ADR)

| Pattern | Spec | Component |
|---------|------|-----------|
| Inline Expand | `p-inline-expand` | `ProgressivePanel` |
| Side Drawer | `p-drawer-pattern` (sm) | `ProgressiveDrawer` |
| Slide-Over Panel | `p-drawer-pattern` (lg) | `ProgressiveDrawer` |
| Full-Screen Modal | `p-drawer-pattern` (full) | `ProgressiveDrawer` |
| Modal Drawer | `p-drawer-pattern` (centered) | `ProgressiveDrawer` |
| Expandable Card | `p-collapse-pattern` | `ExpandableCard` |
| Side Panel | `p-drawer-pattern` (responsive) | `ProgressiveDrawer` |
| Tab Conversion | `p-tab-conversion` | `TabContainer` |
| Banner + Drawer | Composite | `ProgressivePanel` + `ProgressiveDrawer` |

### Implementation Requirements (Governed by `s-progressive-disclosure-spec.md`)

1. **All features preserved** — no deletion, routes intact
2. **Correct pattern per feature** — per `m-progressive-triggers.md`
3. **Animations from design tokens** — `k-dashstack-tokens` Section 18
4. **Accessibility** — WCAG 2.1 AA (focus trap, ARIA, keyboard)
5. **Lazy loading** — `React.lazy` + `Suspense`
6. **Lazy loading** — `React.lazy` + `Suspense`
7. **URL state** for tabs/panels (optional)
8. **Persistence** — `localStorage` for sidebar groups
9. **Role-based defaults** — per `m-group-defaults.md`
10. **Mobile** — touch targets 44px, bottom sheets

### Skill Implementation

Three reusable skills created:
- `sk-progressive-ui` — Drawer, Panel, Collapse components
- `sk-sidebar-management` — Defaults, persistence, role config
- `sk-dashstack-restyle` — Tokens, animations, utilities

## Consequences

**Positive:**
- Sidebar decluttered (2 primary groups open, 5 secondary closed by default)
- All 28 features preserved and accessible
- Contextual triggers improve discoverability
- Consistent patterns reduce learning curve
- Lazy loading reduces initial bundle
- Reusable skills for future features

**Negative:**
- Added complexity (5 patterns, 14 trigger implementations)
- Must maintain trigger visibility (don't hide too deep)
- URL state sync for tabs/panels adds complexity
- Mobile/desktop parity testing required

## Alternatives Considered

1. **Delete unused features** — Rejected: Owner directive "tidak ada yang dihapus"
2. **Accordion sidebar only** — Rejected: Doesn't solve contextual triggers, some features need more space
3. **Mega-menu** — Rejected: Same cognitive load, just hidden differently
4. **Search-only navigation** — Rejected: Discovery suffers, power users need muscle memory

## Status

**Approved** — Implementation in progress via PR #192+ follow-ups.

## Links

- Spec: `s-progressive-disclosure-spec.md`
- Patterns: `p-progressive-disclosure.md`, `p-inline-expand.md`, `p-drawer-pattern.md`, `p-modal-pattern.md`, `p-collapse-pattern.md`, `p-tab-conversion.md`
- Mapping: `m-progressive-triggers.md`, `m-sidebar-map.md`, `m-group-defaults.md`
- Skills: `sk-progressive-ui`, `sk-sidebar-management`, `sk-dashstack-restyle`