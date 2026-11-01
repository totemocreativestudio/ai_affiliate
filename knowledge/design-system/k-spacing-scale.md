---
id: k-spacing-scale
title: Spacing Scale (4px Grid)
type: knowledge
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [design-system, spacing, grid, layout]
relationships:
  - type: implements
    target: k-dashstack-tokens
    description: "Spacing scale implements token definitions"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Spacing Scale — 4px Base Grid

All spacing in the system derives from a **4px base unit**. This ensures visual rhythm and alignment across all components.

## Scale Definition

| Token | Pixels | Rem | Ratio | Use Case |
|-------|--------|-----|-------|----------|
| `--ds-space-1` | 4px | 0.25rem | 1× | Icon padding, micro gaps, badge inner padding |
| `--ds-space-2` | 8px | 0.5rem | 2× | Chip gaps, button icon-text gap, small component gaps |
| `--ds-space-3` | 12px | 0.75rem | 3× | **Table cell padding**, form field gaps, card content gaps |
| `--ds-space-4` | 16px | 1rem | 4× | **Standard card padding**, section gaps, grid gaps |
| `--ds-space-5` | 20px | 1.25rem | 5× | **Card internal padding** (comfortable) |
| `--ds-space-6` | 24px | 1.5rem | 6× | **Section margins**, page-level grid gaps |
| `--ds-space-8` | 32px | 2rem | 8× | Major section spacing, page hero padding |
| `--ds-space-10` | 40px | 2.5rem | 10× | Large section spacing |
| `--ds-space-12` | 48px | 3rem | 12× | Major layout spacing, dashboard top padding |

## Usage Rules

### DO
- Use tokens for all margins, padding, gaps
- Combine tokens: `margin: var(--ds-space-4) var(--ds-space-6);`
- Use `gap` in flex/grid: `gap: var(--ds-space-4);`
- Use `--ds-space-4` as default card padding
- Use `--ds-space-6` as default section margin

### DON'T
- Use arbitrary pixel values (10px, 18px, 22px, etc.)
- Use rem/em directly for spacing (use tokens)
- Mix spacing scales (stick to 4px grid)

## Component-Specific Spacing

| Component | Padding | Gap | Margin |
|-----------|---------|-----|--------|
| `.card` | `--ds-space-5` (20px) | — | — |
| `.kpi-grid` | — | `--ds-space-4` (16px) | — |
| `.dashboard-grid` | — | `--ds-space-4` (16px) | — |
| `.section-head` | — | `--ds-space-3` (12px) | `margin-bottom: var(--ds-space-4)` |
| `.page-head` | `padding-bottom: var(--ds-space-4)` | `--ds-space-4` | `margin-bottom: var(--ds-space-6)` |
| `.table td, .table th` | `--ds-space-3` (12px) vertical, `--ds-space-4` (16px) horizontal | — | — |
| `.button` | `--ds-space-3` vertical, `--ds-space-4` horizontal | `--ds-space-2` (icon gap) | — |
| `.input` | `--ds-space-3` vertical, `--ds-space-4` horizontal | — | — |
| `.empty-state` | `--ds-space-10` vertical, `--ds-space-6` horizontal | `--ds-space-3` | — |

## Responsive Spacing

| Breakpoint | Card Padding | Grid Gap | Section Margin |
|------------|--------------|----------|----------------|
| Mobile (<=640px) | `--ds-space-4` (16px) | `--ds-space-3` (12px) | `--ds-space-5` (20px) |
| Tablet (641–1024px) | `--ds-space-5` (20px) | `--ds-space-4` (16px) | `--ds-space-6` (24px) |
| Desktop (>1024px) | `--ds-space-5` (20px) | `--ds-space-4` (16px) | `--ds-space-6` (24px) |

## CSS Implementation

```css
/* In lumaway-dashstack-restyle.css */
:root {
  --ds-space-1: 4px;
  --ds-space-2: 8px;
  --ds-space-3: 12px;
  --ds-space-4: 16px;
  --ds-space-5: 20px;
  --ds-space-6: 24px;
  --ds-space-8: 32px;
  --ds-space-10: 40px;
  --ds-space-12: 48px;
}

/* Utility classes (Section 17) */
.mt-1 { margin-top: var(--ds-space-1) !important; }
.mt-2 { margin-top: var(--ds-space-2) !important; }
.mt-3 { margin-top: var(--ds-space-3) !important; }
.mt-4 { margin-top: var(--ds-space-4) !important; }
.mt-5 { margin-top: var(--ds-space-5) !important; }
.mt-6 { margin-top: var(--ds-space-6) !important; }
.mb-1 { margin-bottom: var(--ds-space-1) !important; }
.mb-2 { margin-bottom: var(--ds-space-2) !important; }
.mb-3 { margin-bottom: var(--ds-space-3) !important; }
.mb-4 { margin-bottom: var(--ds-space-4) !important; }
.gap-2 { gap: var(--ds-space-2) !important; }
.gap-3 { gap: var(--ds-space-3) !important; }
.gap-4 { gap: var(--ds-space-4) !important; }
```

## Migration from Legacy

Legacy spacing was inconsistent (10px, 12px, 14px, 16px, 18px, 20px, 22px, 24px, 26px, 28px, 30px, 32px, 34px, 36px). All mapped to nearest 4px grid token.