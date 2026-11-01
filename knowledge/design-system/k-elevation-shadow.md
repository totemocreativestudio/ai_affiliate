---
id: k-elevation-shadow
title: Elevation & Shadow Scale
type: knowledge
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [design-system, elevation, shadow, depth]
relationships:
  - type: implements
    target: k-dashstack-tokens
    description: "Elevation/shadow scale implements token definitions"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Elevation & Shadow Scale

Subtle, layered depth system following DashStack's "light and airy" philosophy. No heavy shadows — only subtle elevation cues.

## Shadow Tokens

| Token | Value | Layers | Blur | Spread | Use Case |
|-------|-------|--------|------|--------|----------|
| `--ds-shadow-sm` | `0 1px 2px rgba(16,24,40,0.05)` | 1 | 2px | 0 | KPI cards, connection pill, subtle elements |
| `--ds-shadow` | `0 1px 3px rgba(16,24,40,0.06), 0 6px 16px rgba(16,24,40,0.05)` | 2 | 3px + 16px | 0 | **Standard cards**, panels, modals, drawers |

## Elevation Levels (Semantic)

| Level | Token | Visual Weight | Use Case |
|-------|-------|---------------|----------|
| 0 (Flat) | none | No shadow | Dividers, flat buttons, inline elements |
| 1 (Subtle) | `--ds-shadow-sm` | Barely visible | KPI cards, pills, connection indicator |
| 2 (Standard) | `--ds-shadow` | Visible but soft | **Cards**, panels, modals, drawers, dropdowns |
| 3 (Modal) | `--ds-shadow` + backdrop | Standard + overlay | Modals, side drawers, full-screen overlays |
| 4 (Focus) | `outline: 2px solid var(--ds-primary)` | Ring only | Focus-visible states (no shadow) |

## Component Shadow Mapping

| Component | Shadow Token | Hover State |
|-----------|--------------|-------------|
| `.card` | `--ds-shadow` | No change (stable) |
| `.dashboard-kpi-card` | `--ds-shadow-sm` | No change |
| `.owner-metric` | `--ds-shadow-sm` | No change |
| `.auth-shell` (login modal) | `0 24px 64px rgba(15,34,82,0.35)` | Custom (stronger) |
| `.sidebar` | `none` (border-right only) | — |
| `.topbar` | `none` (border-bottom only) | — |
| `.dropdown`, `.popover` | `--ds-shadow` | — |
| `.toast` | `--ds-shadow` | — |
| `.tooltip` | `--ds-shadow-sm` | — |
| `.avatar` | `0 4px 12px rgba(72,128,255,0.25)` | Custom (brand glow) |
| `.primary` button | `0 1px 3px rgba(72,128,255,0.35)` | `0 2px 6px rgba(72,128,255,0.4)` |

## Focus Ring (Not Shadow)

```css
/* Focus visible — uses outline ring, not shadow */
*:focus-visible {
  outline: 2px solid var(--ds-primary) !important;
  outline-offset: 2px !important;
}
```

## Color

All shadows use `rgba(16, 24, 40, alpha)` — a neutral near-black (`#101828` at low opacity). **No colored shadows** except:
- Primary button: `rgba(72, 128, 255, alpha)` (brand blue)
- Avatar: `rgba(72, 128, 255, 0.25)` (brand blue)
- Legacy auth shell: `rgba(15, 34, 82, 0.35)` (navy)

## Anti-Patterns (Avoid)

- ❌ Multiple shadow layers on same element (max 2)
- ❌ Heavy shadows (`0 20px 40px`+) — not DashStack style
- ❌ Colored shadows on neutral elements
- ❌ `box-shadow` on interactive elements that already have border/background changes on hover
- ❌ Inner shadows (use background color instead)

## CSS Implementation

```css
:root {
  --ds-shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.05);
  --ds-shadow: 0 1px 3px rgba(16, 24, 40, 0.06), 0 6px 16px rgba(16, 24, 40, 0.05);
}

/* Applied via restyle layer (Section 5) */
body .card {
  box-shadow: var(--ds-shadow) !important;
}
body .dashboard-kpi-card,
body .owner-metric {
  box-shadow: var(--ds-shadow-sm) !important;
}
```

## Migration from Legacy

Legacy had inconsistent shadows:
- `0 4px 18px rgba(16,24,40,.035)` → `--ds-shadow`
- `0 1px 2px rgba(16,24,40,.025)` → `--ds-shadow-sm`
- `0 5px 16px rgba(15,23,42,.12)` → `--ds-shadow`
- `0 6px 18px oklch(65% 0.18 48 / 0.22)` → brand avatar shadow (kept)
- `0 24px 64px rgba(15,34,82,.35)` → auth shell (kept, stronger)
- Many `!important` overrides → unified via restyle layer with `body` prefix specificity