// Profil ve öneri ekranlarının ortak listeleri (docs/anlasma.md). Ekranda `ad` görünür, sunucuya `kod` gider.

// Modelin tanıdığı 12 ilgi alanı (ortak veri tablosunun "Etiketler" sekmesi).
// renk: her alanın kendi rengi, --c1 … --c12 (tema.css).
export const ALANLAR = [
  { kod: 'web', ad: 'Web Geliştirme', renk: 2 },
  { kod: 'mobil', ad: 'Mobil Uygulama', renk: 3 },
  { kod: 'yapay_zeka', ad: 'Yapay Zekâ ve Makine Öğrenmesi', renk: 1 },
  { kod: 'goruntu_isleme', ad: 'Görüntü İşleme', renk: 8 },
  { kod: 'dogal_dil', ad: 'Doğal Dil İşleme', renk: 4 },
  { kod: 'veri_bilimi', ad: 'Veri Bilimi ve Analitik', renk: 7 },
  { kod: 'siber_guvenlik', ad: 'Siber Güvenlik', renk: 5 },
  { kod: 'gomulu_iot', ad: 'Gömülü Sistemler ve IoT', renk: 6 },
  { kod: 'oyun', ad: 'Oyun Geliştirme', renk: 11 },
  { kod: 'bulut_devops', ad: 'Bulut ve DevOps', renk: 9 },
  { kod: 'veritabani', ad: 'Veritabanı Sistemleri', renk: 12 },
  { kod: 'ag_dagitik', ad: 'Ağ ve Dağıtık Sistemler', renk: 10 },
];

// Profildeki her alanın ilgi puanı 1 ile 5 arasında (docs/anlasma.md, 5. bölüm).
export const PUAN_EN_COK = 5;

// Projenin zorluğu: 1 kolay, 3 zor (docs/anlasma.md, 4. bölüm).
export const ZORLUKLAR = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };

// Profil ekranında eklenebilen beceriler (ortak veri tablosunun "Etiketler" sekmesi).
export const BECERILER = [
  'Python', 'Java', 'C', 'C++', 'C#', 'JavaScript', 'TypeScript', 'HTML/CSS', 'React', 'Node.js',
  'Flutter', 'Kotlin', 'Swift', 'SQL', 'MongoDB', 'Linux', 'Git', 'Docker', 'Kubernetes', 'AWS/Azure',
  'Unity', 'Unreal', 'Arduino', 'Raspberry Pi', 'OpenCV', 'PyTorch', 'TensorFlow', 'scikit-learn',
  'Pandas', 'Ağ Temelleri', 'Kriptografi', 'Figma',
];

// Alanı koduyla (ör. "web") ya da adıyla bulur.
export function alanBul(adVeyaKod) {
  return ALANLAR.find((a) => a.kod === adVeyaKod || a.ad === adVeyaKod) || null;
}
