// DashStack Animations — Keyframes & Utility Classes
// Mirrors restyle layer Section 18 + additional animations

export const dashstackAnimations = {
  // Keyframes
  keyframes: {
    // Progressive Disclosure
    "ds-slide-down": {
      from: { opacity: 0, transform: "translateY(-6px)", maxHeight: 0 },
      to: { opacity: 1, transform: "translateY(0)", maxHeight: "500px" },
    },
    "ds-slide-up": {
      from: { opacity: 1, transform: "translateY(0)", maxHeight: "500px" },
      to: { opacity: 0, transform: "translateY(-6px)", maxHeight: 0 },
    },
    "ds-slide-right": {
      from: { opacity: 0, transform: "translateX(12px)" },
      to: { opacity: 1, transform: "translateX(0)" },
    },
    "ds-fade-in": {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    "ds-fade-out": {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    "ds-expand-height": {
      from: { maxHeight: 0, opacity: 0 },
      to: { maxHeight: "800px", opacity: 1 },
    },
    "ds-collapse-height": {
      from: { maxHeight: "800px", opacity: 1 },
      to: { maxHeight: 0, opacity: 0 },
    },
    "ds-chevron-rotate": {
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(180deg)" },
    },
    // Page transitions
    "ds-page-reveal": {
      from: { opacity: 0, transform: "translateY(5px)" },
      to: { opacity: 1, transform: "translateY(0)" },
    },
    // Button hover
    "ds-button-hover": {
      from: { boxShadow: "0 1px 3px rgba(72, 128, 255, 0.35)" },
      to: { boxShadow: "0 2px 6px rgba(72, 128, 255, 0.4)" },
    },
  },

  // Animation Configurations
  animations: {
    // Progressive Disclosure
    "ds-progressive-panel": "ds-slide-down 0.2s ease both",
    "ds-progressive-panel.closing": "ds-slide-up 0.15s ease both",
    "ds-drawer": "ds-slide-right 0.22s ease both",
    "ds-fade": "ds-fade-in 0.15s ease both",
    "ds-expand": "ds-expand-height 0.25s ease both",
    "ds-collapse": "ds-collapse-height 0.2s ease both",
    "ds-chevron": "transform 0.2s ease",
    "ds-chevron.rotated": "rotate(180deg)",

    // Sidebar
    "sidebar-side-subnav": "max-height 0.2s ease, opacity 0.15s ease",
    "sidebar-side-subnav-closed": "max-height: 0; opacity: 0; pointer-events: none",
    "sidebar-side-subnav-open": "max-height: 500px; opacity: 1",

    // KPI Grid
    "kpi-row-hidden": "max-height 0.25s ease, opacity 0.15s ease",
    "kpi-row-hidden-closed": "max-height: 0; opacity: 0; pointer-events: none",
    "kpi-row-hidden-open": "max-height: 200px; opacity: 1",

    // Toolbar
    "toolbar-advanced": "max-height 0.2s ease, opacity 0.15s ease",
    "toolbar-advanced-collapsed": "max-height: 0; opacity: 0; pointer-events: none",
    "toolbar-advanced-expanded": "max-height: 200px; opacity: 1",

    // Page Reveal
    "page-reveal": "ds-page-reveal 0.18s ease both",

    // Button
    "button-hover": "ds-button-hover 0.15s ease",

    // Focus
    "focus-ring": "outline 0.1s ease",
  },

  // Utility Classes (CSS)
  utilityClasses: {
    // Progressive Disclosure
    ".ds-progressive-panel": { animation: "ds-slide-down 0.2s ease both", overflow: "hidden" },
    ".ds-progressive-panel.closing": { animation: "ds-slide-up 0.15s ease both" },
    ".ds-drawer": { animation: "ds-slide-right 0.22s ease both" },
    ".ds-fade": { animation: "ds-fade-in 0.15s ease both" },
    ".ds-expand": { animation: "ds-expand-height 0.25s ease both" },
    ".ds-collapse": { animation: "ds-collapse-height 0.2s ease both" },
    ".ds-chevron": { display: "inline-flex", transition: "transform 0.2s ease" },
    ".ds-chevron.rotated": { transform: "rotate(180deg)" },

    // Sidebar
    ".sidebar .side-group > .side-subnav": { overflow: "hidden", transition: "max-height 0.2s ease, opacity 0.15s ease" },
    ".sidebar .side-group:not([open]) > .side-subnav": { maxHeight: 0, opacity: 0, pointerEvents: "none" },
    ".sidebar .side-group[open] > .side-subnav": { maxHeight: "500px", opacity: 1 },

    // KPI Grid
    ".kpi-grid .kpi-row-hidden": { overflow: "hidden", transition: "max-height 0.25s ease, opacity 0.15s ease" },
    ".kpi-grid:not(.expanded) .kpi-row-hidden": { maxHeight: 0, opacity: 0, pointerEvents: "none" },
    ".kpi-grid.expanded .kpi-row-hidden": { maxHeight: "200px", opacity: 1 },

    // Toolbar
    ".toolbar-advanced": { overflow: "hidden", transition: "max-height 0.2s ease, opacity 0.15s ease" },
    ".toolbar-advanced.collapsed": { maxHeight: 0, opacity: 0, pointerEvents: "none" },
    ".toolbar-advanced.expanded": { maxHeight: "200px", opacity: 1 },

    // Focus Visible
    "*:focus-visible": { outline: "2px solid var(--ds-primary) !important", outlineOffset: "2px !important" },
    "button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible": { outline: "2px solid var(--ds-primary) !important", outlineOffset: "2px !important" },

    // Touch Targets
    "@media (pointer: coarse)": {
      ".side-nav a, .side-nav > button, .side-group summary, .topbar button, .connection-pill, .card button, .button, .primary, .content button, .pagination button, .tab-button": {
        minHeight: "44px !important",
        minWidth: "44px !important",
      },
    },

    // Scrollbar
    "::-webkit-scrollbar": { width: "8px !important", height: "8px !important" },
    "::-webkit-scrollbar-track": { background: "transparent !important" },
    "::-webkit-scrollbar-thumb": { background: "var(--ds-line) !important", borderRadius: "4px !important", border: "2px solid transparent !important", backgroundClip: "content-box !important" },
    "::-webkit-scrollbar-thumb:hover": { background: "var(--ds-muted-2) !important" },
    "html": { scrollbarWidth: "thin !important", scrollbarColor: "var(--ds-line) transparent !important" },

    // Reduced Motion
    "@media (prefers-reduced-motion: reduce)": {
      "*, *::before, *::after": {
        animationDuration: "0.01ms !important",
        animationIterationCount: "1 !important",
        transitionDuration: "0.01ms !important",
        scrollBehavior: "auto !important",
      },
    },
  },
} as const;

// Generate CSS for all animations
export function generateAnimationsCSS(): string {
  const keyframes = Object.entries(dashstackAnimations.keyframes)
    .map(([name, frames]) => {
      const frameRules = Object.entries(frames)
        .map(([selector, props]) => {
          const propStr = Object.entries(props)
            .map(([k, v]) => `${kebabCase(k)}: ${v};`)
            .join(" ");
          return `  ${selector} { ${propStr} }`;
        })
        .join("\n");
      return `@keyframes ${name} {\n${frameRules}\n}`;
    })
    .join("\n\n");

  const utilities = Object.entries(dashstackAnimations.utilityClasses)
    .map(([selector, props]) => {
      const propStr = Object.entries(props)
        .map(([k, v]) => `${kebabCase(k)}: ${v};`)
        .join(" ");
      return `${selector} { ${propStr} }`;
    })
    .join("\n");

  return `${keyframes}\n\n${utilities}`;
}

// Helper: camelCase to kebab-case
function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

// CSS-in-JS helper for React components
export const animationStyles = {
  progressivePanel: { animation: "ds-slide-down 0.2s ease both", overflow: "hidden" },
  progressivePanelClosing: { animation: "ds-slide-up 0.15s ease both" },
  drawer: { animation: "ds-slide-right 0.22s ease both" },
  fade: { animation: "ds-fade-in 0.15s ease both" },
  expand: { animation: "ds-expand-height 0.25s ease both" },
  collapse: { animation: "ds-collapse-height 0.2s ease both" },
  chevron: { transition: "transform 0.2s ease" },
  chevronRotated: { transform: "rotate(180deg)" },
};