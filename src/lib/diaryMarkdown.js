// Formattazione minima per il Diario — richiesta esplicita di Flavio: righe
// che iniziano con "- " o "* " diventano un elenco puntato, righe che
// iniziano con "1. " (o "2)" ecc.) diventano un elenco numerato, esattamente
// come nel rendering delle risposte in chat. Applicata solo in anteprima
// (dopo aver finito di scrivere), mai mentre si digita nella textarea — la
// stessa scelta già fatta per JournalModal/CoachPage in questo progetto.
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function renderInline(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')
}

export function renderDiaryMarkdown(text) {
  if (!text) return ''
  const lines = escapeHtml(text).split('\n')
  const out = []
  let listType = null // 'ul' | 'ol' | null

  function closeList() {
    if (listType) { out.push(`</${listType}>`); listType = null }
  }

  for (const line of lines) {
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (bullet) {
      if (listType !== 'ul') { closeList(); out.push('<ul style="margin:4px 0;padding-left:22px">'); listType = 'ul' }
      out.push(`<li style="margin:2px 0">${renderInline(bullet[1])}</li>`)
    } else if (numbered) {
      if (listType !== 'ol') { closeList(); out.push('<ol style="margin:4px 0;padding-left:22px">'); listType = 'ol' }
      out.push(`<li style="margin:2px 0">${renderInline(numbered[1])}</li>`)
    } else {
      closeList()
      out.push(line.trim() === '' ? '<div style="height:0.7em"></div>' : `<div>${renderInline(line)}</div>`)
    }
  }
  closeList()
  return out.join('')
}

export function countWords(text) {
  const trimmed = (text || '').trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
