export const THEMES = {
  dark: {
    id: 'dark',
    name: 'Dark',
    bg: '#121212',
    card: 'rgba(30,30,30,0.82)',
    cardSolid: '#1e1e1e',
    themeColor: '#ffca28',
    themeGlow: 'rgba(255,202,40,0.25)',
    accent2: '#d05ce3',
    border: 'rgba(255,255,255,0.07)',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    bg: '#0d2010',
    card: 'rgba(20,42,24,0.82)',
    cardSolid: '#142a18',
    themeColor: '#69f0ae',
    themeGlow: 'rgba(105,240,174,0.25)',
    accent2: '#4caf50',
    border: 'rgba(105,240,174,0.08)',
  },
  volcano: {
    id: 'volcano',
    name: 'Volcano',
    bg: '#1a0800',
    card: 'rgba(42,16,0,0.82)',
    cardSolid: '#2a1000',
    themeColor: '#ff7043',
    themeGlow: 'rgba(255,112,67,0.25)',
    accent2: '#ff9800',
    border: 'rgba(255,112,67,0.08)',
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    bg: '#06080f',
    card: 'rgba(14,18,32,0.82)',
    cardSolid: '#0e1220',
    themeColor: '#7986cb',
    themeGlow: 'rgba(121,134,203,0.25)',
    accent2: '#5c6bc0',
    border: 'rgba(121,134,203,0.08)',
  },
  aurora: {
    id: 'aurora',
    name: 'Aurora',
    bg: '#050e14',
    card: 'rgba(10,26,36,0.82)',
    cardSolid: '#0a1a24',
    themeColor: '#4db6ac',
    themeGlow: 'rgba(77,182,172,0.25)',
    accent2: '#80cbc4',
    border: 'rgba(77,182,172,0.08)',
  },
}

export function applyTheme(themeId) {
  const t = THEMES[themeId] || THEMES.dark
  const r = document.documentElement
  r.style.setProperty('--bg', t.bg)
  r.style.setProperty('--card', t.card)
  r.style.setProperty('--card-solid', t.cardSolid)
  r.style.setProperty('--theme-color', t.themeColor)
  r.style.setProperty('--theme-glow', t.themeGlow)
  r.style.setProperty('--accent2', t.accent2)
  r.style.setProperty('--card-border', t.border)
}

export function applyUserColors(flavioColor, simonaColor) {
  const r = document.documentElement
  r.style.setProperty('--flavio-color', flavioColor)
  r.style.setProperty('--simona-color', simonaColor)
}
