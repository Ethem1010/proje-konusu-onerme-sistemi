// "Konu Kartları" yazısı ve üst üste iki karttan oluşan işaret.
export default function Logo() {
  return (
    <span className="logo">
      <span className="logo-isaret" aria-hidden="true" />
      Konu Kartları
    </span>
  );
}
