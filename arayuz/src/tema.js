// Açık / koyu tema. Seçilen tema <html data-tema="..."> ile uygulanır ve tarayıcıda saklanır.
// İlk açılışta seçim yoksa bilgisayarın ayarına uyulur. Aynı kural index.html'de de var:
// orada sayfa çizilmeden önce çalışır ki açılışta renk sıçraması olmasın.

export const TEMA_ANAHTARI = 'konu_kartlari_tema';

export function baslangicTemasi() {
  try {
    const kayitli = localStorage.getItem(TEMA_ANAHTARI);
    if (kayitli === 'acik' || kayitli === 'koyu') return kayitli;
  } catch {
    // tarayıcı saklamaya izin vermiyorsa bilgisayarın ayarına bakılır
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'koyu' : 'acik';
}

export function temaOku() {
  return document.documentElement.dataset.tema === 'koyu' ? 'koyu' : 'acik';
}

export function temaAyarla(tema) {
  document.documentElement.dataset.tema = tema;
  try {
    localStorage.setItem(TEMA_ANAHTARI, tema);
  } catch {
    // saklanamazsa sadece bu açılışta geçerli olur
  }
}
