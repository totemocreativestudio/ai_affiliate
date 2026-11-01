---
id: s-design-spec
title: Design Specification — Lumaway Workspace
type: spec
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [spec, design, requirements, dashstack]
relationships:
  - type: decides
    target: d-001-dashstack-adoption
    description: "Design spec decided by dashstack adoption ADR"
  - type: governs
    target: d-004-no-feature-deletion
    description: "Design spec governed by no feature deletion decision"
  - type: implements
    target: a-shell-architecture
    description: "Shell architecture implements this spec"
  - type: implements
    target: a-css-layer-strategy
    description: "CSS layer strategy implements this spec"
  - type: implements
    target: k-dashstack-tokens
    description: "Tokens implement this spec"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Design Specification — Lumaway Workspace (DashStack Edition)

## 1. Scope

Complete visual and interaction specification for the Lumaway workspace application. Based on **DashStack — Free Admin Dashboard UI Kit** (Figma Community). Implemented via additive CSS restyle layer (`app/lumaway-dashstack-restyle.css`).

## 2. Design Tokens (Normative)

All values defined in `k-dashstack-tokens.md` and implemented in `app/lumaway-dashstack-restyle.css` Section 0 (`:root`).

### 2.1 Color
| Token | Value | Requirement |
|-------|-------|-------------|
| `--ds-bg` | `#f7f8fa` | Page background |
| `--ds-card` | `#ffffff` | All elevated surfaces |
| `--ds-line` | `#e6eaf1` | Primary borders |
| `--ds-line-soft` | `#eef1f6` | Subtle borders |
| `--ds-ink` | `#141b2d` | Body text |
| `--ds-ink-head` | `#101828` | Headings |
| `--ds-muted` | `#667085` | Secondary text |
| `--ds-muted-2` | `#98a2b3` | Tertiary text |
| `--ds-primary` | `#4880ff` | Primary actions, focus, active |
| `--ds-primary-hover` | `#3a6ef0` | Primary hover/active |
| `--ds-primary-soft` | `#ecf2ff` | Selected backgrounds |
| `--ds-success` | `#12b76a` | Success states |
| `--ds-warning` | `#f79009` | Warning states |
| `--ds-danger` | `#f04438` | Danger states |
| `--ds-info` | `#0ea5e9` | Info states |

### 2.2 Spacing (4px Grid)
| Token | Value |
|-------|-------|
| `--ds-space-1` | 4px |
| `--ds-space-2` | 8px |
| `--ds-space-3` | 12px |
| `--ds-space-4` | 16px |
| `--ds-space-5` | 20px |
| `--ds-space-6` | 24px |
| `--ds-space-8` | 32px |
| `--ds-space-10` | 40px |
| `--ds-space-12` | 48px |

### 2.3 Typography
| Token | Value | Line Height |
|-------|-------|-------------|
| `--ds-text-xs` | 12px | 1.5 |
| `--ds-text-sm` | 13px | 1.65 |
| `--ds-text-base` | 14px | 1.65 |
| `--ds-text-lg` | 16px | 1.5 |
| `--ds-text-xl` | 18px | 1.4 |
| `--ds-text-2xl` | 22px | 1.3 |
| `--ds-text-3xl` | 28px | 1.25 |
| `--ds-text-4xl` | 34px | 1.2 |

### 2.4 Border Radius
| Token | Value |
|-------|-------|
| `--ds-radius` | 16px |
| `--ds-radius-sm` | 10px |

### 2.5 Elevation
| Token | Value |
|-------|-------|
| `--ds-shadow-sm` | `0 1px 2px rgba(16,24,40,0.05)` |
| `--ds-shadow` | `0 1px 3px rgba(16,24,40,0.06), 0 6px 16px rgba(16,24,40,0.05)` |

## 3. Component Specifications

### 3.1 Shell

| Component | Spec |
|-----------|------|
| **Sidebar** | Fixed left, 264px (desktop), collapsible 72px, mobile drawer max 304px. White (`--ds-card`), border-right `--ds-line`. Brand top, nav groups collapsible, user bottom. |
| **Topbar** | Sticky top, 66px height. White, border-bottom `--ds-line`. Left: kicker + title. Right: PWA, tasks, notifications, connection pill. |
| **Content** | Max-width 1480px, centered. Padding 26px/30px/64px. Base font 14px, line-height 1.65. |

### 3.2 Navigation

| Element | Spec |
|---------|------|
| **Nav Item** | Min-height 40px, padding 9px 11px, radius 10px, font 13px weight 600. Hover: `--ds-line` bg. Active: `--ds-primary-soft` bg, `--ds-primary` text, icon bg `--ds-primary`. |
| **Group Label** | 9px, letter-spacing 0.14em, color `#9aa4b4`, padding 14px 10px 7px. |
| **Sub-nav** | Indented 36px, gap 0, radius 8px. |

### 3.3 Buttons

| Variant | Spec |
|---------|------|
| **Primary** | Bg `--ds-primary`, text white, weight 700, radius 10px, shadow `0 1px 3px rgba(72,128,255,0.35)`. Hover: `--ds-primary-hover`, shadow `0 2px 6px rgba(72,128,255,0.4)`. No transform. |
| **Secondary** | White, border `--ds-line-strong`, radius 10px, text `--ds-ink`. |
| **Ghost** | Transparent, text `--ds-primary`, radius 10px. |
| **Danger** | Bg `--ds-danger`, text white. |

