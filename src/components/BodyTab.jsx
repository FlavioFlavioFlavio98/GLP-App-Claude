// Nuova sezione, ancora da definire — ci arriveranno statistiche/strumenti
// legati al corpo, separati dall'allenamento vero e proprio (che resta in
// Workout). Per ora è solo un contenitore vuoto in attesa di indicazioni.
export default function BodyTab() {
  return (
    <div style={{ paddingTop: 40, textAlign: 'center' }}>
      <div style={{ fontSize: '3em', marginBottom: 12 }}>🫀</div>
      <div style={{ fontSize: '1em', fontWeight: 700, color: 'var(--theme-color)', marginBottom: 6 }}>Body</div>
      <div style={{ fontSize: '0.85em', color: '#666', maxWidth: 260, margin: '0 auto' }}>
        Presto qui troverai altri strumenti legati al tuo corpo.
      </div>
    </div>
  )
}
