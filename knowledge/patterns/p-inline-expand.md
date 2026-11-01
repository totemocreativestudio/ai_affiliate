---
id: p-inline-expand
title: Inline Expand Pattern
type: pattern
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [patterns, inline, expand, sidebar, progressive]
relationships:
  - type: extends
    target: p-progressive-disclosure
    description: "Extends base progressive disclosure pattern"
  - type: references
    target: m-progressive-triggers
    description: "References trigger mappings"
  - type: references
    target: sk-progressive-ui
    description: "Implemented by progressive UI skill"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# Inline Expand Pattern

## When to Use

- Content is **contextually related** to a parent item
- Content is **small to medium** (fits in sidebar width)
- User needs **quick glance** without leaving context
- Works in **constrained containers** (sidebar, table rows, cards)

## Anatomy

```
┌─────────────────────────────────────┐
│ Parent Item          [▼] Trigger    │  ← Always visible
├─────────────────────────────────────┤
│ ▼ Expanded Content (animates down)  │  ← Animate max-height + opacity
│ ┌─────────────────────────────────┐ │
│ │ Content component               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Trigger

- **Location**: Right side of parent row (sidebar) or inline with label
- **UI**: Chevron icon (`ds-chevron`) + optional label
- **States**: Default → Hover → Active (rotated 180°)
- **ARIA**: `aria-expanded`, `aria-controls`

## Animation

```css
/* From k-dashstack-tokens / restyle Section 18 */
.side-group > .side-subnav {
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.15s ease;
}
.side-group:not([open]) > .side-subnav {
  max-height: 0;
  opacity: 0;
  pointer-events: none;
}
.side-group[open] > .side-subnav {
  max-height: 500px;
  opacity: 1;
}

/* Chevron rotation */
.ds-chevron { transition: transform 0.2s ease; }
.ds-chevron.rotated { transform: rotate(180deg); }
```

## Implementation (React)

```tsx
interface InlineExpandProps {
  open: boolean;
  onToggle: () => void;
  triggerLabel: string;
  triggerIcon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function InlineExpand({ 
  open, onToggle, triggerLabel, triggerIcon, children, className 
}: InlineExpandProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Animate height smoothly
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.maxHeight = open 
      ? `${contentRef.current.scrollHeight}px` 
      : "0";
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="inline-expand-trigger ds-progressive-trigger"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${triggerLabel}-panel`}
        type="button"
      >
        {triggerIcon}
        <LumaIcon name="chevron" className={`ds-chevron ${open ? "rotated" : ""}`} />
      </button>
      <div
        ref={contentRef}
        id={`${triggerLabel}-panel`}
        className={`inline-expand-panel ds-progressive-panel ${className || ""}`}
        style={{ maxHeight: open ? "500px" : "0", opacity: open ? 1 : 0 }}
        aria-hidden={!open}
      >
        {children}
      </div>
    </>
  );
}
```

## Sidebar Usage (LumaSidebar.tsx)

```tsx
// Database row with inline expand for Data Health
<a className={subActive("database")} href={routeForSection("database")} onClick={(e) => go(e, "database")}>
  <NavIcon name="master" />
  <span className="nav-label">Database</span>
  <button
    type="button"
    className="inline-expand-trigger ds-progressive-trigger"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInline("data-health"); }}
    aria-expanded={inlineOpen["data-health"]}
    aria-controls="data-health-panel"
  >
    <LumaIcon name="health" />
    <LumaIcon name="chevron" className={`ds-chevron ${inlineOpen["data-health"] ? "rotated" : ""}`} />
  </button>
</a>

// Inline panel in side-subnav
<div className="side-subnav">
  <InlineExpand open={inlineOpen["data-health"]} onToggle={() => toggleInline("data-health")} triggerLabel="data-health" triggerIcon={<LumaIcon name="health" />}>
    <DataHealthCenter workspaceId={workspace.id} />
  </InlineExpand>
</div>
```

## Table Row Usage

```tsx
// Click row to expand details below
<TableRow 
  className={expandedRow === id ? "expanded" : ""}
  onClick={() => setExpandedRow(expandedRow === id ? null : id)}
>
  <TableCell>...</TableCell>
  <TableCell>
    <LumaIcon name="chevron" className={`ds-chevron ${expandedRow === id ? "rotated" : ""}`} />
  </TableCell>
</TableRow>

// Expanded row (next sibling)
{expandedRow === id && (
  <TableRow className="expanded-content-row">
    <TableCell colSpan={columns.length}>
      <div className="ds-progressive-panel ds-expand">
        <DetailContent item={item} />
      </div>
    </TableCell>
  </TableRow>
)}
```

## CSS Classes (Restyle Layer)

```css
/* Inline expand panel */
.inline-expand-panel {
  overflow: hidden;
  transition: max-height 0.2s ease, opacity 0.15s ease;
}

/* Table expanded row */
.expanded-content-row .inline-expand-panel {
  animation: ds-expand-height 0.25s ease both;
}

/* Trigger button */
.inline-expand-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.inline-expand-trigger:hover { color: var(--ds-primary); }
.inline-expand-trigger:focus-visible { outline: 2px solid var(--ds-primary); outline-offset: 2px; }
```

## Accessibility

- `aria-expanded` on trigger → `true`/`false`
- `aria-controls` on trigger → panel `id`
- `aria-hidden` on panel → `true` when closed
- Panel content `tabIndex={-1}` when closed
- Escape key closes (handled by parent)

## Variants

| Variant | Use Case | Difference |
|---------|----------|------------|
| Sidebar | Navigation groups | Uses `<details>`/`<summary>` native |
| Table Row | Data tables | Full-width panel below row |
| Card Section | Dashboard cards | Panel inside card |
| List Item | Settings lists | Panel below item |

## Examples in Lumaway

| Feature | Location | Component |
|---------|----------|-----------|
| Data Health | Sidebar Database row | `DataHealthCenter` |
| Excel Sync | Sidebar Upload Center row | (inline component) |
| Creator Samples | Affiliate 360 table row | `CreatorSamples` (drawer variant) |
| Goal Forecast | Dashboard KPI header | `GoalForecastCenter` (card variant) |