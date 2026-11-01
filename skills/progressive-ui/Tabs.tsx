// TabContainer — Tab navigation with lazy-loaded panels
// Implements p-tab-conversion

import { useState, useEffect, useId, lazy, Suspense, Fragment } from "react";

export interface TabConfig {
  value: string;
  label: string;
  icon?: React.ReactNode;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  props?: Record<string, any>;
}

interface TabContainerProps {
  tabs: TabConfig[];
  defaultTab: string;
  onTabChange?: (tab: string) => void;
  syncUrl?: boolean; // Sync with URL ?tab=...
  className?: string;
}

function TabPanelSkeleton() {
  return (
    <div className="tab-panel-skeleton" style={{ minHeight: "200px" }}>
      <div style={{ height: "24px", width: "60%", background: "var(--ds-line)", borderRadius: "4px", marginBottom: "16px" }} />
      <div style={{ height: "16px", width: "80%", background: "var(--ds-line-soft)", borderRadius: "4px", marginBottom: "8px" }} />
      <div style={{ height: "16px", width: "50%", background: "var(--ds-line-soft)", borderRadius: "4px" }} />
    </div>
  );
}

export function TabContainer({
  tabs,
  defaultTab,
  onTabChange,
  syncUrl = false,
  className,
}: TabContainerProps) {
  const [activeTab, setActiveTab] = useState(() => {
    if (syncUrl && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      return tabs.some(t => t.value === tab) ? tab : defaultTab;
    }
    return defaultTab;
  });

  const handleChange = (value: string) => {
    setActiveTab(value);
    onTabChange?.(value);
    if (syncUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", value);
      window.history.replaceState({}, "", url);
    }
  };

  return (
    <div className={`tab-container ${className || ""}`}>
      <div className="tab-list" role="tablist" aria-label="Tab navigation">
        {tabs.map(tab => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={activeTab === tab.value}
            aria-controls={`panel-${tab.value}`}
            id={`tab-${tab.value}`}
            className={`tab-trigger ds-progressive-trigger ${activeTab === tab.value ? "active" : ""}`}
            onClick={() => handleChange(tab.value)}
            type="button"
          >
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="tab-panels">
        {tabs.map(tab => (
          <div
            key={tab.value}
            role="tabpanel"
            id={`panel-${tab.value}`}
            aria-labelledby={`tab-${tab.value}`}
            className={`tab-panel ${activeTab === tab.value ? "active" : ""}`}
            hidden={activeTab !== tab.value}
          >
            <Suspense fallback={<TabPanelSkeleton />}>
              <tab.component {...tab.props} />
            </Suspense>
          </div>
        ))}
      </div>
    </div>
  );
}