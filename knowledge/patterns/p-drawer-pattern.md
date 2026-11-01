---
id: p-drawer-pattern
title: Drawer Pattern (Side, Slide-Over, Full-Screen)
type: pattern
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [patterns, drawer, slide-over, modal, side-panel]
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

# Drawer Pattern — Side, Slide-Over, Full-Screen, Modal

## When to Use

| Size | Use Case | Width |
|------|----------|-------|
| **Side Drawer** (`sm`) | Contextual details, related records | 320px (max 90vw mobile) |
| **Slide-Over Panel** (`lg`) | Forms, wizards, multi-step flows | 480px (desktop), 100% (mobile) |
| **Full-Screen Modal** (`full`) | Complex workflows, immersive tasks | 100vw × 100vh |
| **Modal Drawer** (`centered`) | Confirmations, simple forms, alerts | 400px centered |

## Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ Backdrop (rgba(0,0,0,0.4)) — click to close                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Drawer Header                                        │   │
│  │ [Title]                                    [× Close] │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                     │   │
│  │ Drawer Content (lazy-loaded)                        │   │
│  │                                                     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Drawer Footer (actions)                             │   │
│  │ [Cancel]                              [Primary]     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Animation

```css
/* From restyle Section 18 */
@keyframes ds-slide-right {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ds-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ds-fade-out { from { opacity: 1; } to { opacity: 0; } }

.ds-drawer { animation: ds-slide-right 0.22s ease both; }
.ds-fade { animation: ds-fade-in 0.15s ease both; }

/* Backdrop */
.drawer-backdrop { animation: ds-fade-in 0.15s ease both; }
.drawer-backdrop.closing { animation: ds-fade-out 0.1s ease both; }
```

## Responsive Behavior

| Breakpoint | `sm` (320px) | `lg` (480px) | `full` | `centered` |
|------------|--------------|--------------|--------|------------|
| Mobile (<640px) | 100% width, bottom sheet | 100% width, bottom sheet | 100% | 90% width, centered |
| Tablet (641-1024px) | 320px right | 480px right | 100% | 90% centered |
| Desktop (>1024px) | 320px right | 480px right | 100% | 400px centered |

## Implementation (React)

```tsx
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  size: "sm" | "lg" | "full" | "centered" | "responsive";
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
}

function Drawer({ 
  open, onClose, size, title, children, footer, 
  showBackdrop = true, closeOnBackdropClick = true, closeOnEscape = true,
  className 
}: DrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus trap + focus return
  useFocusTrap(open, onClose);
  useFocusReturn(open, null, onClose); // Trigger handled by parent

  // Size classes
  const sizeClass = {
    sm: "drawer-sm",
    lg: "drawer-lg", 
    full: "drawer-full",
    centered: "drawer-centered",
    responsive: "drawer-responsive"
  }[size] || "drawer-sm";

  if (!open) return null;

  return (
    <>
      {showBackdrop && (
        <div 
          className="drawer-backdrop ds-fade"
          onClick={closeOnBackdropClick ? onClose : undefined}
          aria-hidden="true"
        />
      )}
      <div
        ref={containerRef}
        className={`drawer ${sizeClass} ds-drawer ${className || ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="drawer-header">
          <h2 id={titleId} className="drawer-title">{title}</h2>
          <button
            className="drawer-close ds-progressive-trigger"
            onClick={onClose}
            aria-label="Tutup"
            type="button"
          >
            <LumaIcon name="close" />
          </button>
        </div>
        <div className="drawer-content">
          <Suspense fallback={<DrawerSkeleton />}>
            {children}
          </Suspense>
        </div>
        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
```

## CSS (Restyle Layer)

```css
/* Base drawer */
.drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  background: var(--ds-card);
  border-left: 1px solid var(--ds-line);
  box-shadow: -4px 0 24px rgba(16,24,40,0.1);
  z-index: var(--ds-z-modal);
  display: flex;
  flex-direction: column;
  max-height: 100vh;
}

/* Sizes */
.drawer-sm { width: 320px; max-width: 90vw; }
.drawer-lg { width: 480px; max-width: 90vw; }
.drawer-full { width: 100vw; max-width: 100vw; border-left: none; }
.drawer-centered { width: 400px; max-width: 90vw; right: 50%; transform: translateX(50%); }
.drawer-responsive { width: 320px; } /* Handled by media queries */

/* Internal layout */
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--ds-space-4) var(--ds-space-5);
  border-bottom: 1px solid var(--ds-line);
  flex-shrink: 0;
}
.drawer-title { font-size: var(--ds-text-lg); font-weight: 700; color: var(--ds-ink-head); margin: 0; }
.drawer-close { padding: 8px; border-radius: var(--ds-radius-sm); color: var(--ds-muted); background: transparent; border: none; cursor: pointer; }
.drawer-close:hover { background: var(--ds-line); color: var(--ds-ink); }

