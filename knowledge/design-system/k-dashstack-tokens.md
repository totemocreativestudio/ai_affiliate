---
id: k-dashstack-tokens
title: DashStack Design Tokens
type: knowledge
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [design-system, tokens, dashstack, css-variables]
relationships:
  - type: implements
    target: s-design-spec
    description: "Tokens implement design specification"
  - type: references
    target: sk-dashstack-restyle
    description: "Referenced by dashstack restyle skill"
  - type: implements
    target: k-color-palette
    description: "Implements color palette definitions"
  - type: implements
    target: k-spacing-scale
    description: "Implements spacing scale"
  - type: implements
    target: k-typography-scale
    description: "Implements typography scale"
  - type: implements
    target: k-elevation-shadow
    description: "Implements elevation/shadow scale"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# DashStack Design Tokens — Single Source of Truth

All design tokens for the Lumaway workspace. Defined as CSS custom properties in `app/lumaway-dashstack-restyle.css` (Section 0). **This is the authoritative source** — do not duplicate values in other files.

## Color Primitives

| Token | Value | Usage | Contrast (WCAG AA) |
|-------|-------|-------|-------------------|
| `--ds-bg` | `#f7f8fa` | Page background | — |
| `--ds-card` | `#ffffff` | Cards, sidebar, topbar, modals | — |
| `--ds-line` | `#e6eaf1` | Primary borders (cards, tables, inputs) | — |
| `--ds-line-soft` | `#eef1f6` | Subtle borders (table rows, dividers) | — |
| `--ds-ink` | `#141b2d` | Body text | 12.6:1 on bg |
| `--ds-ink-head` | `#101828` | Headings (h1–h3) | 14.2:1 on bg |
| `--ds-muted` | `#667085` | Secondary text, labels | 4.8:1 on bg |
| `--ds-muted-2` | `#98a2b3` | Tertiary text, placeholders | 3.2:1 on bg |

## Accent Colors (DashStack Blue #4880FF)

| Token | Value | Usage | State |
|-------|-------|-------|-------|
| `--ds-primary` | `#4880ff` | Primary buttons, active nav, focus rings | Default |
| `--ds-primary-hover` | `#3a6ef0` | Primary button hover, pressed | Hover/Active |
| `--ds-primary-soft` | `#ecf2ff` | Active nav background, selected chips | Subtle bg |

## Semantic Colors (Unchanged from Legacy)

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-success` | `#12b76a` | Paid status, success states |
| `--ds-success-soft` | `#ecfdf3` | Success background |
| `--ds-warning` | `#f79009` | Pending status, warnings |
| `--ds-warning-soft` | `#fef4e6` | Warning background |
| `--ds-danger` | `#f04438` | Failed status, errors |
| `--ds-danger-soft` | `#fef3f2` | Danger background |
| `--ds-info` | `#0ea5e9` | Processing status, info |
| `--ds-info-soft` | `#f0f9ff` | Info background |

## Spacing Scale (4px Grid)

| Token | Value | Rem | Usage |
|-------|-------|-----|-------|
| `--ds-space-1` | `4px` | 0.25rem | Micro gap, icon padding |
| `--ds-space-2` | `8px` | 0.5rem | Small gap, chip padding |
| `--ds-space-3` | `12px` | 0.75rem | Standard gap, table cell padding |
| `--ds-space-4` | `16px` | 1rem | Card padding, section gap |
| `--ds-space-5` | `20px` | 1.25rem | Card internal padding |
| `--ds-space-6` | `24px` | 1.5rem | Section margin, grid gap |
| `--ds-space-8` | `32px` | 2rem | Page section spacing |
| `--ds-space-10` | `40px` | 2.5rem | Large section spacing |
| `--ds-space-12` | `48px` | 3rem | Major layout spacing |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-radius` | `16px` | Cards, panels, modals, empty states |
| `--ds-radius-sm` | `10px` | Buttons, inputs, nav items, chips |

## Elevation (Shadow)

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-shadow-sm` | `0 1px 2px rgba(16,24,40,0.05)` | KPI cards, connection pill, subtle |
| `--ds-shadow` | `0 1px 3px rgba(16,24,40,0.06), 0 6px 16px rgba(16,24,40,0.05)` | Standard cards, panels |

