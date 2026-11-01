---
id: p-progressive-disclosure
title: Progressive Disclosure Base Pattern
type: pattern
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [patterns, progressive, disclosure, base, ui]
relationships:
  - type: implements
    target: s-progressive-disclosure-spec
    description: "Base pattern implements progressive disclosure spec"
  - type: references
    target: k-dashstack-tokens
    description: "References design tokens for animations"
  - type: references
    target: sk-progressive-ui
    description: "Implemented by progressive UI skill"
  - type: extends
    target: p-inline-expand
    description: "Extended by inline expand pattern"
  - type: extends
    target: p-drawer-pattern
    description: "Extended by drawer pattern"
  - type: extends
    target: p-modal-pattern
    description: "Extended by modal pattern"
  - type: extends
    target: p-collapse-pattern
    description: "Extended by collapse pattern"
  - type: extends
    target: p-tab-conversion
    description: "Extended by tab conversion pattern"
governance:
  review-cycle: 180d
  last-reviewed: 2026-11-01
---

# Progressive Disclosure — Base Pattern

## When to Use

Progressive disclosure hides secondary/advanced features until needed, reducing cognitive load while keeping everything accessible.

**Use when:**
- Feature is used by < 30% of users daily
- Feature is contextual (depends on selection)
- Feature is advanced/power-user
- Feature is occasional (billing, settings, reports)
- Screen real estate is limited

**Don't use when:**
- Feature is primary workflow (> 50% daily usage)
- Hiding creates confusion ("where is X?")
- User expects it in navigation (muscle memory)

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| **Discoverable** | Clear trigger with icon + label, `aria-expanded` |
| **Predictable** | Consistent patterns (inline, drawer, modal, collapse, tab) |
| **Reversible** | Easy to close, Escape key, click backdrop |
| **Accessible** | Focus trap, ARIA roles, focus return, live regions |
| **Performant** | Lazy-load content, CSS-only animations |

## Pattern Taxonomy

```
ProgressiveDisclosure (base)
├── InlineExpand (p-inline-expand)      // Expands in place, sibling content shifts
├── Drawer (p-drawer-pattern)           // Slides from right, overlay backdrop
│   ├── SideDrawer (md: 320px)          // Contextual details
│   ├── SlideOverPanel (lg: 480px)      // Forms, wizards
│   ├── FullScreenModal (100vw)         // Complex workflows
│   └── ModalDrawer (centered 400px)    // Confirmations, simple forms
├── Collapse (p-collapse-pattern)       // Vertical expand/collapse
│   ├── ExpandableCard                  // Card sections
│   ├── ExpandableRow                   // Table rows
│   └── Accordion                       // Multiple sections
├── TabConversion (p-tab-conversion)    // Menu item → tab
└── BannerDrawer (composite)            // Banner + drawer combo
```

## Shared API (TypeScript)

```typescript
// Base props for all progressive components
interface ProgressiveBaseProps {
  open: boolean;
  onClose: () => void;
  id: string;                    // For ARIA linking
  triggerRef?: React.RefObject<HTMLElement>; // For focus return
  className?: string;
  children: React.ReactNode;
}

// Sizes
type DrawerSize = "sm" | "md" | "lg" | "full" | "responsive";

interface DrawerProps extends ProgressiveBaseProps {
  size: DrawerSize;
  position?: "right" | "left" | "center";
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

interface PanelProps extends ProgressiveBaseProps {
  animate?: boolean;             // Default true
  collapseHeight?: number;       // Max height when open
}
```

## Animation Tokens (from `k-dashstack-tokens`)

```css
/* In lumaway-dashstack-restyle.css Section 18 */
@keyframes ds-slide-down {
  from { opacity: 0; transform: translateY(-6px); max-height: 0; }
  to   { opacity: 1; transform: translateY(0); max-height: 500px; }
}
@keyframes ds-slide-up {
  from { opacity: 1; transform: translateY(0); max-height: 500px; }
  to   { opacity: 0; transform: translateY(-6px); max-height: 0; }
}
@keyframes ds-slide-right {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes ds-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ds-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes ds-expand-height { from { max-height: 0; opacity: 0; } to { max-height: 800px; opacity: 1; } }
@keyframes ds-collapse-height { from { max-height: 800px; opacity: 1; } to { max-height: 0; opacity: 0; } }

/* Utility classes */
.ds-progressive-panel { animation: ds-slide-down 0.2s ease both; overflow: hidden; }
.ds-progressive-panel.closing { animation: ds-slide-up 0.15s ease both; }
.ds-drawer { animation: ds-slide-right 0.22s ease both; }
.ds-fade { animation: ds-fade-in 0.15s ease both; }
.ds-expand { animation: ds-expand-height 0.25s ease both; }
.ds-collapse { animation: ds-collapse-height 0.2s ease both; }
.ds-chevron { display: inline-flex; transition: transform 0.2s ease; }
.ds-chevron.rotated { transform: rotate(180deg); }
```

## Accessibility Checklist (All Patterns)

- [ ] `role="dialog"` + `aria-modal="true"` (modals/drawers)
- [ ] `aria-labelledby` pointing to panel title
- [ ] `aria-describedby` for description (optional)
- [ ] Focus trap when open (FocusTrap React or custom)
- [ ] Focus returns to trigger on close
- [ ] Escape key closes
- [ ] Click backdrop closes (configurable)
- [ ] `aria-expanded` on trigger button
- [ ] `aria-controls` linking trigger → panel
- [ ] `aria-hidden` on panel when closed
- [ ] Live region for open/close announcements
- [ ] Keyboard navigation within panel (Tab/Shift+Tab)

## Implementation Guide

### 1. Lazy Load Content
```tsx
const DataHealthCenter = lazy(() => import("./DataHealthCenter"));
const CreatorSamples = lazy(() => import("./CreatorSamples"));

<ProgressivePanel open={isOpen} onClose={onClose}>
  <Suspense fallback={<PanelSkeleton />}>
    <DataHealthCenter workspaceId={workspaceId} />
  </Suspense>
</ProgressivePanel>
```

### 2. Focus Management
```tsx
function useFocusTrap(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    // Trap focus
    const focusable = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function handleTab(e: KeyboardEvent) {
      if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first?.focus();
        }
      }
      if (e.key === "Escape") onClose();
    }
    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, [open, onClose]);

  return containerRef;
}
```

### 3. Focus Return
```tsx
function useFocusReturn(open: boolean, triggerRef: RefObject<HTMLElement>, onClose: () => void) {
  const wasOpen = useRef(open);
  useEffect(() => {
    if (wasOpen.current && !open && triggerRef.current) {
      triggerRef.current.focus();
    }
    wasOpen.current = open;
  }, [open, triggerRef, onClose]);
}
```

## Testing Checklist

- [ ] Opens on trigger click
- [ ] Closes on Escape
- [ ] Closes on backdrop click (if applicable)
- [ ] Focus trapped inside
- [ ] Focus returns to trigger
- [ ] Screen reader announces open/close
- [ ] Animations smooth (60fps)
- [ ] No layout shift on open/close
- [ ] Lazy content loads correctly
- [ ] Works on mobile (touch, swipe)
- [ ] Respects `prefers-reduced-motion`