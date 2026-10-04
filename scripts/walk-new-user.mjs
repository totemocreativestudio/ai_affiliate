// Create a confirmed account directly through the admin API, then sign in
// through the real login form and walk the workspace.
// The signup endpoint only sends a confirmation email, and a throwaway inbox
// cannot read it, so admin.createUser is the only way to get a usable session.
// Run with: node scripts/walk-new-user.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const env = {};
for (const raw of readFileSync(new URL("../.env", import.meta.url), "utf-8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const BASE = "http://localhost:3000";
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = `surya.walk${Date.now()}@gmail.com`;
const PASSWORD = "Walkthrough12345";

mkdirSync(".screenshots", { recursive: true });

const admin = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };

// Verified and confirmed at creation, so no inbox round-trip is needed.
const created = await fetch(`${SB}/auth/v1/admin/users`, {
  method: "POST",
  headers: admin,
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
});
const user = await created.json();
const userId = user?.id;
if (!userId) {
  console.log("gagal membuat user:", JSON.stringify(user).slice(0, 300));
  process.exit(1);
}
console.log(`user dibuat        : ${userId}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 150)));
page.on("requestfailed", (r) => errors.push(`failed: ${r.url().slice(0, 110)}`));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 60000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await page.click("button.auth-v7-primary");
await page
  .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 })
  .catch(() => console.log("PERINGATAN: tetap di /login"));

console.log(`setelah login     : ${page.url().replace(BASE, "") || "/"}`);

await page.waitForTimeout(2500);
await page.screenshot({ path: ".screenshots/new-00-landing.png", fullPage: true });

const SECTIONS = ["dashboard", "profile", "billing", "ai-analytics", "database", "product-master", "upload"];
for (const s of SECTIONS) {
  await page.goto(`${BASE}/${s}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2200);
  const landed = page.url().replace(BASE, "") || "/";
  await page.screenshot({ path: `.screenshots/new-${s}.png`, fullPage: true });

  const m = await page.evaluate(() => {
    const vis = (el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    const txt = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const nodes = (sel) => Array.from(document.querySelectorAll(sel)).filter(vis);
    return {
      title: txt(document.querySelector("h1")).slice(0, 58),
      nav: nodes(".sidebar a, nav a, aside a").length,
      rows: nodes("tbody tr").length,
      tiny: nodes("span, small, label, td, th, p, li, button").filter(
        (el) => parseFloat(getComputedStyle(el).fontSize) < 12,
      ).length,
      height: document.documentElement.scrollHeight,
    };
  });

  const flag = landed === `/${s}` ? "" : `  <-- DIALIHKAN ke ${landed}`;
  console.log(
    `${s.padEnd(14)} nav=${String(m.nav).padStart(3)} row=${String(m.rows).padStart(3)} ` +
      `<12px=${String(m.tiny).padStart(3)} h=${String(m.height).padStart(6)} "${m.title}"${flag}`,
  );
}

if (errors.length) {
  console.log("\nerrors:");
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(`  ${e}`);
}

await ctx.close();
await browser.close();

for (const [p, mth] of [
  [`/rest/v1/profiles?id=eq.${userId}`, "DELETE"],
  [`/rest/v1/referral_profiles?user_id=eq.${userId}`, "DELETE"],
  [`/auth/v1/admin/users/${userId}`, "DELETE"],
]) {
  await fetch(SB + p, { method: mth, headers: admin }).catch(() => {});
}
console.log("\nprobe user dibersihkan");
console.log("selesai");
