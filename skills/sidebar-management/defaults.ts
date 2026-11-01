// Sidebar Group Defaults Configuration
// Mirrors m-group-defaults.md and m-sidebar-map.md

export type Role = "admin" | "creator-manager" | "merchant" | "marketing" | "default";

export interface GroupConfig {
  id: string;
  label: string;
  icon: string;
  defaultOpen: Record<Role, boolean>;
  sections: string[];
}

export const GROUP_CONFIGS = [
  {
    id: "data",
    label: "WORKSPACE",
    icon: "data",
    defaultOpen: {
      admin: true,
      "creator-manager": true,
      merchant: true,
      marketing: true,
      default: true,
    },
    sections: ["dashboard", "upload", "database", "data-health", "excel-sync", "tutorial"],
  },
  {
    id: "ai",
    label: "INSIGHTS & ANALYSIS",
    icon: "performance",
    defaultOpen: {
      admin: false,
      "creator-manager": true,
      merchant: false,
      marketing: false,
      default: true,
    },
    sections: ["ai-analytics", "recommendation", "performance", "product", "creator"],
  },
  {
    id: "affiliate",
    label: "AFFILIATE & CREATOR",
    icon: "creator",
    defaultOpen: {
      admin: false,
      "creator-manager": true,
      merchant: false,
      marketing: false,
      default: true,
    },
    sections: ["affiliate-360", "agreements", "affiliate-support", "creator-samples", "ratecard"],
  },
  {
    id: "live",
    label: "LIVE STREAMING",
    icon: "performance",
    defaultOpen: {
      admin: false,
      "creator-manager": false,
      merchant: false,
      marketing: false,
      default: false,
    },
    sections: ["live-streaming"],
  },
  {
    id: "commerce",
    label: "PRODUCT & COMMERCE",
    icon: "product",
    defaultOpen: {
      admin: false,
      "creator-manager": false,
      merchant: true,
      marketing: false,
      default: false,
    },
    sections: ["product-master", "listings", "shipping", "spending"],
  },
  {
    id: "growth",
    label: "GROWTH & WORKFLOW",
    icon: "kanban",
    defaultOpen: {
      admin: false,
      "creator-manager": false,
      merchant: false,
      marketing: true,
      default: false,
    },
    sections: ["daily-brief", "automation-rules", "goal-forecast", "scheduled-reports", "campaign-tracker", "promo-studio", "kanban"],
  },
  {
    id: "support",
    label: "SUPPORT & BILLING",
    icon: "ticket",
    defaultOpen: {
      admin: false,
      "creator-manager": false,
      merchant: false,
      marketing: false,
      default: false,
    },
    sections: ["support-tickets", "billing", "luma-affiliate"],
  },
  {
    id: "content",
    label: "CONTENT & COMMUNITY",
    icon: "content",
    defaultOpen: {
      admin: false,
      "creator-manager": false,
      merchant: false,
      marketing: false,
      default: false,
    },
    sections: ["content-hub", "social-lumaway"],
  },
] as const satisfies readonly GroupConfig[];

// Type for group IDs
export type GroupId = typeof GROUP_CONFIGS[number]["id"];

// Section IDs (for navigation)
export const SECTION_IDS = GROUP_CONFIGS.flatMap(g => g.sections) as readonly string[];

// Role detection
export function getUserRole(profile: { role: string }): Role {
  if (profile.role === "admin") return "admin";
  // Extend with more sophisticated role detection if needed
  return "default";
}

// Get default open state for a role
export function getDefaultOpenGroups(role: Role): Record<GroupId, boolean> {
  const defaults: Record<GroupId, boolean> = {} as Record<GroupId, boolean>;
  GROUP_CONFIGS.forEach(g => {
    defaults[g.id] = g.defaultOpen[role] ?? g.defaultOpen.default ?? false;
  });
  return defaults;
}

// Get all group configs for a role with computed open state
export function getGroupsForRole(role: Role, overrides?: Record<GroupId, boolean>) {
  const defaults = getDefaultOpenGroups(role);
  return GROUP_CONFIGS.map(g => ({
    ...g,
    open: overrides?.[g.id] ?? defaults[g.id],
  }));
}