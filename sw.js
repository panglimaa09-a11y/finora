// Bumping CACHE_VERSION on every deploy ensures browsers pick up fresh assets.
// In a CI/CD pipeline, inject the build hash here automatically.
const CACHE_VERSION = 'v2'
const CACHE_NAME = `finora-pwa-${CACHE_VERSION}`

// Only these static assets are pre-cached (app shell).
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
]

// Assets that should never be served from cache when network is available.
// Matches JS, CSS, and HTML files that Vite generates with content hashes.
const NETWORK_FIRST_PATTERN = /\.(js|css|html)(\?.*)?$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // Network-first for JS/CSS/HTML: always try the network; only use
  // the cache as a fallback when the user is fully offline.
  if (NETWORK_FIRST_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          return response
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    )
    return
  }

  // Cache-first for everything else (icons, manifest, etc.).
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        const copy = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
        return response
      }).catch(() => caches.match('/'))
    })
  )
})
