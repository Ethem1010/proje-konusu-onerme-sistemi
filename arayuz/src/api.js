// Sunucuya istek gönderen tek yer. Ekranlar fetch'i doğrudan çağırmaz, buradaki fonksiyonları kullanır.
import { akisiTemizle } from './akis.js';

// Seyithan'ın sunucusu: `uvicorn sunucu.main:app --reload` ile bu adreste açılır.
// Başka bir adres gerekirse `.env` dosyasında VITE_SUNUCU_ADRESI ile değiştirilir.
export const SUNUCU_ADRESI = import.meta.env.VITE_SUNUCU_ADRESI || 'http://127.0.0.1:8000';

const JETON_ANAHTARI = 'konu_kartlari_jeton';
const AD_ANAHTARI = 'konu_kartlari_ad';

// --- Giriş jetonu ---------------------------------------------------------

export function jetonuKaydet({ erisim_jetonu, ad }) {
  localStorage.setItem(JETON_ANAHTARI, erisim_jetonu);
  localStorage.setItem(AD_ANAHTARI, ad);
}

export function jetonuAl() {
  return localStorage.getItem(JETON_ANAHTARI);
}

export function kullaniciAdi() {
  return localStorage.getItem(AD_ANAHTARI) || '';
}

export function cikisYap() {
  localStorage.removeItem(JETON_ANAHTARI);
  localStorage.removeItem(AD_ANAHTARI);
  akisiTemizle(); // aynı sekmede giriş yapan başka biri öncekinin cevaplarını görmesin
}

// --- Genel istek -----------------------------------------------------------

export class SunucuHatasi extends Error {
  constructor(mesaj, durum) {
    super(mesaj);
    this.durum = durum; // HTTP durum kodu; sunucuya hiç ulaşılamadıysa 0
  }
}

// FastAPI hatayı { detail: "..." } olarak döner. Alan kontrolü hatasında (422) detail bir listedir:
// sunucunun kendi yazdığı kural cümlesi varsa ("Value error, Bir alan hem …") o gösterilir,
// yoksa kullanıcıya teknik metin göstermemek için sade bir cümle verilir.
function hataMesaji(govde, durum) {
  if (govde && typeof govde.detail === 'string') return govde.detail;
  if (durum === 422) {
    const kural = Array.isArray(govde?.detail) && govde.detail.find((h) => h?.type === 'value_error');
    if (kural && typeof kural.msg === 'string') return kural.msg.replace(/^Value error, /, '');
    return 'Bilgileri kontrol edip tekrar dene.';
  }
  return 'Bir sorun oluştu, birazdan tekrar dene.';
}

export async function istek(yol, { yontem = 'GET', govde, jetonlu = false } = {}) {
  const basliklar = {};
  if (govde !== undefined) basliklar['Content-Type'] = 'application/json';
  if (jetonlu) {
    const jeton = jetonuAl();
    if (jeton) basliklar.Authorization = `Bearer ${jeton}`;
  }

  let cevap;
  try {
    cevap = await fetch(SUNUCU_ADRESI + yol, {
      method: yontem,
      headers: basliklar,
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
  } catch {
    throw new SunucuHatasi('Sunucuya ulaşılamıyor. İnternet bağlantını kontrol edip tekrar dene.', 0);
  }

  const veri = await cevap.json().catch(() => null);
  if (!cevap.ok) {
    // Jeton yok, geçersiz ya da süresi dolmuş: jeton silinir, ekran öğrenciyi girişe gönderir.
    if (jetonlu && cevap.status === 401) cikisYap();
    throw new SunucuHatasi(hataMesaji(veri, cevap.status), cevap.status);
  }
  return veri;
}

// Giriş gerektiren bir istekte oturum düştü mü (401)? Düştüyse ekran girişe yönlendirir.
export function oturumDustu(hata) {
  return hata?.durum === 401;
}

// --- Adresler (Seyithan'ın sunucusu) ---------------------------------------

// POST /auth/kayit → { erisim_jetonu, jeton_turu, kullanici_id, ad }
export function kayitOl({ ad, eposta, sifre }) {
  return istek('/auth/kayit', { yontem: 'POST', govde: { ad, eposta, sifre } });
}

// POST /auth/giris → { erisim_jetonu, jeton_turu, kullanici_id, ad }
export function girisYap({ eposta, sifre }) {
  return istek('/auth/giris', { yontem: 'POST', govde: { eposta, sifre } });
}

// GET /auth/ben → { id, ad, eposta, rol }
export function ben() {
  return istek('/auth/ben', { jetonlu: true });
}

// GET /bolumler → [{ id, ad, grup }]; grup 'muhendislik' ya da 'diger'
export function bolumleriGetir() {
  return istek('/bolumler');
}

// POST /profil → { id, alanlar, istemedikleri, beceriler, onaylandi }
export function profilOlustur(govde) {
  return istek('/profil', { yontem: 'POST', govde, jetonlu: true });
}

// GET /profil/{id} → POST /profil ile aynı kalıp. Profil yoksa ya da başkasınınsa 404.
export function profilGetir(id) {
  return istek(`/profil/${id}`, { jetonlu: true });
}

// PUT /profil/{id} → aynı kalıp, onaylandi: true. Bir alan hem ilgi hem istemediklerdeyse 422.
export function profilOnayla(id, { alanlar, istemedikleri, beceriler }) {
  return istek(`/profil/${id}`, { yontem: 'PUT', govde: { alanlar, istemedikleri, beceriler }, jetonlu: true });
}

// GET /oneriler/{profilId} → kayıtlı 10 proje; henüz üretilmediyse boş liste
export function onerileriGetir(profilId) {
  return istek(`/oneriler/${profilId}`, { jetonlu: true });
}

// POST /oneriler/{profilId} → 10 proje üretir (Gemini yüzünden 5-10 saniye sürebilir)
export function onerileriUret(profilId) {
  return istek(`/oneriler/${profilId}`, { yontem: 'POST', jetonlu: true });
}

// POST /duello { profil_id, kazanan_proje_id, kaybeden_proje_id, tur } → 201, aynısı + id.
// Proje daha önce elendiyse ya da turun maçları dolduysa 400.
export function duelloKaydet(secim) {
  return istek('/duello', { yontem: 'POST', govde: secim, jetonlu: true });
}

// GET /duello/{profilId} → kaydedilmiş maçlar, oynanma sırasıyla (en çok 7); henüz yoksa boş liste
export function duellolariGetir(profilId) {
  return istek(`/duello/${profilId}`, { jetonlu: true });
}
