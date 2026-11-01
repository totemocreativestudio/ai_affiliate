// Progressive UI Utilities

export type DrawerSize = "sm" | "lg" | "full" | "centered" | "responsive";

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Focusable element selectors for focus trap
export const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

// Get all focusable elements within container
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

// Get first and last focusable elements
export function getFocusBoundaries(container: HTMLElement): { first: HTMLElement | null; last: HTMLElement | null } {
  const elements = getFocusableElements(container);
  return { first: elements[0] || null, last: elements[elements.length - 1] || null };
}

// Lock/unlock body scroll
export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  const scrollY = window.scrollY;
  document.body.style.position = "fixed";
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = "100%";
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  const scrollY = parseInt(document.body.style.top || "0", 10) * -1;
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.width = "";
  window.scrollTo(0, scrollY);
}