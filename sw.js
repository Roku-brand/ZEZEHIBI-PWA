/* =========================================
   記録アプリ Service Worker (sw.js)
   - オフライン対応
   - 自動更新（旧キャッシュ掃除）
   - 壊れにくいフェッチ戦略
   ========================================= */

const VERSION = 'v2.0.0-' + (self.registration?.scope || '');
const CACHE_NAME = `journal-cache-${VERSION}`;

/* PWAのアプリシェル（先読みキャッシュ） */
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './offline.html',
  './manifest.webmanifest',
  // アイコン（存在しない場合はコメントアウトOK）
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

/* ---- インストール：アプリシェルをキャッシュ ---- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/* ---- 有効化：古いキャッシュを削除 ---- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith('journal-cache-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/* ---- 取得：状況に応じた戦略 ---- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // POSTや他メソッドは素通し
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // 1) HTMLナビゲーションは「ネット優先 → キャッシュ → オフライン画面」
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: 'no-store' });
          // 200系のみキャッシュ更新
          const cache = await caches.open(CACHE_NAME);
          if (fresh.ok) cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (err) {
          // ネット不可：indexのキャッシュ or offline.html
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('./index.html');
          return cached || (await cache.match('./offline.html'));
        }
      })()
    );
    return;
  }

  // 2) 同一オリジンの静的アセットは「Stale-While-Revalidate」
  if (isSameOrigin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            // 成功したらキャッシュ更新（opaqueは除外）
            if (res && res.status === 200 && res.type !== 'opaque') {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => null);

        // 先にキャッシュがあれば即返す。なければネット
        return cached || (await fetchPromise) || new Response('', { status: 504, statusText: 'Gateway Timeout' });
      })()
    );
    return;
  }

  // 3) クロスオリジンは「ネット優先 → キャッシュ」
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        // CDN等のキャッシュ可能リソースのみ保存（opaqueはそのまま返す）
        if (res && res.ok && res.type !== 'opaque') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, res.clone());
        }
        return res;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        return (
          cached ||
          new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      }
    })()
  );
});

/* ---- 即時反映用（任意）：skipWaiting メッセージ ---- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
