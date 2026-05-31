// ─── GLP Service Worker ────────────────────────────────────────────────────────
const CACHE_NAME = 'glp-cache-v4'
const OFFLINE_ASSETS = ['/GLP-App-Claude/']

// Install
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  )
})

// Activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch: network-first, fallback cache
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return
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
