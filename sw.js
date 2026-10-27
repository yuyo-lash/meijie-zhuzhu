// 離線快取：打開過一次之後，沒有網路也能記帳
// 只快取 App 自己的檔案；Google 登入與雲端硬碟同步一律直接連網，不經過快取。
const CACHE = "beauty-ledger-v18";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "privacy.html", "welcome-pig.svg"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = FONT_HOSTS.includes(url.hostname);
  if (!sameOrigin && !isFont) return;            // Google 登入、雲端硬碟 API：不攔截
  if (sameOrigin && url.pathname.endsWith("quotes.json")) return;   // 每日鼓勵語：永遠抓最新

  // 頁面本身：先連網拿最新版，沒網路才用快取（更新會立刻生效）
  if (req.mode === "navigate" || (sameOrigin && url.pathname.endsWith(".html"))) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match("./")))
    );
    return;
  }

  // 圖示、字型等：先用快取，背景再更新
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(hit => {
        const net = fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});
