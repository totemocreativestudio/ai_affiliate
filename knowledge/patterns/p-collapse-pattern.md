---
id: p-collapse-pattern
title: Collapse Pattern (Expandable Card, Row, Accordion)
type: pattern
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [patterns, collapse, expandable, accordion, card]
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

# Collapse Pattern — Expandable Card, Row, Accordion

## When to Use

- **Expandable Card**: Section within a card that's optional (e.g., Forecast in KPI card)
- **Expandable Row**: Table row showing detail (e.g., order details, creator breakdown)
- **Accordion**: Multiple mutually exclusive or independent sections (e.g., FAQ, filters)

## Variants

| Variant | Structure | Animation | Use Case |
|---------|-----------|-----------|----------|
| **Expandable Card** | Card → Header (toggle) → Content panel | `ds-expand-height` / `ds-collapse-height` | KPI forecast, advanced settings |
| **Expandable Row** | Table row → Next row (full-width panel) | `ds-expand-height` / `ds-collapse-height` | Order details, creator stats |
| **Accordion** | Multiple sections, one or many open | `ds-slide-down/up` | FAQ, filters, settings groups |

## Animation

```css
/* From restyle Section 18 */
@keyframes ds-expand-height { from { max-height: 0; opacity: 0; } to { max-height: 800px; opacity: 1; } }
@keyframes ds-collapse-height { from { max-height: 800px; opacity: 1; } to { max-height: 0; opacity: 0; } }
@keyframes ds-slide-down { from { opacity: 0; transform: translateY(-6px); max-height: 0; } to { opacity: 1; transform: translateY(0); max-height: 500px; } }
@keyframes ds-slide-up { from { opacity: 1; transform: translateY(0); max-height: 500px; } to { opacity: 0; transform: translateY(-6px); max-height: 0; } }

.ds-expand { animation: ds-expand-height 0.25s ease both; overflow: hidden; }
.ds-collapse { animation: ds-collapse-height 0.2s ease both; overflow: hidden; }
```

## Expandable Card (KPI Forecast)

```tsx
interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  triggerLabel: string; // "Tampilkan Forecast" / "Sembunyikan Forecast"
  triggerIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function ExpandableCard({ 
  title, subtitle, defaultOpen = false, triggerLabel, triggerIcon, children, className 
}: ExpandableCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  // Smooth height animation
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.maxHeight = open 
      ? `${contentRef.current.scrollHeight}px` 
      : "0";
  }, [open]);

  return (
    <div className={`expandable-card ${className || ""}`}>
      <div className="expandable-card-header">
        <div className="expandable-card-title">
          <h3>{title}</h3>
          {subtitle && <p className="expandable-card-subtitle">{subtitle}</p>}
        </div>
        <button
          className="expandable-trigger ds-progressive-trigger"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`${triggerLabel}-panel`}
          type="button"
        >
          {triggerLabel}
          {triggerIcon || <LumaIcon name="chevron" className={`ds-chevron ${open ? "rotated" : ""}`} />}
        </button>
      </div>
      <div
        ref={contentRef}
        id={`${triggerLabel}-panel`}
        className={`expandable-card-panel ds-expand ${open ? "" : "ds-collapse"}`}
        style={{ maxHeight: open ? "800px" : "0", opacity: open ? 1 : 0 }}
        aria-hidden={!open}
      >
        <div className="expandable-card-content">
          {children}
        </div>
      </div>
    </div>
  );
}
```

### Usage (Dashboard KPI)

```tsx
<ExpandableCard 
  title="Key Metrics" 
  subtitle="Real-time performance overview"
  triggerLabel={showForecast ? "Sembunyikan Forecast" : "Tampilkan Forecast"}
  triggerIcon={<LumaIcon name="chart" />}
  defaultOpen={false}
>
  <GoalForecastCenter workspaceId={workspace.id} />
</ExpandableCard>
```

### CSS (Restyle Layer)

```css
.expandable-card { border: 1px solid var(--ds-line); border-radius: var(--ds-radius); background: var(--ds-card); overflow: hidden; }
.expandable-card-header { display: flex; align-items: center; justify-content: space-between; padding: var(--ds-space-4) var(--ds-space-5); border-bottom: 1px solid var(--ds-line); background: var(--ds-bg); }
.expandable-card-title h3 { margin: 0; font-size: var(--ds-text-lg); font-weight: 700; color: var(--ds-ink-head); }
.expandable-card-subtitle { margin: 2px 0 0; font-size: var(--ds-text-xs); color: var(--ds-muted); }
.expandable-trigger { display: inline-flex; align-items: center; gap: var(--ds-space-2); padding: var(--ds-space-1) var(--ds-space-2); font-size: var(--ds-text-sm); font-weight: 600; color: var(--ds-primary); background: transparent; border: none; cursor: pointer; }
.expandable-trigger:hover { text-decoration: underline; }
.expandable-trigger .ds-chevron { transition: transform 0.2s ease; }
.expandable-trigger .ds-chevron.rotated { transform: rotate(180deg); }

.expandable-card-panel { overflow: hidden; transition: max-height 0.25s ease, opacity 0.15s ease; }
.expandable-card-content { padding: var(--ds-space-5); }
```

