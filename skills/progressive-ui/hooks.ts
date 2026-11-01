// Utility hooks for progressive UI components

import { useEffect, useRef } from "react";

/**
 * Focus trap hook for modals, drawers, and panels
 * Traps Tab/Shift+Tab focus within container
 */
export function useFocusTrap(
  open: boolean,
  onClose: () => void,
  options?: { closeOnEscape?: boolean }
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { closeOnEscape = true } = options || {};

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
      if (e.key === "Escape") onClose();
    }

    container.addEventListener("keydown", handleTab);
    return () => container.removeEventListener("keydown", handleTab);
  }, [open, onClose]);

  return containerRef;
}

/**
 * Focus return hook — returns focus to trigger element on close
 */
export function useFocusReturn(
  open: boolean,
  triggerRef: React.RefObject<HTMLElement> | null,
  onClose: () => void
) {
  const wasOpen = useRef(open);

  useEffect(() => {
    if (wasOpen.current && !open && triggerRef?.current) {
      triggerRef.current.focus();
    }
    wasOpen.current = open;
  }, [open, triggerRef, onClose]);
}

/**
 * Combined hook for progressive components
 * Returns refs for container and trigger
 */
export function useProgressiveFocus(
  open: boolean,
  onClose: () => void,
  options?: { closeOnEscape?: boolean }
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  useFocusTrap(open, onClose, options);
  useFocusReturn(open, triggerRef, onClose);

  return { containerRef, triggerRef };
}