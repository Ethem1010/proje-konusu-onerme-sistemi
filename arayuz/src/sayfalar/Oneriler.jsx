import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { akisOku, akisYaz } from '../akis.js';
import { onerileriGetir, onerileriUret, oturumDustu, surprizGetir } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import Etiket from '../bilesenler/Etiket.jsx';
import ProjeAyrintisi from '../bilesenler/ProjeAyrintisi.jsx';
import ProjeKarti from '../bilesenler/ProjeKarti.jsx';
import PuanHalkasi from '../bilesenler/PuanHalkasi.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { alanBul, ZORLUKLAR } from '../secenekler.js';
import Bekleme from './Bekleme.jsx';

export const ONERI_ADIMLARI = ['Profiline uyan projeler seçiliyor', 'Sana özel yeni fikirler üretiliyor', 'Projeler puanlanıyor'];

// Aynı profil için aynı anda tek istek gitsin (React geliştirme modunda ekranı iki kez açar).
const bekleyenler = new Map();

// Önce kayıtlı liste istenir (GET); boşsa üretilir (POST). yeniUret: profil yeni onaylandı,
// eski liste geçersiz, doğrudan üretilir.
function onerileriYukle(profilId, yeniUret) {
  if (!bekleyenler.has(profilId)) {
    const is = (async () => {
      if (!yeniUret) {
        const kayitli = await onerileriGetir(profilId);
        if (Array.isArray(kayitli) && kayitli.length > 0) return kayitli;
      }
      return onerileriUret(profilId);
    })().finally(() => bekleyenler.delete(profilId));
    bekleyenler.set(profilId, is);
  }
  return bekleyenler.get(profilId);
}

function OneriKarti({ proje, sira, acik, onAc }) {
  const renk = alanBul(proje.alan)?.renk;
  const detayId = `oneri-detay-${proje.id}`;

  return (
    <li className={proje.duelloda ? 'oneri' : 'oneri yedek'} style={renk ? { '--fc': `var(--c${renk})` } : undefined}>
      <button type="button" className="oneri-ust" aria-expanded={acik} aria-controls={detayId} onClick={onAc}>
        <span className="oneri-sira">{sira}</span>
        <span className="oneri-govde">
          <span className="oneri-etiketler">
            <Etiket renk={renk}>{proje.alan_adi}</Etiket>
            {proje.kaynak === 'gemini' && <span className="ozel">✨ Sana özel</span>}
            <span className={proje.duelloda ? 'pill in' : 'pill no'}>{proje.duelloda ? 'Düelloda' : 'Yedek'}</span>
          </span>
          <b className="oneri-baslik">{proje.baslik}</b>
          <span className="muted small">
            {ZORLUKLAR[proje.zorluk]} · {proje.hafta} hafta
          </span>
        </span>
        <PuanHalkasi puan={proje.puan_toplam ?? 0} />
      </button>

      {acik && <ProjeAyrintisi proje={proje} id={detayId} className="oneri-detay" />}
    </li>
  );
}

