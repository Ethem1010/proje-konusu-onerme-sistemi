import { useEffect, useState } from 'react';
import { bolumleriGetir } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { anlatHatasi, bolumleriGrupla } from '../dogrulama.js';

// Seçenekler demodakiyle aynı.
export const PROJE_TURLERI = ['Ders ödevi', 'Dönem projesi', 'Bitirme projesi', 'Yarışma projesi', 'Kişisel proje'];
export const SURELER = [1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24];

// Yazılanlar sekme kapanana kadar bu anahtarla saklanır.
export const TASLAK_ANAHTARI = 'konu_kartlari_anlat';

function taslakOku() {
  try {
    return JSON.parse(sessionStorage.getItem(TASLAK_ANAHTARI)) || {};
  } catch {
    return {};
  }
}

export default function Anlat() {
  const [taslak] = useState(taslakOku);
  const [bolumler, setBolumler] = useState(null); // null: yükleniyor
  const [listeHatasi, setListeHatasi] = useState('');
  const [deneme, setDeneme] = useState(0);

  const [bolum, setBolum] = useState(taslak.bolum ?? ''); // bölümün id'si ya da 'diger'
  const [bolumAdi, setBolumAdi] = useState(taslak.bolum === 'diger' ? taslak.bolumAdi : '');
  const [tur, setTur] = useState(taslak.tur ?? 'Dönem projesi');
  const [sure, setSure] = useState(taslak.sure ?? 12);
  const [metin, setMetin] = useState(taslak.metin ?? '');
  const [hata, setHata] = useState('');
  const [kaydedildi, setKaydedildi] = useState(false);

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

  function devam(e) {
    e.preventDefault();
    const sorun = anlatHatasi({ bolum, bolumAdi, metin });
    if (sorun) {
      setHata(sorun);
      setKaydedildi(false);
      return;
    }
    const secilen = bolumler?.find((b) => String(b.id) === bolum);
    sessionStorage.setItem(
      TASLAK_ANAHTARI,
      JSON.stringify({
        bolum,
        bolumId: secilen ? secilen.id : null,
        bolumAdi: secilen ? secilen.ad : bolumAdi.trim(),
        tur,
        sure,
        metin: metin.trim(),
      }),
    );
    setHata('');
    setKaydedildi(true);
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
                <select value={bolum} onChange={(e) => setBolum(e.target.value)} disabled={!gruplar}>
                  {!gruplar && <option value="">{listeHatasi ? 'Liste alınamadı' : 'Yükleniyor…'}</option>}
                  {gruplar && (
                    <>
                      <option value="" disabled>
                        Bölümünü seç
                      </option>
                      <optgroup label="Mühendislik">
                        {gruplar.muhendislik.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.ad}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Diğer bölümler">
                        {gruplar.diger.map((b) => (
                          <option key={b.id} value={String(b.id)}>
                            {b.ad}
                          </option>
                        ))}
                      </optgroup>
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
                    <option key={t} value={t}>
                      {t}
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
          {kaydedildi && (
            <p className="ok" role="status">
              Bilgilerin kaydedildi.
            </p>
          )}

          <div className="row">
            <Dugme type="submit">Devam et</Dugme>
          </div>
        </form>
      </main>
    </>
  );
}
