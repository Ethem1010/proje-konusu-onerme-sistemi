// Sunucuya istek gönderen tek yer. Ekranlar fetch'i doğrudan çağırmaz, buradaki fonksiyonları kullanır.

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
}

// --- Genel istek -----------------------------------------------------------

export class SunucuHatasi extends Error {
  constructor(mesaj, durum) {
    super(mesaj);
    this.durum = durum; // HTTP durum kodu; sunucuya hiç ulaşılamadıysa 0
  }
}

// FastAPI hatayı { detail: "..." } olarak döner. Alan kontrolü hatasında (422)
// detail bir listedir; kullanıcıya teknik metin göstermemek için sade bir cümle verilir.
function hataMesaji(govde, durum) {
  if (govde && typeof govde.detail === 'string') return govde.detail;
  if (durum === 422) return 'Bilgileri kontrol edip tekrar dene.';
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
  if (!cevap.ok) throw new SunucuHatasi(hataMesaji(veri, cevap.status), cevap.status);
  return veri;
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
