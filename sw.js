const CACHE_NAME = 'glp-cache-v3'
const OFFLINE_ASSETS = ['/GLP-App-Claude/']

// Install: cache shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  )
  // Do NOT skipWaiting here — wait for activation message
})

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: network-first, fall back to cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
