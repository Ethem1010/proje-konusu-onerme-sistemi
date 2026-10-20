import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ANAHTARLAR, akisSil, akisYaz } from '../akis.js';
import { bolumleriGetir, oturumDustu, profilOlustur } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { anlatHatasi, bolumleriGrupla } from '../dogrulama.js';

// Seçenekler demodakiyle aynı. Ekranda ad görünür, sunucuya kod gider (docs/anlasma.md).
export const PROJE_TURLERI = [
  { kod: 'ders', ad: 'Ders ödevi' },
  { kod: 'donem', ad: 'Dönem projesi' },
  { kod: 'bitirme', ad: 'Bitirme projesi' },
  { kod: 'yarisma', ad: 'Yarışma projesi' },
  { kod: 'kisisel', ad: 'Kişisel proje' },
];
export const SURELER = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];
export const TERCIHLER = [
  { kod: 'uretmek', ad: 'Bir şey üretmek' },
  { kod: 'arastirmak', ad: 'Araştırmak' },
  { kod: 'farketmez', ad: 'Fark etmez' },
];

// Yazılanlar sekme kapanana kadar bu anahtarla saklanır; çıkış yapınca silinir (akis.js).
export const TASLAK_ANAHTARI = ANAHTARLAR.anlat;

function taslakOku() {
  try {
    return JSON.parse(sessionStorage.getItem(TASLAK_ANAHTARI)) || {};
  } catch {
    return {};
  }
}

// Eski taslakta proje türü kod yerine yazı olarak durabilir ("Dönem projesi"); koda çevrilir.
function turKodu(deger) {
  return PROJE_TURLERI.find((t) => t.kod === deger || t.ad === deger)?.kod ?? 'donem';
}

// Saat ve kişi sayısı kutularında sadece rakam kalır.
function rakamlar(yazi) {
  return yazi.replace(/\D/g, '');
}

