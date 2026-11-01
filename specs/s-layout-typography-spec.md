---
id: s-layout-typography-spec
title: Layout & Typography Specification
type: spec
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [spec, layout, typography, spacing, grid]
relationships:
  - type: extends
    target: s-design-spec
    description: "Extends base design spec with layout/typography details"
  - type: implements
    target: k-spacing-scale
    description: "Layout implements spacing scale"
  - type: implements
    target: k-typography-scale
    description: "Typography implements typography scale"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Layout & Typography Specification

## 1. Purpose

Detailed requirements for spacing grid, typography scale, vertical rhythm, and component layout structures. Extends `s-design-spec.md` §2–3.

## 2. Spacing Grid (4px Base)

### 2.1 Token Requirements

| Token | Value | Requirement |
|-------|-------|-------------|
| `--ds-space-1` | 4px | Micro gaps, icon padding |
| `--ds-space-2` | 8px | Small gaps, chip padding |
| `--ds-space-3` | 12px | Table cells, form gaps |
| `--ds-space-4` | 16px | **Standard card padding, grid gaps** |
| `--ds-space-5` | 20px | Card internal padding |
| `--ds-space-6` | 24px | Section margins, page grid gaps |
| `--ds-space-8` | 32px | Major sections |
| `--ds-space-10` | 40px | Large sections |
| `--ds-space-12` | 48px | Hero spacing |

### 2.2 Usage Rules

- **REQ-LT-01**: All margins, padding, gaps MUST use `--ds-space-*` tokens
- **REQ-LT-02**: No arbitrary pixel values (10px, 18px, 22px, etc.)
- **REQ-LT-03**: No raw rem/em for spacing
- **REQ-LT-04**: Default card padding = `--ds-space-5` (20px)
- **REQ-LT-05**: Default grid/section gap = `--ds-space-4` (16px)
- **REQ-LT-06**: Default section margin = `--ds-space-6` (24px)

### 2.3 Component Spacing Map

| Component | Padding | Gap | Margin |
|-----------|---------|-----|--------|
| `.card` | `--ds-space-5` | — | — |
| `.kpi-grid` | — | `--ds-space-4` | — |
| `.dashboard-grid` | — | `--ds-space-4` | — |
| `.section-head` | — | `--ds-space-3` | `mb: --ds-space-4` |
| `.page-head` | `pb: --ds-space-4` | `--ds-space-4` | `mb: --ds-space-6` |
| `table td, th` | `--ds-space-3` vertical, `--ds-space-4` horizontal | — | — |
| `.button` | `--ds-space-3` vertical, `--ds-space-4` horizontal | `--ds-space-2` | — |
| `.input` | `--ds-space-3` vertical, `--ds-space-4` horizontal | — | — |
| `.empty-state` | `--ds-space-10` vertical, `--ds-space-6` horizontal | `--ds-space-3` | — |

## 3. Typography Scale

### 3.1 Token Requirements

| Token | Size | Line Height | Weight | Requirement |
|-------|------|-------------|--------|-------------|
| `--ds-text-xs` | 12px | 1.5 | 500 | Labels, badges, timestamps |
| `--ds-text-sm` | 13px | 1.65 | 500 | **Table cells, form labels, body secondary** |
| `--ds-text-base` | 14px | 1.65 | 500 | **Body text default** |
| `--ds-text-lg` | 16px | 1.5 | 600 | Card titles, emphasized body |
| `--ds-text-xl` | 18px | 1.4 | 600 | h3, section heads |
| `--ds-text-2xl` | 22px | 1.3 | 700 | h2, page subheadings |
| `--ds-text-3xl` | 28px | 1.25 | 800 | h1, page titles |
| `--ds-text-4xl` | 34px | 1.2 | 800 | Hero |

### 3.2 Line Height Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-leading-tight` | 1.25 | Headings |
| `--ds-leading-normal` | 1.5 | UI text, buttons, labels |
| `--ds-leading-relaxed` | 1.65 | **Body text default** |

### 3.3 Vertical Rhythm Requirements

- **REQ-LT-07**: Body text line-height = 1.65 (`--ds-leading-relaxed`)
- **REQ-LT-08**: Heading line-height = 1.25 (`--ds-leading-tight`)
- **REQ-LT-09**: Paragraph spacing: `margin-top: --ds-space-4` (16px) between paragraphs
- **REQ-LT-10**: Heading margins: h2 `--ds-space-8`, h3 `--ds-space-6`, h4 `--ds-space-5`
- **REQ-LT-11**: List spacing: `margin-top: --ds-space-3`, padding-left `--ds-space-5`

### 3.4 CSS Implementation (Restyle Layer Section 9)

```css
html body { font-size: var(--ds-text-base) !important; line-height: var(--ds-leading-relaxed) !important; }
.content { font-size: var(--ds-text-base) !important; line-height: var(--ds-leading-relaxed) !important; }
.content p, .content li, .content td, .content th, .content label { font-size: var(--ds-text-sm) !important; line-height: var(--ds-leading-relaxed) !important; }
.content h1 { font-size: var(--ds-text-4xl) !important; line-height: var(--ds-leading-tight) !important; }
.content h2 { font-size: var(--ds-text-2xl) !important; line-height: var(--ds-leading-tight) !important; }
.content h3 { font-size: var(--ds-text-xl) !important; line-height: var(--ds-leading-tight) !important; }
.content h4 { font-size: var(--ds-text-lg) !important; line-height: var(--ds-leading-normal) !important; }
.content small { font-size: var(--ds-text-xs) !important; line-height: var(--ds-leading-normal) !important; }

/* Vertical rhythm */
.content p + p, .content h2 + p, .content h3 + p { margin-top: var(--ds-space-4) !important; }
.content h2 { margin-top: var(--ds-space-8) !important; }
.content h3 { margin-top: var(--ds-space-6) !important; }
.content h4 { margin-top: var(--ds-space-5) !important; }
.content ul, .content ol { margin-top: var(--ds-space-3) !important; padding-left: var(--ds-space-5) !important; }
```

