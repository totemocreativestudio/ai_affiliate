// DashStack Component Patterns — CSS-only component definitions
// These are patterns implemented via restyle layer CSS utility classes
// React components should compose these classes

export const dashstackComponents = {
  // Card
  card: {
    base: "card",
    kpi: "dashboard-kpi-card",
    ownerMetric: "owner-metric",
    pmShell: "pm-shell",
    pmStats: "pm-stats",
    listingTable: "listing-v2-table-wrap",
    shippingTable: "shipping-v2-table-wrap",
    campaignTable: "campaign-v1-table-wrap",
    rateTable: "rate-v2-table-wrap",
  },

  // Button
  button: {
    primary: "primary",
    authPrimary: "auth-primary-button",
    aspPrimary: "asp-primary",
    authV7Primary: "auth-v7-primary",
    secondary: "button",
    content: "content button",
    sheetTabs: "sheet-tabs button",
    authTabs: "auth-v7-tabs button",
  },

  // Input
  input: {
    base: "content input",
    select: "content select",
    textarea: "content textarea",
    checkbox: "content input[type=checkbox]",
    radio: "content input[type=radio]",
  },

  // Table
  table: {
    base: "scroll table",
    listing: "listing-v2-table",
    shipping: "shipping-v2-table",
    campaign: "campaign-v1-table",
    rate: "rate-v2-table",
  },

  // Status Pill
  statusPill: {
    base: "status-pill",
    paid: "s-paid",
    pending: "s-pending",
    failed: "s-failed",
    processing: "s-processing",
    pmOk: "pm-status ok",
    pmAlertRed: "pm-alert-red",
  },

  // Auth
  auth: {
    standalone: "standalone-auth",
    shell: "auth-shell",
  },

  // Page Head
  pageHead: {
    base: "page-head",
    main: "page-head-main",
    actions: "page-head-actions",
  },

  // Section Head
  sectionHead: {
    base: "section-head",
    title: "section-head > div:first-child",
    actions: "section-head-actions",
  },

  // Grid
  grid: {
    base: "grid",
    dashboard: "dashboard-grid",
    card: "card-grid",
    kpi: "kpi-grid",
  },

  // Empty State
  emptyState: {
    base: "empty-state",
    smart: "smart-empty",
    noData: "no-data",
  },

  // Progressive Disclosure
  progressive: {
    panel: "ds-progressive-panel",
    drawer: "ds-drawer",
    fade: "ds-fade",
    expand: "ds-expand",
    collapse: "ds-collapse",
    chevron: "ds-chevron",
    chevronRotated: "ds-chevron rotated",
  },

  // Utility Classes
  utility: {
    mt1: "mt-1", mt2: "mt-2", mt3: "mt-3", mt4: "mt-4", mt5: "mt-5", mt6: "mt-6",
    mb1: "mb-1", mb2: "mb-2", mb3: "mb-3", mb4: "mb-4",
    gap2: "gap-2", gap3: "gap-3", gap4: "gap-4",
  },
} as const;

// React Component Helpers (for className composition)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function cardClassName(variant?: keyof typeof dashstackComponents.card): string {
  const base = dashstackComponents.card.base;
  return variant ? cn(base, dashstackComponents.card[variant]) : base;
}

export function buttonClassName(variant: keyof typeof dashstackComponents.button): string {
  return dashstackComponents.button[variant];
}

export function statusPillClassName(status: keyof typeof dashstackComponents.statusPill): string {
  const base = dashstackComponents.statusPill.base;
  return cn(base, dashstackComponents.statusPill[status]);
}

export function gridClassName(variant: keyof typeof dashstackComponents.grid): string {
  return dashstackComponents.grid[variant];
}

export function progressiveClassName(variant: keyof typeof dashstackComponents.progressive): string {
  return dashstackComponents.progressive[variant];
}