import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { akisOku, akisYaz } from '../akis.js';
import { duellolariGetir, onerileriGetir, oturumDustu, secimYap } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import ProjeKarti from '../bilesenler/ProjeKarti.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { duelloProjeleri, maclar, sampiyon } from '../duello.js';
import { ZORLUK_MODLARI } from '../secenekler.js';
import Bekleme from './Bekleme.jsx';

export const HARITA_ADIMLARI = ['Proje adımlara bölünüyor', 'Adımlar seçtiğin zorluğa göre ayarlanıyor', 'Görev haritan hazırlanıyor'];

// Zorluk kartlarında ne yazar: kolay ve efsane projenin kendi metinleri, orta projenin kendisi.
const MOD_ALT_BASLIK = { kolay: 'Daha kolay hâli', orta: 'Projenin kendisi', efsane: 'Daha zor hâli' };
function modAciklamasi(kod, proje) {
  if (kod === 'kolay') return proje.kolay || 'Projenin daha küçük bir hâlini yaparsın.';
  if (kod === 'efsane') return proje.efsane || 'Projeye daha iddialı özellikler eklersin.';
  return proje.ne || 'Projeyi olduğu gibi yaparsın.';
}

// Düellonun şampiyonu, öneriler ve oynanan maçlardan bulunur (sayfa başka sekmede açılsa da).
export default function Sonuc() {
  const git = useNavigate();
  const { profilId } = useParams();
  const kayitliOneriler = akisOku('oneriler');

  const [liste, setListe] = useState(() => (kayitliOneriler?.profilId === profilId ? kayitliOneriler.liste : null));
  const [kazananlar, setKazananlar] = useState(null);
  const [yuklemeHatasi, setYuklemeHatasi] = useState('');
  const [deneme, setDeneme] = useState(0);
  const [mod, setMod] = useState('orta');
  const [icerik, setIcerik] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [secimHatasi, setSecimHatasi] = useState('');

  useEffect(() => {
    let iptal = false;
    Promise.all([liste ?? onerileriGetir(profilId), duellolariGetir(profilId)])
      .then(([gelenListe, oynananlar]) => {
        if (iptal) return;
        if (!liste && gelenListe.length > 0) akisYaz('oneriler', { profilId, liste: gelenListe });
        setListe(gelenListe);
        setKazananlar(oynananlar.map((m) => m.kazanan_proje_id));
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

  if (!liste || !kazananlar) {
    return (
      <Bekleme
        adim="Sonuç"
        baslik="Sonucun açılıyor"
        hataBasligi="Sonuç açılamadı"
        hata={yuklemeHatasi}
        tekrarDene={() => {
          setYuklemeHatasi('');
          setDeneme((d) => d + 1);
        }}
        geriDon={() => git(`/duello/${profilId}`)}
        geriEtiketi="Düelloya dön"
      />
    );
  }

  const kazanan = sampiyon(maclar(duelloProjeleri(liste), kazananlar));
  // Düello bitmeden sonuç olmaz.
  if (!kazanan) return <Navigate to={`/duello/${profilId}`} replace />;

  async function sec() {
    setSecimHatasi('');
    setGonderiliyor(true);
    try {
      const harita = await secimYap({ proje_id: kazanan.id, zorluk_modu: mod });
      git(`/harita/${harita.secim_id}`);
    } catch (hataNesnesi) {
      if (oturumDustu(hataNesnesi)) {
        git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
        return;
      }
      setSecimHatasi(hataNesnesi.message);
    }
  }

  // Haritayı Gemini ürettiği için 5-15 saniye sürebilir.
  if (gonderiliyor) {
    return (
      <Bekleme
        adim="Sonuç"
        baslik="Görev haritan hazırlanıyor"
        aciklama="Birkaç saniye sürebilir."
        adimlar={HARITA_ADIMLARI}
        hataBasligi="Görev haritası hazırlanamadı"
        hata={secimHatasi}
        tekrarDene={sec}
        geriDon={() => {
          setSecimHatasi('');
          setGonderiliyor(false);
        }}
        geriEtiketi="Zorluk seçimine dön"
      />
    );
  }

  return (
    <>
      <UstCubuk adim="Sonuç" geri={`/duello/${profilId}`} />
      <main className="wrap">
        <section className="scr">
          <div className="sayfa-baslik">
            <h1>Zorluğunu seç</h1>
            <p className="muted">Şampiyon projeni hangi zorlukta yapmak istersin?</p>
          </div>
          <div className="tek">
            <ProjeKarti proje={kazanan} icerik={icerik} onIcerik={() => setIcerik((a) => !a)} rozet="Şampiyon" />
          </div>
          <fieldset className="modlar">
            <legend>Zorluk</legend>
            {ZORLUK_MODLARI.map((m) => (
              <label key={m.kod} className={mod === m.kod ? 'mod secili' : 'mod'}>
                <span className="mod-ust">
                  <input type="radio" name="zorluk_modu" value={m.kod} checked={mod === m.kod} onChange={() => setMod(m.kod)} />
                  <b>{m.ad}</b>
                </span>
                <span className="muted small">{MOD_ALT_BASLIK[m.kod]}</span>
                <span className="mod-metin">{modAciklamasi(m.kod, kazanan)}</span>
              </label>
            ))}
          </fieldset>
          <div className="row">
            <Dugme onClick={sec}>Bu projeyi seç</Dugme>
          </div>
        </section>
      </main>
    </>
  );
}
