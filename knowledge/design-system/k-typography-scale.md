---
id: k-typography-scale
title: Typography Scale
type: knowledge
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [design-system, typography, font, scale]
relationships:
  - type: implements
    target: k-dashstack-tokens
    description: "Typography scale implements token definitions"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Typography Scale — Nunito Sans

All typography derives from **Nunito Sans** (self-hosted variable font, wght 200–1000) with a harmonious scale.

## Font Stack

```css
font-family: "Nunito Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

- **Primary**: Nunito Sans (`public/fonts/nunito-sans-latin-vf.woff2`, ~31KB, latin subset, wght 200–1000)
- **Fallback**: Inter → system UI stack
- **Loaded via**: `@font-face` in `lumaway-dashstack-restyle.css` Section 0

## Type Scale

| Token | Size | Line Height | Weight | Use Case |
|-------|------|-------------|--------|----------|
| `--ds-text-xs` | 12px | 1.5 (`--ds-leading-normal`) | 500 | Timestamps, badges, small labels, footnotes |
| `--ds-text-sm` | 13px | 1.65 (`--ds-leading-relaxed`) | 500 | **Table cells**, form labels, secondary text, list items |
| `--ds-text-base` | 14px | 1.65 (`--ds-leading-relaxed`) | 500 | **Body text default**, paragraphs, content |
| `--ds-text-lg` | 16px | 1.5 (`--ds-leading-normal`) | 600 | Card titles, emphasized body, large inputs |
| `--ds-text-xl` | 18px | 1.4 | 600 | h3, section heads, subsection titles |
| `--ds-text-2xl` | 22px | 1.3 | 700 | h2, page subheadings |
| `--ds-text-3xl` | 28px | 1.25 (`--ds-leading-tight`) | 800 | h1, page titles |
| `--ds-text-4xl` | 34px | 1.2 (`--ds-leading-tight`) | 800 | Hero, dashboard hero |

## Line Height Tokens

| Token | Value | Use Case |
|-------|-------|----------|
| `--ds-leading-tight` | 1.25 | Headings (h1–h3) |
| `--ds-leading-normal` | 1.5 | UI text, buttons, labels, form elements |
| `--ds-leading-relaxed` | 1.65 | **Body text**, paragraphs, long-form content |

## Font Weight Mapping

| Weight | Value | Use Case |
|--------|-------|----------|
| Regular | 400 | Body text (rarely used — prefer 500) |
| Medium | 500 | **Default body**, table cells, form labels |
| Semibold | 600 | Card titles, emphasized text, h3 |
| Bold | 700 | h2, primary buttons, strong emphasis |
| Extrabold | 800 | h1, hero, dashboard hero |

## Responsive Typography

| Breakpoint | Base | h1 | h2 | h3 | Body |
|------------|------|-----|-----|-----|------|
| Mobile (<=640px) | 13px | 26px | 20px | 17px | 13px |
| Tablet (641–1024px) | 14px | 30px | 22px | 18px | 14px |
| Desktop (>1024px) | 14px | 34px | 22px | 18px | 14px |

```css
/* Mobile adjustments */
@media (max-width: 640px) {
  html body { font-size: 13px !important; }
  .content h1 { font-size: 26px !important; }
  .content h2 { font-size: 20px !important; }
  .content h3 { font-size: 17px !important; }
}
```

## CSS Implementation (from `lumaway-dashstack-restyle.css`)

```css
:root {
  --ds-text-xs: 12px;
  --ds-text-sm: 13px;
  --ds-text-base: 14px;
  --ds-text-lg: 16px;
  --ds-text-xl: 18px;
  --ds-text-2xl: 22px;
  --ds-text-3xl: 28px;
  --ds-text-4xl: 34px;
  --ds-leading-tight: 1.25;
  --ds-leading-normal: 1.5;
  --ds-leading-relaxed: 1.65;
}

/* Base (Section 1 & 9) */
html body {
  font-size: var(--ds-text-base) !important;
  line-height: var(--ds-leading-relaxed) !important;
}
.content { font-size: var(--ds-text-base) !important; line-height: var(--ds-leading-relaxed) !important; }
.content p, .content li, .content td, .content th, .content label { font-size: var(--ds-text-sm) !important; line-height: var(--ds-leading-relaxed) !important; }
.content h1 { font-size: var(--ds-text-4xl) !important; line-height: var(--ds-leading-tight) !important; }
.content h2 { font-size: var(--ds-text-2xl) !important; line-height: var(--ds-leading-tight) !important; }
.content h3 { font-size: var(--ds-text-xl) !important; line-height: var(--ds-leading-tight) !important; }
.content h4 { font-size: var(--ds-text-lg) !important; line-height: var(--ds-leading-normal) !important; }
.content small { font-size: var(--ds-text-xs) !important; line-height: var(--ds-leading-normal) !important; }

/* Vertical Rhythm (Section 9) */
.content p + p, .content h2 + p, .content h3 + p { margin-top: var(--ds-space-4) !important; }
.content h2 { margin-top: var(--ds-space-8) !important; }
.content h3 { margin-top: var(--ds-space-6) !important; }
.content h4 { margin-top: var(--ds-space-5) !important; }
```

## Migration from Legacy

Legacy had **889 rules** with font-size 6–9.5px across 36 files (micro-typography). All raised to minimum 12px (xs) with harmonious scale:

| Legacy Range | Mapped To |
|--------------|-----------|
| 6–7.5px | 12px (xs) |
| 7.6–8.7px | 13px (sm) |
| 8.8–9.9px | 14px (base) / 13px (sm) |
| 10–11px | 13px (sm) / 14px (base) |
| 12–13px | 13px (sm) |
| 14–15px | 14px (base) / 16px (lg) |
| 16–17px | 16px (lg) / 18px (xl) |
| 18–19px | 18px (xl) |
| 20–22px | 22px (2xl) |
| 24–26px | 28px (3xl) |
| 28–30px | 28px (3xl) / 34px (4xl) |

Font families unified: DM Sans, Inter, system-ui → **Nunito Sans** with Inter fallback.