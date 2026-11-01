---
id: d-003-sidebar-smart-defaults
title: Sidebar Smart Defaults Per Role
type: decision
status: approved
version: 1.0.0
owner: @surya
created: 2026-11-01
updated: 2026-11-01
tags: [decision, sidebar, defaults, roles, personalization]
relationships:
  - type: decides
    target: m-group-defaults
    description: "Decides on group defaults configuration"
  - type: governs
    target: sk-sidebar-management
    description: "Governs sidebar management skill implementation"
  - type: relates-to
    target: d-002-progressive-disclosure
    description: "Related to progressive disclosure (group visibility)"
governance:
  review-cycle: 365d
  last-reviewed: 2026-11-01
---

# ADR 003: Sidebar Smart Defaults Per Role

## Context

Sidebar has 8 groups with 28 features. Default all-open causes:
- Sidebar height exceeds viewport on laptop screens
- Cognitive overload for new users
- Irrelevant groups visible (e.g., Live Streaming for non-streamers)
- Mobile drawer unusable (too tall)

Owner requirement: "Semua fitur dipertahankan" (all features kept) but organized better.

## Decision

**Implement role-based default open/closed groups with localStorage persistence.**

### Default Open Groups by Role

| Role | Open Groups | Closed Groups | Rationale |
|------|-------------|---------------|-----------|
| **Admin/Owner** | `data`, `administration` | ai, affiliate, live, commerce, growth, support, content | Owner needs admin console + core data |
| **Creator Manager** | `data`, `ai`, `affiliate` | live, commerce, growth, support, content | Core workflow: data + insights + creators |
| **Merchant/Ops** | `data`, `commerce` | ai, affiliate, live, growth, support, content | Core workflow: data + product/commerce |
| **Marketing/Growth** | `data`, `growth` | ai, affiliate, live, commerce, support, content | Core workflow: data + growth tools |
| **Default (new user)** | `data`, `ai`, `affiliate` | live, commerce, growth, support, content | Balanced onboarding |

### Group Definitions

| Group ID | Label | Sections | Default Closed (Most Roles) |
|----------|-------|----------|------------------------------|
| `data` | WORKSPACE | dashboard, upload, database, data-health, excel-sync, tutorial | ❌ Never (core) |
| `ai` | INSIGHTS & ANALYSIS | ai-analytics, recommendation, performance, product, creator | ✅ Most roles |
| `affiliate` | AFFILIATE & CREATOR | affiliate-360, agreements, affiliate-support, creator-samples, ratecard | ✅ Most roles |
| `live` | LIVE STREAMING | live-streaming | ✅ All except specialist |
| `commerce` | PRODUCT & COMMERCE | product-master, listings, shipping, spending | ✅ Non-merchant |
| `growth` | GROWTH & WORKFLOW | daily-brief, automation-rules, goal-forecast, scheduled-reports, campaign-tracker, promo-studio, kanban | ✅ Non-marketing |
| `support` | SUPPORT & BILLING | support-tickets, billing, luma-affiliate | ✅ Most roles |
| `content` | CONTENT & COMMUNITY | content-hub, social-lumaway | ✅ All |

### Persistence Strategy

**localStorage Keys:**
```typescript
const STORAGE_KEYS = {
  groups: "lumaway_sidebar_groups",      // { [groupId]: boolean }
  collapsed: "lumaway_sidebar_collapsed", // "0" | "1"
  ownerTab: "lumaway_owner_tab",         // "overview" | "creators" | ...
};
```

**Merge Logic:**
```typescript
function getInitialGroupStates(role: string): Record<string, boolean> {
  const stored = JSON.parse(localStorage.getItem("lumaway_sidebar_groups") || "{}");
  const defaults: Record<string, boolean> = {};
  GROUP_CONFIGS.forEach(g => {
    defaults[g.id] = g.defaultOpen[role] ?? g.defaultOpen.default ?? false;
  });
  // Stored overrides defaults for explicitly toggled groups
  return { ...defaults, ...stored };
}
```

**Behavior:**
1. On mount: read localStorage, merge with role defaults
2. On toggle: write to localStorage immediately
3. On role change: re-merge (preserves explicit toggles)
4. Mobile: groups closed by default, user opens → persists

### Mobile Behavior

- **Default**: All groups closed on mobile (< 1024px)
- **User action**: Opens group → persists in localStorage
- **Sync**: Desktop/mobile share same localStorage keys
- **Drawer**: Mobile sidebar is drawer, groups animate in/out

### Implementation

Skill: `sk-sidebar-management`
- `defaults.ts` — Role configs, GROUP_CONFIGS
- `persistence.ts` — localStorage read/write, merge logic
- `index.ts` — React hook `useSidebarGroups(role)`

### Consequences

**Positive:**
- New users see relevant groups only
- Sidebar fits viewport on all screens
- Personalization without accounts (localStorage)
- Persists across sessions/devices (same browser)
- Mobile usable

**Negative:**
- Role detection needed (currently only `admin` vs `default`)
- New users might not discover closed groups
- localStorage cleared = reset to defaults

## Alternatives Considered

1. **All open default** — Rejected: sidebar too tall, overwhelming
2. **All closed default** — Rejected: core features hidden, poor discovery
3. **Fixed defaults (no role)** — Rejected: one-size-fits-all doesn't work
4. **Server-side preferences** — Rejected: overkill, localStorage sufficient

## Status

**Approved** — Implementation in `sk-sidebar-management` skill.

## Links

- Config: `m-group-defaults.md`
- Map: `m-sidebar-map.md`
- Skill: `sk-sidebar-management` (`defaults.ts`, `persistence.ts`, `index.ts`)
- Related: `d-002-progressive-disclosure.md`