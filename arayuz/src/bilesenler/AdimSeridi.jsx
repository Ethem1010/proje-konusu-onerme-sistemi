// Üstteki adım şeridi: öğrencinin yolda nerede olduğunu gösterir.
// Demodaki sıra; demodaki "Nasıl çalışır" tanıtım ekranı planda olmadığı için yok.
export const ADIMLAR = ['Anlat', 'Kart', 'Projeler', 'Düello', 'Sonuç', 'Harita'];

export default function AdimSeridi({ aktif }) {
  const sira = ADIMLAR.indexOf(aktif);
  return (
    <ol className="steps" aria-label="Adımlar">
      {ADIMLAR.map((ad, i) => (
        <li
          key={ad}
          className={i === sira ? 'on' : i < sira ? 'done' : undefined}
          aria-current={i === sira ? 'step' : undefined}
        >
          <span className="no" aria-hidden="true">
            {i + 1}
          </span>
          <span>{ad}</span>
        </li>
      ))}
    </ol>
  );
}