## Typography Scale

| Token | Value | Line Height | Usage |
|-------|-------|-------------|-------|
| `--ds-text-xs` | `12px` | 1.5 | Small labels, timestamps, badges |
| `--ds-text-sm` | `13px` | 1.5 | Body text, table cells, form labels |
| `--ds-text-base` | `14px` | 1.65 | **Base body text** (default) |
| `--ds-text-lg` | `16px` | 1.5 | Large body, card titles |
| `--ds-text-xl` | `18px` | 1.4 | h3, section heads |
| `--ds-text-2xl` | `22px` | 1.3 | h2, page subheadings |
| `--ds-text-3xl` | `28px` | 1.25 | h1, page titles |
| `--ds-text-4xl` | `34px` | 1.2 | Hero, dashboard hero |

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-leading-tight` | `1.25` | Headings |
| `--ds-leading-normal` | `1.5` | UI text, buttons |
| `--ds-leading-relaxed` | `1.65` | **Body text** (default) |

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-z-dropdown` | `100` | Dropdown menus |
| `--ds-z-sticky` | `200` | Sticky headers, topbar |
| `--ds-z-sidebar` | `300` | Sidebar |
| `--ds-z-modal-backdrop` | `400` | Modal backdrops |
| `--ds-z-modal` | `500` | Modals, drawers |
| `--ds-z-toast` | `600` | Toasts, notifications |
| `--ds-z-tooltip` | `700` | Tooltips |

## Breakpoints (CSS-only, defined in media queries)

| Name | Value | Usage |
|------|-------|-------|
| `mobile` | `<= 640px` | Single column, stacked |
| `tablet` | `641px – 1024px` | 2-col grids, sidebar collapsible |
| `desktop` | `1025px – 1280px` | Standard layout |
| `wide` | `> 1280px` | 4-col KPI grid, full sidebar |

## Font Stack

```css
font-family: "Nunito Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

- **Primary**: Nunito Sans (self-hosted variable font, `public/fonts/nunito-sans-latin-vf.woff2`, wght 200–1000)
- **Fallback**: Inter → system UI stack
- **Loaded via**: `@font-face` in `lumaway-dashstack-restyle.css` Section 0

## Usage Rules

1. **Never hardcode values** — always use tokens
2. **Token naming**: `--ds-{category}-{variant}` (kebab-case)
3. **Color tokens**: semantic names, not color names (e.g., `--ds-primary` not `--ds-blue`)
4. **Spacing**: always use `--ds-space-*` scale
4. **Typography**: use `--ds-text-*` + `--ds-leading-*`
5. **Border radius**: only `--ds-radius` or `--ds-radius-sm`
6. **Shadows**: only `--ds-shadow-sm` or `--ds-shadow`

## Migration Reference

Legacy tokens mapped to DashStack (see `d-001-dashstack-adoption`):

| Legacy Token | File | Mapped To |
|--------------|------|-----------|
| `--luma` (oklch 65% 0.18 48) | `luma-production.css` | `--ds-primary` |
| `--luma-deep` (oklch 55% 0.16 48) | `luma-production.css` | `--ds-primary-hover` |
| `--luma-soft` (oklch 96% 0.05 48) | `luma-production.css` | `--ds-primary-soft` |
| `--ui-accent` (oklch 65% 0.18 48) | `product-ui.css` | `--ds-primary` |
| `--ui-accent-soft` (oklch 96% 0.05 48) | `product-ui.css` | `--ds-primary-soft` |
| `--lw4-violet` | `lumaway-premium-v4.css` | `--ds-primary` |
| `--lwv5-violet` | `lumaway-visual-system-v5.css` | `--ds-primary` |
| `--lwv5-purple` | `lumaway-visual-system-v5.css` | `--ds-primary` |
| `--lh-accent` | `lumaway-hallmark.css` | `--ds-primary` |
| `--lh-focus` | `lumaway-hallmark.css` | `--ds-primary` |
| `--lwv5-orange` (`#ff9f43`) | `lumaway-visual-system-v5.css` | `--ds-primary` light (`#6e9aff`) |

Full migration log: 1,275 values across 42 files (see `masalah/context.md`).