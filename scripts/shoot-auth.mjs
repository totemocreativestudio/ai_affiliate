// Screenshot key auth pages at desktop and mobile widths for visual review.
// Run with: node scripts/shoot-auth.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = new URL("../.screenshots/", import.meta.url).pathname.replace(/^\//, "");
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["login", "/login"],
  ["register", "/register"],
  ["forgot", "/login?view=forgot"],
];

const VIEWPORTS = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

const browser = await chromium.launch();

for (const [vpName, viewport] of VIEWPORTS) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();

  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 160)}`);
  });
  page.on("requestfailed", (r) => problems.push(`failed: ${r.url().slice(0, 120)}`));

  for (const [name, path] of PAGES) {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(1200);
    const file = `${OUT}${name}-${vpName}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`saved ${file}`);
  }

  if (problems.length) {
    console.log(`\n[${vpName}] masalah:`);
    for (const p of [...new Set(problems)].slice(0, 10)) console.log(`  ${p}`);
  }
  await context.close();
}

await browser.close();
console.log("\nselesai");
