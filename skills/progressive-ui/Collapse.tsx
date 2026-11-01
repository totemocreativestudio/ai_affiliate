// ExpandableCard — Card with expandable content section
// Implements p-collapse-pattern (expandable card variant)

import { useState, useRef, useEffect, useId } from "react";

interface ExpandableCardProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ExpandableCard({
  title,
  subtitle,
  defaultOpen = false,
  triggerLabel,
  triggerIcon,
  children,
  className,
}: ExpandableCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Smooth height animation
  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.style.maxHeight = open
      ? `${contentRef.current.scrollHeight}px`
      : "0";
    contentRef.current.style.opacity = open ? "1" : "0";
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
          {triggerIcon || (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`ds-chevron ${open ? "rotated" : ""}`} aria-hidden="true">
              <path d="M5 6L8 9L11 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
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