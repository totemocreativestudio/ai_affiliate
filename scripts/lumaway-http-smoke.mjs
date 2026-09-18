const origin = process.env.LUMAWAY_SMOKE_ORIGIN || "http://127.0.0.1:3100";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  let lastError = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${origin}/app.lumaway/login`, { redirect: "manual" });
      if (response.status >= 200 && response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(500);
  }
  throw lastError || new Error("Lumaway server did not become ready.");
}

async function expectRoute(pathname, { status = 200, contains } = {}) {
  const response = await fetch(`${origin}${pathname}`, { redirect: "manual" });
  if (response.status !== status) {
    throw new Error(`${pathname}: expected HTTP ${status}, received ${response.status}`);
  }
  const body = await response.text();
  if (contains && !body.includes(contains)) {
    throw new Error(`${pathname}: response did not contain expected marker: ${contains}`);
  }
}

async function expectRootLoginRedirect() {
  const response = await fetch(`${origin}/`, { redirect: "manual" });
  if ([307, 308].includes(response.status)) {
    const location = response.headers.get("location") || "";
    if (!location.endsWith("/app.lumaway/login")) {
      throw new Error(`/: expected redirect to /app.lumaway/login, received ${location || "(missing)"}`);
    }
    return;
  }

  // Next.js may prerender a server-component redirect as an HTTP 200 shell
  // containing the redirect instruction. Accept that only if the target path
  // is explicitly present in the generated response.
  if (response.status === 200) {
    const body = await response.text();
    if (body.includes("/app.lumaway/login")) return;
  }

  throw new Error(`/: expected redirect to /app.lumaway/login, received HTTP ${response.status}`);
}

async function main() {
  await waitForServer();
  await expectRootLoginRedirect();

  for (const route of [
    "/app.lumaway/login",
    "/app.lumaway/dashboard",
    "/app.lumaway/ai-analytics",
    "/app.lumaway/billing",
    "/app.lumaway/profile",
  ]) {
    await expectRoute(route, { contains: "Lumaway" });
  }

  console.log("Lumaway HTTP route smoke checks passed.");
}

main().catch((error) => {
  console.error("Lumaway HTTP smoke check failed:", error);
  process.exit(1);
});