## Expandable Row (Table)

```tsx
function ExpandableTableRow({ 
  row, expanded, onToggle, renderSummary, renderDetail 
}: {
  row: any;
  expanded: boolean;
  onToggle: () => void;
  renderSummary: (row: any) => React.ReactNode;
  renderDetail: (row: any) => React.ReactNode;
}) {
  return (
    <>
      <TableRow className={expanded ? "expanded" : ""} onClick={onToggle}>
        {renderSummary(row).map((cell, i) => (
          <TableCell key={i}>{cell}</TableCell>
        ))}
        <TableCell className="expand-trigger-cell">
          <button className="expandable-trigger ds-progressive-trigger" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-expanded={expanded} type="button">
            <LumaIcon name="chevron" className={`ds-chevron ${expanded ? "rotated" : ""}`} />
          </button>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="expanded-detail-row">
          <TableCell colSpan={999} className="expanded-detail-cell">
            <div className="ds-progressive-panel ds-expand">
              {renderDetail(row)}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
```

### CSS

```css
.expanded-detail-cell { padding: 0 !important; }
.expanded-detail-row .ds-progressive-panel { animation: ds-expand-height 0.25s ease both; }
```

## Accordion (Multiple Sections)

```tsx
function Accordion({ 
  items, allowMultiple = false, className 
}: {
  items: Array<{ id: string; title: string; subtitle?: string; content: React.ReactNode }>;
  allowMultiple?: boolean;
  className?: string;
}) {
  const [openIds, setOpenIds] = useState<string[]>(() => 
    items.filter(i => i.defaultOpen).map(i => i.id)
  );

  const toggle = (id: string) => {
    setOpenIds(prev => allowMultiple 
      ? prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      : prev.includes(id) ? [] : [id]
    );
  };

  return (
    <div className={`accordion ${className || ""}`}>
      {items.map(item => (
        <details key={item.id} className="accordion-item" open={openIds.includes(item.id)}>
          <summary className="accordion-trigger ds-progressive-trigger">
            <div className="accordion-title">
              <strong>{item.title}</strong>
              {item.subtitle && <span className="accordion-subtitle">{item.subtitle}</span>}
            </div>
            <LumaIcon name="chevron" className="ds-chevron" />
          </summary>
          <div className="accordion-panel ds-progressive-panel">
            {item.content}
          </div>
        </details>
      ))}
    </div>
  );
}
```

### CSS

```css
.accordion { display: flex; flex-direction: column; gap: var(--ds-space-2); }
.accordion-item { border: 1px solid var(--ds-line); border-radius: var(--ds-radius); background: var(--ds-card); overflow: hidden; }
.accordion-trigger { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: var(--ds-space-4) var(--ds-space-5); background: transparent; border: none; text-align: left; cursor: pointer; font: inherit; color: var(--ds-ink); }
.accordion-trigger:hover { background: var(--ds-bg); }
.accordion-trigger:focus-visible { outline: 2px solid var(--ds-primary); outline-offset: -2px; }
.accordion-title { display: flex; flex-direction: column; gap: 2px; }
.accordion-title strong { font-size: var(--ds-text-sm); font-weight: 600; color: var(--ds-ink-head); }
.accordion-subtitle { font-size: var(--ds-text-xs); color: var(--ds-muted); }
.accordion-panel { padding: 0 var(--ds-space-5) var(--ds-space-5); overflow: hidden; transition: max-height 0.2s ease, opacity 0.15s ease; }
.accordion-item:not([open]) .accordion-panel { max-height: 0; opacity: 0; }
.accordion-item[open] .accordion-panel { max-height: 500px; opacity: 1; }
.accordion-trigger .ds-chevron { transition: transform 0.2s ease; }
.accordion-item[open] .accordion-trigger .ds-chevron { transform: rotate(180deg); }
```

## Accessibility

- `aria-expanded` on trigger
- `aria-controls` linking trigger → panel
- Panel `role="region"` with `aria-labelledby`
- Keyboard: Enter/Space toggles, Arrow keys navigate accordion
- Focus visible on triggers

## Examples in Lumaway

| Feature | Variant | Location |
|---------|---------|----------|
| Goal & Forecast | Expandable Card | Dashboard KPI header |
| Order/Creator details | Expandable Row | Affiliate 360, Listings tables |
| Filters | Accordion | Dashboard filters, Campaign Tracker filters |
| Tutorial steps | Accordion | Tutorial Center |
| Settings groups | Accordion | Administration settings |