---
id: a-css-layer-strategy
title: CSS Layer Strategy
type: architecture
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [architecture, css, layers, cascade, turbopack]
relationships:
  - type: implements
    target: s-design-spec
    description: "CSS layer strategy implements design spec"
  - type: relates-to
    target: a-shell-architecture
    description: "Related to shell architecture"
  - type: references
    target: k-dashstack-tokens
    description: "References design tokens"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# CSS Layer Strategy — Cascade Management

## Problem

Lumaway has **42 CSS files** in `app/` with heavy legacy `!important` usage. Turbopack (Next.js 16) **does not guarantee chunk order matches import order**, causing the restyle layer to sometimes load BEFORE legacy CSS — losing cascade despite `!important`.

## Solution: Additive Restyle Layer with Specificity Boost

### 1. Single Restyle File
`app/lumaway-dashstack-restyle.css` — contains ALL new design tokens, component overrides, utilities, animations.

### 2. Import LAST in Both Entry Points

```typescript
// app/layout.tsx (root)
import "./lumaway-dashstack-restyle.css";  // Line 16 — LAST

// app/LumawayWorkspaceApp.tsx (workspace)
import "./lumaway-dashstack-restyle.css";  // Line 33 — LAST
```

### 3. Specificity Boost: `body` Prefix on ALL Selectors

Legacy CSS uses `.class { prop: val !important }` → specificity `(0,1,0)`.

Restyle uses `body .class { prop: val !important }` → specificity `(0,1,1)`.

**Result**: Restyle wins regardless of load order.

```css
/* Legacy (loses) */
.card { background: #fff !important; }

/* Restyle (wins) */
body .card { background: var(--ds-card) !important; }
```

### 4. Token-Driven: Single Source of Truth

All values reference `--ds-*` tokens defined in `:root` of restyle file. Calibration = change token once.

## File Inventory (42 CSS Files in `app/`)

### Legacy Design Systems (DO NOT DELETE — additive only)
| File | Purpose | Key `!important` Selectors |
|------|---------|---------------------------|
| `luma-v2.css` | Base v2 styles | — |
| `luma-social.css` | Social features | — |
| `luma-social-extra.css` | Social extras | — |
| `creator360.css` | Creator 360 | — |
| `owner-monitoring.css` | Owner monitoring | — |
| `product-ui.css` | Production UI | `.card`, `html,body`, `.content button` |
| `production-polish.css` | Polish | — |
| `luma-helpdesk.css` | Helpdesk | — |
| `runtime-guard.css` | Runtime guards | — |
| `luma-route-ui-hotfix.css` | Route hotfixes | `html[data-theme="dark"]` |
| `lumaway-auth-v7.css` | Auth v7 | `.auth-v7-primary`, `.auth-v7-tabs` |
| `luma-ops-v4.css` | Ops v4 | `.history-hamburger-trigger`, `.kanban-v5-column` |
| `lumaway-hallmark.css` | Hallmark design system | CSS variables `--lh-*` |
| `luma-layout-standard.css` | Layout standard | — |

### Workspace-Specific (imported in LumawayWorkspaceApp.tsx)
| File | Purpose | Key `!important` Selectors |
|------|---------|---------------------------|
| `luma-production.css` | Production shell | `.sidebar`, `.topbar`, `.content`, `.card`, `.side-nav` |
| `luma-legacy-extra.css` | Legacy extras | `.card`, `.grid`, `.section-head` |
| `luma-helpdesk.css` | Helpdesk (dup) | — |
| `luma-fixes.css` | Fixes | — |
| `luma-responsive.css` | Responsive | `html[data-theme="dark"]` |
| `luma-subscription.css` | Subscription | — |
| `luma-ux-polish.css` | UX polish | `.card`, `.section-head` |
| `luma-final-fixes.css` | Final fixes | `.sidebar`, `.side-group`, `.topbar`, `html[data-theme="dark"]` |
| `lumaway-experience-v2.css` | Experience v2 | — |
| `lumaway-premium-v4.css` | Premium v4 | — |
| `lumaway-visual-system-v5.css` | Visual system v5 | `.dashboard-page`, `.legacy-page-anchor` |
| `lumaway-auth-access-v6.css` | Auth access v6 | — |
| `lumaway-auth-v7.css` | Auth v7 (dup) | — |
| `automation-rules.css` | Automation rules | — |
| `goal-forecast.css` | Goal forecast | — |
| `scheduled-reports.css` | Scheduled reports | — |
| `tutorial-center.css` | Tutorial center | — |
| `live-streaming.css` | Live streaming | `.lpi-kpis` |
| `live-host-session.css` | Live host session | — |
| `live-upload.css` | Live upload | — |
| `live-campaign.css` | Live campaign | — |
| `live-analytics.css` | Live analytics | — |
| `affiliate360-search.css` | Affiliate 360 search | — |
| `live-data-health.css` | Live data health | — |
| `spending-center.css` | Spending center | — |
| `listing-followup-insights.css` | Followup insights | — |
| `listing-followup-queue.css` | Followup queue | — |
| `listing-followup-calendar.css` | Followup calendar | — |
| `listing-quick-message.css` | Quick message | — |
| `listing-contact-readiness.css` | Contact readiness | — |
| `lumaway-ops-pr87.css` | Ops PR87 | `.asp-primary`, `.history-hamburger-trigger` |
| `runtime-guard.css` | Runtime guard (dup) | — |

### New (Additive Only)
| File | Purpose |
|------|---------|
| `lumaway-dashstack-restyle.css` | **DashStack restyle layer** — tokens, overrides, utilities, animations |

## Turbopack Chunk Order Issue

### Observed Behavior
- Turbopack splits CSS into chunks (e.g., `1y7-bddr_0gj3.css`, `2pcszzuv_fk3h.css`)
- Chunk order in HTML `<link>` tags ≠ import order in source
- Restyle chunk can appear BEFORE legacy chunks

### Verification
```bash
# Check production for restyle tokens
curl -s https://app.lumaway.online/login | grep -o '/_next/static/[^"]*\.css' | xargs -I{} curl -s "https://app.lumaway.online{}" | grep -c '--ds-primary'
# Returns: 1 chunk contains --ds-primary
```

### Fix Applied
1. `body` prefix on all restyle selectors (specificity boost)
2. Import LAST in both entry points
3. `!important` on all restyle properties (matches legacy)

## Migration Rules

1. **Never delete legacy CSS** — additive only
2. **Never edit legacy CSS** — override in restyle layer
3. **All new tokens** → `--ds-*` in restyle `:root`
4. **All new overrides** → `body .selector { prop: var(--ds-*) !important; }`
5. **All new utilities** → `body .utility-class { ... !important; }`
5. **Animations** → `@keyframes ds-*` + `body .ds-* { animation: ds-* ... }`

## Verification Checklist

- [ ] Restyle imported LAST in `app/layout.tsx`
- [ ] Restyle imported LAST in `app/LumawayWorkspaceApp.tsx`
- [ ] All restyle selectors have `body` or `html body` prefix
- [ ] All restyle properties have `!important`
- [ ] Tokens defined in restyle `:root`
- [ ] `npm run verify` passes
- [ ] `npm run build` passes
- [ ] Playwright: login page shows DashStack blue button, 14px base font