## 4. Page Structure Components

### 4.1 Page Head (`.page-head`)

**REQ-LT-12**: Every top-level page MUST have a `.page-head` with:
- Flex layout: eyebrow + h1 left, actions right
- Border-bottom `--ds-line`
- Padding-bottom `--ds-space-4`
- Margin-bottom `--ds-space-6`

```css
.page-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--ds-space-4); margin-bottom: var(--ds-space-6); padding-bottom: var(--ds-space-4); border-bottom: 1px solid var(--ds-line); }
.page-head h1 { margin: 0 !important; }
.page-head .eyebrow { margin-bottom: var(--ds-space-2) !important; }
.page-head-actions { display: flex; gap: var(--ds-space-2); flex-wrap: wrap; align-items: center; }
```

### 4.2 Section Head (`.section-head`)

**REQ-LT-13**: Every card/panel section MUST have a `.section-head` with:
- Flex layout: heading + meta left, actions right
- Margin-bottom `--ds-space-4`
- Heading: h3 `--ds-text-lg` or h4 `--ds-text-base`
- Meta: `--ds-text-xs`, `--ds-muted`

```css
.section-head { display: flex; flex-wrap: wrap; align-items: flex-start; justify-content: space-between; gap: var(--ds-space-3); margin-bottom: var(--ds-space-4); }
.section-head h3 { font-size: var(--ds-text-lg) !important; margin: 0 !important; }
.section-head h4 { font-size: var(--ds-text-base) !important; margin: 0 !important; }
.section-head p { margin: var(--ds-space-1) 0 0 !important; font-size: var(--ds-text-xs) !important; color: var(--ds-muted) !important; }
.section-head-actions { display: flex; gap: var(--ds-space-2); align-items: center; flex-wrap: wrap; }
```

### 4.3 Grid Systems

**REQ-LT-14**: Dashboard grid = 2 columns, responsive to 1 column ≤1100px
**REQ-LT-15**: KPI grid = 4 columns, responsive 2 col ≤1100px, 1 col ≤640px
**REQ-LT-16**: Gap = `--ds-space-4` (16px)

```css
.dashboard-grid { display: grid; gap: var(--ds-space-4); grid-template-columns: repeat(2, minmax(0, 1fr)); }
.kpi-grid { display: grid; gap: var(--ds-space-4); grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (max-width: 1100px) { .dashboard-grid { grid-template-columns: 1fr; } .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .kpi-grid { grid-template-columns: 1fr; } }
```

## 5. Table Specifications

**REQ-LT-17**: Table header = bg `#f7f8fa`, text `#67728a`, weight 750, letter-spacing 0.03em, font 13px
**REQ-LT-18**: Table cells = padding 12px 16px, font 13px, border `--ds-line-soft`
**REQ-LT-19**: Table hover = bg `#f8fafd`
**REQ-LT-20**: Selected row = border `--ds-primary`, bg `--ds-primary-soft`

## 6. Empty State

**REQ-LT-21**: Empty state = centered flex column, padding 40px/24px, border dashed `--ds-line`, radius 16px
**REQ-LT-22**: Icon 48px `--ds-muted-2`, title 18px `--ds-ink-head`, desc 13px `--ds-muted` max-width 280px, action button margin-top 16px

## 6. Scrollbar

**REQ-LT-23**: Width 8px, track transparent, thumb `--ds-line` radius 4px with 2px transparent border (content-box), hover `--ds-muted-2`

## 7. Focus Visible

**REQ-LT-24**: All focusable elements = outline 2px `--ds-primary`, offset 2px

## 7. Touch Targets

**REQ-LT-25**: `@media (pointer: coarse)` = min-height 44px, min-width 44px for all interactive elements

## 8. Migration Requirements

**REQ-LT-26**: All 889 micro-typography rules (<10px) raised to minimum 12px
**REQ-LT-27**: All arbitrary spacing values mapped to nearest `--ds-space-*`
**REQ-LT-28**: All legacy font families (DM Sans, Inter direct) → Nunito Sans with Inter fallback
**REQ-LT-29**: All legacy heading sizes mapped to token scale

## 9. Acceptance Criteria

| ID | Criterion | Test |
|-----|-----------|------|
| AC-LT-01 | Base font 14px, line-height 1.65 | Playwright computed style |
| AC-LT-02 | All spacing uses tokens | CSS audit (no px values except tokens) |
| AC-LT-03 | Page head structure correct | Visual + DOM audit |
| AC-LT-04 | Section head structure correct | Visual + DOM audit |
| AC-LT-05 | Dashboard grid 2-col, KPI 4-col | Responsive test |
| AC-LT-06 | Table cells 13px, padding 12×16px | Visual + CSS audit |
| AC-LT-07 | Vertical rhythm 16px between paragraphs | Visual |
| AC-LT-08 | Empty state centered with icon + action | Visual |
| AC-LT-09 | Scrollbar 8px, thumb `--ds-line` | Visual |
| AC-LT-10 | Focus ring 2px `--ds-primary` | Keyboard nav |
| AC-LT-11 | Touch targets 44px mobile | Playwright mobile |
| AC-LT-12 | `npm run verify` + `build` pass | CI |