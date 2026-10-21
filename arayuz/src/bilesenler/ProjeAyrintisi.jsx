// Bir projenin ayrıntısı: ne, kim, çıktı, adımlar, kolay/efsane mod, alt puanlar.
// Sunucu bazı bilgileri boş gönderebilir; boş olan bölüm hiç gösterilmez.

function Bilgi({ baslik, children }) {
  if (!children) return null;
  return (
    <div className="kv">
      <h3>{baslik}</h3>
      <p>{children}</p>
    </div>
  );
}

function Puan({ ad, deger }) {
  return (
    <div className="meter">
      <span>{ad}</span>
      <span className="track">
        <i style={{ width: `${deger}%` }} />
      </span>
      <span>{deger}</span>
    </div>
  );
}

export default function ProjeAyrintisi({ proje, id, className = '' }) {
  const puanlar = [
    ['Sana uyumu', proje.puan_uyum],
    ['Yapılabilirliği', proje.puan_yapilabilirlik],
    ['Özgünlüğü', proje.puan_ozgunluk],
  ].filter(([, deger]) => deger != null);

  return (
    <div className={['ayrinti', className].filter(Boolean).join(' ')} id={id}>
      <Bilgi baslik="Ne yapılacak">{proje.ne}</Bilgi>
      <Bilgi baslik="Kimin işine yarar">{proje.kim}</Bilgi>
      <Bilgi baslik="Sonunda ne çıkar">{proje.cikti}</Bilgi>
      {proje.adimlar?.length > 0 && (
        <div className="kv">
          <h3>Nasıl yapılır</h3>
          <ol className="adimlar">
            {proje.adimlar.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
        </div>
      )}
      {(proje.kolay || proje.efsane) && (
        <div className="iki">
          <Bilgi baslik="Kolay mod">{proje.kolay}</Bilgi>
          <Bilgi baslik="Efsane mod">{proje.efsane}</Bilgi>
        </div>
      )}
      {puanlar.length > 0 && (
        <div className="kv">
          <h3>Puan</h3>
          {puanlar.map(([ad, deger]) => (
            <Puan key={ad} ad={ad} deger={deger} />
          ))}
        </div>
      )}
    </div>
  );
}
