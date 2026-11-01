---
id: p-modal-pattern
title: Modal Pattern
type: pattern
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [patterns, modal, dialog, confirmation]
relationships:
  - type: extends
    target: p-progressive-disclosure
    description: "Extends base progressive disclosure pattern"
  - type: extends
    target: p-drawer-pattern
    description: "Specialized drawer variant (centered modal)"
  - type: references
    target: sk-progressive-ui
    description: "Implemented by progressive UI skill"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# Modal Pattern — Centered Dialog

## When to Use

- **Confirmations** (delete, discard changes, irreversible actions)
- **Simple forms** (login, settings, quick input)
- **Alerts/Notifications** requiring acknowledgment
- **Onboarding steps** (welcome, feature tour)
- **Content that blocks** main workflow until resolved

**Don't use for:** Complex multi-step flows → use Full-Screen Drawer (`p-drawer-pattern` size `full`)

## Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│ Backdrop (rgba(15,24,42,0.4)) — click to close             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Modal Header                                         │   │
│  │ [Icon]  Title                              [×]      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │ Modal Body (message, form, content)                 │   │
│  │                                                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Modal Footer                                         │   │
│  │                              [Secondary] [Primary]  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Variants

| Variant | Icon | Use Case | Primary Action |
|---------|------|----------|----------------|
| **Danger** | ⚠️ (alert) | Delete, destroy, irreversible | "Hapus" / "Ya, hapus" (red) |
| **Warning** | ⚠️ (warning) | Discard changes, leave page | "Tetap keluar" / "Buang" (amber) |
| **Info** | ℹ️ (info) | Notices, feature announcements | "Mengerti" / "OK" (blue) |
| **Success** | ✅ (check) | Completed actions | "Selesai" (green) |
| **Form** | 📝 (edit) | Simple input, settings | "Simpan" (blue) |

## Animation

```css
/* From restyle Section 18 + drawer */
.ds-drawer { animation: ds-slide-right 0.22s ease both; }
.ds-fade { animation: ds-fade-in 0.15s ease both; }

/* Modal specific - centered, fade */
.drawer-centered {
  width: 400px; max-width: 90vw;
  right: 50%; transform: translateX(50%);
  animation: ds-fade-in 0.15s ease both;
}
```

## Implementation

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  variant: "danger" | "warning" | "info" | "success" | "form";
  title: string;
  message?: string;
  children?: React.ReactNode; // For form variant
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  primaryLoading?: boolean;
}

const VARIANT_CONFIG = {
  danger: { icon: "alert", iconColor: "var(--ds-danger)", primaryColor: "danger" },
  warning: { icon: "warning", iconColor: "var(--ds-warning)", primaryColor: "warning" },
  info: { icon: "info", iconColor: "var(--ds-info)", primaryColor: "primary" },
  success: { icon: "check", iconColor: "var(--ds-success)", primaryColor: "success" },
  form: { icon: "edit", iconColor: "var(--ds-primary)", primaryColor: "primary" },
} as const;

function Modal({ 
  open, onClose, variant, title, message, children, 
  primaryLabel, onPrimary, secondaryLabel, onSecondary, primaryLoading 
}: ModalProps) {
  const { icon, iconColor, primaryColor } = VARIANT_CONFIG[variant];
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(open, onClose);
  useFocusReturn(open, null, onClose);

  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop ds-fade" onClick={onClose} aria-hidden="true" />
      <div 
        ref={containerRef}
        className="drawer drawer-centered ds-drawer ds-fade"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="drawer-header">
          <div className="modal-header-content">
            <span 
              className="modal-icon" 
              style={{ color: iconColor }}
              aria-hidden="true"
            >
              <LumaIcon name={icon} size={24} />
            </span>
            <h2 id="modal-title" className="drawer-title">{title}</h2>
          </div>
          <button className="drawer-close ds-progressive-trigger" onClick={onClose} aria-label="Tutup" type="button">
            <LumaIcon name="close" />
          </button>
        </div>
        <div className="drawer-content modal-content">
          {message && <p className="modal-message">{message}</p>}
          {children}
        </div>
        <div className="drawer-footer modal-footer">
          {secondaryLabel && (
            <Button variant="ghost" onClick={onSecondary || onClose} disabled={primaryLoading}>
              {secondaryLabel}
            </Button>
          )}
          <Button 
            variant={primaryColor} 
            onClick={onPrimary} 
            disabled={primaryLoading}
            loading={primaryLoading}
          >
            {primaryLabel}
          </Button>
        </div>
      </div>
    </>
  );
}
```

## CSS (Restyle Layer)

```css
/* Modal centered - extends drawer-centered */
.drawer-centered {
  width: 400px; max-width: 90vw;
  right: 50%; transform: translateX(50%);
  animation: ds-fade-in 0.15s ease both;
  border-radius: var(--ds-radius);
  box-shadow: 0 24px 64px rgba(15, 34, 82, 0.35);
}

