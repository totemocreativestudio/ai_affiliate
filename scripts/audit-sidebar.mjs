// Inspect how the sidebar actually presents itself: which groups are open,
// what is visible above the fold, and how much scrolling a user faces.
// Run with: node scripts/audit-sidebar.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const env = {};
for (const raw of readFileSync(new URL("../.env", import.meta.url), "utf-8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = `surya.nav${Date.now()}@gmail.com`;
const PASSWORD = "Walkthrough12345";

const admin = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };
const created = await fetch(`${SB}/auth/v1/admin/users`, {
  method: "POST",
  headers: admin,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
});
const user = await created.json();

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 60000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click("button.auth-v7-primary");
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const sidebar = document.querySelector(".sidebar");
  const groups = Array.from(document.querySelectorAll(".sidebar details.side-group"));
  const topLinks = Array.from(document.querySelectorAll(".sidebar > nav > a"));
  const allLinks = Array.from(document.querySelectorAll(".sidebar a"));

  const cs = (el) => getComputedStyle(el);
  const small = allLinks.filter((a) => parseFloat(cs(a).fontSize) < 12);

  return {
    sidebarHeight: sidebar ? Math.round(sidebar.getBoundingClientRect().height) : 0,
    sidebarScroll: sidebar ? Math.round(sidebar.scrollHeight) : 0,
    viewport: window.innerHeight,
    topLevel: topLinks.length,
    groupCount: groups.length,
    openGroups: groups.filter((g) => g.open).length,
    totalLinks: allLinks.length,
    visibleLinks: allLinks.filter((a) => a.offsetParent !== null).length,
    smallLinks: small.length,
    groupLabels: groups.map((g) => ({
      label: (g.querySelector(".nav-label")?.textContent || "?").trim(),
      open: g.open,
      children: g.querySelectorAll(".side-subnav a, .side-subnav button").length,
    })),
  };
});

console.log(`sidebar tinggi      : ${report.sidebarHeight}px (viewport ${report.viewport}px)`);
console.log(`sidebar scroll      : ${report.sidebarScroll}px  ${report.sidebarScroll > report.viewport ? "-> HARUS SCROLL" : "-> muat"}`);
console.log(`link level atas     : ${report.topLevel}`);
console.log(`grup                : ${report.groupCount}, terbuka: ${report.openGroups}`);
console.log(`total link          : ${report.totalLinks}, terlihat: ${report.visibleLinks}`);
console.log(`link < 12px         : ${report.smallLinks}\n`);
console.log("grup:");
for (const g of report.groupLabels) {
  console.log(`  ${g.open ? "[buka]" : "[tutup]"} ${g.label.padEnd(24)} ${g.children} item`);
}

await page.screenshot({ path: ".screenshots/sidebar-state.png" });
await ctx.close();
await browser.close();

for (const [p, m] of [
  [`/rest/v1/profiles?id=eq.${user.id}`, "DELETE"],
  [`/rest/v1/referral_profiles?user_id=eq.${user.id}`, "DELETE"],
  [`/auth/v1/admin/users/${user.id}`, "DELETE"],
]) {
  await fetch(SB + p, { method: m, headers: admin }).catch(() => {});
}
console.log("\nselesai");
