import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { girisYap, jetonuKaydet } from '../api.js';
import Dugme from '../bilesenler/Dugme.jsx';
import GirisCercevesi from '../bilesenler/GirisCercevesi.jsx';
import { girisHatasi } from '../dogrulama.js';

export default function Giris() {
  const git = useNavigate();
  const konum = useLocation();
  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  // Oturumu düşüp buraya gönderilen öğrenci nedenini görsün (ör. "Oturumun süresi doldu…").
  const [hata, setHata] = useState(konum.state?.mesaj ?? '');
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e) {
    e.preventDefault();
    const sorun = girisHatasi({ eposta, sifre });
    if (sorun) return setHata(sorun);

    setHata('');
    setBekliyor(true);
    try {
      jetonuKaydet(await girisYap({ eposta: eposta.trim(), sifre }));
      git('/anlat', { replace: true });
    } catch (hataNesnesi) {
      setHata(hataNesnesi.message);
      setBekliyor(false);
    }
  }

  return (
    <GirisCercevesi>
      <div className="ust">
        <h1>Giriş yap</h1>
        <p className="muted small">Kendini anlat, sana özel proje konusu çıksın.</p>
      </div>

      <form onSubmit={gonder} noValidate>
        <label className="f">
          E-posta
          <input type="email" autoComplete="email" value={eposta} onChange={(e) => setEposta(e.target.value)} />
        </label>
        <label className="f">
          Şifre
          <input
            type="password"
            autoComplete="current-password"
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
          {bekliyor ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </Dugme>
      </form>

      <p className="giris-alt">
        Hesabın yok mu? <Link to="/kayit">Kayıt ol</Link>
      </p>
    </GirisCercevesi>
  );
}
