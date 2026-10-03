// Walk the full auth flow and the workspace, capturing each state.
// Used to spot real layout and copy problems rather than guessing from CSS.
// Run with: node scripts/shoot-flow.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = ".screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`saved ${name}`);
};

// 1. login, focus the email field so the focus ring is visible in the capture
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.click('input[type="email"]');
await shot("flow-01-login-focused");

// 2. wrong password -> the error alert
await page.fill('input[type="email"]', "sryadit5@gmail.com");
await page.fill('input[type="password"]', "wrongpassword123");
await page.click("button.auth-v7-primary");
await page.waitForTimeout(2500);
await shot("flow-02-login-error");

// 3. wrong password shows no error and no navigation -> detect that too
const afterBad = page.url();

await page.reload({ waitUntil: "networkidle" });
await page.fill('input[type="email"]', "sryadit5@gmail.com");
await page.fill('input[type="password"]', "wrongpassword123");
await page.click("button.auth-v7-primary");
await page.waitForTimeout(3000);
const errText = await page
  .locator(".auth-v7-alert.error")
  .textContent()
  .catch(() => null);
console.log(`URL setelah password salah : ${afterBad}`);
console.log(`pesan error              : ${errText ? errText.replace(/\s+/g, " ").trim() : "(TIDAK ADA)"}`);
await shot("flow-03-login-error-second");

// 4. forgot password view
await page.goto("http://localhost:3000/login?view=forgot", { waitUntil: "networkidle" });
await shot("flow-04-forgot");

// 5. register with the consent checkbox empty -> validation copy
await page.goto("http://localhost:3000/register", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "surya.baru@gmail.com");
await page.fill('input[type="password"]', "RahasiaKuat123");
await page.click("button.auth-v7-primary");
await page.waitForTimeout(1500);
await shot("flow-05-register-consent");

// 6. keyboard-only navigation: tab through and screenshot focus visibility
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
await shot("flow-06-login-keyboard-focus");

await ctx.close();
await browser.close();
console.log("selesai");
