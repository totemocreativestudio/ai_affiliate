import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`Lumaway route check failed: ${message}`);
  process.exitCode = 1;
};
const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const relative = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(relative);
  return [relative.replaceAll("\\", "/")];
});

const navigation = read("lib/luma-navigation.ts");
const rootPage = read("app/page.tsx");
const appShell = read("app/LumawayWorkspaceApp.tsx");
const catchAll = read("app/app.lumaway/[[...route]]/page.tsx");
const sidebar = read("app/components/LumaSidebar.tsx");
const notifications = read("app/components/NotificationCenter.tsx");
const analytics = read("app/components/AIAnalytics.tsx");
const finalCss = read("app/luma-final-fixes.css");
const serviceWorker = read("public/sw.js");

if (!navigation.includes('export const APP_BASE = "/app.lumaway"')) {
  fail("APP_BASE must stay at /app.lumaway");
}

for (const route of [
  "dashboard",
  "upload",
  "excel-sync",
  "database",
  "ai-analytics",
  "promo-studio",
  "kanban",
  "support-tickets",
  "billing",
  "social-lumaway",
  "profile",
  "administration",
]) {
  if (!navigation.includes(`\"${route}\"`) && !navigation.includes(`${route}:`)) {
    fail(`missing route mapping: ${route}`);
  }
}

if (!exists("app/LumawayWorkspaceApp.tsx")) {
  fail("Lumaway workspace app shell is missing");
}
if (!rootPage.includes('redirect("/app.lumaway/login")')) {
  fail("root route must redirect directly to /app.lumaway/login");
}
if (!exists("app/app.lumaway/[[...route]]/page.tsx")) {
  fail("Lumaway catch-all route is missing");
}
if (!catchAll.includes('LumawayWorkspaceApp')) {
  fail("Lumaway catch-all route must render the workspace app shell");
}
if (!exists("app/app.lumaway/[[...route]]/loading.tsx")) {
  fail("route-level Lumaway loading state is missing");
}
if (exists("app/app.lumaway/[[...slug]]/page.tsx")) {
  fail("duplicate catch-all route [[...slug]] must not exist");
}

if (!appShell.includes("routeForSection(legacyHash)")) {
  fail("legacy hash migration must remain available");
}
if (!appShell.includes('navigateToSection(target, { replace: true })')) {
  fail("post-login navigation must resolve through path-based routing");
}
if (!appShell.includes('`${APP_BASE}/login`') || !appShell.includes('`${APP_BASE}/register`')) {
  fail("login/register must use /app.lumaway paths");
}

for (const [legacyPath, target] of [
  ["app/login/page.tsx", "/app.lumaway/login"],
  ["app/register/page.tsx", "/app.lumaway/register"],
]) {
  if (!exists(legacyPath) || !read(legacyPath).includes(target)) {
    fail(`${legacyPath} must redirect to ${target}`);
  }
}

if (!navigation.includes('value === "/?auth=signin"') || !navigation.includes('value === "/?auth=signup"')) {
  fail("legacy root auth URLs must normalize to /app.lumaway login/register");
}

// Dashboard navigation must not reintroduce hash anchors. Legacy hash handling is allowed only in the app shell/navigation compatibility layer.
for (const file of walk("app").filter((file) => /\.(tsx|ts|jsx|js)$/.test(file))) {
  if (file === "app/LumawayWorkspaceApp.tsx") continue;
  const source = read(file);
  if (/href\s*=\s*["'`]#/.test(source) || /href\s*=\s*\{\s*["'`]#/.test(source)) {
    fail(`hash href is not allowed in dashboard source: ${file}`);
  }
}

if (!sidebar.includes('className="sidebar-edge-collapse"')) {
  fail("desktop sidebar expand/minimize control is missing");
}
if (!sidebar.includes('className="mobile-sidebar-trigger"')) {
  fail("mobile sidebar trigger is missing");
}
if (!notifications.includes('<LumaIcon name="bell" />')) {
  fail("notification control must render the Lumaway bell icon");
}

if (!analytics.includes('className="history-action-trigger"')) {
  fail("analysis history dropdown trigger is missing");
}
if (!finalCss.includes('.history-action-trigger::before{content:"⌄"')) {
  fail("analysis history action must render as a dropdown arrow, not an overflow menu");
}
if (!finalCss.includes(".sidebar-edge-collapse{position:absolute")) {
  fail("sidebar expand/minimize control must live on the sidebar edge");
}
if (!finalCss.includes('html[data-theme="dark"] .notification-bell')) {
  fail("night-mode notification contrast override is missing");
}

if (!serviceWorker.includes('const CACHE = "lumaway-shell-v3"')) {
  fail("service worker cache version must be bumped after routing overhaul");
}
if (serviceWorker.includes('caches.match("/")')) {
  fail("service worker must not use the root route as an offline navigation fallback");
}
if (!serviceWorker.includes('fetch(request, { cache: "no-store" })')) {
  fail("navigation requests must prefer the latest server shell");
}
if (!serviceWorker.includes('url.pathname.startsWith("/_next/")')) {
  fail("service worker must explicitly bypass Next.js chunk caching");
}

if (!process.exitCode) {
  console.log("Lumaway route/UI regression checks passed.");
}
