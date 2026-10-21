import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { akisOku, akisYaz } from '../akis.js';
import { duelloKaydet, duellolariGetir, onerileriGetir, oturumDustu } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import ProjeKarti from '../bilesenler/ProjeKarti.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { duelloProjeleri, MAC_SAYISI, maclar, sampiyon, siradakiMac, TURLAR, turAdi } from '../duello.js';
import Bekleme from './Bekleme.jsx';

// Seçilen kart büyür, diğeri kaybolur (demodaki gibi); "hareketi azalt" seçenlerde beklenmez.
const ANIMASYON = 330; // ms
function hareketsiz() {
  return !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
const bekle = (ms) => new Promise((cozum) => setTimeout(cozum, ms));

export default function Duello() {
  const git = useNavigate();
  const { profilId } = useParams();
  const kayitliOneriler = akisOku('oneriler');

  const [liste, setListe] = useState(() => (kayitliOneriler?.profilId === profilId ? kayitliOneriler.liste : null));
  const [kazananlar, setKazananlar] = useState(null); // oynanan maçların kazananları; null: yükleniyor
  const [yuklemeHatasi, setYuklemeHatasi] = useState('');
  const [deneme, setDeneme] = useState(0);
  const [hata, setHata] = useState('');
  const [secilen, setSecilen] = useState(null); // seçimi kaydedilen projenin id'si
  const [acikId, setAcikId] = useState(null); // içeriği açık kartın projesi
  const icerikDegistir = (id) => setAcikId((a) => (a === id ? null : id));

  // Oynanan maçlar sunucudan gelir (sayfa yenilense ya da başka sekmede açılsa da kaldığı yerden).
  // Öneriler tarayıcıda yoksa onlar da sunucudan istenir. Profil başkasınınsa sunucu 404 verir.
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
        adim="Düello"
        baslik="Düello hazırlanıyor"
        hataBasligi="Düello açılamadı"
        hata={yuklemeHatasi}
        tekrarDene={() => {
          setYuklemeHatasi('');
          setDeneme((d) => d + 1);
        }}
        geriDon={() => git(`/oneriler/${profilId}`)}
        geriEtiketi="Önerilere dön"
      />
    );
  }

  const projeler = duelloProjeleri(liste);
  // Henüz öneri yoksa ya da düelloya yetecek proje yoksa önce öneriler ekranı.
  if (projeler.length < 8) return <Navigate to={`/oneriler/${profilId}`} replace />;

  const tumMaclar = maclar(projeler, kazananlar);
  const sira = siradakiMac(tumMaclar);
  const kazanan = sampiyon(tumMaclar);

  async function sec(mac, secilenProje) {
    const kaybeden = secilenProje.id === mac.a.id ? mac.b : mac.a;
    setHata('');
    setSecilen(secilenProje.id);
    try {
      await Promise.all([
        duelloKaydet({
          profil_id: Number(profilId),
          kazanan_proje_id: secilenProje.id,
          kaybeden_proje_id: kaybeden.id,
          tur: mac.tur,
        }),
        hareketsiz() ? null : bekle(ANIMASYON),
      ]);
      setKazananlar([...kazananlar, secilenProje.id]);
      setAcikId(null);
      window.scrollTo(0, 0);
    } catch (hataNesnesi) {
      if (oturumDustu(hataNesnesi)) {
        git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
        return;
      }
      setHata(hataNesnesi.message);
    } finally {
      setSecilen(null);
    }
  }

  const ilerleme = (
    <div className="prog" role="progressbar" aria-label="Düello" aria-valuemin={0} aria-valuemax={MAC_SAYISI} aria-valuenow={kazananlar.length}>
      {Array.from({ length: MAC_SAYISI }, (_, i) => (
        <i key={i} className={i < kazananlar.length ? 'on' : undefined} />
      ))}
    </div>
  );

  if (kazanan) {
    return (
      <>
        <UstCubuk adim="Düello" geri={`/oneriler/${profilId}`} />
        <main className="wrap">
          <section className="scr">
            <div className="sayfa-baslik">
              <h1>Şampiyon belli oldu</h1>
              <p className="muted">7 seçimin sonunda en çok bu projeyi yapmak istedin.</p>
            </div>
            {ilerleme}
            <div className="tek">
              <ProjeKarti
                proje={kazanan}
                icerik={acikId === kazanan.id}
                onIcerik={() => icerikDegistir(kazanan.id)}
                rozet="Şampiyon"
              />
            </div>
            <div className="row">
              <Dugme onClick={() => git(`/sonuc/${profilId}`)}>Devam et</Dugme>
            </div>
          </section>
        </main>
      </>
    );
  }

  const mac = tumMaclar[sira];
  const tur = TURLAR.find((t) => t.kod === mac.tur);
  const turdaKacinci = tumMaclar.slice(0, sira).filter((m) => m.tur === mac.tur).length + 1;
  const baslik = tur.mac > 1 ? `${turAdi(mac.tur)} ${turdaKacinci}/${tur.mac}` : turAdi(mac.tur);

  return (
    <>
      <UstCubuk adim="Düello" geri={`/oneriler/${profilId}`} />
      <main className="wrap">
        <section className="scr">
          <div className="sayfa-baslik">
            <h1>{baslik}</h1>
            <p className="muted">Hangisini yapmak isterdin? Seçtiğin bir üst tura çıkar.</p>
          </div>
          {ilerleme}
          {/* Kapalıyken iki kart aynı boyda; biri açılınca öbürü uzamasın diye "acik". */}
          <div className={acikId ? 'duel acik' : 'duel'} key={sira}>
            {[mac.a, mac.b].map((p) => (
              <ProjeKarti
                key={p.id}
                proje={p}
                icerik={acikId === p.id}
                onIcerik={() => icerikDegistir(p.id)}
                secildi={secilen === p.id}
                kaybetti={secilen != null && secilen !== p.id}
                kilitli={secilen != null}
                onSec={() => sec(mac, p)}
              />
            ))}
          </div>
          {hata && (
            <p className="err" role="alert">
              {hata}
            </p>
          )}
        </section>
      </main>
    </>
  );
}
