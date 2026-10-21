// Öğrencinin "Seni tanıyalım"da yazdıkları ve sunucudan gelen profil ve öneriler. Sayfa yenilense de
// kaybolmasın ve sunucuya boşuna gidilmesin diye sekme kapanana kadar tarayıcıda saklanır; çıkış
// yapınca silinir. Asıl kayıt sunucuda: burada yoksa ekranlar sunucudan ister.

export const ANAHTARLAR = {
  anlat: 'konu_kartlari_anlat',
  profil: 'konu_kartlari_profil',
  oneriler: 'konu_kartlari_oneriler',
};

export function akisOku(ad) {
  try {
    return JSON.parse(sessionStorage.getItem(ANAHTARLAR[ad])) || null;
  } catch {
    return null;
  }
}

export function akisYaz(ad, deger) {
  sessionStorage.setItem(ANAHTARLAR[ad], JSON.stringify(deger));
}

export function akisSil(ad) {
  sessionStorage.removeItem(ANAHTARLAR[ad]);
}

export function akisiTemizle() {
  Object.values(ANAHTARLAR).forEach((anahtar) => sessionStorage.removeItem(anahtar));
}
