import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { akisOku, akisSil, akisYaz } from '../akis.js';
import { oturumDustu, profilOnayla } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import Etiket from '../bilesenler/Etiket.jsx';
import UstCubuk from '../bilesenler/UstCubuk.jsx';
import { ALANLAR, alanBul, BECERILER, PUAN_EN_COK } from '../secenekler.js';

const renkOf = (kod) => alanBul(kod)?.renk;
const adOf = (kod) => alanBul(kod)?.ad ?? kod;

// Listeden bir şey eklemek için açılır liste; seçilince eklenir ve liste başa döner.
function EkleListesi({ etiket, secenekler, onEkle }) {
  if (secenekler.length === 0) return null;
  return (
    <select className="ekle" aria-label={etiket} value="" onChange={(e) => e.target.value && onEkle(e.target.value)}>
      <option value="">+ {etiket}</option>
      {secenekler.map((s) => (
        <option key={s.deger} value={s.deger}>
          {s.ad}
        </option>
      ))}
    </select>
  );
}

export default function Profil() {
  const git = useNavigate();
  const { id } = useParams();
  const [profil] = useState(() => akisOku('profil'));
  const [alanlar, setAlanlar] = useState(() => (profil?.alanlar ?? []).map((a) => ({ ...a, ad: a.ad ?? adOf(a.kod) })));
  const [istemedikleri, setIstemedikleri] = useState(() => profil?.istemedikleri ?? []);
  const [beceriler, setBeceriler] = useState(() => profil?.beceriler ?? []);
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  // Profil "Seni tanıyalım"dan gelir; adres başka bir profili gösteriyorsa oraya dönülür.
  if (!profil || String(profil.id) !== id) return <Navigate to="/anlat" replace />;

  const kullanilan = new Set([...alanlar.map((a) => a.kod), ...istemedikleri]);
  const bosAlanlar = ALANLAR.filter((a) => !kullanilan.has(a.kod));

  function puanVer(kod, puan) {
    setAlanlar((liste) => liste.map((a) => (a.kod === kod ? { ...a, puan } : a)));
  }

  function alanDegistir(eskiKod, yeniKod) {
    setAlanlar((liste) => liste.map((a) => (a.kod === eskiKod ? { ...a, kod: yeniKod, ad: adOf(yeniKod) } : a)));
  }

  async function onayla() {
    setHata('');
    setBekliyor(true);
    try {
      const guncel = await profilOnayla(profil.id, { alanlar, istemedikleri, beceriler });
      akisYaz('profil', guncel);
      akisSil('oneriler');
      git(`/oneriler/${profil.id}`, { state: { yeniUret: true } });
    } catch (hataNesnesi) {
      if (oturumDustu(hataNesnesi)) {
        git('/giris', { replace: true, state: { mesaj: hataNesnesi.message } });
        return;
      }
      setHata(hataNesnesi.message);
      setBekliyor(false);
    }
  }

  return (
    <>
      <UstCubuk adim="Anlat" geri="/anlat" />
      <main className="wrap">
        <section className="scr">
          <div className="sayfa-baslik">
            <h1>Doğru anladık mı?</h1>
            <p className="muted">Yazdıklarından çıkardığımız profil bu. Yanlışsa düzelt, sonra onayla.</p>
          </div>

          <div className="panel">
            <div className="panel-baslik">
              <h2 id="ilgi-alanlari">İlgi alanların</h2>
              <p className="muted small">
                En çok ilgilendiğin {alanlar.length} alan. 1 az, {PUAN_EN_COK} çok ilgili demek.
              </p>
            </div>
            <ul className="puanlar" aria-labelledby="ilgi-alanlari">
              {alanlar.map((a) => (
                <li key={a.kod} className="puan-satir" style={{ '--fc': `var(--c${renkOf(a.kod)})` }}>
                  <select
                    className="alan-sec"
                    aria-label={`${a.ad} yerine başka alan seç`}
                    value={a.kod}
                    onChange={(e) => alanDegistir(a.kod, e.target.value)}
                  >
                    <option value={a.kod}>{a.ad}</option>
                    {bosAlanlar.map((b) => (
                      <option key={b.kod} value={b.kod}>
                        {b.ad}
                      </option>
                    ))}
                  </select>
                  <span className="dots">
                    {Array.from({ length: PUAN_EN_COK }, (_, i) => i + 1).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={v <= a.puan ? 'dot on' : 'dot'}
                        aria-label={`${a.ad} ${v} puan`}
                        aria-pressed={v === a.puan}
                        onClick={() => puanVer(a.kod, v)}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-baslik">
              <h2>Bunları önermeyeceğiz</h2>
              <p className="muted small">İstemediğin alanlardan proje gelmez.</p>
            </div>
            <div className="etiketler">
              {istemedikleri.length === 0 && <span className="muted small">Şu an yok.</span>}
              {istemedikleri.map((kod) => (
                <Etiket
                  key={kod}
                  buyuk
                  renk={renkOf(kod)}
                  kaldir={() => setIstemedikleri((liste) => liste.filter((k) => k !== kod))}
                >
                  {adOf(kod)}
                </Etiket>
              ))}
              <EkleListesi
                etiket="Alan ekle"
                secenekler={bosAlanlar.map((b) => ({ deger: b.kod, ad: b.ad }))}
                onEkle={(kod) => setIstemedikleri((liste) => [...liste, kod])}
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-baslik">
              <h2>Bildiklerin</h2>
            </div>
            <div className="etiketler">
              {beceriler.length === 0 && <span className="muted small">Henüz beceri yok.</span>}
              {beceriler.map((b) => (
                <Etiket key={b} buyuk kaldir={() => setBeceriler((liste) => liste.filter((x) => x !== b))}>
                  {b}
                </Etiket>
              ))}
              <EkleListesi
                etiket="Beceri ekle"
                secenekler={BECERILER.filter((b) => !beceriler.includes(b)).map((b) => ({ deger: b, ad: b }))}
                onEkle={(b) => setBeceriler((liste) => [...liste, b])}
              />
            </div>
          </div>

          {hata && (
            <p className="err" role="alert">
              {hata}
            </p>
          )}

          <div className="row">
            <Dugme onClick={onayla} disabled={bekliyor}>
              {bekliyor ? 'Kaydediliyor…' : 'Onayla ve devam'}
            </Dugme>
          </div>
        </section>
      </main>
    </>
  );
}
