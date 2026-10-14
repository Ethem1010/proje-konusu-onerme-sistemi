import { useNavigate } from 'react-router';
import { cikisYap, jetonuAl } from '../api.js';
import AdimSeridi from './AdimSeridi.jsx';
import Dugme from './Dugme.jsx';
import GeriDugmesi from './GeriDugmesi.jsx';
import Logo from './Logo.jsx';

// Her ekranın üstündeki çubuk: sol üstte geri, logo, girişliyse "Çıkış", altında adım şeridi.
export default function UstCubuk({ geri, adim }) {
  const git = useNavigate();

  function cik() {
    cikisYap();
    git('/giris', { replace: true });
  }

  return (
    <header className="bar">
      <div className="bar-ic">
        {geri && <GeriDugmesi adres={geri} />}
        <Logo />
        {jetonuAl() && (
          <Dugme tur="ghost" kucuk onClick={cik}>
            Çıkış
          </Dugme>
        )}
        {adim && <AdimSeridi aktif={adim} />}
      </div>
    </header>
  );
}
