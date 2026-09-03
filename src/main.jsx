import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './lib/store'
import App from './App'
import { APP_BUILD_HASH } from './version'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
)

// Service Worker registration with update detection
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // ?v=<build hash> nell'URL registrato: GitHub Pages serve sw.js con un
    // Cache-Control che alcuni browser rispettano anche per lo script del
    // service worker stesso (bug/quirk ben documentato, non solo teorico —
    // esattamente la causa per cui l'app di Flavio è rimasta bloccata alla
    // v2.19.0 anche dopo aver corretto la logica di controllo aggiornamenti:
    // il nuovo sw.js semplicemente non veniva mai ri-scaricato). Una query
    // string diversa ad ogni deploy (stabile per lo stesso deploy, cambia
    // solo quando cambia l'hash) forza il browser a trattarlo come un URL
    // mai visto prima, bypassando quella cache — indipendente dal
    // versionamento di CACHE_NAME già in sw.js, che vive un livello più in
    // basso (Cache Storage) e non aiuta se lo script stesso non viene
    // ri-scaricato per primo.
    navigator.serviceWorker.register(`/GLP-App-Claude/sw.js?v=${APP_BUILD_HASH}`)
      .then(registration => {
        // Check for updates periodically
        registration.update()

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            // New SW installed and waiting — notify the app
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('swUpdateAvailable', { detail: { registration } }))
            }
          })
        })

        // Store registration globally for the settings page
        window.__swRegistration = registration
      })
      .catch(err => console.warn('SW registration failed:', err))

    // Handle SW-controlled reload after skipWaiting
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload() }
    })
  })
}
