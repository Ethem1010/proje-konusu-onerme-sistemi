// "Konu Kartları" yazısı ve üst üste iki karttan oluşan işaret.
// Çok dar telefonda üst çubukta yazı gizlenir (ekran okuyucu yine okur), sadece işaret kalır.
export default function Logo() {
  return (
    <span className="logo">
      <span className="logo-isaret" aria-hidden="true" />
      <span className="logo-yazi">Konu Kartları</span>
    </span>
  );
}
