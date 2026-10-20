import { useEffect, useState } from 'react';
import Dugme from '../bilesenler/Dugme.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';

const ADIM_SURESI = 1800; // ms

// Uzun süren bir iş beklenirken gösterilir: kayan çubuk ve sırayla yanan adımlar.
// hata verilirse hataBasligi + mesaj, "Tekrar dene" ve geri düğmesi çıkar.
export default function Bekleme({ baslik, aciklama, adimlar, hataBasligi, hata, tekrarDene, geriDon, geriEtiketi, adim }) {
  const [sira, setSira] = useState(0);

  useEffect(() => {
    if (hata) return undefined;
    setSira(0);
    const sayac = setInterval(() => setSira((s) => Math.min(s + 1, adimlar.length - 1)), ADIM_SURESI);
    return () => clearInterval(sayac);
  }, [hata, adimlar.length]);

  return (
    <>
      <UstCubuk adim={adim} />
      <main className="wrap">
        {hata ? (
          <section className="scr">
            <div className="sayfa-baslik">
              <h1>{hataBasligi}</h1>
              <p className="err" role="alert">
                {hata}
              </p>
            </div>
            <div className="row">
              <Dugme onClick={tekrarDene}>Tekrar dene</Dugme>
              <Dugme tur="ghost" onClick={geriDon}>
                {geriEtiketi}
              </Dugme>
            </div>
          </section>
        ) : (
          <section className="scr" aria-busy="true">
            <div className="sayfa-baslik">
              <h1>{baslik}</h1>
              <p className="muted">{aciklama}</p>
            </div>
            <div className="panel">
              <div className="ilerleme" role="progressbar" aria-label={baslik}>
                <i />
              </div>
              <ol className="bekleme-adimlar">
                {adimlar.map((ad, i) => (
                  <li key={ad} className={i < sira ? 'done' : i === sira ? 'on' : undefined}>
                    {ad}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
