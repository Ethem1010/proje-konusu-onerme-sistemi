// Formların kontrolü. Her fonksiyon sorun varsa kullanıcıya gösterilecek cümleyi,
// yoksa null döner. Kurallar sunucudakiyle aynı ki boşuna istek gitmesin.

// Seyithan'ın sunucusundaki EPOSTA_KALIBI ile aynı.
const EPOSTA_KALIBI = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function girisHatasi({ eposta, sifre }) {
  if (!eposta.trim() || !sifre) return 'E-posta ve şifreni yaz.';
  return null;
}

export function kayitHatasi({ ad, eposta, sifre }) {
  if (ad.trim().length < 2) return 'Adını ve soyadını yaz.';
  if (!EPOSTA_KALIBI.test(eposta.trim())) return 'Geçerli bir e-posta adresi yaz.';
  if (sifre.length < 6) return 'Şifre en az 6 karakter olmalı.';
  // bcrypt 72 bayttan uzununu kabul etmez; Türkçe harfler 2 bayt sayılır.
  if (new TextEncoder().encode(sifre).length > 72) return 'Şifre çok uzun.';
  return null;
}

// Demodaki kurallar: "Diğer" seçildiyse bölüm adı en az 3 harf, metin en az 20 karakter.
// Anlaşma belgesindeki kurallar: haftalık saat ve ekip 1 ve üstü bir sayı, tercih seçilmiş olmalı.
export const EN_KISA_METIN = 20;

function birVeUstu(deger) {
  const sayi = Number(deger);
  return Number.isInteger(sayi) && sayi >= 1;
}

export function anlatHatasi({ bolum, bolumAdi, saat, ekip, tercih, metin }) {
  if (!bolum) return 'Bölümünü seç.';
  if (bolum === 'diger' && bolumAdi.trim().length < 3) return 'Bölümünün adını yaz.';
  if (!birVeUstu(saat)) return 'Haftada en az 1 saat ayırmalısın.';
  if (!birVeUstu(ekip)) return 'Ekip en az 1 kişi olmalı.';
  if (!tercih) return 'Tercihini seç.';
  if (metin.trim().length < EN_KISA_METIN) return 'Kendini birkaç cümleyle anlat.';
  return null;
}

// Sunucudan gelen bölüm listesini açılır listedeki iki gruba ayırır.
export function bolumleriGrupla(liste) {
  return {
    muhendislik: liste.filter((b) => b.grup === 'muhendislik'),
    diger: liste.filter((b) => b.grup !== 'muhendislik'),
  };
}
