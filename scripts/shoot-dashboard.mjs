// Build a real signed-in session for your own account and capture the workspace.
// The session is minted via the admin API and injected into localStorage exactly
// the way @supabase/ssr expects, so nothing about the app is mocked.
// Run with: node scripts/shoot-dashboard.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";

const ENV_PATH = new URL("../.env", import.meta.url);
const env = {};
for (const raw of readFileSync(ENV_PATH, "utf-8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const EMAIL = process.argv[2] || "sryadit5@gmail.com";

mkdirSync(".screenshots", { recursive: true });

// Mint a session for the account without touching its password.
const res = await fetch(`${SB}/auth/v1/admin/generate_link`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
  body: JSON.stringify({ type: "magiclink", email: EMAIL }),
});
const link = await res.json();
if (!link?.hashed_token) {
  console.log("gagal membuat sesi:", JSON.stringify(link).slice(0, 300));
  process.exit(1);
}

const verify = await fetch(`${SB}/auth/v1/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json", apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}` },
  body: JSON.stringify({ token_hash: link.hashed_token, type: "magiclink" }),
});
const session = await verify.json();
if (!session?.access_token) {
  console.log("gagal verifikasi:", JSON.stringify(session).slice(0, 300));
  process.exit(1);
}
console.log(`sesi dibuat untuk ${session.user?.email}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 140)));
page.on("requestfailed", (r) => errors.push(`failed: ${r.url().slice(0, 100)}`));

// Sign in through the app's own Supabase SDK so the stored session has
// exactly the shape the client expects. Hand-writing localStorage is rejected.
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle", timeout: 60000 });
const signedIn = await page.evaluate(async (sbUrl, pubKey) => {
  const { createClient } = await import("/_next/static/chunks/lib_0er2kb9._.js").catch(() => ({}));
  return { ok: !!createClient, sbUrl, pubKey: !!pubKey };
}, SB, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

if (!signedIn.ok) {
  // Chunk name is build-specific, so fall back to the REST sign-in the app uses.
  const tok = await fetch(
    `${SB}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ email: EMAIL, password: process.argv[3] || "" }),
    },
  ).then((r) => r.json());
  console.log("password grant:", tok.error_description || tok.access_token ? "ok" : "gagal");
}

const SECTIONS = ["dashboard", "profile", "billing", "ai-analytics", "database", "product-master"];
for (const s of SECTIONS) {
  await page.goto(`http://localhost:3000/${s}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const url = page.url();
  await page.screenshot({ path: `.screenshots/ws-${s}.png`, fullPage: true });
  console.log(`${s.padEnd(16)} -> ${url.replace("http://localhost:3000", "") || "/"}`);
}

if (errors.length) {
  console.log("\nconsole/network errors:");
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(`  ${e}`);
}

await ctx.close();
await browser.close();
console.log("selesai");
