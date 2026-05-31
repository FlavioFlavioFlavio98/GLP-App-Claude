import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider, ALLOWED_EMAILS, EMAIL_TO_USER } from '../lib/firebase'
import { THEMES } from '../lib/themes'

// Google logo SVG
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

export default function LoginScreen({ onLogin }) {
  const theme = THEMES[localStorage.getItem('glp_theme') || 'dark']
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const email = result.user.email

      if (!ALLOWED_EMAILS.includes(email)) {
        const { signOut } = await import('firebase/auth')
        await signOut(auth)
        setError('Accesso non autorizzato — questa app è privata.')
        setLoading(false)
        return
      }

      // Successful login — store handles the rest via onAuthStateChanged
      onLogin?.(email)
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        setError('Errore durante il login. Riprova.')
      }
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: theme.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32,
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: '5em', marginBottom: 12, animation: 'flicker 1.8s ease-in-out infinite' }}>🔥</div>
        <div style={{ fontSize: '2.8em', fontWeight: 900, letterSpacing: 4, color: theme.themeColor, marginBottom: 8 }}>
          GLP
        </div>
        <div style={{ fontSize: '0.9em', color: '#555', letterSpacing: 1 }}>
          Gamification Life Project
        </div>
      </div>

      {/* Login button */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: loading ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.95)',
          color: '#222', border: 'none', borderRadius: 12,
          padding: '14px 28px', fontSize: '0.95em', fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          transition: 'all 0.2s', opacity: loading ? 0.7 : 1,
          minWidth: 220,
        }}
      >
        {loading ? (
          <>
            <div style={{ width: 18, height: 18, border: '2px solid #bbb', borderTopColor: '#333', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            Accesso in corso...
          </>
        ) : (
          <>
            <GoogleLogo />
            Accedi con Google
          </>
        )}
      </button>

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 20, padding: '12px 20px',
          background: 'rgba(239,83,80,0.15)', border: '1px solid rgba(239,83,80,0.4)',
          borderRadius: 10, color: '#ef5350', fontSize: '0.85em',
          maxWidth: 320, textAlign: 'center', lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 40, fontSize: '0.68em', color: '#333', letterSpacing: 0.5 }}>
        App privata — solo utenti autorizzati
      </div>
    </div>
  )
}
