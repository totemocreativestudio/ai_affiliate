import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => {
  console.error(`Lumaway route check failed: ${message}`);
  process.exitCode = 1;
};

const navigation = read("lib/luma-navigation.ts");
const page = read("app/page.tsx");
const sidebar = read("app/components/LumaSidebar.tsx");
const notifications = read("app/components/NotificationCenter.tsx");
const analytics = read("app/components/AIAnalytics.tsx");
const finalCss = read("app/luma-final-fixes.css");

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

if (!exists("app/app.lumaway/[[...route]]/page.tsx")) {
  fail("Lumaway catch-all route is missing");
}
if (!exists("app/app.lumaway/[[...route]]/loading.tsx")) {
  fail("route-level Lumaway loading state is missing");
}
if (exists("app/app.lumaway/[[...slug]]/page.tsx")) {
  fail("duplicate catch-all route [[...slug]] must not exist");
}

if (!page.includes("routeForSection(legacyHash)")) {
  fail("legacy hash migration must remain available");
}
if (!page.includes('navigateToSection(target, { replace: true })')) {
  fail("post-login navigation must resolve through path-based routing");
}
if (!page.includes('`${APP_BASE}/login`') || !page.includes('`${APP_BASE}/register`')) {
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

if (!process.exitCode) {
  console.log("Lumaway route/UI regression checks passed.");
}
