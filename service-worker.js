const CACHE_NAME = 'fe-conectada-v4';
const VIDEOJS_VER = '8.21.0';
const CHROMECAST_VER = '1.5.0';

const LOCAL_URLS = [
  './index.html',
  './login.html',
  './admin.html',
  './style.css',
  './script.js',
  './admin.js',
  './auth-config.js',
  './api-config.js',
  './manifest.json',
  './data/programacao.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const CDN_URLS = [
  `https://cdn.jsdelivr.net/npm/video.js@${VIDEOJS_VER}/dist/video-js.min.css`,
  `https://cdn.jsdelivr.net/npm/video.js@${VIDEOJS_VER}/dist/video.min.js`,
  `https://cdn.jsdelivr.net/npm/@silvermine/videojs-chromecast@${CHROMECAST_VER}/dist/silvermine-videojs-chromecast.min.css`,
  `https://cdn.jsdelivr.net/npm/@silvermine/videojs-chromecast@${CHROMECAST_VER}/dist/silvermine-videojs-chromecast.min.js`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all([
          cache.addAll(LOCAL_URLS).catch(() => {}),
          Promise.all(CDN_URLS.map((url) => cache.add(url).catch(() => {}))),
        ])
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') return response;
        const url = new URL(event.request.url);
        const sameOrigin = url.origin === self.location.origin;
        const isCdnJsCss =
          url.hostname === 'cdn.jsdelivr.net' &&
          (url.pathname.endsWith('.js') || url.pathname.endsWith('.css'));
        if (sameOrigin || isCdnJsCss) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
