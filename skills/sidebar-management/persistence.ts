// Sidebar Persistence — localStorage Read/Write
// Mirrors m-group-defaults.md persistence schema

const STORAGE_KEYS = {
  groups: "lumaway_sidebar_groups",
  collapsed: "lumaway_sidebar_collapsed",
  ownerTab: "lumaway_owner_tab",
} as const;

type GroupStates = Record<string, boolean>;

export function readGroupStates(): GroupStates {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.groups);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function writeGroupStates(states: GroupStates): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.groups, JSON.stringify(states));
  } catch {
    // Ignore quota/privacy errors
  }
}

export function toggleGroup(groupId: string, currentStates: GroupStates): GroupStates {
  const next = { ...currentStates, [groupId]: !currentStates[groupId] };
  writeGroupStates(next);
  return next;
}

export function setGroupState(groupId: string, open: boolean, currentStates: GroupStates): GroupStates {
  const next = { ...currentStates, [groupId]: open };
  writeGroupStates(next);
  return next;
}

export function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEYS.collapsed) === "1";
}

export function writeCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.collapsed, collapsed ? "1" : "0");
}

export function readOwnerTab(): string {
  if (typeof window === "undefined") return "overview";
  return localStorage.getItem(STORAGE_KEYS.ownerTab) || "overview";
}

export function writeOwnerTab(tab: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.ownerTab, tab);
}

// Merge stored states with role defaults
export function mergeWithDefaults(stored: GroupStates, defaults: Record<string, boolean>): GroupStates {
  // Stored overrides defaults for explicitly toggled groups
  return { ...defaults, ...stored };
}

// Initialize group states on mount
export function initializeGroupStates(role: string, getDefaults: (role: string) => Record<string, boolean>): GroupStates {
  const stored = readGroupStates();
  const defaults = getDefaults(role);
  return mergeWithDefaults(stored, defaults);
}