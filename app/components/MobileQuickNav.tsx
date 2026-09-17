"use client";

import { useEffect, useState } from "react";
import { navigateToSection, routeForSection, sectionFromPath } from "../../lib/luma-navigation";
import LumaIcon from "./LumaIcon";

const items = [
  ["dashboard", "dashboard", "Home"],
  ["upload", "data", "Data"],
  ["ai-analytics", "ai", "AI"],
  ["kanban", "kanban", "Kanban"],
  ["billing", "billing", "Billing"],
] as const;

export default function MobileQuickNav() {
  const [active, setActive] = useState("dashboard");
  useEffect(() => {
    const sync = () => setActive(sectionFromPath(window.location.pathname) || "dashboard");
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("lumaway-routechange", sync as EventListener);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("lumaway-routechange", sync as EventListener);
    };
  }, []);

  return (
    <nav className="mobile-quick-nav" aria-label="Lumaway quick navigation">
      {items.map(([section, icon, label]) => (
        <a
          key={section}
          href={routeForSection(section)}
          className={active === section ? "active" : ""}
          onClick={(event) => {
            event.preventDefault();
            navigateToSection(section);
            setActive(section);
          }}
        >
          <LumaIcon name={icon} />
          <span>{label}</span>
        </a>
      ))}
      <button type="button" aria-label="Buka seluruh menu" onClick={() => window.dispatchEvent(new Event("lumaway-open-sidebar"))}>
        <LumaIcon name="menu" />
        <span>More</span>
      </button>
    </nav>
  );
}
