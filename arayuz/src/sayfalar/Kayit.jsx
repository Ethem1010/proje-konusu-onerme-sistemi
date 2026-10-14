import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { jetonuKaydet, kayitOl } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import GeriDugmesi from '../bilesenler/GeriDugmesi.jsx';
import GirisCercevesi from '../bilesenler/GirisCercevesi.jsx';
import { kayitHatasi } from '../dogrulama.js';

export default function Kayit() {
  const git = useNavigate();
  const [ad, setAd] = useState('');
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [hata, setHata] = useState('');
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e) {
    e.preventDefault();
    const sorun = kayitHatasi({ ad, eposta, sifre });
    if (sorun) return setHata(sorun);

    setHata('');
    setBekliyor(true);
    try {
      // Sunucu kayıttan sonra hemen giriş jetonu da veriyor; ayrıca giriş yapmaya gerek yok.
      jetonuKaydet(await kayitOl({ ad: ad.trim(), eposta: eposta.trim(), sifre }));
      git('/anlat', { replace: true });
    } catch (hataNesnesi) {
      setHata(hataNesnesi.message);
      setBekliyor(false);
    }
  }

  return (
    <GirisCercevesi>
      <div className="geri">
        <GeriDugmesi adres="/giris" />
      </div>
      <div className="ust">
        <h1>Kayıt ol</h1>
        <p className="muted small">Bir dakikada hesabını aç, hemen başla.</p>
      </div>

      <form onSubmit={gonder} noValidate>
        <label className="f">
          Adın soyadın
          <input type="text" autoComplete="name" maxLength={100} value={ad} onChange={(e) => setAd(e.target.value)} />
        </label>
        <label className="f">
          E-posta
          <input type="email" autoComplete="email" value={eposta} onChange={(e) => setEposta(e.target.value)} />
        </label>
        <label className="f">
          Şifre (en az 6 karakter)
          <input
            type="password"
            autoComplete="new-password"
            value={sifre}
            onChange={(e) => setSifre(e.target.value)}
          />
        </label>
        {hata && (
          <p className="err" role="alert">
            {hata}
          </p>
        )}
        <Dugme type="submit" className="blok" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : 'Kayıt ol'}
        </Dugme>
      </form>

      <p className="giris-alt">
        Hesabın var mı? <Link to="/giris">Giriş yap</Link>
      </p>
    </GirisCercevesi>
  );
}
