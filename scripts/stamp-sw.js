import { readFileSync, writeFileSync } from 'fs'

// Runs after `vite build`. Reads the real hashed asset filenames Vite just generated
// (from dist/index.html — no manual list to maintain) and injects them into dist/sw.js
// as the install-time precache manifest, plus stamps the cache name with the build
// timestamp so a new deploy always invalidates old caches, never serves stale assets.

const dist = 'dist'
const swPath = `${dist}/sw.js`
const htmlPath = `${dist}/index.html`

const html = readFileSync(htmlPath, 'utf8')
const assetMatches = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(m => m[1])
const assets = [...new Set(assetMatches)]

// Derive the base path (e.g. "/GLP-App-Claude/" or "/") from the first asset URL
const base = assets.length ? assets[0].slice(0, assets[0].indexOf('assets/')) : '/'

const precache = [base, `${base}index.html`, `${base}manifest.json`, ...assets]

const ts = Date.now()
let sw = readFileSync(swPath, 'utf8')
sw = sw.replace("'glp-cache-BUILD_TS'", `'glp-cache-${ts}'`)
sw = sw.replace('const PRECACHE_ASSETS = []', `const PRECACHE_ASSETS = ${JSON.stringify(precache)}`)
writeFileSync(swPath, sw)

console.log(`SW cache versioned: glp-cache-${ts}`)
console.log(`SW precaching ${precache.length} app-shell assets`)