export default function Anlat() {
  const git = useNavigate();
  const [taslak] = useState(taslakOku);
  const [bolumler, setBolumler] = useState(null); // null: yükleniyor
  const [listeHatasi, setListeHatasi] = useState('');
  const [deneme, setDeneme] = useState(0);

  const [bolum, setBolum] = useState(taslak.bolum ?? ''); // bölümün id'si ya da 'diger'
  const [bolumAdi, setBolumAdi] = useState(taslak.bolum === 'diger' ? taslak.bolumAdi : '');
  const [tur, setTur] = useState(turKodu(taslak.tur));
  const [sure, setSure] = useState(taslak.sure ?? 12);
  const [saat, setSaat] = useState(taslak.saat ? String(taslak.saat) : '');
  const [ekip, setEkip] = useState(taslak.ekip ? String(taslak.ekip) : '');
  const [tercih, setTercih] = useState(taslak.tercih ?? '');
  const [metin, setMetin] = useState(taslak.metin ?? '');
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    let iptal = false;
    bolumleriGetir()
      .then((liste) => !iptal && setBolumler(liste))
      .catch((hataNesnesi) => !iptal && setListeHatasi(hataNesnesi.message));
    return () => {
      iptal = true;
    };
  }, [deneme]);

  function tekrarDene() {
    setBolumler(null);
    setListeHatasi('');
    setDeneme((d) => d + 1);
  }

  const secilen = bolumler?.find((b) => String(b.id) === bolum);
  // Taslaktaki bölüm artık listede yoksa (liste daraldı) seçilmemiş sayılır.
  const gecerliBolum = bolum === 'diger' || secilen ? bolum : '';

  async function devam(e) {
    e.preventDefault();
    const sorun = anlatHatasi({ bolum: gecerliBolum, bolumAdi, saat, ekip, tercih, metin });
    if (sorun) return setHata(sorun);

    const bilgiler = {
      bolum: gecerliBolum,
      bolumId: secilen ? secilen.id : null,
      bolumAdi: secilen ? secilen.ad : bolumAdi.trim(),
      tur,
      sure,
      saat: Number(saat),
      ekip: Number(ekip),
      tercih,
      metin: metin.trim(),
    };
    // Sunucuya ulaşılamasa da yazılanlar kaybolmasın.
    sessionStorage.setItem(TASLAK_ANAHTARI, JSON.stringify(bilgiler));

    setHata('');
    setBekliyor(true);
    try {
      const profil = await profilOlustur({
        bolum_id: bilgiler.bolumId,
        bolum_diger: secilen ? null : bilgiler.bolumAdi,
        proje_turu: tur,
        sure_hafta: sure,
        metin: bilgiler.metin,
        haftalik_saat: bilgiler.saat,
        ekip: bilgiler.ekip,
        tercih,
      });
      // Sunucuda profili okuyan bir adres yok; profil ekranı onu buradan alır. Yeni profilin önerileri yenidir.
      akisYaz('profil', profil);
      akisSil('oneriler');
      git(`/profil/${profil.id}`);
    } catch (hataNesnesi) {
      if (oturumDustu(hataNesnesi)) {
        git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
        return;
      }
      setHata(hataNesnesi.message);
      setBekliyor(false);
    }
  }

  const gruplar = bolumler && bolumleriGrupla(bolumler);

  return (
    <>
      <UstCubuk adim="Anlat" />
      <main className="wrap">
        <form className="scr" onSubmit={devam} noValidate>
          <div className="sayfa-baslik">
            <h1>Seni tanıyalım</h1>
            <p className="muted">Bölümünü ve projeni seç, sonra kendini kendi cümlelerinle anlat.</p>
          </div>

          <div className="panel">
            <div className="alanlar">
              <label className={bolum === 'diger' ? 'f' : 'f tam'}>
                Bölüm
                <select value={gecerliBolum} onChange={(e) => setBolum(e.target.value)} disabled={!gruplar}>
                  {!gruplar && <option value="">{listeHatasi ? 'Liste alınamadı' : 'Yükleniyor…'}</option>}
                  {gruplar && (
                    <>
                      <option value="" disabled>
                        Bölümünü seç
                      </option>
                      {/* Boş grubun başlığı gösterilmez (liste artık sadece Bilgisayar ve Yazılım). */}
                      {gruplar.muhendislik.length > 0 && (
                        <optgroup label="Mühendislik">
                          {gruplar.muhendislik.map((b) => (
                            <option key={b.id} value={String(b.id)}>
                              {b.ad}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {gruplar.diger.length > 0 && (
                        <optgroup label="Diğer bölümler">
                          {gruplar.diger.map((b) => (
                            <option key={b.id} value={String(b.id)}>
                              {b.ad}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <option value="diger">Diğer (bölümünü yaz)</option>
                    </>
                  )}
                </select>
              </label>

              {bolum === 'diger' && (
                <label className="f">
                  Bölümünün adı
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="Örnek: Gastronomi"
                    value={bolumAdi}
                    onChange={(e) => setBolumAdi(e.target.value)}
                  />
                </label>
              )}

              <label className="f">
                Proje türü
                <select value={tur} onChange={(e) => setTur(e.target.value)}>
                  {PROJE_TURLERI.map((t) => (
                    <option key={t.kod} value={t.kod}>
                      {t.ad}
                    </option>
                  ))}
                </select>
              </label>

              <label className="f">
                Süre
                <select value={sure} onChange={(e) => setSure(Number(e.target.value))}>
                  {SURELER.map((h) => (
                    <option key={h} value={h}>
                      {h} hafta
                    </option>
                  ))}
                </select>
              </label>

              <label className="f">
                Haftada kaç saat ayırabilirsin?
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="Örnek: 8"
                  value={saat}
                  onChange={(e) => setSaat(rakamlar(e.target.value))}
                />
              </label>

              <label className="f">
                Kaç kişisiniz?
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="Tek başınaysan 1"
                  value={ekip}
                  onChange={(e) => setEkip(rakamlar(e.target.value))}
                />
              </label>

              <label className="f tam">
                Tercihin ne?
                <select value={tercih} onChange={(e) => setTercih(e.target.value)}>
                  <option value="" disabled>
                    Birini seç
                  </option>
                  {TERCIHLER.map((t) => (
                    <option key={t.kod} value={t.kod}>
                      {t.ad}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {listeHatasi && (
              <div className="row">
                <p className="err" role="alert">
                  Bölüm listesi alınamadı. {listeHatasi}
                </p>
                <Dugme tur="ghost" kucuk onClick={tekrarDene}>
                  Tekrar dene
                </Dugme>
              </div>
            )}

            <label className="f">
              Neyi seviyorsun, neyi biliyorsun, neyi istemiyorsun?
              <textarea
                placeholder="Kendi cümlelerinle yaz. Örnek: Şunu biliyorum, şu ilgimi çekiyor, şununla uğraşmak istemiyorum."
                value={metin}
                onChange={(e) => setMetin(e.target.value)}
              />
            </label>
          </div>

          {hata && (
            <p className="err" role="alert">
              {hata}
            </p>
          )}

          <div className="row">
            <Dugme type="submit" disabled={bekliyor}>
              {bekliyor ? 'Gönderiliyor…' : 'Devam et'}
            </Dugme>
          </div>
        </form>
      </main>
    </>
  );
}
