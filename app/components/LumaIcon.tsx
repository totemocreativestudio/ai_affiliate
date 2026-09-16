"use client";

import type { SVGProps } from "react";

type IconName =
  | "dashboard"
  | "data"
  | "creator"
  | "ai"
  | "sparkles"
  | "kanban"
  | "ticket"
  | "billing"
  | "content"
  | "community"
  | "master"
  | "product"
  | "listing"
  | "shipping"
  | "sample"
  | "ratecard"
  | "bell"
  | "install"
  | "theme"
  | "logout"
  | "settings"
  | "finance"
  | "referral"
  | "broadcast"
  | "system"
  | "integration"
  | "support"
  | "menu"
  | "close"
  | "chevron";

type Props = SVGProps<SVGSVGElement> & { name: IconName };

export default function LumaIcon({ name, ...props }: Props) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const path = (() => {
    switch (name) {
      case "dashboard":
        return <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>;
      case "data":
        return <><ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"/><path d="M4.5 11v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/></>;
      case "creator":
        return <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.8-3.3 2.7-5 5.5-5s4.7 1.7 5.5 5"/><circle cx="17.5" cy="9" r="2.2"/><path d="M15.5 14.8c2.9-.4 4.7 1 5 4.2"/></>;
      case "ai":
        return <><path d="M12 3 9.8 8.3 4.5 10.5l5.3 2.2L12 18l2.2-5.3 5.3-2.2-5.3-2.2L12 3Z"/><path d="m18.5 16 .8 2 .2.5.5.2 2 .8-2 .8-.5.2-.2.5-.8 2-.8-2-.2-.5-.5-.2-2-.8 2-.8.5-.2.2-.5.8-2Z"/></>;
      case "sparkles":
        return <><path d="m8 3 1.2 3.1L12.3 7.3 9.2 8.5 8 11.6 6.8 8.5 3.7 7.3l3.1-1.2L8 3Z"/><path d="m16 10 1.7 4.3L22 16l-4.3 1.7L16 22l-1.7-4.3L10 16l4.3-1.7L16 10Z"/></>;
      case "kanban":
        return <><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M15 4v16"/><path d="M5.5 8h1M11.5 8h1M17.5 8h1"/></>;
      case "ticket":
      case "support":
        return <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5V9a3 3 0 0 0 0 6v1.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5V15a3 3 0 0 0 0-6V7.5Z"/><path d="M12 8v8"/></>;
      case "billing":
      case "finance":
        return <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 9h18"/><path d="M7 15h4"/><circle cx="17" cy="14.5" r="1.5"/></>;
      case "content":
        return <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/></>;
      case "community":
        return <><path d="M5 5h14v10H9l-4 4v-4H5z"/><circle cx="9" cy="10" r=".7" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r=".7" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r=".7" fill="currentColor" stroke="none"/></>;
      case "master":
        return <><path d="M4 6.5 12 3l8 3.5-8 3.5L4 6.5Z"/><path d="m4 11 8 3.5 8-3.5M4 15.5 12 19l8-3.5"/></>;
      case "product":
        return <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></>;
      case "listing":
        return <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>;
      case "shipping":
        return <><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></>;
      case "sample":
        return <><circle cx="9" cy="8" r="3"/><path d="M4 20c.6-4 2.3-6 5-6s4.4 2 5 6"/><path d="M16 6h5M18.5 3.5v5"/></>;
      case "ratecard":
        return <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h4"/><path d="m15.5 16.5 1.2 1.2 2.3-2.7"/></>;
      case "bell":
        return <><path d="M6.5 9a5.5 5.5 0 0 1 11 0c0 5 2.5 6 2.5 6H4s2.5-1 2.5-6Z"/><path d="M9.5 18a2.7 2.7 0 0 0 5 0"/></>;
      case "install":
        return <><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M5 18v2h14v-2"/></>;
      case "theme":
        return <path d="M20 15.2A8 8 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z"/>;
      case "logout":
        return <><path d="M10 4H5v16h5"/><path d="M13 8l4 4-4 4M17 12H8"/></>;
      case "settings":
        return <><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.6a7 7 0 0 0-.7-1.7l1-1.8-2.1-2.1-1.8 1a7 7 0 0 0-1.8-.7L11 2.5H8l-.6 2.1a7 7 0 0 0-1.8.7l-1.8-1-2.1 2.1 1 1.8A7 7 0 0 0 2 9.9l-2 .6v3l2 .6a7 7 0 0 0 .7 1.7l-1 1.8 2.1 2.1 1.8-1a7 7 0 0 0 1.8.7l.6 2.1h3l.6-2.1a7 7 0 0 0 1.8-.7l1.8 1 2.1-2.1-1-1.8a7 7 0 0 0 .7-1.7l2-.6Z" transform="translate(2 -0.5) scale(.83)"/></>;
      case "referral":
        return <><circle cx="8" cy="8" r="3"/><path d="M3.5 19c.7-3.4 2.2-5 4.5-5 1.7 0 3 .8 3.8 2.4"/><path d="M15 8h6M18 5l3 3-3 3"/><path d="M14 17h7"/></>;
      case "broadcast":
        return <><path d="M4 11v3h4l6 4V7l-6 4H4Z"/><path d="M17 9c1 .8 1.5 1.8 1.5 3S18 14.2 17 15M19 6.5c2 1.4 3 3.2 3 5.5s-1 4.1-3 5.5"/></>;
      case "system":
        return <><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 20h10M9 18v2M15 18v2"/><path d="m7 12 2-2 2 2 3-4 3 3"/></>;
      case "integration":
        return <><path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/><rect x="8" y="8" width="8" height="8" rx="2"/></>;
      case "menu":
        return <><path d="M4 7h16M4 12h16M4 17h16"/></>;
      case "close":
        return <><path d="M6 6l12 12M18 6 6 18"/></>;
      case "chevron":
        return <path d="m8 10 4 4 4-4"/>;
      default:
        return <circle cx="12" cy="12" r="8"/>;
    }
  })();

  return <svg {...common} {...props}>{path}</svg>;
}

export type { IconName };
