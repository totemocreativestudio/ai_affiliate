"use client";

import { useEffect, useState } from "react";
import LumaIcon from "./LumaIcon";

const items = [
  ["#dashboard", "dashboard", "Home"],
  ["#upload", "data", "Data"],
  ["#ai-analytics", "ai", "AI"],
  ["#kanban", "kanban", "Kanban"],
  ["#billing", "billing", "Billing"],
] as const;

export default function MobileQuickNav() {
  const [hash, setHash] = useState("#dashboard");
  useEffect(() => {
    const sync = () => setHash(window.location.hash || "#dashboard");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <nav className="mobile-quick-nav" aria-label="Lumaway quick navigation">
      {items.map(([href, icon, label]) => (
        <a key={href} href={href} className={hash === href ? "active" : ""}>
          <LumaIcon name={icon} />
          <span>{label}</span>
        </a>
      ))}
      <button
        type="button"
        aria-label="Buka seluruh menu"
        onClick={() => window.dispatchEvent(new Event("lumaway-open-sidebar"))}
      >
        <LumaIcon name="menu" />
        <span>More</span>
      </button>
    </nav>
  );
}
