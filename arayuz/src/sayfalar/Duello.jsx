import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { akisOku, akisYaz } from '../akis.js';
import { duelloKaydet, onerileriGetir, oturumDustu } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import Etiket from '../bilesenler/Etiket.jsx';
import ProjeAyrintisi from '../bilesenler/ProjeAyrintisi.jsx';
import PuanHalkasi from '../bilesenler/PuanHalkasi.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { duelloProjeleri, MAC_SAYISI, maclar, sampiyon, siradakiMac, TURLAR, turAdi } from '../duello.js';
import { alanBul } from '../secenekler.js';

// Seçilen kart büyür, diğeri kaybolur (demodaki gibi); "hareketi azalt" seçenlerde beklenmez.
const ANIMASYON = 330; // ms
function hareketsiz() {
  return !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
const bekle = (ms) => new Promise((cozum) => setTimeout(cozum, ms));

// Tarayıcıda saklı ilerleme, ancak aynı profilin aynı 8 projesine aitse geçerli.
function kayitliKazananlar(kayit, profilId, projeler) {
  const ayni = kayit?.profilId === profilId && kayit.projeler?.join() === projeler.map((p) => p.id).join();
  return ayni ? kayit.kazananlar : [];
}

function ProjeKarti({ proje, icerik, onIcerik, sampiyonMu, secildi, kaybetti, kilitli, onSec }) {
  const renk = alanBul(proje.alan)?.renk;
  const icerikId = `duello-icerik-${proje.id}`;
  const siniflar = ['dcard', secildi && 'win', kaybetti && 'lose'].filter(Boolean).join(' ');

  return (
    <article className={siniflar} style={renk ? { '--fc': `var(--c${renk})` } : undefined}>
      <span className="oneri-etiketler">
        <Etiket renk={renk}>{proje.alan_adi}</Etiket>
        {proje.kaynak === 'gemini' && <span className="ozel">✨ Sana özel</span>}
        {sampiyonMu && <span className="crown">Şampiyon</span>}
      </span>
      <h2 className="ttl">{proje.baslik}</h2>
      <PuanHalkasi puan={proje.puan_toplam ?? 0} />
      <span className="acts">
        <Dugme tur="ghost" kucuk aria-expanded={icerik} aria-controls={icerikId} onClick={onIcerik}>
          {icerik ? 'İçeriği gizle' : 'İçerik'}
        </Dugme>
        {onSec && (
          <Dugme kucuk disabled={kilitli} aria-label={`Bunu seç: ${proje.baslik}`} onClick={onSec}>
            Bunu seç
          </Dugme>
        )}
      </span>
      {/* Ayrıntı düğmelerin altında açılır; "Bunu seç" yerinden kaymaz. */}
      {icerik && <ProjeAyrintisi proje={proje} id={icerikId} />}
    </article>
  );
}

export default function Duello() {
  const git = useNavigate();
  const { profilId } = useParams();
  const profil = akisOku('profil');
  const profilUygun = profil && String(profil.id) === profilId;
  const kayitliOneriler = akisOku('oneriler');

  const [liste, setListe] = useState(() => (kayitliOneriler?.profilId === profilId ? kayitliOneriler.liste : null));
  const [kayit, setKayit] = useState(() => akisOku('duello'));
  const [listeHatasi, setListeHatasi] = useState('');
  const [deneme, setDeneme] = useState(0);
  const [hata, setHata] = useState('');
  const [secilen, setSecilen] = useState(null); // seçimi kaydedilen projenin id'si
  const [acikId, setAcikId] = useState(null); // içeriği açık kartın projesi
  const icerikDegistir = (id) => setAcikId((a) => (a === id ? null : id));

  // Öneriler tarayıcıda yoksa (ör. sayfa başka sekmede açıldı) kayıtlı liste sunucudan istenir.
  useEffect(() => {
    if (liste || !profilUygun) return undefined;
    let iptal = false;
    onerileriGetir(profilId)
      .then((gelen) => {
        if (iptal) return;
        if (gelen.length > 0) akisYaz('oneriler', { profilId, liste: gelen });
        setListe(gelen);
      })
      .catch((hataNesnesi) => {
        if (iptal) return;
        if (oturumDustu(hataNesnesi)) {
          git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
          return;
        }
        setListeHatasi(hataNesnesi.message);
      });
    return () => {
      iptal = true;
    };
  }, [deneme]);

  if (!profilUygun) return <Navigate to="/anlat" replace />;

  if (!liste) {
    return (
      <>
        <UstCubuk adim="Düello" geri={`/oneriler/${profilId}`} />
        <main className="wrap">
          <section className="scr">
            {listeHatasi ? (
              <>
                <p className="err" role="alert">
                  Projeler getirilemedi. {listeHatasi}
                </p>
                <div className="row">
                  <Dugme
                    onClick={() => {
                      setListeHatasi('');
                      setDeneme((d) => d + 1);
                    }}
                  >
                    Tekrar dene
                  </Dugme>
                </div>
              </>
            ) : (
              <p className="muted" role="status">
                Projeler yükleniyor…
              </p>
            )}
          </section>
        </main>
      </>
    );
  }

  const projeler = duelloProjeleri(liste);
  // Henüz öneri yoksa ya da düelloya yetecek proje yoksa önce öneriler ekranı.
  if (projeler.length < 8) return <Navigate to={`/oneriler/${profilId}`} replace />;

  const kazananlar = kayitliKazananlar(kayit, profilId, projeler);
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
      const yeni = { profilId, projeler: projeler.map((p) => p.id), kazananlar: [...kazananlar, secilenProje.id] };
      akisYaz('duello', yeni);
      setKayit(yeni);
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
                sampiyonMu
              />
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
