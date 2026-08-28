// ─── GLP Service Worker ────────────────────────────────────────────────────────
// CACHE_NAME and PRECACHE_ASSETS are injected at build time by scripts/stamp-sw.js
// (reads the real hashed filenames from dist/ after `vite build` — no manual list to
// maintain, and the cache name changes on every build so stale caches are dropped).
const CACHE_NAME = 'glp-cache-1787945233229'
const PRECACHE_ASSETS = ["/GLP-App-Claude/","/GLP-App-Claude/index.html","/GLP-App-Claude/manifest.json","/GLP-App-Claude/assets/index-Bys6rqy1.js","/GLP-App-Claude/assets/index-C56AtMEp.css"]

// External font/icon CDNs we opportunistically cache (cache-first, static content)
const EXTERNAL_CACHE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net']

// Install: precache the real app shell (index.html + hashed JS/CSS from this build)
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
  )
})

// Activate: delete ALL old caches (different CACHE_NAME per build), then claim
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch strategy — app shell only. Firestore/Google API calls are never intercepted
// here (different origin, not in EXTERNAL_CACHE_HOSTS), so they always hit the network.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  const isSameOrigin = url.origin === self.location.origin
  const isCacheableExternal = EXTERNAL_CACHE_HOSTS.includes(url.hostname)
  if (!isSameOrigin && !isCacheableExternal) return

  // Navigation (index.html): network-only — always get fresh HTML with current asset hashes
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/GLP-App-Claude/index.html'))
    )
    return
  }

  // Hashed assets (/assets/*) and external fonts/icons: cache-first, never stale
  if ((isSameOrigin && url.pathname.includes('/assets/')) || isCacheableExternal) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Everything else same-origin: network-first, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// Messages from the app
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()

  if (event.data?.type === 'UPDATE_PERSISTENT') {
    const { title, body } = event.data
    self.registration.showNotification(title, {
      body,
      icon: '/GLP-App-Claude/icons/icon-192x192.png',
      badge: '/GLP-App-Claude/icons/icon-72x72.png',
      tag: 'glp-persistent',
      renotify: false,
      silent: true,
    })
  }
})

// ─── Firebase Cloud Messaging (background push) ───────────────────────────────
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyA001klzJou17djB76Q-t2eRTKbU9NZoQs',
  authDomain: 'gamification-life-project.firebaseapp.com',
  projectId: 'gamification-life-project',
  storageBucket: 'gamification-life-project.firebasestorage.app',
  messagingSenderId: '925252547674',
  appId: '1:925252547674:web:1316a5d96cb54c0a515463',
})

const messaging = firebase.messaging()

// Handle background FCM messages
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {}
  const data = payload.data || {}

  // Persistent notification → update with tag (replaces existing)
  if (data.type === 'persistent') {
    return self.registration.showNotification(title || 'GLP', {
      body: body || '',
      icon: '/GLP-App-Claude/icons/icon-192x192.png',
      badge: '/GLP-App-Claude/icons/icon-72x72.png',
      tag: 'glp-persistent',
      renotify: false,
      silent: true,
    })
  }

  // Regular notification (reminder, goal expired, etc.)
  return self.registration.showNotification(title || 'GLP', {
    body: body || '',
    icon: '/GLP-App-Claude/icons/icon-192x192.png',
    badge: '/GLP-App-Claude/icons/icon-72x72.png',
    data: { url: '/GLP-App-Claude/' },
  })
})

// Notification click → focus or open app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/GLP-App-Claude/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('GLP-App-Claude') && 'focus' in client) return client.focus()
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
