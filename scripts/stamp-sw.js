import { readFileSync, writeFileSync } from 'fs'

const ts = Date.now()
const dist = 'dist/sw.js'
const content = readFileSync(dist, 'utf8').replace('BUILD_TS', String(ts))
writeFileSync(dist, content)
console.log(`SW cache versioned: glp-cache-${ts}`)