### 3.4 Inputs

| State | Spec |
|-------|------|
| **Default** | Bg `--ds-card`, border `#d5dbe7`, radius 10px, padding 12px 16px, font 13px. |
| **Focus** | Outline `2px solid rgba(72,128,255,0.35)`, offset 1px, border `--ds-primary`. |
| **Error** | Border `--ds-danger`, focus ring `--ds-danger`. |

### 3.5 Tables

| Element | Spec |
|---------|------|
| **Header** | Bg `#f7f8fa`, text `#67728a`, weight 750, letter-spacing 0.03em, font 13px. |
| **Cells** | Padding 12px 16px, border `--ds-line-soft`, font 13px. |
| **Hover** | Bg `#f8fafd`. |
| **Selected** | Border `--ds-primary`, bg `--ds-primary-soft`. |

### 3.6 Cards

| Property | Spec |
|----------|------|
| **Background** | `--ds-card` |
| **Border** | 1px `--ds-line` |
| **Radius** | `--ds-radius` (16px) |
| **Shadow** | `--ds-shadow` |
| **Padding** | `--ds-space-5` (20px) |

### 3.7 Status Pills

| Status | Background | Text |
|--------|------------|------|
| Paid/Success | `--ds-success-soft` | `#027a48` |
| Pending | `--ds-warning-soft` | `#b25e02` |
| Failed/Danger | `--ds-danger-soft` | `#b42318` |
| Processing/Info | `--ds-info-soft` | `#026aa2` |

### 3.8 Empty State

| Element | Spec |
|---------|------|
| **Container** | Centered flex column, padding 40px/24px, border dashed `--ds-line`, radius 16px. |
| **Icon** | 48px, `--ds-muted-2`. |
| **Title** | 18px, `--ds-ink-head`. |
| **Description** | 13px, `--ds-muted`, max-width 280px. |
| **Action** | Primary button, margin-top 16px. |

### 3.9 Scrollbar

| Part | Spec |
|------|------|
| **Width** | 8px |
| **Track** | Transparent |
| **Thumb** | `--ds-line`, radius 4px, 2px transparent border (content-box) |
| **Hover** | `--ds-muted-2` |

### 3.10 Focus Visible

| Element | Spec |
|---------|------|
| **All focusable** | Outline `2px solid --ds-primary`, offset 2px. |

### 3.11 Touch Targets (Mobile)

| Element | Minimum |
|---------|---------|
| **All interactive** | 44×44px (`@media (pointer: coarse)`) |

## 4. Progressive Disclosure Spec

See `s-progressive-disclosure-spec.md` for detailed requirements.

## 5. Layout & Typography Spec

See `s-layout-typography-spec.md` for detailed requirements.

## 6. Accessibility Requirements (WCAG 2.1 AA)

| Requirement | Target |
|-------------|--------|
| **Color Contrast** | 4.5:1 text, 3:1 UI components |
| **Focus Visible** | All interactive elements |
| **Keyboard Navigation** | All functionality |
| **Screen Reader** | ARIA labels, roles, live regions |
| **Reduced Motion** | Respect `prefers-reduced-motion` |
| **Touch Targets** | 44×44px minimum |

## 7. Browser Support

| Browser | Version |
|---------|---------|
| Chrome | ≥ 110 |
| Firefox | ≥ 110 |
| Safari | ≥ 16 |
| Edge | ≥ 110 |

## 8. Performance Budgets

| Metric | Budget |
|--------|--------|
| **CSS Size** | < 100KB gzipped (restyle layer) |
| **Font Size** | ~31KB (Nunito Sans variable) |
| **Animations** | 60fps, GPU-accelerated |
| **CLS** | < 0.1 |

## 9. Acceptance Criteria

| ID | Criterion | Test Method |
|----|-----------|-------------|
| AC-01 | Login page shows DashStack blue primary button | Playwright: `.auth-v7-primary` bg = `rgb(72,128,255)` |
| AC-02 | Body font is Nunito Sans 14px | Playwright: `font-family` contains "Nunito Sans", `font-size` = 14px |
| AC-03 | Page background is `#f7f8fa` | Playwright: `body` bg = `rgb(247,248,250)` |
| AC-04 | Sidebar is white with blue active item | Visual + CSS check |
| AC-05 | Cards have 16px radius, subtle shadow | Visual + CSS check |
| AC-06 | Tables have 13px cells, hover `#f8fafd` | Visual + CSS check |
| AC-07 | All 42 CSS files migrated (no legacy violet) | HSL scan = 0 violet saturations |
| AC-08 | `npm run verify` passes | CI |
| AC-09 | `npm run build` passes | CI |
| AC-10 | Progressive disclosure patterns work | Manual + Playwright |
| AC-11 | Touch targets ≥ 44px on mobile | Playwright mobile viewport |
| AC-12 | Focus visible on all interactive | Keyboard navigation test |

## 10. Migration Complete (2026-11-01)

- ✅ 1,275 color values migrated across 42 files
- ✅ 889 micro-typography rules raised to ≥12px
- ✅ Restyle layer imported LAST with `body` prefix specificity
- ✅ All legacy CSS preserved (additive only)
- ✅ PWA cache v7
- ✅ All gates passing