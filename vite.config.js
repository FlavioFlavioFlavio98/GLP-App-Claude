import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getBuildMeta() {
  // Fuso orario di Flavio (Bulgaria) invece di UTC — il badge versione deve
  // mostrare un orario che riconosce a colpo d'occhio, non UTC che confonde.
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Sofia',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const get = t => parts.find(p => p.type === t)?.value
  const time = `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`
  let hash = 'dev'
  try { hash = execSync('git rev-parse --short HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim() } catch {}
  return { time, hash }
}

const { time, hash } = getBuildMeta()

export default defineConfig({
  plugins: [react()],
  base: '/',
  define: {
    __BUILD_TIME__: JSON.stringify(time),
    __BUILD_HASH__: JSON.stringify(hash),
  },
})
