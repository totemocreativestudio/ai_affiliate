---
id: m-group-defaults
title: Sidebar Group Defaults
type: mapping
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [navigation, sidebar, defaults, groups, persistence]
relationships:
  - type: relates-to
    target: m-sidebar-map
    description: "Relates to sidebar navigation map"
  - type: references
    target: sk-sidebar-management
    description: "Referenced by sidebar management skill"
governance:
  review-cycle: 90d
  last-reviewed: 2026-11-01
---

# Sidebar Group Defaults — Open/Closed Per Role

## Default Open Groups by Role

| Role | Open Groups | Rationale |
|------|-------------|-----------|
| **Admin/Owner** | `data`, `administration` | Owner needs admin console + core data |
| **Creator Manager** | `data`, `ai`, `affiliate` | Core workflow: data + insights + creators |
| **Merchant/Ops** | `data`, `commerce` | Core workflow: data + product/commerce |
| **Marketing/Growth** | `data`, `growth` | Core workflow: data + growth tools |
| **Default (new user)** | `data`, `ai`, `affiliate` | Balanced onboarding |

## Group Definitions

```typescript
interface GroupConfig {
  id: string;
  label: string;
  icon: string;
  defaultOpen: Record<string, boolean>; // role -> open
  sections: string[];
}

const GROUP_CONFIGS: GroupConfig[] = [
  {
    id: "data",
    label: "WORKSPACE",
    icon: "data",
    defaultOpen: { admin: true, "creator-manager": true, merchant: true, marketing: true, default: true },
    sections: ["dashboard", "upload", "database", "data-health", "excel-sync", "tutorial"]
  },
  {
    id: "ai",
    label: "INSIGHTS & ANALYSIS",
    icon: "performance",
    defaultOpen: { admin: false, "creator-manager": true, merchant: false, marketing: false, default: true },
    sections: ["ai-analytics", "recommendation", "performance", "product", "creator"]
  },
  {
    id: "affiliate",
    label: "AFFILIATE & CREATOR",
    icon: "creator",
    defaultOpen: { admin: false, "creator-manager": true, merchant: false, marketing: false, default: true },
    sections: ["affiliate-360", "agreements", "affiliate-support", "creator-samples", "ratecard"]
  },
  {
    id: "live",
    label: "LIVE STREAMING",
    icon: "performance",
    defaultOpen: { admin: false, "creator-manager": false, merchant: false, marketing: false, default: false },
    sections: ["live-streaming"]
  },
  {
    id: "commerce",
    label: "PRODUCT & COMMERCE",
    icon: "product",
    defaultOpen: { admin: false, "creator-manager": false, merchant: true, marketing: false, default: false },
    sections: ["product-master", "listings", "shipping", "spending"]
  },
  {
    id: "growth",
    label: "GROWTH & WORKFLOW",
    icon: "kanban",
    defaultOpen: { admin: false, "creator-manager": false, merchant: false, marketing: true, default: false },
    sections: ["daily-brief", "automation-rules", "goal-forecast", "scheduled-reports", "campaign-tracker", "promo-studio", "kanban"]
  },
  {
    id: "support",
    label: "SUPPORT & BILLING",
    icon: "ticket",
    defaultOpen: { admin: false, "creator-manager": false, merchant: false, marketing: false, default: false },
    sections: ["support-tickets", "billing", "luma-affiliate"]
  },
  {
    id: "content",
    label: "CONTENT & COMMUNITY",
    icon: "content",
    defaultOpen: { admin: false, "creator-manager": false, merchant: false, marketing: false, default: false },
    sections: ["content-hub", "social-lumaway"]
  },
];
```

## Persistence Schema

```typescript
// localStorage: "lumaway_sidebar_groups"
// Value: { [groupId: string]: boolean }
// Example: { "data": true, "ai": true, "affiliate": true, "live": false, ... }

function readGroupStates(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem("lumaway_sidebar_groups") || "{}");
  } catch { return {}; }
}

function writeGroupStates(states: Record<string, boolean>): void {
  localStorage.setItem("lumaway_sidebar_groups", JSON.stringify(states));
}

function getInitialGroupStates(role: string): Record<string, boolean> {
  const stored = readGroupStates();
  const defaults: Record<string, boolean> = {};
  GROUP_CONFIGS.forEach(g => {
    defaults[g.id] = g.defaultOpen[role] ?? g.defaultOpen.default ?? false;
  });
  // Merge: stored overrides defaults for explicitly toggled groups
  return { ...defaults, ...stored };
}

function toggleGroup(groupId: string, currentStates: Record<string, boolean>): Record<string, boolean> {
  const next = { ...currentStates, [groupId]: !currentStates[groupId] };
  writeGroupStates(next);
  return next;
}
```

## Role Detection

```typescript
function getUserRole(profile: { role: string }): string {
  if (profile.role === "admin") return "admin";
  // Could extend: check permissions, teams, etc.
  return "default";
}
```

## Mobile Behavior

- Groups **always closed** on mobile (< 1024px) initially
- User opens group → persists in localStorage
- Mobile drawer closes on route change
- Group state synced across desktop/mobile via localStorage