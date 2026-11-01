// ProgressiveDrawer — Side drawer, slide-over, full-screen, modal drawer
// Implements p-drawer-pattern and p-modal-pattern

import { useEffect, useRef, useId, Fragment } from "react";
import { cn, DrawerSize } from "./utils";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  size: DrawerSize;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  showBackdrop?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  triggerRef?: React.RefObject<HTMLElement>;
}

export function ProgressiveDrawer({
  open,
  onClose,
  size,
  title,
  children,
  footer,
  showBackdrop = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  triggerRef,
}: DrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const wasOpen = useRef(open);

  // Focus trap
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const container = containerRef.current;
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
      if (e.key === "Escape" && closeOnEscape) onClose();
    }
    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, [open, closeOnEscape, onClose]);

  // Focus return to trigger
  useEffect(() => {
    if (wasOpen.current && !open && triggerRef?.current) {
      triggerRef.current.focus();
    }
    wasOpen.current = open;
  }, [open, triggerRef]);

  if (!open) return null;

  const sizeClass = {
    sm: "drawer-sm",
    lg: "drawer-lg",
    full: "drawer-full",
    centered: "drawer-centered",
    responsive: "drawer-responsive",
  }[size] || "drawer-sm";

  return (
    <Fragment>
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
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="drawer-content">
          {children}
        </div>
        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </Fragment>
  );
}

// DrawerSize is exported from ./utils