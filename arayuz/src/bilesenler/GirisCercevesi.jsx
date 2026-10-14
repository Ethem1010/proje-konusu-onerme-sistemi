import Logo from './Logo.jsx';

// Giriş ve Kayıt ekranlarının ortak çerçevesi: ekranın ortasında dar bir kutu.
export default function GirisCercevesi({ children }) {
  return (
    <main className="giris-sayfa">
      <div className="giris-kutu">
        <Logo />
        <div className="giris-kart">{children}</div>
        <p className="giris-imza">Fırat Üniversitesi · Mühendislik Tasarımı · 6. Grup</p>
      </div>
    </main>
  );
}
