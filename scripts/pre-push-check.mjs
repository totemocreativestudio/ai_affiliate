// Pre-push verification for the local login/signup fixes.
// Run with: node scripts/pre-push-check.mjs
import { readFileSync } from "node:fs";
import net from "node:net";

const BASE = "http://localhost:3000";
const ENV_PATH = new URL("../.env", import.meta.url);

const env = {};
for (const raw of readFileSync(ENV_PATH, "utf-8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}

let ok = true;

function check(label, cond, detail = "") {
  if (!cond) ok = false;
  console.log(`  [${cond ? "PASS" : "FAIL"}] ${label}${detail ? `  -> ${detail}` : ""}`);
}

function title(n, text) {
  console.log(`\n${"=".repeat(62)}\n${n}. ${text}\n${"=".repeat(62)}`);
}

// Node's fetch() and http.request() both drop the Host header as a forbidden
// header, so production routing cannot be exercised through either API. Raw
// sockets are required to send Host, which is what a real deployment does.
function rawRequest(host, path) {
  return new Promise((resolve) => {
    const socket = net.connect(3000, "127.0.0.1", () => {
      socket.write(`GET ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`);
    });
    let raw = "";
    socket.setEncoding("utf-8");
    socket.on("data", (chunk) => (raw += chunk));
    socket.on("end", () => {
      const status = Number((raw.split(" ")[1] || "0")) || 0;
      const match = raw.match(/^location:\s*(.+)$/im);
      resolve({ status, location: match ? match[1].trim() : "" });
    });
    socket.on("error", () => resolve({ status: 0, location: "" }));
  });
}

async function req(path, { method = "GET", host, body } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  return fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
}

title(1, "ROUTING - localhost harus serve app, bukan lempar keluar");
for (const p of ["/", "/login", "/register", "/dashboard", "/web/home", "/web/terms", "/blog"]) {
  const r = await req(p);
  const loc = r.headers.get("location") || "";
  check(p, r.status === 200 && !loc, `${r.status}${loc ? " " + loc.slice(0, 50) : ""}`);
}

title(2, "PRODUCTION TIDAK BOLEH RUSAK");
let { status, location } = await rawRequest("app.lumaway.online", "/web/home");
check(
  "app host /web/home -> www (port kosong)",
  status === 308 && location === "https://www.lumaway.online/web/home",
  `${status} ${location}`,
);
({ status, location } = await rawRequest("lumaway.online", "/login"));
check(
  "public host /login -> app host (port kosong)",
  status === 308 && location === "https://app.lumaway.online/login",
  `${status} ${location}`,
);
({ status, location } = await rawRequest("lumaway.online", "/blog"));
check("public host /blog tetap 200 (tidak dialihkan)", status === 200, `${status}`);

title(3, "AUTH ENDPOINTS");
let r = await req("/api/auth/google-config");
const gc = await r.text();
check("google-config 200 + client_id", r.status === 200 && gc.includes('"ok":true'), `${r.status}`);
r = await req("/api/auth/email-verification");
check("email-verification tolak GET (405)", r.status === 405, `${r.status}`);

title(4, "SUPABASE - trigger signup masih benar?");
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` };

let userId = null;
try {
  const res = await fetch(`${SB}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: ADMIN,
    body: JSON.stringify({
      type: "signup",
      email: `surya.selftest${Date.now()}@gmail.com`,
      password: "SelfTest12345",
    }),
  });
  const data = await res.json();
  userId = data.id || null;
  check(
    "generateLink signup (Database error = regresi)",
    res.status === 200 && !!userId,
    `${res.status} ${data.msg || data.message || ""}`,
  );
} catch (e) {
  check("generateLink signup (Database error = regresi)", false, String(e));
}

if (userId) {
  const probes = [
    ["profile dibuat", `/rest/v1/profiles?select=id&id=eq.${userId}`],
    ["workspace dibuat", `/rest/v1/workspace_members?select=workspace_id&user_id=eq.${userId}`],
    ["referral code dibuat", `/rest/v1/referral_profiles?select=referral_code&user_id=eq.${userId}`],
  ];
  for (const [label, path] of probes) {
    const res = await fetch(SB + path, { headers: ADMIN });
    const rows = await res.json();
    check(label, Array.isArray(rows) && rows.length > 0, `${rows.length ?? "?"} row`);
  }

  console.log("\n  cleanup user self-test...");
  for (const [path, method] of [
    [`/rest/v1/profiles?id=eq.${userId}`, "DELETE"],
    [`/rest/v1/referral_profiles?user_id=eq.${userId}`, "DELETE"],
    [`/auth/v1/admin/users/${userId}`, "DELETE"],
  ]) {
    try {
      await fetch(SB + path, { method, headers: ADMIN });
    } catch {}
  }
  console.log("  cleanup selesai");
}

title(5, "ENDPOINT LAIN TIDAK CRASH");
for (const [path, body] of [
  ["/api/auth/password-reset", { action: "request", email: "sryadit5@gmail.com" }],
  ["/api/auth/whatsapp-otp", { action: "request", phone: "+6281234567890" }],
]) {
  const res = await req(path, { method: "POST", body });
  check(`${path} merespons`, res.status !== "ERR" && res.status < 500, `${res.status}`);
}

console.log(`\n${"=".repeat(62)}\nRESULT: ${ok ? "SEMUA PASS" : "ADA YANG FAIL"}\n${"=".repeat(62)}`);
process.exit(ok ? 0 : 1);
