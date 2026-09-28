const CACHE = "lumaway-shell-v4";
const STATIC = ["/luma-mark.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(STATIC))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function offlinePage() {
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
<meta name="theme-color" content="#f6f7fb" />
<title>Lumaway · Offline</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7fb;color:#101828;font:500 15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:24px}.box{width:min(420px,100%);padding:34px;border:1px solid #e2e7ef;border-radius:22px;background:#fff;text-align:center;box-shadow:0 18px 60px rgba(16,24,40,.08)}img{width:54px;height:54px;object-fit:contain;margin-bottom:16px}h1{margin:0 0 8px;font-size:23px}p{margin:0;color:#667085}button{margin-top:22px;border:0;border-radius:12px;background:#635bff;color:#fff;padding:12px 18px;font-weight:700;cursor:pointer}
</style>
</head>
<body><main class="box"><img src="/luma-mark.png" alt="Lumaway"/><h1>Koneksi terputus</h1><p>Lumaway akan memuat kembali workspace setelah koneksi tersedia.</p><button onclick="location.reload()">Coba lagi</button></main></body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App navigations must always prefer the newest server response. Never serve an old dashboard shell.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" }).catch(() => offlinePage()));
    return;
  }

  // Never cache Next.js chunks here. Their hashed filenames and the browser cache are sufficient,
  // and bypassing a service-worker chunk cache prevents stale UI after a release.
  if (url.pathname.startsWith("/_next/")) return;

  if (STATIC.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        });
        return cached || network;
      }),
    );
  }
});
