// Ters duran, dokununca dönüp ön yüzünü gösteren kart (karakter kartı ve sonuç kartları için).
// acik: kart açık mı. onCevir: karta dokununca çağrılır. renk: ön yüz çerçevesi için 1-8.
// Boyutu (yükseklik) dışarıdan className ile verilir; ön yüz absolute olduğu için gerekli.
export default function DonenKart({ acik, onCevir, renk, etiket, className = '', children }) {
  return (
    <button
      type="button"
      className={['flip', acik && 'open', className].filter(Boolean).join(' ')}
      style={renk ? { '--fc': `var(--c${renk})` } : undefined}
      onClick={onCevir}
      aria-label={etiket}
      aria-pressed={acik}
    >
      <span className="flip-in">
        <span className="face back" aria-hidden="true">?</span>
        <span className="face front">{children}</span>
      </span>
    </button>
  );
}
