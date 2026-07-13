import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

function getBuildMeta() {
  const time = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
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
