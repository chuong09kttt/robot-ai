// ========== CHIRI AI SERVICE WORKER ==========
const CACHE_NAME = 'chiri-ai-v13.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache
const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/script.js',
  '/manifest.json',
  '/offline.html'
];

// CDN assets (external)
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
  'https://cdn.socket.io/4.7.5/socket.io.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...STATIC_ASSETS, ...CDN_ASSETS]);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Skip WebSocket
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      
      return fetch(event.request).then((networkResponse) => {
        // Cache successful responses
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Return offline page for HTML requests
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  const cache = await caches.open('messages-queue');
  const requests = await cache.keys();
  
  for (const request of requests) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.delete(request);
      }
    } catch(e) {}
  }
}
