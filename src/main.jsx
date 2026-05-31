import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppProvider } from './lib/store'
import App from './App'
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
    navigator.serviceWorker.register('/GLP-App-Claude/sw.js')
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
