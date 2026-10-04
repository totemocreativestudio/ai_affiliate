// Capture the signed-in workspace by letting the app authenticate itself.
// Run with: node scripts/shoot-workspace.mjs <email> <password>
// Auth is client-side, so typing real credentials into the real form is the
// only faithful way to reproduce what the user actually sees.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
const SECTIONS = (process.argv[4] || "dashboard,profile,billing,ai-analytics,database,product-master").split(",");

if (!EMAIL || !PASSWORD) {
  console.log("cara pakai: node scripts/shoot-workspace.mjs <email> <password> [sections]");
  process.exit(1);
}

mkdirSync(".screenshots", { recursive: true });

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

// Wait for the app to actually leave the login screen.
await page
  .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 })
  .catch(() => console.log("peringatan: tetap di /login"));

console.log(`setelah login -> ${page.url().replace(BASE, "") || "/"}`);

for (const s of SECTIONS.map((x) => x.trim()).filter(Boolean)) {
  await page.goto(`${BASE}/${s}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `.screenshots/ws-${s}.png`, fullPage: true });

  // Report what a first-time viewer has to make sense of on this screen.
  const summary = await page.evaluate(() => {
    const vis = (el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    const text = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
    const nodes = (sel) => Array.from(document.querySelectorAll(sel)).filter(vis);
    return {
      title: text(document.querySelector("h1, h2")) .slice(0, 70),
      navItems: nodes(".sidebar a, nav a, aside a").length,
      buttons: nodes("button").length,
      tinyText: nodes("span, small, label, td, th, p, li").filter((el) => parseFloat(getComputedStyle(el).fontSize) < 12)
        .length,
      tables: nodes("table").length,
      rows: nodes("tbody tr").length,
      cards: nodes(".card, .panel, section").length,
      scrollH: document.documentElement.scrollHeight,
    };
  });

  console.log(
    `${s.padEnd(15)} ${String(summary.navItems).padStart(3)} nav  ${String(summary.buttons).padStart(3)} btn  ` +
      `${String(summary.rows).padStart(3)} row  ${String(summary.tinyText).padStart(3)} <12px  h=${summary.scrollH}  "${summary.title}"`,
  );
}

if (errors.length) {
  console.log("\nerrors:");
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(`  ${e}`);
}

await ctx.close();
await browser.close();
console.log("\nselesai");
