// DashStack Utilities — Spacing, Typography, Focus, Scrollbar, Touch Targets
// Utility classes for direct use in components

import { dashstackTokens } from "./tokens";

export const dashstackUtilities = {
  // Spacing Utilities (from restyle Section 17)
  spacing: {
    marginTop: {
      mt1: "var(--ds-space-1)",
      mt2: "var(--ds-space-2)",
      mt3: "var(--ds-space-3)",
      mt4: "var(--ds-space-4)",
      mt5: "var(--ds-space-5)",
      mt6: "var(--ds-space-6)",
    },
    marginBottom: {
      mb1: "var(--ds-space-1)",
      mb2: "var(--ds-space-2)",
      mb3: "var(--ds-space-3)",
      mb4: "var(--ds-space-4)",
    },
    gap: {
      gap2: "var(--ds-space-2)",
      gap3: "var(--ds-space-3)",
      gap4: "var(--ds-space-4)",
    },
  },

  // Typography Utilities
  typography: {
    fontSize: {
      xs: "var(--ds-text-xs)",
      sm: "var(--ds-text-sm)",
      base: "var(--ds-text-base)",
      lg: "var(--ds-text-lg)",
      xl: "var(--ds-text-xl)",
      "2xl": "var(--ds-text-2xl)",
      "3xl": "var(--ds-text-3xl)",
      "4xl": "var(--ds-text-4xl)",
    },
    lineHeight: {
      tight: "var(--ds-leading-tight)",
      normal: "var(--ds-leading-normal)",
      relaxed: "var(--ds-leading-relaxed)",
    },
    fontWeight: {
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  // Color Utilities
  color: {
    text: {
      primary: "var(--ds-ink)",
      heading: "var(--ds-ink-head)",
      muted: "var(--ds-muted)",
      muted2: "var(--ds-muted-2)",
      accent: "var(--ds-primary)",
      success: "var(--ds-success)",
      warning: "var(--ds-warning)",
      danger: "var(--ds-danger)",
      info: "var(--ds-info)",
    },
    bg: {
      primary: "var(--ds-bg)",
      card: "var(--ds-card)",
      primarySoft: "var(--ds-primary-soft)",
      successSoft: "var(--ds-success-soft)",
      warningSoft: "var(--ds-warning-soft)",
      dangerSoft: "var(--ds-danger-soft)",
      infoSoft: "var(--ds-info-soft)",
    },
    border: {
      default: "var(--ds-line)",
      soft: "var(--ds-line-soft)",
      primary: "var(--ds-primary)",
    },
  },

  // Border Radius
  radius: {
    default: "var(--ds-radius)",
    sm: "var(--ds-radius-sm)",
  },

  // Shadow
  shadow: {
    sm: "var(--ds-shadow-sm)",
    default: "var(--ds-shadow)",
  },

  // Focus
  focus: {
    ring: "var(--ds-focus-ring)",
    offset: "var(--ds-focus-offset)",
  },

  // Z-Index
  zIndex: {
    dropdown: 100,
    sticky: 200,
    sidebar: 300,
    modalBackdrop: 400,
    modal: 500,
    toast: 600,
    tooltip: 700,
  },

  // Breakpoints
  breakpoints: {
    mobile: "640px",
    tablet: "1024px",
    desktop: "1280px",
  },
} as const;

// Generate utility CSS classes
export function generateUtilityCSS(): string {
  const rules: string[] = [];

  // Spacing
  Object.entries(dashstackUtilities.spacing.marginTop).forEach(([cls, val]) => {
    rules.push(`.${cls} { margin-top: ${val} !important; }`);
  });
  Object.entries(dashstackUtilities.spacing.marginBottom).forEach(([cls, val]) => {
    rules.push(`.${cls} { margin-bottom: ${val} !important; }`);
  });
  Object.entries(dashstackUtilities.spacing.gap).forEach(([cls, val]) => {
    rules.push(`.${cls} { gap: ${val} !important; }`);
  });

  // Focus Visible (global)
  rules.push(`
*:focus-visible {
  outline: var(--ds-focus-ring) !important;
  outline-offset: var(--ds-focus-offset) !important;
}
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: var(--ds-focus-ring) !important;
  outline-offset: var(--ds-focus-offset) !important;
}`);

  // Touch Targets (mobile)
  rules.push(`
@media (pointer: coarse) {
  .side-nav a,
  .side-nav > button,
  .side-group summary,
  .topbar button,
  .connection-pill,
  .card button,
  .button,
  .primary,
  .content button,
  .pagination button,
  .tab-button {
    min-height: 44px !important;
    min-width: 44px !important;
  }
}`);

  // Scrollbar
  rules.push(`
::-webkit-scrollbar { width: 8px !important; height: 8px !important; }
::-webkit-scrollbar-track { background: transparent !important; }
::-webkit-scrollbar-thumb { background: var(--ds-line) !important; border-radius: 4px !important; border: 2px solid transparent !important; background-clip: content-box !important; }
::-webkit-scrollbar-thumb:hover { background: var(--ds-muted-2) !important; }
html { scrollbar-width: thin !important; scrollbar-color: var(--ds-line) transparent !important; }`);

  // Reduced Motion
  rules.push(`
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}`);

  return rules.join("\n\n");
}

// React Hook for consuming tokens
export function useDashStackTokens() {
  return dashstackTokens;
}

// CSS-in-JS helpers for components
export const styleHelpers = {
  // Spacing
  mt: (n: 1 | 2 | 3 | 4 | 5 | 6) => ({ marginTop: `var(--ds-space-${n})` }),
  mb: (n: 1 | 2 | 3 | 4) => ({ marginBottom: `var(--ds-space-${n})` }),
  gap: (n: 2 | 3 | 4) => ({ gap: `var(--ds-space-${n})` }),
  p: (n: 1 | 2 | 3 | 4 | 5) => ({ padding: `var(--ds-space-${n})` }),
  px: (n: 1 | 2 | 3 | 4 | 5) => ({ paddingLeft: `var(--ds-space-${n})`, paddingRight: `var(--ds-space-${n})` }),
  py: (n: 1 | 2 | 3 | 4 | 5) => ({ paddingTop: `var(--ds-space-${n})`, paddingBottom: `var(--ds-space-${n})` }),

  // Typography
  text: (size: keyof typeof dashstackTokens.typography.size) => ({ fontSize: `var(--ds-text-${size})` }),
  leading: (type: keyof typeof dashstackTokens.typography.lineHeight) => ({ lineHeight: `var(--ds-leading-${type})` }),
  fontWeight: (weight: keyof typeof dashstackTokens.typography.weight) => ({ fontWeight: dashstackTokens.typography.weight[weight] }),

  // Color
  textColor: (color: keyof typeof dashstackUtilities.color.text) => ({ color: `var(--ds-${color.replace(/([A-Z])/g, "-$1").toLowerCase()})` }),
  bgColor: (color: keyof typeof dashstackUtilities.color.bg) => ({ backgroundColor: `var(--ds-${color.replace(/([A-Z])/g, "-$1").toLowerCase()})` }),
  borderColor: (color: keyof typeof dashstackUtilities.color.border) => ({ borderColor: `var(--ds-${color.replace(/([A-Z])/g, "-$1").toLowerCase()})` }),

  // Radius
  radius: (size: keyof typeof dashstackTokens.radius) => ({ borderRadius: `var(--ds-radius${size === "default" ? "" : "-sm"})` }),

  // Shadow
  shadow: (size: keyof typeof dashstackTokens.shadow) => ({ boxShadow: `var(--ds-shadow${size === "default" ? "" : "-sm"})` }),

  // Focus
  focusRing: () => ({ outline: "var(--ds-focus-ring)", outlineOffset: "var(--ds-focus-offset)" }),

  // Transitions
  transition: (props: string[] = ["all"], duration = "0.16s", easing = "ease") => ({
    transition: props.map(p => `${p} ${duration} ${easing}`).join(", "),
  }),
};