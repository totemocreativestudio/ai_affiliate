const origin = process.env.LUMAWAY_SMOKE_ORIGIN || "http://127.0.0.1:3100";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(pathname, host, options = {}) {
  return fetch(`${origin}${pathname}`, { redirect: "manual", headers: { Host: host }, ...options });
}

async function waitForServer() {
  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await request("/login", "app.lumaway.online");
      if (response.status >= 200 && response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error("Lumaway server did not become ready.");
}

async function expectRoute(pathname, { status = 200, contains, host = "app.lumaway.online" } = {}) {
  const response = await request(pathname, host);
  if (response.status !== status) {
    throw new Error(`${host}${pathname}: expected HTTP ${status}, received ${response.status}`);
  }
  const body = await response.text();
  if (contains && !body.includes(contains)) {
    throw new Error(`${host}${pathname}: response did not contain expected marker: ${contains}`);
  }
}

async function expectPublicLanding() {
  const response = await request("/", "www.lumaway.online");
  if ([307, 308].includes(response.status)) {
    const location = response.headers.get("location") || "";
    if (!location.endsWith("/web/home")) {
      throw new Error(`www root: expected redirect to /web/home, received ${location || "(missing)"}`);
    }
    return;
  }
  if (response.status === 200) {
    const body = await response.text();
    if (body.includes("/web/home")) return;
  }
  throw new Error(`www root: expected landing redirect, received HTTP ${response.status}`);
}

async function expectLegacyRedirect() {
  const response = await request("/app.lumaway/login", "www.lumaway.online");
  if (![307, 308].includes(response.status)) {
    throw new Error(`legacy route: expected redirect, received HTTP ${response.status}`);
  }
  const location = response.headers.get("location") || "";
  let parsed = null;
  try { parsed = new URL(location); } catch {}
  if (!parsed || parsed.hostname !== "app.lumaway.online" || parsed.pathname !== "/login") {
    throw new Error(`legacy route: expected app.lumaway.online/login, received ${location || "(missing)"}`);
  }
}

async function main() {
  await waitForServer();
  await expectPublicLanding();
  await expectLegacyRedirect();

  for (const route of [
    "/login",
    "/dashboard",
    "/ai-analytics",
    "/billing",
    "/profile",
  ]) {
    await expectRoute(route, { contains: "Lumaway" });
  }

  console.log("Lumaway host-aware HTTP route smoke checks passed.");
}

main().catch((error) => {
  console.error("Lumaway HTTP smoke check failed:", error);
  process.exit(1);
});
