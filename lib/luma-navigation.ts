export const APP_BASE = "/app.lumaway";

const SECTION_ROUTES: Record<string, string> = {
  dashboard: "dashboard",
  upload: "upload",
  "excel-sync": "excel-sync",
  database: "database",
  agreements: "agreements",
  "affiliate-support": "affiliate-support",
  "ai-analytics": "ai-analytics",
  "promo-studio": "promo-studio",
  kanban: "kanban",
  "support-tickets": "support-tickets",
  billing: "billing",
  "luma-affiliate": "luma-affiliate",
  "content-hub": "content-hub",
  "social-lumaway": "social-lumaway",
  "product-master": "product-master",
  listings: "listings",
  shipping: "shipping",
  "creator-samples": "creator-samples",
  ratecard: "ratecard",
  profile: "profile",
  administration: "administration",
};

const ROUTE_SECTIONS = Object.fromEntries(
  Object.entries(SECTION_ROUTES).map(([section, route]) => [route, section]),
) as Record<string, string>;

export function routeForSection(section: string) {
  return `${APP_BASE}/${SECTION_ROUTES[section] || "dashboard"}`;
}

export function sectionFromPath(pathname: string) {
  const clean = String(pathname || "").replace(/\/+$/, "");
  if (!clean || clean === "/" || clean === APP_BASE) return null;
  if (!clean.startsWith(`${APP_BASE}/`)) return null;
  const segment = clean.slice(APP_BASE.length + 1).split("/")[0];
  if (segment === "login" || segment === "register") return null;
  return ROUTE_SECTIONS[segment] || "dashboard";
}

export function isAuthPath(pathname: string) {
  const clean = String(pathname || "").replace(/\/+$/, "");
  return clean === `${APP_BASE}/login` || clean === `${APP_BASE}/register`;
}

export function navigateToSection(section: string, options: { replace?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const path = routeForSection(section);
  const method = options.replace ? "replaceState" : "pushState";
  window.history[method](null, "", path);
  window.dispatchEvent(new CustomEvent("lumaway-routechange", { detail: { section, path } }));
}

export function normalizeLumawayUrl(url: string) {
  if (!url) return routeForSection("dashboard");
  if (url.startsWith("/#")) return routeForSection(url.slice(2));
  if (url.startsWith("#")) return routeForSection(url.slice(1));
  return url;
}

export function navigateLumawayUrl(url: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeLumawayUrl(url);
  if (normalized.startsWith(`${APP_BASE}/`)) {
    const section = sectionFromPath(normalized) || "dashboard";
    window.history.pushState(null, "", normalized);
    window.dispatchEvent(new CustomEvent("lumaway-routechange", { detail: { section, path: normalized } }));
    return;
  }
  window.location.assign(normalized);
}
