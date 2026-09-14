/**
 * FCM utilities — token management, persistent notification, permission
 *
 * SETUP:
 *  1. Firebase Console → Project Settings → Cloud Messaging → Web push certificates
 *  2. Generate a VAPID key and paste it below
 *  3. Run: firebase deploy --only functions
 */

// firebase/messaging NON è importato qui in cima — questo file è raggiunto
// eager da store.jsx (via updatePersistentNotification, che non ne ha
// bisogno), quindi un import statico qui vanificherebbe il lazy-loading già
// fatto in firebase.js. getToken/onMessage vengono importati dinamicamente
// dentro le funzioni che li usano, sotto.
import { doc, setDoc, collection, getDocs } from 'firebase/firestore'
import { db, getMessagingInstance } from './firebase'

// ⚠️  Replace with your VAPID key from Firebase Console > Cloud Messaging
export const VAPID_KEY = 'BP_S9XE4wePvtvch398aZJnM7onaz7Mq91TRuqZiHARgiQd26kiNRbP8-LsQgzuK_6DkGraHFb_Wzli7u7ONuvA'

// ─── Permission ───────────────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

// ─── Token ────────────────────────────────────────────────────────────────────

export async function saveFcmToken(userId) {
  if (Notification.permission !== 'granted') return null
  if (VAPID_KEY.startsWith('REPLACE_')) {
    console.warn('GLP: FCM VAPID key not configured — skipping token registration')
    return null
  }
  try {
    const messaging = await getMessagingInstance()
    if (!messaging) return null
    const { getToken } = await import('firebase/messaging')

    const registration = window.__swRegistration
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return null

    // Use first 20 chars of token as doc ID (stable, unique-enough)
    const tokenId = token.slice(0, 20)
    await setDoc(doc(db, 'users', userId, 'fcmTokens', tokenId), {
      token,
      updatedAt: new Date().toISOString(),
      platform: 'web',
    })
    localStorage.setItem(`glp_fcm_token_${userId}`, token)
    return token
  } catch (e) {
    console.warn('FCM token error:', e)
    return null
  }
}

// ─── Foreground messages ──────────────────────────────────────────────────────

export async function setupForegroundMessages(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  const { onMessage } = await import('firebase/messaging')
  return onMessage(messaging, payload => callback?.(payload))
}

// ─── Persistent notification ──────────────────────────────────────────────────

/**
 * Shows/updates the "GLP — Oggi" persistent notification via the SW.
 * Uses the SW message channel so the SW handles it with the correct tag.
 */
export function updatePersistentNotification({ net, pending, streak }) {
  if (Notification.permission !== 'granted') return
  if (localStorage.getItem('glp_persistent_notification') !== 'true') return

  const title = `GLP — Oggi: ${net >= 0 ? '+' : ''}${net}pt`
  const body = `${pending} abitudini mancanti · Streak: ${streak}🔥`

  if (window.__swRegistration?.active) {
    window.__swRegistration.active.postMessage({ type: 'UPDATE_PERSISTENT', title, body })
  }
}

/** Send a test notification immediately (foreground, no FCM) */
export function sendTestNotification(title = 'GLP Test 🔥', body = 'Le notifiche funzionano!') {
  if (Notification.permission !== 'granted') return
  if (window.__swRegistration) {
    window.__swRegistration.showNotification(title, {
      body,
      icon: '/GLP-App-Claude/icons/icon-192x192.png',
    })
  } else {
    new Notification(title, { body })
  }
}
