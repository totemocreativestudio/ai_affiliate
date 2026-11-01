// DashStack Design Tokens — TypeScript Definitions
// Single source of truth for all --ds-* CSS custom properties
// Mirrors k-dashstack-tokens.md and restyle layer :root

export const dashstackTokens = {
  // Color Primitives
  color: {
    bg: "#f7f8fa",
    card: "#ffffff",
    line: "#e6eaf1",
    lineSoft: "#eef1f6",
    ink: "#141b2d",
    inkHead: "#101828",
    muted: "#667085",
    muted2: "#98a2b3",
    primary: "#4880ff",
    primaryHover: "#3a6ef0",
    primarySoft: "#ecf2ff",
    success: "#12b76a",
    successSoft: "#ecfdf3",
    warning: "#f79009",
    warningSoft: "#fef4e6",
    danger: "#f04438",
    dangerSoft: "#fef3f2",
    info: "#0ea5e9",
    infoSoft: "#f0f9ff",
  },

  // Spacing (4px grid)
  space: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
  },

  // Typography
  typography: {
    fontFamily: '"Nunito Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontFamilyMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    size: {
      xs: "12px",
      sm: "13px",
      base: "14px",
      lg: "16px",
      xl: "18px",
      "2xl": "22px",
      "3xl": "28px",
      "4xl": "34px",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.65",
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  // Border Radius
  radius: {
    default: "16px",
    sm: "10px",
  },

  // Elevation (Shadows)
  shadow: {
    sm: "0 1px 2px rgba(16, 24, 40, 0.05)",
    default: "0 1px 3px rgba(16, 24, 40, 0.06), 0 6px 16px rgba(16, 24, 40, 0.05)",
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

  // Breakpoints (for reference, used in media queries)
  breakpoints: {
    mobile: "640px",
    tablet: "1024px",
    desktop: "1280px",
  },

  // Focus
  focus: {
    ring: "2px solid #4880ff",
    offset: "2px",
  },

  // Touch Targets
  touchTarget: {
    minSize: "44px",
  },
} as const;

// CSS Variable Names (for injection)
export const cssVariables = {
  // Color
  "--ds-bg": dashstackTokens.color.bg,
  "--ds-card": dashstackTokens.color.card,
  "--ds-line": dashstackTokens.color.line,
  "--ds-line-soft": dashstackTokens.color.lineSoft,
  "--ds-ink": dashstackTokens.color.ink,
  "--ds-ink-head": dashstackTokens.color.inkHead,
  "--ds-muted": dashstackTokens.color.muted,
  "--ds-muted-2": dashstackTokens.color.muted2,
  "--ds-primary": dashstackTokens.color.primary,
  "--ds-primary-hover": dashstackTokens.color.primaryHover,
  "--ds-primary-soft": dashstackTokens.color.primarySoft,
  "--ds-success": dashstackTokens.color.success,
  "--ds-success-soft": dashstackTokens.color.successSoft,
  "--ds-warning": dashstackTokens.color.warning,
  "--ds-warning-soft": dashstackTokens.color.warningSoft,
  "--ds-danger": dashstackTokens.color.danger,
  "--ds-danger-soft": dashstackTokens.color.dangerSoft,
  "--ds-info": dashstackTokens.color.info,
  "--ds-info-soft": dashstackTokens.color.infoSoft,

  // Spacing
  "--ds-space-1": dashstackTokens.space[1],
  "--ds-space-2": dashstackTokens.space[2],
  "--ds-space-3": dashstackTokens.space[3],
  "--ds-space-4": dashstackTokens.space[4],
  "--ds-space-5": dashstackTokens.space[5],
  "--ds-space-6": dashstackTokens.space[6],
  "--ds-space-8": dashstackTokens.space[8],
  "--ds-space-10": dashstackTokens.space[10],
  "--ds-space-12": dashstackTokens.space[12],

  // Typography
  "--ds-text-xs": dashstackTokens.typography.size.xs,
  "--ds-text-sm": dashstackTokens.typography.size.sm,
  "--ds-text-base": dashstackTokens.typography.size.base,
  "--ds-text-lg": dashstackTokens.typography.size.lg,
  "--ds-text-xl": dashstackTokens.typography.size.xl,
  "--ds-text-2xl": dashstackTokens.typography.size["2xl"],
  "--ds-text-3xl": dashstackTokens.typography.size["3xl"],
  "--ds-text-4xl": dashstackTokens.typography.size["4xl"],
  "--ds-leading-tight": dashstackTokens.typography.lineHeight.tight,
  "--ds-leading-normal": dashstackTokens.typography.lineHeight.normal,
  "--ds-leading-relaxed": dashstackTokens.typography.lineHeight.relaxed,

  // Radius
  "--ds-radius": dashstackTokens.radius.default,
  "--ds-radius-sm": dashstackTokens.radius.sm,

  // Shadow
  "--ds-shadow-sm": dashstackTokens.shadow.sm,
  "--ds-shadow": dashstackTokens.shadow.default,

  // Focus
  "--ds-focus-ring": dashstackTokens.focus.ring,
  "--ds-focus-offset": dashstackTokens.focus.offset,

  // Touch
  "--ds-touch-target": dashstackTokens.touchTarget.minSize,
} as const;

// Type for CSS variable keys
export type DashStackCSSVariable = keyof typeof cssVariables;

// Helper to get CSS variable value
export function getCSSVariable(name: DashStackCSSVariable): string {
  return cssVariables[name];
}

// Helper to generate :root CSS
export function generateRootCSS(): string {
  const lines = Object.entries(cssVariables).map(([key, value]) => `  ${key}: ${value};`);
  return `:root {\n${lines.join("\n")}\n}`;
}