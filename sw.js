const CACHE_NAME = 'madhav-shivom-erp-v32';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Firestore API / dynamic database or auth traffic
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.hostname.includes('googleapis.com/v1')
  ) {
    return;
  }

  const isSameOrigin = (url.origin === self.location.origin);
  const isAllowedCdn = (
    url.hostname === 'cdn.sheetjs.com' ||
    url.hostname === 'cdn.jsdelivr.net' ||
    url.hostname === 'www.gstatic.com'
  );

  if (!isSameOrigin && !isAllowedCdn) {
    return;
  }

  // Stale-while-revalidate for CDN libraries for offline reliability
  if (isAllowedCdn) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Network-first strategy for local origin so updates always load immediately
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match('/index.html')))
  );
});