export default function Oneriler() {
  const git = useNavigate();
  const konum = useLocation();
  const { profilId } = useParams();
  const yeniUret = konum.state?.yeniUret === true;
  const kayitli = akisOku('oneriler');

  const [liste, setListe] = useState(() => (!yeniUret && kayitli?.profilId === profilId ? kayitli.liste : null));
  const [hata, setHata] = useState('');
  const [deneme, setDeneme] = useState(0);
  const [acikId, setAcikId] = useState(null);
  const [surpriz, setSurpriz] = useState(null);
  const [surprizBekliyor, setSurprizBekliyor] = useState(false);
  const [surprizHatasi, setSurprizHatasi] = useState('');
  const [surprizIcerik, setSurprizIcerik] = useState(false);

  // GET /surpriz: aynı profil için hep aynı proje döner. Profil onaylı değilse 400, uygun proje yoksa 404.
  async function surprizGoster() {
    setSurprizHatasi('');
    setSurprizBekliyor(true);
    try {
      setSurpriz(await surprizGetir(profilId));
    } catch (hataNesnesi) {
      if (oturumDustu(hataNesnesi)) {
        git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
        return;
      }
      setSurprizHatasi(hataNesnesi.message);
    } finally {
      setSurprizBekliyor(false);
    }
  }

  // deneme değişince ("Tekrar dene") yeniden yüklenir. Profil başkasınınsa sunucu 404 verir.
  useEffect(() => {
    if (liste) return undefined;
    let iptal = false;
    onerileriYukle(profilId, yeniUret)
      .then((gelen) => {
        akisYaz('oneriler', { profilId, liste: gelen });
        if (iptal) return;
        setListe(gelen);
        // Sayfa yenilenince yeniden üretilmesin: "yeni üret" işareti adresten silinir.
        if (yeniUret) git(konum.pathname, { replace: true, state: null });
      })
      .catch((hataNesnesi) => {
        if (iptal) return;
        if (oturumDustu(hataNesnesi)) {
          git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
          return;
        }
        setHata(hataNesnesi.message);
      });
    return () => {
      iptal = true;
    };
  }, [deneme]);

  if (!liste) {
    return (
      <Bekleme
        adim="Projeler"
        baslik="Projelerin hazırlanıyor"
        aciklama="Birkaç saniye sürebilir."
        adimlar={ONERI_ADIMLARI}
        hataBasligi="Projeler getirilemedi"
        hata={hata}
        tekrarDene={() => {
          setHata('');
          setDeneme((d) => d + 1);
        }}
        geriDon={() => git(`/profil/${profilId}`)}
        geriEtiketi="Profile dön"
      />
    );
  }

  const sirali = [...liste].sort((a, b) => (b.puan_toplam ?? 0) - (a.puan_toplam ?? 0));

  return (
    <>
      <UstCubuk adim="Projeler" geri={`/profil/${profilId}`} />
      <main className="wrap">
        <section className="scr">
          <div className="sayfa-baslik">
            <h1>Sana uygun {sirali.length} proje</h1>
            <p className="muted">Puana göre sıralı. İlk 8'i düelloya girer. Ayrıntı için projeye dokun.</p>
          </div>
          <ol className="oneriler">
            {sirali.map((p, i) => (
              <OneriKarti
                key={p.id}
                proje={p}
                sira={i + 1}
                acik={acikId === p.id}
                onAc={() => setAcikId((a) => (a === p.id ? null : p.id))}
              />
            ))}
          </ol>
          {/* Liste uzun; düğme ekranın altında sabit durur, kaydırırken de görünür. */}
          <div className="row alt-sabit">
            <Dugme onClick={() => git(`/duello/${profilId}`)}>Düelloyu başlat</Dugme>
            {!surpriz && (
              <Dugme tur="ghost" onClick={surprizGoster} disabled={surprizBekliyor}>
                {surprizBekliyor ? 'Bakılıyor…' : '🎁 Sürpriz proje'}
              </Dugme>
            )}
          </div>
          {surprizHatasi && (
            <p className="err" role="alert">
              {surprizHatasi}
            </p>
          )}
          {surpriz && (
            <section className="surpriz" aria-labelledby="surpriz-baslik">
              <div className="sayfa-baslik">
                <h2 id="surpriz-baslik">🎁 Sürpriz proje</h2>
                <p className="muted">İlgi alanlarının dışından, ama istemediğin alanlardan değil. Bunu hiç düşünmemiştin belki.</p>
              </div>
              <div className="tek">
                <ProjeKarti
                  proje={surpriz}
                  icerik={surprizIcerik}
                  onIcerik={() => setSurprizIcerik((a) => !a)}
                  rozet="Sürpriz"
                />
              </div>
            </section>
          )}
        </section>
      </main>
    </>
  );
}
