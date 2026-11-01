---
id: k-color-palette
title: DashStack Color Palette Definitions
type: knowledge
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [design-system, colors, palette, hsl]
relationships:
  - type: implements
    target: k-dashstack-tokens
    description: "Color palette implements token definitions"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# DashStack Color Palette — HSL Definitions

Authoritative HSL values for all colors. Used by `k-dashstack-tokens` for CSS token generation.

## Primary Blue Family (Hue 221°)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Blue 50 | `#ecf2ff` | 221° 100% 96% | `--ds-primary-soft` |
| Blue 100 | `#d6e4ff` | 221° 100% 92% | Hover backgrounds |
| Blue 200 | `#adb5ff` | 221° 100% 84% | — |
| Blue 300 | `#8496ff` | 221° 100% 76% | — |
| Blue 400 | `#5d77ff` | 221° 100% 68% | — |
| **Blue 500** | `#4880ff` | **221° 100% 64%** | **`--ds-primary`** |
| Blue 600 | `#3a6ef0` | 222° 100% 58% | `--ds-primary-hover` |
| Blue 700 | `#2d5bd8` | 222° 100% 51% | Gradient stops |
| Blue 800 | `#1f47b0` | 222° 100% 41% | — |
| Blue 900 | `#143080` | 222° 100% 29% | — |

## Light Blue Variant (Hue 221°, higher lightness)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Light Blue 300 | `#9cc1ff` | 221° 100% 80% | — |
| **Light Blue 400** | `#6e9aff` | **221° 100% 72%** | **`--ds-primary` light variant** |

## Neutral Grays (Hue ~220°, low saturation)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Gray 50 | `#f7f8fa` | 220° 20% 97% | `--ds-bg` |
| Gray 100 | `#f0f2f7` | 220° 18% 95% | — |
| Gray 200 | `#e6eaf1` | 220° 15% 92% | `--ds-line` |
| Gray 300 | `#d0d5dd` | 220° 12% 84% | — |
| Gray 400 | `#98a2b3` | 220° 10% 65% | `--ds-muted-2` |
| Gray 500 | `#667085` | 220° 8% 43% | `--ds-muted` |
| Gray 600 | `#475467` | 220° 7% 31% | — |
| Gray 700 | `#344054` | 220° 6% 26% | — |
| Gray 800 | `#1d2939` | 220° 10% 17% | h3 color |
| **Gray 900** | `#101828` | **220° 12% 11%** | **`--ds-ink-head`** |
| Gray 950 | `#0f1728` | 220° 15% 8% | Legacy navy (sidebar old) |

## Semantic Colors (HSL)

### Success (Hue 155° — Green)
| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Success 50 | `#ecfdf3` | 155° 80% 97% | `--ds-success-soft` |
| Success 500 | `#12b76a` | 155° 70% 40% | `--ds-success` |
| Success 600 | `#0d9454` | 155° 70% 32% | Hover |

### Warning (Hue 62° — Amber)
| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Warning 50 | `#fef4e6` | 62° 100% 97% | `--ds-warning-soft` |
| Warning 500 | `#f79009` | 62° 100% 50% | `--ds-warning` |
| Warning 600 | `#d97808` | 62° 100% 44% | Hover |

### Danger (Hue 28° — Red)
| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Danger 50 | `#fef3f2` | 28° 90% 97% | `--ds-danger-soft` |
| Danger 500 | `#f04438` | 28° 85% 58% | `--ds-danger` |
| Danger 600 | `#d92d20` | 28° 85% 49% | Hover |

### Info (Hue 230° — Sky Blue)
| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| Info 50 | `#f0f9ff` | 230° 100% 97% | `--ds-info-soft` |
| Info 500 | `#0ea5e9` | 230° 95% 49% | `--ds-info` |
| Info 600 | `#0284c7` | 230° 95% 39% | Hover |

## Migration HSL Rules (from legacy sweep)

### Violet/Indigo Family (Hue 228°–320°)
- **Chroma gate**: delta (max-min) >= 12 (excludes neutral grays)
- **Lightness tiers**:
  - L >= 91% → `#ecf2ff` (soft)
  - L >= 70% → `#6e9aff` (light)
  - L >= 58% → `#4880ff` (primary)
  - L >= 40% → `#3a6ef0` (deep)
  - L < 40% → preserve (dark backgrounds)

### Bright Indigo-Blue Family (Hue 205°–228°)
- Saturation >= 55%, Lightness 36–78% → `#4880ff`
- Lightness >= 91% → `#ecf2ff`

### Coral OKLCH Family (Hue 48°)
- Chroma >= 0.05
- Mapped by lightness to blue family with alpha

### Near-White Violet Tint (Hue 235°–320°, delta 4–12, L >= 88%)
- → `#ecf2ff`

### Dark Violet Text (Hue 240°–320°, delta >= 35, L 15–40%)
- → `#141b2d` (ink)

### Preserved (Not Migrated)
- Neutral grays (chroma < 4–12)
- Semantic colors (green/red/amber/teal)
- Navy backgrounds (hue < 228, dark)
- `html[data-theme="dark"]` rules (dormant)
- Magenta/pink (hue > 320°)