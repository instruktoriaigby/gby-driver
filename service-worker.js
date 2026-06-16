const CACHE_NAME = 'gby-driver-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/main.js',
  '/i18n.js',
  '/manifest.json',
  '/pages/login.html',
  '/pages/dashboard.html',
  '/pages/defektas.html',
  '/pages/instrukcijos.html',
  '/pages/uzduotys.html',
  '/pages/nustatymai.html',
  '/locales/lt.json',
  '/locales/en.json',
  '/locales/ru.json',
  '/Logo_GBY.jpg',
  '/VIN.jpg',
  '/TOLI.jpg',
  '/ARTI.jpg',
  '/DOK.jpg',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(error => {
        console.warn('Cache install skipped:', error);
      })
  );

  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.in') ||
    url.pathname.includes('/storage/')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const responseClone = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone).catch(error => {
            console.warn('Cache put skipped:', error);
          });
        });

        return response;
      })
      .catch(() => caches.match(request))
  );
});