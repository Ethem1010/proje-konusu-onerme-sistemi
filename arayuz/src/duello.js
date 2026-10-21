// Düello: puanı en yüksek 8 proje eleme usulü karşılaşır (çeyrek final, yarı final, final).
// Eşleşmeyi arayüz belirler, sunucu sadece her seçimi kaydeder (POST /duello).

export const TURLAR = [
  { kod: 'ceyrek', ad: 'Çeyrek final', mac: 4 },
  { kod: 'yari', ad: 'Yarı final', mac: 2 },
  { kod: 'final', ad: 'Final', mac: 1 },
];

export const MAC_SAYISI = 7;

// Puan sırasına göre 1-8 numaralı projelerin çeyrek final eşleşmesi: 1-8, 4-5, 2-7, 3-6.
// Böylece en yüksek puanlı iki proje ancak finalde karşılaşabilir.
const CEYREK_ESLESMESI = [
  [0, 7],
  [3, 4],
  [1, 6],
  [2, 5],
];

// Düelloya girenler: duelloda olan projeler, puana göre büyükten küçüğe, en çok 8 tane.
export function duelloProjeleri(liste) {
  return liste
    .filter((p) => p.duelloda)
    .sort((a, b) => (b.puan_toplam ?? 0) - (a.puan_toplam ?? 0))
    .slice(0, 8);
}

// 7 maçın hepsi, oynanma sırasıyla. kazananlar: şimdiye kadar seçilenlerin id'leri, maç sırasıyla.
// Her maç: { tur, a, b, kazanan }. Henüz belli olmayan taraf null.
export function maclar(projeler, kazananlar) {
  const bul = (id) => projeler.find((p) => p.id === id) ?? null;
  const sonuc = [];

  const ekle = (tur, a, b) => {
    const kazananId = kazananlar[sonuc.length];
    sonuc.push({ tur, a, b, kazanan: a && b && kazananId != null ? bul(kazananId) : null });
  };

  CEYREK_ESLESMESI.forEach(([i, j]) => ekle('ceyrek', projeler[i] ?? null, projeler[j] ?? null));
  ekle('yari', sonuc[0].kazanan, sonuc[1].kazanan);
  ekle('yari', sonuc[2].kazanan, sonuc[3].kazanan);
  ekle('final', sonuc[4].kazanan, sonuc[5].kazanan);
  return sonuc;
}

// Oynanacak ilk maçın sırası; hepsi bittiyse -1.
export function siradakiMac(maclarListesi) {
  return maclarListesi.findIndex((m) => m.a && m.b && !m.kazanan);
}

export function sampiyon(maclarListesi) {
  return maclarListesi[MAC_SAYISI - 1]?.kazanan ?? null;
}

export function turAdi(kod) {
  return TURLAR.find((t) => t.kod === kod)?.ad ?? kod;
}
