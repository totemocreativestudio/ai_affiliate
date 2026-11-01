// Sidebar Management Skill — Main Export
// React hook for sidebar group state management

import { useState, useEffect, useCallback, useMemo } from "react";
import { GROUP_CONFIGS, GroupConfig, getDefaultOpenGroups, getUserRole, Role } from "./defaults";
import { readGroupStates, writeGroupStates, readCollapsed, writeCollapsed, initializeGroupStates } from "./persistence";

export { GROUP_CONFIGS, getDefaultOpenGroups, getUserRole } from "./defaults";
export { readGroupStates, writeGroupStates, readCollapsed, writeCollapsed } from "./persistence";
export type { GroupConfig, Role } from "./defaults";

export interface UseSidebarGroupsOptions {
  profile: { role: string; email: string | null; full_name: string | null };
  workspace: { name: string; slug: string; status: string };
  onToggleGroup?: (groupId: string, open: boolean) => void;
  onToggleCollapsed?: (collapsed: boolean) => void;
}

export interface SidebarGroupState {
  id: string;
  label: string;
  icon: string;
  open: boolean;
  sections: string[];
}

export interface UseSidebarGroupsReturn {
  groups: SidebarGroupState[];
  collapsed: boolean;
  toggleGroup: (groupId: string) => void;
  setGroupOpen: (groupId: string, open: boolean) => void;
  toggleCollapsed: () => void;
  setCollapsed: (collapsed: boolean) => void;
  ownerTab: string;
  setOwnerTab: (tab: string) => void;
}

function toggleGroupState(groupId: string, currentStates: Record<string, boolean>): Record<string, boolean> {
  const next = { ...currentStates, [groupId]: !currentStates[groupId] };
  writeGroupStates(next);
  return next;
}

export function useSidebarGroups(options: UseSidebarGroupsOptions): UseSidebarGroupsReturn {
  const { profile, workspace, onToggleGroup, onToggleCollapsed } = options;
  
  // Determine role
  const role = useMemo(() => getUserRole(profile), [profile.role]);
  
  // Initialize group states from localStorage + role defaults
  const [groupStates, setGroupStates] = useState<Record<string, boolean>>(() => 
    initializeGroupStates(role, getDefaultOpenGroups)
  );
  
  // Initialize collapsed state
  const [collapsed, setCollapsedState] = useState(() => readCollapsed());
  
  // Initialize owner tab
  const [ownerTab, setOwnerTabState] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lumaway_owner_tab") || "overview";
    }
    return "overview";
  });

  // Build groups with current open state
  const groups = useMemo((): SidebarGroupState[] => {
    const defaults = getDefaultOpenGroups(role);
    return GROUP_CONFIGS.map(g => ({
      ...g,
      open: groupStates[g.id] ?? defaults[g.id],
    }));
  }, [groupStates, role]);

  // Toggle group
  const toggleGroup = useCallback((groupId: string) => {
    setGroupStates(prev => {
      const next = toggleGroupState(groupId, prev);
      onToggleGroup?.(groupId, next[groupId]);
      return next;
    });
  }, [onToggleGroup]);

  // Set group open/closed explicitly
  const setGroupOpen = useCallback((groupId: string, open: boolean) => {
    setGroupStates(prev => {
      const next = { ...prev, [groupId]: open };
      writeGroupStates(next);
      onToggleGroup?.(groupId, open);
      return next;
    });
  }, [onToggleGroup]);

  // Toggle sidebar collapsed
  const toggleCollapsed = useCallback(() => {
    const next = !collapsed;
    setCollapsedState(next);
    writeCollapsed(next);
    onToggleCollapsed?.(next);
  }, [collapsed, onToggleCollapsed]);

  // Set collapsed explicitly
  const setCollapsed = useCallback((nextCollapsed: boolean) => {
    setCollapsedState(nextCollapsed);
    writeCollapsed(nextCollapsed);
    onToggleCollapsed?.(nextCollapsed);
  }, [onToggleCollapsed]);

  // Set owner tab
  const setOwnerTab = useCallback((tab: string) => {
    setOwnerTabState(tab);
    if (typeof window !== "undefined") {
      localStorage.setItem("lumaway_owner_tab", tab);
    }
  }, []);

  // Sync with external changes (other tabs)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "lumaway_sidebar_groups") {
        try {
          setGroupStates(JSON.parse(e.newValue || "{}"));
        } catch {}
      } else if (e.key === "lumaway_sidebar_collapsed") {
        setCollapsedState(e.newValue === "1");
      } else if (e.key === "lumaway_owner_tab") {
        setOwnerTabState(e.newValue || "overview");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return {
    groups,
    collapsed,
    toggleGroup,
    setGroupOpen,
    toggleCollapsed,
    setCollapsed,
    ownerTab,
    setOwnerTab,
  };
}