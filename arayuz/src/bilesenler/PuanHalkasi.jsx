// Puanı (0-100) dolan bir halka olarak gösterir. Renk demodaki gibi:
// 70 ve üstü yeşil, 50-69 turuncu, altı kırmızı.
export function halkaRengi(puan) {
  if (puan >= 70) return 'good';
  if (puan >= 50) return 'warn';
  return 'crit';
}

export default function PuanHalkasi({ puan }) {
  const deger = Math.max(0, Math.min(100, Math.round(puan)));
  return (
    <span
      className="ring"
      role="img"
      aria-label={`Puan ${deger}`}
      style={{ '--v': deger, '--rc': `var(--${halkaRengi(deger)})` }}
    >
      <b>{deger}</b>
    </span>
  );
}
