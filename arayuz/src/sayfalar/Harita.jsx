import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { adimIsaretle, haritaGetir, oturumDustu, projeGetir } from '../api.js';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { ZORLUK_MODLARI } from '../secenekler.js';
import Bekleme from './Bekleme.jsx';

// Görev haritası: seçilen projenin 12 adımı, her birinde onay kutusu. Asıl kayıt sunucuda;
// sayfa her açıldığında (yenilense de) GET /harita ile yeniden yüklenir.
export default function Harita() {
  const git = useNavigate();
  const { secimId } = useParams();
  const [harita, setHarita] = useState(null);
  const [proje, setProje] = useState(null); // sadece başlık için; gelmezse başlıksız gösterilir
  const [yuklemeHatasi, setYuklemeHatasi] = useState('');
  const [deneme, setDeneme] = useState(0);
  const [hata, setHata] = useState('');
  const [bekleyen, setBekleyen] = useState(null); // kaydedilmekte olan adımın sırası

  useEffect(() => {
    let iptal = false;
    haritaGetir(secimId)
      .then((gelen) => {
        if (iptal) return;
        setHarita(gelen);
        projeGetir(gelen.proje_id)
          .then((p) => !iptal && setProje(p))
          .catch(() => {});
      })
      .catch((hataNesnesi) => {
        if (iptal) return;
        if (oturumDustu(hataNesnesi)) {
          git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
          return;
        }
        setYuklemeHatasi(hataNesnesi.message);
      });
    return () => {
      iptal = true;
    };
  }, [deneme]);

  if (!harita) {
    return (
      <Bekleme
        adim="Harita"
        baslik="Görev haritan açılıyor"
        hataBasligi="Görev haritası açılamadı"
        hata={yuklemeHatasi}
        tekrarDene={() => {
          setYuklemeHatasi('');
          setDeneme((d) => d + 1);
        }}
        geriDon={() => git('/anlat')}
        geriEtiketi="Başa dön"
      />
    );
  }

  const adimlar = [...harita.adimlar].sort((a, b) => a.sira - b.sira);
  const biten = adimlar.filter((a) => a.tamamlandi).length;
  const modAdi = ZORLUK_MODLARI.find((m) => m.kod === harita.zorluk_modu)?.ad ?? harita.zorluk_modu;

  const adimDegistir = (sira, tamamlandi) => (h) => ({
    ...h,
    adimlar: h.adimlar.map((a) => (a.sira === sira ? { ...a, tamamlandi } : a)),
  });

  // İşaret hemen görünür; sunucu kabul etmezse geri alınır. Kaydedilirken diğer kutular kilitli
  // (cevaplar karışıp eski hâl yenisinin üstüne yazılmasın).
  async function isaretle(adim, tamamlandi) {
    setHata('');
    setBekleyen(adim.sira);
    setHarita(adimDegistir(adim.sira, tamamlandi));
    try {
      setHarita(await adimIsaretle(secimId, { sira: adim.sira, tamamlandi }));
    } catch (hataNesnesi) {
      setHarita(adimDegistir(adim.sira, !tamamlandi));
      if (oturumDustu(hataNesnesi)) {
        git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
        return;
      }
      setHata(hataNesnesi.message);
    } finally {
      setBekleyen(null);
    }
  }

  return (
    <>
      <UstCubuk adim="Harita" />
      <main className="wrap">
        <section className="scr">
          <div className="sayfa-baslik">
            <h1>Görev haritan</h1>
            <p className="muted">
              {proje && <b className="harita-proje">{proje.baslik}</b>}
              {proje && ' · '}
              {modAdi} mod. Bitirdiğin adımı işaretle.
            </p>
          </div>

          <div
            className="harita-ilerleme"
            role="progressbar"
            aria-label="Görev haritası"
            aria-valuemin={0}
            aria-valuemax={adimlar.length}
            aria-valuenow={biten}
          >
            <b>
              {biten}/{adimlar.length} tamamlandı
            </b>
            <span className="track">
              <i style={{ width: `${adimlar.length ? (biten / adimlar.length) * 100 : 0}%` }} />
            </span>
          </div>

          {hata && (
            <p className="err" role="alert">
              {hata}
            </p>
          )}

          <ol className="harita">
            {adimlar.map((a) => (
              <li key={a.sira} className={a.tamamlandi ? 'adim tamam' : 'adim'}>
                <label>
                  <input
                    type="checkbox"
                    checked={a.tamamlandi}
                    disabled={bekleyen != null}
                    onChange={(e) => isaretle(a, e.target.checked)}
                  />
                  <span className="adim-govde">
                    <b>
                      {a.sira}. {a.baslik}
                    </b>
                    {a.aciklama && <span className="muted">{a.aciklama}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </>
  );
}
