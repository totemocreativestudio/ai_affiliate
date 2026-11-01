---
id: d-001-dashstack-adoption
title: Adopt DashStack UI Kit as Design System
type: decision
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [decision, design-system, dashstack, adoption]
relationships:
  - type: decides
    target: s-design-spec
    description: "Decides on design specification approach"
  - type: governs
    target: k-dashstack-tokens
    description: "Governs token definitions"
  - type: governs
    target: a-shell-architecture
    description: "Governs shell architecture"
governance:
  review-cycle: 365d
  last-reviewed: 2026-11-01
---

# ADR 001: Adopt DashStack UI Kit as Design System

## Context

Lumaway workspace has accumulated 42 CSS files with inconsistent design tokens:
- Multiple conflicting color systems (violet, coral, navy, indigo)
- Inconsistent spacing (10px, 12px, 14px, 16px, 18px, 20px, 22px, 24px...)
- Micro-typography (889 rules < 10px, down to 6px)
- Multiple font families (DM Sans, Inter, system-ui)
- Heavy `!important` usage blocking cascade
- Turbopack chunk order non-deterministic

Owner provided reference: **DashStack — Free Admin Dashboard UI Kit** (Figma Community, by Seju).

## Decision

**Adopt DashStack UI Kit as the single design system** for Lumaway workspace.

### Design Token Mapping

| DashStack | Lumaway Token | Value |
|-----------|---------------|-------|
| Primary Blue | `--ds-primary` | `#4880FF` |
| Page Background | `--ds-bg` | `#f7f8fa` |
| Card Surface | `--ds-card` | `#ffffff` |
| Border | `--ds-line` | `#e6eaf1` |
| Text Primary | `--ds-ink` | `#141b2d` |
| Text Heading | `--ds-ink-head` | `#101828` |
| Font | `--font-nunito` | Nunito Sans (variable) |
| Spacing Base | `--ds-space-1` | 4px |
| Radius Card | `--ds-radius` | 16px |
| Radius Small | `--ds-radius-sm` | 10px |

### Legacy Token Migration (Complete 2026-11-01)

| Legacy Token | File | Migrated To |
|--------------|------|-------------|
| `--luma` (oklch 65% 0.18 48) | `luma-production.css` | `--ds-primary` |
| `--luma-deep` (oklch 55% 0.16 48) | `luma-production.css` | `--ds-primary-hover` |
| `--luma-soft` (oklch 96% 0.05 48) | `luma-production.css` | `--ds-primary-soft` |
| `--ui-accent` | `product-ui.css` | `--ds-primary` |
| `--ui-accent-soft` | `product-ui.css` | `--ds-primary-soft` |
| `--lw4-violet` | `lumaway-premium-v4.css` | `--ds-primary` |
| `--lwv5-violet` | `lumaway-visual-system-v5.css` | `--ds-primary` |
| `--lwv5-purple` | `lumaway-visual-system-v5.css` | `--ds-primary` |
| `--lh-accent` | `lumaway-hallmark.css` | `--ds-primary` |
| `--lh-focus` | `lumaway-hallmark.css` | `--ds-primary` |
| `--lwv5-orange` (`#ff9f43`) | `lumaway-visual-system-v5.css` | `--ds-primary` light (`#6e9aff`) |

**Total: 1,275 values across 42 files migrated via HSL-gated sweep.**

### Font Decision

- **Primary**: Nunito Sans (DashStack brand font)
- **Delivery**: Self-hosted variable font (`public/fonts/nunito-sans-latin-vf.woff2`, ~31KB, wght 200–1000)
- **Reason**: `next/font/google` incompatible with Turbopack in Next.js 16; self-host avoids third-party requests
- **Fallback**: Inter → system UI stack

### Implementation Strategy

**Additive CSS Restyle Layer** (`app/lumaway-dashstack-restyle.css`):
1. New file — **no legacy CSS deleted or modified**
2. Imported **LAST** in both `app/layout.tsx` and `app/LumawayWorkspaceApp.tsx`
3. All selectors prefixed with `body` / `html body` for specificity (0,1,1) > legacy (0,1,0)
4. All properties use `!important` matching legacy
5. Tokens defined in `:root` for single-source calibration

### Turbopack Cascade Fix

**Problem**: Turbopack does not guarantee CSS chunk order matches import order. Restyle layer could load before legacy `!important` rules.

**Solution**: Specificity boost via `body` prefix:
```css
/* Legacy: (0,1,0) */
.card { background: #fff !important; }

/* Restyle: (0,1,1) — wins regardless of load order */
body .card { background: var(--ds-card) !important; }
```

### PWA Cache Version

Bumped `CACHE_VERSION` from v6 → v7 in `public/sw.js` to ensure clients refresh shell.

### Consequences

**Positive:**
- Single source of truth for all design tokens
- Consistent visual language across 42 CSS files
- 889 micro-typography rules raised to readable minimum (12px)
- 4px spacing grid brings rhythm
- Nunito Sans brings DashStack character
- Additive — zero risk of breaking legacy features
- Reversible (delete one file)

**Negative:**
- Added CSS file (~3KB gzipped)
- `body` prefix on all selectors (minor verbosity)
- Must maintain import order discipline
- Legacy CSS still loads (additive)

### Alternatives Considered

1. **Edit legacy CSS in place** — Rejected: 42 files, high risk, hard to review, Turbopack order issue persists
2. **CSS Modules / Styled Components** — Rejected: Major rewrite, not compatible with current architecture
3. **Tailwind CSS** — Rejected: Would require full migration, conflicts with existing CSS
4. **Delete unused CSS** — Rejected: Owner directive "no deletion", features "not yet used" not "unused"

## Status

**Approved** — Implemented 2026-11-01 via PR #190 + #191 + follow-up commits.

## Links

- Spec: `s-design-spec.md`
- Tokens: `k-dashstack-tokens.md`
- Architecture: `a-shell-architecture.md`, `a-css-layer-strategy.md`
- Migration log: `masalah/context.md`
- PRs: #190 (layer), #191 (cascade fix + full migration), #192 (layout/typography)