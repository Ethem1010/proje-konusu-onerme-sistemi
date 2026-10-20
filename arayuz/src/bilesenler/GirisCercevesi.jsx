import Logo from './Logo.jsx';
import TemaDugmesi from './TemaDugmesi.jsx';

// Giriş ve Kayıt ekranlarının ortak çerçevesi: ekranın ortasında dar bir kutu; sağ üstte tema düğmesi.
export default function GirisCercevesi({ children }) {
  return (
    <main className="giris-sayfa">
      <div className="giris-tema">
        <TemaDugmesi />
      </div>
      <div className="giris-kutu">
        <Logo />
        <div className="giris-kart">{children}</div>
        <p className="giris-imza">Fırat Üniversitesi · Mühendislik Tasarımı · 6. Grup</p>
      </div>
    </main>
  );
}
