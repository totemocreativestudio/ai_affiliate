// ProgressivePanel — Inline expandable panel
// Implements p-inline-expand and p-collapse-pattern (panel variant)

import { useEffect, useRef, useId, Fragment } from "react";

interface PanelProps {
  open: boolean;
  onClose: () => void;
  id: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  children: React.ReactNode;
  animate?: boolean;
  className?: string;
}

export function ProgressivePanel({
  open,
  onClose,
  id,
  triggerLabel,
  triggerIcon,
  children,
  animate = true,
  className,
}: PanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Animate height smoothly
  useEffect(() => {
    if (!animate || !contentRef.current) return;
    contentRef.current.style.maxHeight = open
      ? `${contentRef.current.scrollHeight}px`
      : "0";
    contentRef.current.style.opacity = open ? "1" : "0";
  }, [open, animate]);

  return (
    <Fragment>
      <button
        className="inline-expand-trigger ds-progressive-trigger"
        onClick={onClose}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        type="button"
      >
        {triggerIcon}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`ds-chevron ${open ? "rotated" : ""}`} aria-hidden="true">
          <path d="M5 6L8 9L11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div
        ref={contentRef}
        id={`${id}-panel`}
        className={`inline-expand-panel ds-progressive-panel ${className || ""}`}
        style={{ maxHeight: open ? "500px" : "0", opacity: open ? 1 : 0 }}
        aria-hidden={!open}
      >
        <div className="inline-expand-content">
          {children}
        </div>
      </div>
    </Fragment>
  );
}