.drawer-content {
  flex: 1; overflow: auto; padding: var(--ds-space-5);
  -webkit-overflow-scrolling: touch;
}

.drawer-footer {
  display: flex; justify-content: flex-end; gap: var(--ds-space-3);
  padding: var(--ds-space-4) var(--ds-space-5);
  border-top: 1px solid var(--ds-line);
  flex-shrink: 0;
}

/* Backdrop */
.drawer-backdrop {
  position: fixed; inset: 0; z-index: calc(var(--ds-z-modal) - 1);
  background: rgba(15, 24, 42, 0.4);
  backdrop-filter: blur(2px);
}

/* Responsive */
@media (max-width: 640px) {
  .drawer-sm, .drawer-lg, .drawer-centered { 
    width: 100%; max-width: 100%; right: 0; transform: none; 
    border-radius: var(--ds-radius) var(--ds-radius) 0 0;
    animation: ds-slide-up 0.22s ease both; /* Bottom sheet */
  }
  @keyframes ds-slide-up {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

## Usage Examples

### Side Drawer (Creator Samples - 320px)
```tsx
<Drawer 
  size="sm" 
  title="Creator Samples" 
  open={drawerId === "creator-samples"}
  onClose={() => setDrawerId(null)}
  footer={
    <>
      <Button variant="ghost" onClick={() => setDrawerId(null)}>Tutup</Button>
      <Button onClick={handleSave}>Simpan</Button>
    </>
  }
>
  <CreatorSamples workspaceId={workspace.id} creatorId={selectedCreatorId} />
</Drawer>
```

### Slide-Over Panel (Scheduled Report - 480px)
```tsx
<Drawer 
  size="lg" 
  title="Jadwalkan Laporan" 
  open={panelId === "scheduled-reports"}
  onClose={() => setPanelId(null)}
  footer={
    <>
      <Button variant="ghost" onClick={() => setPanelId(null)}>Batal</Button>
      <Button onClick={handleSchedule}>Jadwalkan</Button>
    </>
  }
>
  <ScheduledReportCenter workspaceId={workspace.id} />
</Drawer>
```

### Full-Screen Modal (Ratecard Master)
```tsx
<Drawer 
  size="full" 
  title="Ratecard Master" 
  open={modalId === "ratecard"}
  onClose={() => setModalId(null)}
  showBackdrop={true}
  footer={
    <>
      <Button variant="ghost" onClick={() => setModalId(null)}>Tutup</Button>
      <Button onClick={handleSave}>Simpan Ratecard</Button>
    </>
  }
>
  <RatecardMaster workspaceId={workspace.id} />
</Drawer>
```

### Modal Drawer (Confirmation - Centered)
```tsx
<Drawer 
  size="centered" 
  title="Konfirmasi" 
  open={modalId === "confirm-delete"}
  onClose={() => setModalId(null)}
  showBackdrop={true}
  footer={
    <>
      <Button variant="ghost" onClick={() => setModalId(null)}>Batal</Button>
      <Button variant="danger" onClick={handleConfirm}>Hapus</Button>
    </>
  }
>
  <div className="drawer-message">
    <LumaIcon name="alert" className="message-icon" />
    <p>Yakin ingin menghapus? Tindakan ini tidak bisa dibatalkan.</p>
  </div>
</Drawer>
```

## Accessibility

- Focus trap inside drawer
- Focus returns to trigger on close
- Escape closes
- Backdrop click closes (configurable)
- `aria-modal="true"`, `aria-labelledby="title-id"`
- Announce open/close via live region
- Scroll lock on body when open (optional)

## Lazy Loading Content

```tsx
const CreatorSamples = lazy(() => import("./CreatorSamples"));
const RatecardMaster = lazy(() => import("./RatecardMaster"));

<Drawer open={open} onClose={onClose} size="sm" title="Creator Samples">
  <Suspense fallback={<DrawerSkeleton />}>
    <CreatorSamples workspaceId={workspace.id} creatorId={id} />
  </Suspense>
</Drawer>
```

## Examples in Lumaway

| Feature | Size | Trigger | Component |
|---------|------|---------|-----------|
| Creator Samples | `sm` (320px) | Affiliate 360 row click | `CreatorSamples` |
| Scheduled Report | `lg` (480px) | Campaign Tracker "📅 Jadwalkan" | `ScheduledReportCenter` |
| Ratecard Master | `full` | Product Master/Listings header | `RatecardMaster` |
| Ticket Status | `centered` | Notification bell click | `UserTicketCenter` |
| Luma Affiliate | `centered` | Avatar menu "Program Referral" | `LumaAffiliateCenter` |
| Daily Brief | `sm` + Banner | Notification bell badge | `DailyBriefCenter` |