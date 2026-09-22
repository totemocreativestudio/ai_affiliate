export const APP_BASE = "/app.lumaway";

const SECTION_ROUTES: Record<string, string> = {
  dashboard: "dashboard",
  upload: "upload",
  tutorial: "tutorial",
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
  const value = String(url || "").trim();
  if (!value) return routeForSection("dashboard");

  if (value === "/" || value === "/?auth=signin" || value === "?auth=signin") return `${APP_BASE}/login`;
  if (value === "/?auth=signup" || value === "?auth=signup") return `${APP_BASE}/register`;
  if (value === "/login") return `${APP_BASE}/login`;
  if (value === "/register") return `${APP_BASE}/register`;

  if (value.startsWith("/#")) return routeForSection(value.slice(2));
  if (value.startsWith("#")) return routeForSection(value.slice(1));

  try {
    const parsed = new URL(value, "https://www.lumaway.online");
    if (parsed.pathname === "/" && parsed.searchParams.get("auth") === "signin") return `${APP_BASE}/login`;
    if (parsed.pathname === "/" && parsed.searchParams.get("auth") === "signup") return `${APP_BASE}/register`;
    if (parsed.hash) return routeForSection(parsed.hash.replace(/^#/, ""));
  } catch {
    // Keep unknown relative or external URLs untouched.
  }

  return value;
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