.drawer-centered .drawer-header {
  padding: var(--ds-space-5) var(--ds-space-5) var(--ds-space-3);
}

.modal-header-content {
  display: flex; align-items: center; gap: var(--ds-space-3);
  flex: 1;
}
.modal-icon { display: flex; flex-shrink: 0; }
.modal-message { margin: 0; font-size: var(--ds-text-sm); color: var(--ds-muted); line-height: 1.6; }

.modal-footer {
  padding: var(--ds-space-4) var(--ds-space-5);
  flex-direction: row-reverse; /* Primary on right */
}

/* Form variant */
.modal-form { display: flex; flex-direction: column; gap: var(--ds-space-4); }
.modal-form .form-field { display: flex; flex-direction: column; gap: var(--ds-space-1); }
.modal-form label { font-size: var(--ds-text-sm); font-weight: 600; color: var(--ds-ink-head); }
.modal-form input, .modal-form select, .modal-form textarea {
  padding: var(--ds-space-3) var(--ds-space-4);
  border: 1px solid var(--ds-line);
  border-radius: var(--ds-radius-sm);
  font-size: var(--ds-text-sm);
  background: var(--ds-card);
}
.modal-form input:focus-visible, .modal-form select:focus-visible, .modal-form textarea:focus-visible {
  outline: 2px solid var(--ds-primary); outline-offset: 1px; border-color: var(--ds-primary);
}
```

## Usage Examples

### Danger Confirmation (Delete)
```tsx
<Modal
  variant="danger"
  title="Hapus Data?"
  message="Yakin ingin menghapus item ini? Tindakan tidak bisa dibatalkan."
  primaryLabel="Hapus"
  secondaryLabel="Batal"
  onPrimary={handleDelete}
  onSecondary={onClose}
  open={modalId === "confirm-delete"}
  onClose={() => setModalId(null)}
/>
```

### Warning (Discard Changes)
```tsx
<Modal
  variant="warning"
  title="Buang Perubahan?"
  message="Kamu memiliki perubahan yang belum disimpan. Yakin ingin keluar?"
  primaryLabel="Buang perubahan"
  secondaryLabel="Lanjutkan edit"
  onPrimary={handleDiscard}
  onSecondary={onClose}
  open={modalId === "discard-changes"}
  onClose={() => setModalId(null)}
/>
```

### Form (Quick Input)
```tsx
<Modal
  variant="form"
  title="Tambah Catatan"
  primaryLabel="Simpan"
  secondaryLabel="Batal"
  onPrimary={handleSave}
  onSecondary={onClose}
  open={modalId === "add-note"}
  onClose={() => setModalId(null)}
>
  <form className="modal-form" onSubmit={handleSubmit}>
    <div className="form-field">
      <label htmlFor="note-title">Judul</label>
      <input id="note-title" type="text" required maxLength={100} />
    </div>
    <div className="form-field">
      <label htmlFor="note-body">Isi</label>
      <textarea id="note-body" rows={4} required maxLength={1000} />
    </div>
  </form>
</Modal>
```

## Accessibility

- Focus trap, focus return to trigger
- Escape closes
- Backdrop click closes
- `role="dialog"`, `aria-modal="true"`
- `aria-labelledby="modal-title"`
- Focus on first focusable element on open
- Screen reader announces title + message

## Examples in Lumaway

| Feature | Variant | Trigger |
|---------|---------|---------|
| Delete confirmation | `danger` | Any delete action |
| Discard unsaved changes | `warning` | Navigate away with dirty form |
| Feature announcement | `info` | First visit / new feature |
| Quick note/input | `form` | "Tambah" button in compact spaces |
| Ratecard quick edit | `form` | Inline edit in table |