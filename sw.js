const CACHE_NAME = 'spotify-clone-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/main.js',
    '/js/modules/state.js',
    '/js/modules/data.js',
    '/js/modules/player.js',
    '/js/modules/playlist.js',
    '/js/modules/search.js',
    '/js/modules/navigation.js',
    '/js/modules/ui.js',
    '/js/modules/auth.js',
    '/js/modules/visualizer.js',
    '/js/modules/home.js',
    '/js/modules/gradient.js',
    '/favicon.ico',
    '/manifest.json',
    '/img/home.svg',
    '/img/search.svg'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch — network first for pages/API, cache first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET and external requests
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // Songs — cache after first play (network first)
    if (url.pathname.startsWith('/songs/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    if (cached) return cached;
                    return fetch(event.request).then((response) => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                        }
                        return response;
                    }).catch(() => cached);
                });
            })
        );
        return;
    }

    // Images — cache first, then network
    if (url.pathname.startsWith('/img/')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cached) => {
                    const fetchPromise = fetch(event.request).then((response) => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    }).catch(() => cached);
                    return cached || fetchPromise;
                });
            })
        );
        return;
    }

    // Static assets — stale while revalidate
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cached) => {
                const fetchPromise = fetch(event.request).then((response) => {
                    if (response.ok) cache.put(event.request, response.clone());
                    return response;
                }).catch(() => cached);
                return cached || fetchPromise;
            });
        })
    );
});
