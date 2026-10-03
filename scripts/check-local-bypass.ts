// Self-check for the local-dev access bypass.
//
// Regression guard: production must keep enforcing subscription locking and
// profile-completion redirects, while localhost must not. Run with:
//   node --experimental-strip-types scripts/check-local-bypass.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

function isLocalDevHost(hostname: string) {
  const host = hostname.toLowerCase();
  return LOCAL_HOSTS.includes(host) || host.endsWith(".localhost");
}

// Mirror of the helper in app/LumawayWorkspaceApp.tsx.
assert.equal(isLocalDevHost("localhost"), true, "localhost must be treated as local dev");
assert.equal(isLocalDevHost("LocalHost"), true, "host matching must be case-insensitive");
assert.equal(isLocalDevHost("127.0.0.1"), true, "loopback IPv4 must be local dev");
assert.equal(isLocalDevHost("[::1]"), true, "loopback IPv6 must be local dev");
assert.equal(isLocalDevHost("app.localhost"), true, "subdomain of localhost must be local dev");

// The production host must never be unlocked.
assert.equal(isLocalDevHost("app.lumaway.online"), false, "production app host must stay gated");
assert.equal(isLocalDevHost("lumaway.online"), false, "public site must stay gated");
assert.equal(isLocalDevHost("www.lumaway.online"), false, "public www must stay gated");

// A lookalike domain must not be treated as local.
assert.equal(isLocalDevHost("localhost.evil.com"), false, "lookalike domain must not unlock");
assert.equal(isLocalDevHost("notlocalhost"), false, "substring must not unlock");

// Guard the source: the bypass must stay opt-in behind isLocalDevHost().
const source = readFileSync(
  new URL("../app/LumawayWorkspaceApp.tsx", import.meta.url),
  "utf-8",
);

assert.match(
  source,
  /if \(localDev\) \{\s*\/\/ Local testing is never billing-gated\.\s*setAccessLocked\(false\);/,
  "local dev must force accessLocked off",
);

assert.match(
  source,
  /const needsProfile = !localDev && typedProfile\.role !== "admin"/,
  "profile-completion redirect must be skipped on localhost",
);

assert.match(
  source,
  /if \(!isAdmin && accessLocked && !localDev &&/,
  "route lock must be skipped on localhost",
);

console.log("ok - local-dev bypass guards pass, production stays gated");
