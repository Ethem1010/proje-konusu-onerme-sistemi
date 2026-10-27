import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { akisOku, akisYaz } from '../akis.js';
import { SunucuHatasi } from '../api.js';
import * as api from '../api.js';
import { TASLAK_ANAHTARI } from './Anlat.jsx';

// Sunucu yerine sahte cevaplar; jeton işlemleri gerçek kalır.
vi.mock('../api.js', async (gercek) => ({
  ...(await gercek()),
  girisYap: vi.fn(),
  kayitOl: vi.fn(),
  bolumleriGetir: vi.fn(),
  profilOlustur: vi.fn(),
  profilOnayla: vi.fn(),
  onerileriGetir: vi.fn(),
  onerileriUret: vi.fn(),
  profilGetir: vi.fn(),
  duelloKaydet: vi.fn(),
  duellolariGetir: vi.fn(),
  surprizGetir: vi.fn(),
  projeGetir: vi.fn(),
  secimYap: vi.fn(),
  haritaGetir: vi.fn(),
  adimIsaretle: vi.fn(),
  secimleriGetir: vi.fn(),
}));

const BOLUMLER = [
  { id: 1, ad: 'Bilgisayar Mühendisliği', grup: 'muhendislik' },
  { id: 2, ad: 'Makine Mühendisliği', grup: 'muhendislik' },
  { id: 27, ad: 'İşletme', grup: 'diger' },
];

// Veritabanındaki yeni liste: sadece Bilgisayar ve Yazılım.
const IKI_BOLUM = [
  { id: 1, ad: 'Bilgisayar Mühendisliği', grup: 'muhendislik' },
  { id: 2, ad: 'Yazılım Mühendisliği', grup: 'muhendislik' },
];

function ac(adres) {
  return render(
    <MemoryRouter initialEntries={[adres]}>
      <App />
    </MemoryRouter>,
  );
}

// POST /profil cevabı (docs/anlasma.md, 5. bölüm)
const PROFIL = {
  id: 5,
  alanlar: [
    { kod: 'mobil', ad: 'Mobil Uygulama', puan: 5 },
    { kod: 'yapay_zeka', ad: 'Yapay Zekâ ve Makine Öğrenmesi', puan: 4 },
    { kod: 'veri_bilimi', ad: 'Veri Bilimi ve Analitik', puan: 3 },
    { kod: 'goruntu_isleme', ad: 'Görüntü İşleme', puan: 2 },
    { kod: 'web', ad: 'Web Geliştirme', puan: 2 },
  ],
  istemedikleri: ['oyun'],
  beceriler: ['Flutter'],
  onaylandi: false,
};

const METIN = 'Web sitesi yapmayı seviyorum, React biliyorum.';

// Formu doldurur; boş bırakılmak istenen alan için '' verilir.
async function doldur({ bolum = '1', saat = '8', ekip = '3', tercih = 'uretmek', metin = METIN } = {}) {
  const liste = screen.getByLabelText('Bölüm');
  await waitFor(() => expect(liste).toBeEnabled());
  if (bolum) await userEvent.selectOptions(liste, bolum);
  if (saat) await userEvent.type(screen.getByLabelText('Haftada kaç saat ayırabilirsin?'), saat);
  if (ekip) await userEvent.type(screen.getByLabelText('Kaç kişisiniz?'), ekip);
  if (tercih) await userEvent.selectOptions(screen.getByLabelText('Tercihin ne?'), tercih);
  if (metin) await userEvent.type(screen.getByLabelText(/Neyi seviyorsun/), metin);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.bolumleriGetir).mockResolvedValue(BOLUMLER);
  vi.mocked(api.secimleriGetir).mockResolvedValue([]);
});

describe('Yönlendirme', () => {
  it('giriş yapmamış öğrenci "Seni tanıyalım"ı açamaz, girişe gider', () => {
    ac('/anlat');
    expect(screen.getByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });

  it('giriş yapmış öğrenci giriş ekranını atlar', async () => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    ac('/giris');
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
  });
});

describe('Giriş', () => {
  it('boş gönderilince uyarır, sunucuya gitmez', async () => {
    ac('/giris');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(screen.getByRole('alert')).toHaveTextContent('E-posta ve şifreni yaz.');
    expect(api.girisYap).not.toHaveBeenCalled();
  });

  it('yanlış şifrede sunucunun mesajını gösterir', async () => {
    vi.mocked(api.girisYap).mockRejectedValue(new SunucuHatasi('E-posta veya şifre hatalı.', 401));
    ac('/giris');
    await userEvent.type(screen.getByLabelText('E-posta'), 'ayse@ornek.com');
    await userEvent.type(screen.getByLabelText('Şifre'), 'yanlis1');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-posta veya şifre hatalı.');
  });

  it('doğru girişte jetonu saklar ve "Seni tanıyalım"a geçer', async () => {
    vi.mocked(api.girisYap).mockResolvedValue({ erisim_jetonu: 'jeton1', ad: 'Ayşe', kullanici_id: 1 });
    ac('/giris');
    await userEvent.type(screen.getByLabelText('E-posta'), ' ayse@ornek.com ');
    await userEvent.type(screen.getByLabelText('Şifre'), 'gizli123');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));

    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
    expect(api.girisYap).toHaveBeenCalledWith({ eposta: 'ayse@ornek.com', sifre: 'gizli123' });
    expect(api.jetonuAl()).toBe('jeton1');
  });

  it('cevap beklenirken düğme kilitlenir, iki kez gönderilemez', async () => {
    let bitir;
    vi.mocked(api.girisYap).mockReturnValue(new Promise((cozum) => (bitir = cozum)));
    ac('/giris');
    await userEvent.type(screen.getByLabelText('E-posta'), 'ayse@ornek.com');
    await userEvent.type(screen.getByLabelText('Şifre'), 'gizli123');
    await userEvent.click(screen.getByRole('button', { name: 'Giriş yap' }));

    const dugme = screen.getByRole('button', { name: 'Giriş yapılıyor…' });
    expect(dugme).toBeDisabled();
    await userEvent.click(dugme);
    expect(api.girisYap).toHaveBeenCalledTimes(1);

    bitir({ erisim_jetonu: 'j', ad: 'Ayşe', kullanici_id: 1 });
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
  });

  it('"Kayıt ol" bağlantısı kayıt ekranını açar, geri düğmesi döner', async () => {
    ac('/giris');
    await userEvent.click(screen.getByRole('link', { name: 'Kayıt ol' }));
    expect(screen.getByRole('heading', { name: 'Kayıt ol' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '← Geri' }));
    expect(screen.getByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });
});

describe('Kayıt', () => {
  it('kısa şifrede uyarır', async () => {
    ac('/kayit');
    await userEvent.type(screen.getByLabelText('Adın soyadın'), 'Ayşe Yılmaz');
    await userEvent.type(screen.getByLabelText('E-posta'), 'ayse@ornek.com');
    await userEvent.type(screen.getByLabelText('Şifre (en az 6 karakter)'), '123');
    await userEvent.click(screen.getByRole('button', { name: 'Kayıt ol' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Şifre en az 6 karakter olmalı.');
    expect(api.kayitOl).not.toHaveBeenCalled();
  });

  it('e-posta zaten kayıtlıysa sunucunun mesajını gösterir, ekranda kalır', async () => {
    vi.mocked(api.kayitOl).mockRejectedValue(new SunucuHatasi('Bu e-posta ile zaten bir hesap var.', 409));
    ac('/kayit');
    await userEvent.type(screen.getByLabelText('Adın soyadın'), 'Ayşe Yılmaz');
    await userEvent.type(screen.getByLabelText('E-posta'), 'ayse@ornek.com');
    await userEvent.type(screen.getByLabelText('Şifre (en az 6 karakter)'), 'gizli123');
    await userEvent.click(screen.getByRole('button', { name: 'Kayıt ol' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Bu e-posta ile zaten bir hesap var.');
    expect(screen.getByRole('heading', { name: 'Kayıt ol' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kayıt ol' })).toBeEnabled();
    expect(api.jetonuAl()).toBeNull();
  });

  it('kayıt olunca doğrudan "Seni tanıyalım"a geçer', async () => {
    vi.mocked(api.kayitOl).mockResolvedValue({ erisim_jetonu: 'yeni', ad: 'Ayşe Yılmaz', kullanici_id: 5 });
    ac('/kayit');
    await userEvent.type(screen.getByLabelText('Adın soyadın'), 'Ayşe Yılmaz');
    await userEvent.type(screen.getByLabelText('E-posta'), 'ayse@ornek.com');
    await userEvent.type(screen.getByLabelText('Şifre (en az 6 karakter)'), 'gizli123');
    await userEvent.click(screen.getByRole('button', { name: 'Kayıt ol' }));
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
    expect(api.jetonuAl()).toBe('yeni');
  });
});

describe('Seni tanıyalım (Anlat)', () => {
  beforeEach(() => api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' }));

  it('daha önce proje seçtiyse "Devam eden projelerin" görünür, "Haritaya git" haritayı açar', async () => {
    vi.mocked(api.secimleriGetir).mockResolvedValue([
      { secim_id: 3, proje_id: 42, baslik: 'Kampüs Oyunu', alan: 'oyun', zorluk_modu: 'efsane', tamamlanan: 3, toplam: 12 },
    ]);
    vi.mocked(api.haritaGetir).mockResolvedValue({ secim_id: 3, proje_id: 42, zorluk_modu: 'efsane', adimlar: [] });
    vi.mocked(api.projeGetir).mockResolvedValue({ id: 42, baslik: 'Kampüs Oyunu' });
    ac('/anlat');

    const kutu = await screen.findByRole('region', { name: 'Devam eden projelerin' });
    expect(kutu).toHaveTextContent('Kampüs Oyunu');
    expect(kutu).toHaveTextContent('Efsane mod · 3/12 tamamlandı');
    await userEvent.click(screen.getByRole('button', { name: 'Haritaya git' }));
    await waitFor(() => expect(api.haritaGetir).toHaveBeenCalledWith('3'));
  });

  it('seçilmiş proje yoksa "Devam eden projelerin" görünmez', async () => {
    ac('/anlat');
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());
    expect(api.secimleriGetir).toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Devam eden projelerin' })).not.toBeInTheDocument();
  });

  it('yazılanlar "Devam et"e basmadan da saklanır, sayfa yenilense de kaybolmaz', async () => {
    const { unmount } = ac('/anlat');
    await userEvent.type(screen.getByLabelText(/Neyi seviyorsun/), 'Unity biliyorum');
    expect(JSON.parse(sessionStorage.getItem(TASLAK_ANAHTARI))).toMatchObject({ metin: 'Unity biliyorum' });
    unmount();

    ac('/anlat');
    expect(screen.getByLabelText(/Neyi seviyorsun/)).toHaveValue('Unity biliyorum');
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());
  });

  it('bölüm listesi sunucudan gelir, iki grupta ve en altta "Diğer"', async () => {
    ac('/anlat');
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());

    const gruplar = liste.querySelectorAll('optgroup');
    expect([...gruplar].map((g) => g.label)).toEqual(['Mühendislik', 'Diğer bölümler']);
    expect(gruplar[0]).toHaveTextContent('Bilgisayar Mühendisliği');
    expect(gruplar[1]).toHaveTextContent('İşletme');
    expect(liste.options[liste.options.length - 1]).toHaveTextContent('Diğer (bölümünü yaz)');
  });

  it('boş grubun başlığı gösterilmez, "Diğer" yine en altta', async () => {
    vi.mocked(api.bolumleriGetir).mockResolvedValue(IKI_BOLUM);
    ac('/anlat');
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());

    const gruplar = liste.querySelectorAll('optgroup');
    expect([...gruplar].map((g) => g.label)).toEqual(['Mühendislik']);
    expect(gruplar[0]).toHaveTextContent('Bilgisayar Mühendisliği');
    expect(gruplar[0]).toHaveTextContent('Yazılım Mühendisliği');
    expect(liste.options[liste.options.length - 1]).toHaveTextContent('Diğer (bölümünü yaz)');
  });

  it('proje türü ekranda yazıyla görünür, değeri kod; süre 1-24 hafta', async () => {
    ac('/anlat');
    const tur = screen.getByLabelText('Proje türü');
    expect([...tur.options].map((o) => o.textContent)).toEqual([
      'Ders ödevi',
      'Dönem projesi',
      'Bitirme projesi',
      'Yarışma projesi',
      'Kişisel proje',
    ]);
    expect([...tur.options].map((o) => o.value)).toEqual(['ders', 'donem', 'bitirme', 'yarisma', 'kisisel']);
    expect(tur).toHaveValue('donem');
    const sureler = [...screen.getByLabelText('Süre').options].map((o) => Number(o.value));
    expect(sureler[0]).toBe(1);
    expect(sureler.at(-1)).toBe(24);
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());
  });

  it('üç soru var: haftalık saat, kişi sayısı, tercih; saat ve kişiye sadece rakam yazılır', async () => {
    ac('/anlat');
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());

    const saat = screen.getByLabelText('Haftada kaç saat ayırabilirsin?');
    await userEvent.type(saat, '1a0,5');
    expect(saat).toHaveValue('105');
    const ekip = screen.getByLabelText('Kaç kişisiniz?');
    await userEvent.type(ekip, '-3');
    expect(ekip).toHaveValue('3');

    const tercih = screen.getByLabelText('Tercihin ne?');
    expect(tercih).toHaveValue('');
    expect([...tercih.options].slice(1).map((o) => [o.value, o.textContent])).toEqual([
      ['uretmek', 'Bir şey üretmek'],
      ['arastirmak', 'Araştırmak'],
      ['farketmez', 'Fark etmez'],
    ]);
  });

  it('"Diğer" seçilince bölüm adı kutusu açılır', async () => {
    ac('/anlat');
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());
    expect(screen.queryByLabelText('Bölümünün adı')).not.toBeInTheDocument();
    await userEvent.selectOptions(liste, 'diger');
    expect(screen.getByLabelText('Bölümünün adı')).toBeInTheDocument();
  });

  it('metin kısaysa uyarır', async () => {
    ac('/anlat');
    await doldur({ metin: 'Bilmiyorum.' });
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Kendini birkaç cümleyle anlat.');
  });

  it('saat 0 yazılırsa uyarır, sunucuya bir şey gitmez', async () => {
    ac('/anlat');
    await doldur({ saat: '0' });
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Haftada en az 1 saat ayırmalısın.');
    expect(api.profilOlustur).not.toHaveBeenCalled();
  });

  it('kişi sayısı boşsa ya da tercih seçilmediyse uyarır', async () => {
    ac('/anlat');
    await doldur({ ekip: '', tercih: '' });
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ekip en az 1 kişi olmalı.');

    await userEvent.type(screen.getByLabelText('Kaç kişisiniz?'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Tercihini seç.');
    expect(api.profilOlustur).not.toHaveBeenCalled();
  });

  it('"Dönem projesi" seçilince sunucuya donem gider; dönen profil saklanır, profil ekranına geçilir', async () => {
    vi.mocked(api.profilOlustur).mockResolvedValue(PROFIL);
    akisYaz('oneriler', { profilId: '4', liste: [] }); // önceki profilin önerileri
    ac('/anlat');
    await doldur();
    await userEvent.selectOptions(screen.getByLabelText('Proje türü'), 'Dönem projesi');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    expect(await screen.findByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
    expect(akisOku('profil')).toEqual(PROFIL);
    expect(akisOku('oneriler')).toBeNull();
    expect(api.profilOlustur).toHaveBeenCalledWith({
      bolum_id: 1,
      bolum_diger: null,
      proje_turu: 'donem',
      sure_hafta: 12,
      metin: METIN,
      haftalik_saat: 8,
      ekip: 3,
      tercih: 'uretmek',
    });
  });

  it('"Diğer" bölümde bolum_diger gider; bilgiler tarayıcıda da saklanır', async () => {
    vi.mocked(api.profilOlustur).mockResolvedValue({ ...PROFIL, id: 9 });
    ac('/anlat');
    await doldur({ bolum: 'diger', saat: '10', ekip: '1', tercih: 'arastirmak', metin: 'Yemek fotoğrafçılığını seviyorum, Excel biliyorum.' });
    await userEvent.type(screen.getByLabelText('Bölümünün adı'), ' Gastronomi ');
    await userEvent.selectOptions(screen.getByLabelText('Proje türü'), 'Bitirme projesi');
    await userEvent.selectOptions(screen.getByLabelText('Süre'), '16');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    expect(await screen.findByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
    expect(api.profilOlustur).toHaveBeenCalledWith({
      bolum_id: null,
      bolum_diger: 'Gastronomi',
      proje_turu: 'bitirme',
      sure_hafta: 16,
      metin: 'Yemek fotoğrafçılığını seviyorum, Excel biliyorum.',
      haftalik_saat: 10,
      ekip: 1,
      tercih: 'arastirmak',
    });
    expect(JSON.parse(sessionStorage.getItem(TASLAK_ANAHTARI))).toEqual({
      bolum: 'diger',
      bolumId: null,
      bolumAdi: 'Gastronomi',
      tur: 'bitirme',
      sure: 16,
      saat: 10,
      ekip: 1,
      tercih: 'arastirmak',
      metin: 'Yemek fotoğrafçılığını seviyorum, Excel biliyorum.',
    });
  });

  it('gönderilirken düğme kilitlenir, iki kez gönderilemez', async () => {
    let bitir;
    vi.mocked(api.profilOlustur).mockReturnValue(new Promise((cozum) => (bitir = cozum)));
    ac('/anlat');
    await doldur();
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    const dugme = screen.getByRole('button', { name: 'Gönderiliyor…' });
    expect(dugme).toBeDisabled();
    await userEvent.click(dugme);
    expect(api.profilOlustur).toHaveBeenCalledTimes(1);

    bitir(PROFIL);
    expect(await screen.findByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
  });

  it('oturum düştüyse (401) girişe gönderir ve nedenini gösterir', async () => {
    vi.mocked(api.profilOlustur).mockImplementation(async () => {
      api.cikisYap(); // gerçek istek() 401'de jetonu böyle siler
      throw new SunucuHatasi('Oturumun süresi doldu, tekrar giriş yap.', 401);
    });
    ac('/anlat');
    await doldur();
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(await screen.findByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Oturumun süresi doldu, tekrar giriş yap.');
  });

  it('sunucu hata verirse mesajı gösterir, ekranda kalır, yazılanlar kaybolmaz', async () => {
    vi.mocked(api.profilOlustur).mockRejectedValue(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0));
    ac('/anlat');
    await doldur();
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor.');
    expect(screen.getByRole('button', { name: 'Devam et' })).toBeEnabled();
    expect(screen.getByLabelText(/Neyi seviyorsun/)).toHaveValue(METIN);
    expect(JSON.parse(sessionStorage.getItem(TASLAK_ANAHTARI))).toMatchObject({ bolumId: 1, saat: 8, ekip: 3, metin: METIN });
  });

  it('kaydedilen bilgiler sayfa yeniden açılınca yerinde durur', async () => {
    sessionStorage.setItem(
      TASLAK_ANAHTARI,
      JSON.stringify({
        bolum: '27',
        bolumId: 27,
        bolumAdi: 'İşletme',
        tur: 'kisisel',
        sure: 6,
        saat: 5,
        ekip: 2,
        tercih: 'farketmez',
        metin: 'Pazarlama ve marka işlerini seviyorum.',
      }),
    );
    ac('/anlat');
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());

    expect(liste).toHaveValue('27');
    expect(screen.getByLabelText('Proje türü')).toHaveValue('kisisel');
    expect(screen.getByLabelText('Süre')).toHaveValue('6');
    expect(screen.getByLabelText('Haftada kaç saat ayırabilirsin?')).toHaveValue('5');
    expect(screen.getByLabelText('Kaç kişisiniz?')).toHaveValue('2');
    expect(screen.getByLabelText('Tercihin ne?')).toHaveValue('farketmez');
    expect(screen.getByLabelText(/Neyi seviyorsun/)).toHaveValue('Pazarlama ve marka işlerini seviyorum.');
  });

  it('eski taslakta proje türü yazıyla durursa koda çevrilir', async () => {
    sessionStorage.setItem(TASLAK_ANAHTARI, JSON.stringify({ bolum: '1', tur: 'Kişisel proje', sure: 6, metin: METIN }));
    ac('/anlat');
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());
    expect(screen.getByLabelText('Proje türü')).toHaveValue('kisisel');
  });

  it('taslaktaki bölüm artık listede yoksa seçilmemiş sayılır', async () => {
    vi.mocked(api.bolumleriGetir).mockResolvedValue(IKI_BOLUM);
    sessionStorage.setItem(TASLAK_ANAHTARI, JSON.stringify({ bolum: '27', bolumId: 27, bolumAdi: 'İşletme', metin: METIN }));
    ac('/anlat');
    await doldur({ bolum: '', metin: '' });
    expect(screen.getByLabelText('Bölüm')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bölümünü seç.');
    expect(api.profilOlustur).not.toHaveBeenCalled();
  });

  it('sunucuya ulaşılamazsa mesaj ve "Tekrar dene" gösterir', async () => {
    vi.mocked(api.bolumleriGetir)
      .mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0))
      .mockResolvedValueOnce(BOLUMLER);
    ac('/anlat');
    expect(await screen.findByRole('alert')).toHaveTextContent('Bölüm listesi alınamadı. Sunucuya ulaşılamıyor.');
    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('"Çıkış" jetonu ve cevapları siler, girişe döner', async () => {
    akisYaz('anlat', { bolum: '1', metin: METIN });
    akisYaz('profil', PROFIL);
    ac('/anlat');
    await userEvent.click(screen.getByRole('button', { name: 'Çıkış' }));
    expect(screen.getByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
    expect(api.jetonuAl()).toBeNull();
    expect(akisOku('anlat')).toBeNull();
    expect(akisOku('profil')).toBeNull();
  });
});

// --- Profil onayı ------------------------------------------------------------

function alanSatirlari() {
  return within(screen.getByRole('list', { name: 'İlgi alanların' })).getAllByRole('listitem');
}

describe('Profil onayı', () => {
  beforeEach(() => api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' }));

  it('profil tarayıcıda yoksa (başka sekme) sunucudan istenir (GET /profil/{id})', async () => {
    vi.mocked(api.profilGetir).mockResolvedValue(PROFIL);
    ac('/profil/5');
    expect(screen.getByRole('heading', { name: 'Profilin açılıyor' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
    expect(api.profilGetir).toHaveBeenCalledWith('5');
    expect(alanSatirlari()).toHaveLength(5);
    expect(akisOku('profil')).toEqual(PROFIL);
  });

  it('tarayıcıdaki profil adresteki numaraya uyuyorsa sunucuya gidilmez', () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    expect(screen.getByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
    expect(api.profilGetir).not.toHaveBeenCalled();
  });

  it('adresteki numara başka bir profilse o profil sunucudan istenir', async () => {
    vi.mocked(api.profilGetir).mockResolvedValue({ ...PROFIL, id: 9 });
    akisYaz('profil', PROFIL);
    ac('/profil/9');
    expect(await screen.findByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
    expect(api.profilGetir).toHaveBeenCalledWith('9');
  });

  it('profil bulunamazsa (404) mesaj gösterir, "Seni tanıyalım"a dönülebilir', async () => {
    vi.mocked(api.profilGetir).mockRejectedValue(new SunucuHatasi('Profil bulunamadı.', 404));
    ac('/profil/7');
    expect(await screen.findByRole('heading', { name: 'Profil açılamadı' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Profil bulunamadı.');
    await userEvent.click(screen.getByRole('button', { name: "Seni tanıyalım'a dön" }));
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
  });

  it('5 alan sunucunun sırasıyla, puanlarıyla görünür', () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    const satirlar = alanSatirlari();
    expect(satirlar).toHaveLength(5);
    expect(within(satirlar[0]).getByRole('combobox')).toHaveValue('mobil');
    expect(within(satirlar[4]).getByRole('combobox')).toHaveValue('web');
    expect(screen.getByRole('button', { name: 'Mobil Uygulama 5 puan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Web Geliştirme 2 puan' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sunucu alan adını göndermezse koddan bulunur', () => {
    akisYaz('profil', { ...PROFIL, alanlar: PROFIL.alanlar.map(({ kod, puan }) => ({ kod, puan })) });
    ac('/profil/5');
    expect(screen.getByRole('button', { name: 'Görüntü İşleme 2 puan' })).toBeInTheDocument();
  });

  it('noktaya dokununca puan değişir', async () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.click(screen.getByRole('button', { name: 'Web Geliştirme 4 puan' }));
    expect(screen.getByRole('button', { name: 'Web Geliştirme 4 puan' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Web Geliştirme 2 puan' })).toHaveAttribute('aria-pressed', 'false');
  });

  it("alan 12'lik listeden değiştirilir; profildeki ve istenmeyen alanlar listede çıkmaz", async () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    const liste = screen.getByLabelText('Web Geliştirme yerine başka alan seç');
    const secenekler = [...liste.options].map((o) => o.value);
    expect(secenekler).toHaveLength(12 - 5 - 1 + 1); // kendisi + boştaki 6 alan
    expect(secenekler).not.toContain('mobil');
    expect(secenekler).not.toContain('oyun');

    await userEvent.selectOptions(liste, 'dogal_dil');
    expect(within(alanSatirlari()[4]).getByRole('combobox')).toHaveValue('dogal_dil');
    expect(screen.getByRole('button', { name: 'Doğal Dil İşleme 2 puan' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('"Bunları önermeyeceğiz": istenmeyen alan × ile kalkar, listeden eklenir', async () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.click(screen.getByRole('button', { name: 'Oyun Geliştirme kaldır' }));
    expect(screen.queryByRole('button', { name: 'Oyun Geliştirme kaldır' })).not.toBeInTheDocument();
    expect(screen.getByText('Şu an yok.')).toBeInTheDocument();

    const ekle = screen.getByLabelText('Alan ekle');
    expect([...ekle.options].map((o) => o.value)).not.toContain('mobil');
    await userEvent.selectOptions(ekle, 'siber_guvenlik');
    expect(screen.getByRole('button', { name: 'Siber Güvenlik kaldır' })).toBeInTheDocument();
    expect(screen.getByLabelText('Alan ekle')).toHaveValue('');
  });

  it("beceriler etiket olarak görünür; × ile silinir, 32'lik listeden eklenir", async () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.selectOptions(screen.getByLabelText('Beceri ekle'), 'Python');
    expect(screen.getByRole('button', { name: 'Python kaldır' })).toBeInTheDocument();
    expect([...screen.getByLabelText('Beceri ekle').options].map((o) => o.value)).not.toContain('Python');

    await userEvent.click(screen.getByRole('button', { name: 'Flutter kaldır' }));
    expect(screen.queryByRole('button', { name: 'Flutter kaldır' })).not.toBeInTheDocument();
  });

  it('"Onayla ve devam" düzeltilmiş profili PUT ile gönderir ve önerilere geçer', async () => {
    vi.mocked(api.profilOnayla).mockImplementation(async (id, govde) => ({ id, ...govde, onaylandi: true }));
    vi.mocked(api.onerileriUret).mockResolvedValue(ONERILER);
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.click(screen.getByRole('button', { name: 'Web Geliştirme 4 puan' }));
    await userEvent.click(screen.getByRole('button', { name: 'Oyun Geliştirme kaldır' }));
    await userEvent.selectOptions(screen.getByLabelText('Beceri ekle'), 'Python');
    await userEvent.click(screen.getByRole('button', { name: 'Onayla ve devam' }));

    expect(await screen.findByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
    const [id, govde] = api.profilOnayla.mock.calls[0];
    expect(id).toBe(5);
    expect(govde.alanlar).toHaveLength(5);
    expect(govde.alanlar).toContainEqual({ kod: 'web', ad: 'Web Geliştirme', puan: 4 });
    expect(govde.istemedikleri).toEqual([]);
    expect(govde.beceriler).toEqual(['Flutter', 'Python']);
    expect(akisOku('profil').onaylandi).toBe(true);
    // Profil yeni onaylandı: eski liste geçersiz, doğrudan üretilir.
    expect(api.onerileriUret).toHaveBeenCalledWith('5');
    expect(api.onerileriGetir).not.toHaveBeenCalled();
  });

  it('beklerken düğme kilitlenir, iki kez gönderilemez', async () => {
    vi.mocked(api.profilOnayla).mockReturnValue(new Promise(() => {}));
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.click(screen.getByRole('button', { name: 'Onayla ve devam' }));
    const dugme = screen.getByRole('button', { name: 'Kaydediliyor…' });
    expect(dugme).toBeDisabled();
    await userEvent.click(dugme);
    expect(api.profilOnayla).toHaveBeenCalledTimes(1);
  });

  it('aynı alan hem ilgi hem istenmeyense sunucunun Türkçe mesajını gösterir', async () => {
    vi.mocked(api.profilOnayla).mockRejectedValueOnce(
      new SunucuHatasi('Bir alan hem ilgi alanlarında hem istemediklerinde olamaz.', 422),
    );
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.click(screen.getByRole('button', { name: 'Onayla ve devam' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Bir alan hem ilgi alanlarında hem istemediklerinde olamaz.');
    expect(screen.getByRole('button', { name: 'Onayla ve devam' })).toBeEnabled();
  });

  it('oturum düştüyse (401) girişe gönderir', async () => {
    vi.mocked(api.profilOnayla).mockImplementation(async () => {
      api.cikisYap();
      throw new SunucuHatasi('Oturumun süresi doldu, tekrar giriş yap.', 401);
    });
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    await userEvent.click(screen.getByRole('button', { name: 'Onayla ve devam' }));
    expect(await screen.findByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });

  it('geri düğmesi "Seni tanıyalım"a döner ve sayfa en üstten başlar', async () => {
    akisYaz('profil', PROFIL);
    ac('/profil/5');
    vi.mocked(window.scrollTo).mockClear();
    await userEvent.click(screen.getByRole('button', { name: '← Geri' }));
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});

// --- Öneriler ----------------------------------------------------------------

// GET/POST /oneriler cevabındaki bir proje (docs/anlasma.md, 4. bölüm)
function proje(no, ekler = {}) {
  return {
    id: 40 + no,
    kaynak: 'havuz',
    havuz_proje_id: no,
    baslik: `Proje ${no}`,
    alan: 'mobil',
    alan_adi: 'Mobil Uygulama',
    alan2: null,
    beceriler: ['Flutter'],
    zorluk: 2,
    hafta: 8,
    ne: `Proje ${no} ne yapar`,
    kim: 'Öğrenciler',
    cikti: 'Bir uygulama',
    adimlar: ['Veriyi topla', 'Modeli eğit', 'Uygulamayı yap', 'Kampüste dene'],
    kolay: 'Sadece ortalama',
    efsane: 'Anlık bildirim',
    puan_uyum: 90,
    puan_yapilabilirlik: 80,
    puan_ozgunluk: 70,
    puan_toplam: 100 - no,
    benzer_baslik: null,
    benzer_link: null,
    benzerlik: null,
    duelloda: no <= 8,
    surpriz: false,
    ...ekler,
  };
}

// Sunucu sıralı gönderir; sıralamayı da denemek için karışık verilir. 2. proje Gemini'den.
const ONERILER = [3, 1, 2, 4, 5, 6, 7, 8, 10, 9].map((no) =>
  proje(
    no,
    no === 2
      ? { kaynak: 'gemini', havuz_proje_id: null, baslik: 'Kantin Sırası Tahmini', alan: 'yapay_zeka', alan_adi: 'Yapay Zekâ ve Makine Öğrenmesi', zorluk: 3 }
      : {},
  ),
);

function oneriKartlari() {
  return [...document.querySelectorAll('ol.oneriler > li')];
}

describe('Öneriler', () => {
  beforeEach(() => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    akisYaz('profil', { ...PROFIL, onaylandi: true });
  });

  it('tarayıcıda hiçbir şey yokken (başka sekme) de açılır, liste sunucudan gelir', async () => {
    sessionStorage.clear();
    vi.mocked(api.onerileriGetir).mockResolvedValue(ONERILER);
    ac('/oneriler/5');
    expect(await screen.findByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
    expect(api.onerileriGetir).toHaveBeenCalledWith('5');
    expect(api.onerileriUret).not.toHaveBeenCalled();
  });

  it('profil başkasınınsa (404) sunucunun mesajını gösterir', async () => {
    vi.mocked(api.onerileriGetir).mockRejectedValue(new SunucuHatasi('Profil bulunamadı.', 404));
    ac('/oneriler/9');
    expect(await screen.findByRole('heading', { name: 'Projeler getirilemedi' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Profil bulunamadı.');
    expect(api.onerileriUret).not.toHaveBeenCalled();
  });

  it('açılışta kayıtlı liste istenir (GET); varsa yeniden üretilmez', async () => {
    vi.mocked(api.onerileriGetir).mockResolvedValue(ONERILER);
    ac('/oneriler/5');
    expect(await screen.findByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
    expect(api.onerileriGetir).toHaveBeenCalledWith('5');
    expect(api.onerileriUret).not.toHaveBeenCalled();
  });

  it('kayıtlı liste boşsa üretilir (POST); beklerken ilerleme gösterir', async () => {
    let bitir;
    vi.mocked(api.onerileriGetir).mockResolvedValue([]);
    vi.mocked(api.onerileriUret).mockImplementation(() => new Promise((r) => (bitir = r)));
    ac('/oneriler/5');

    expect(screen.getByRole('heading', { name: 'Projelerin hazırlanıyor' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    await waitFor(() => expect(api.onerileriUret).toHaveBeenCalledWith('5'));
    bitir(ONERILER);

    expect(await screen.findByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
    const basliklar = oneriKartlari().map((k) => k.querySelector('.oneri-baslik').textContent);
    expect(basliklar).toEqual(['Proje 1', 'Kantin Sırası Tahmini', 'Proje 3', 'Proje 4', 'Proje 5', 'Proje 6', 'Proje 7', 'Proje 8', 'Proje 9', 'Proje 10']);
    expect(api.onerileriUret).toHaveBeenCalledTimes(1);
    expect(akisOku('oneriler')).toEqual({ profilId: '5', liste: ONERILER });
  });

  it('kartta alan, zorluk, hafta, puan; Gemini projesinde "✨ Sana özel" rozeti var', async () => {
    vi.mocked(api.onerileriGetir).mockResolvedValue(ONERILER);
    ac('/oneriler/5');
    await screen.findByRole('heading', { name: 'Sana uygun 10 proje' });
    const [ilk, ikinci] = oneriKartlari();
    expect(ilk).toHaveTextContent('Proje 1');
    expect(ilk).toHaveTextContent('Mobil Uygulama');
    expect(ilk).toHaveTextContent('Orta · 8 hafta');
    expect(ilk).toHaveTextContent('Düelloda');
    expect(ilk).not.toHaveTextContent('Sana özel');
    expect(within(ilk).getByRole('img', { name: 'Puan 99' })).toBeInTheDocument();
    expect(ikinci).toHaveTextContent('✨ Sana özel');
    expect(ikinci).toHaveTextContent('Zor · 8 hafta');
    // Düelloya girmeyen 9. ve 10. proje "Yedek"
    expect(oneriKartlari()[8]).toHaveTextContent('Yedek');
    expect(oneriKartlari()[9]).toHaveTextContent('Yedek');
    expect(oneriKartlari()[7]).toHaveTextContent('Düelloda');
  });

  it('karta dokununca ayrıntı açılır, tekrar dokununca kapanır', async () => {
    vi.mocked(api.onerileriGetir).mockResolvedValue(ONERILER);
    ac('/oneriler/5');
    await screen.findByRole('heading', { name: 'Sana uygun 10 proje' });
    const dugme = within(oneriKartlari()[0]).getAllByRole('button')[0];
    expect(dugme).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(dugme);
    expect(dugme).toHaveAttribute('aria-expanded', 'true');
    const kart = oneriKartlari()[0];
    for (const yazi of ['Proje 1 ne yapar', 'Öğrenciler', 'Bir uygulama', 'Kampüste dene', 'Sadece ortalama', 'Anlık bildirim', 'Sana uyumu', 'Yapılabilirliği', 'Özgünlüğü']) {
      expect(kart).toHaveTextContent(yazi);
    }

    await userEvent.click(dugme);
    expect(kart).not.toHaveTextContent('Proje 1 ne yapar');
  });

  it('sunucunun boş gönderdiği bilgiler ayrıntıda gösterilmez', async () => {
    const eksik = proje(1, { kim: null, cikti: null, kolay: null, efsane: null, puan_uyum: null, puan_yapilabilirlik: null, puan_ozgunluk: null, puan_toplam: null });
    vi.mocked(api.onerileriGetir).mockResolvedValue([eksik]);
    ac('/oneriler/5');
    await screen.findByRole('heading', { name: 'Sana uygun 1 proje' });
    expect(screen.getByRole('img', { name: 'Puan 0' })).toBeInTheDocument();
    await userEvent.click(within(oneriKartlari()[0]).getAllByRole('button')[0]);
    const kart = oneriKartlari()[0];
    expect(kart).toHaveTextContent('Proje 1 ne yapar');
    for (const yazi of ['Kimin işine yarar', 'Sonunda ne çıkar', 'Kolay mod', 'Efsane mod', 'Puan']) {
      expect(within(kart).queryByRole('heading', { name: yazi })).not.toBeInTheDocument();
    }
  });

  it('tarayıcıda saklı liste varsa sunucuya hiç gitmez', async () => {
    akisYaz('oneriler', { profilId: '5', liste: ONERILER });
    ac('/oneriler/5');
    expect(screen.getByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
    expect(api.onerileriGetir).not.toHaveBeenCalled();
    expect(api.onerileriUret).not.toHaveBeenCalled();
  });

  it('"Düelloyu başlat" düello ekranını açar', async () => {
    akisYaz('oneriler', { profilId: '5', liste: ONERILER });
    vi.mocked(api.duellolariGetir).mockResolvedValue([]);
    ac('/oneriler/5');
    await userEvent.click(screen.getByRole('button', { name: 'Düelloyu başlat' }));
    expect(await screen.findByRole('heading', { name: 'Çeyrek final 1/4' })).toBeInTheDocument();
  });

  it('hata olursa mesaj gösterir; "Tekrar dene" yeniden ister', async () => {
    vi.mocked(api.onerileriUret)
      .mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0))
      .mockResolvedValueOnce(ONERILER);
    ac({ pathname: '/oneriler/5', state: { yeniUret: true } });
    expect(await screen.findByRole('heading', { name: 'Projeler getirilemedi' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor.');
    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
  });

  it('hata ekranındaki "Profile dön" profil ekranını açar', async () => {
    vi.mocked(api.onerileriUret).mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0));
    ac({ pathname: '/oneriler/5', state: { yeniUret: true } });
    await userEvent.click(await screen.findByRole('button', { name: 'Profile dön' }));
    expect(await screen.findByRole('heading', { name: 'Doğru anladık mı?' })).toBeInTheDocument();
  });

  it('oturum düştüyse (401) girişe gönderir', async () => {
    vi.mocked(api.onerileriGetir).mockImplementation(async () => {
      api.cikisYap();
      throw new SunucuHatasi('Oturumun süresi doldu, tekrar giriş yap.', 401);
    });
    ac('/oneriler/5');
    expect(await screen.findByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });
});

// --- Düello ------------------------------------------------------------------

// ONERILER'de puan sırası: Proje 1 (41), Kantin Sırası Tahmini (42), Proje 3 (43) … Proje 8 (48).
// GET /duello cevabındaki bir maç
function oynanan(no, kazanan, kaybeden, tur) {
  return { id: no, profil_id: 5, kazanan_proje_id: kazanan, kaybeden_proje_id: kaybeden, tur };
}

function ilerleme() {
  return Number(screen.getByRole('progressbar', { name: 'Düello' }).getAttribute('aria-valuenow'));
}

// Düello ekranı yüklenene kadar bekler (önce oynanan maçlar sunucudan istenir).
async function duelloAc(adres = '/duello/5') {
  ac(adres);
  await screen.findByRole('progressbar', { name: 'Düello' });
}

async function sec(baslik) {
  await userEvent.click(screen.getByRole('button', { name: `Bunu seç: ${baslik}` }));
}

describe('Düello', () => {
  beforeEach(() => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    akisYaz('profil', { ...PROFIL, onaylandi: true });
    akisYaz('oneriler', { profilId: '5', liste: ONERILER });
    vi.mocked(api.duellolariGetir).mockResolvedValue([]);
    vi.mocked(api.duelloKaydet).mockImplementation(async (secim) => ({ id: 1, ...secim }));
  });

  it('açılırken oynanan maçlar sunucudan istenir (GET /duello)', async () => {
    ac('/duello/5');
    expect(screen.getByRole('heading', { name: 'Düello hazırlanıyor' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Çeyrek final 1/4' })).toBeInTheDocument();
    expect(api.duellolariGetir).toHaveBeenCalledWith('5');
  });

  it('ilk maç çeyrek final 1/4: en yüksek puanlı proje ile 8. proje', async () => {
    await duelloAc();
    expect(screen.getByRole('heading', { name: 'Çeyrek final 1/4' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proje 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proje 8' })).toBeInTheDocument();
    expect(ilerleme()).toBe(0);
  });

  it('seçim POST /duello ile kaydedilir ve sonraki maça geçilir', async () => {
    await duelloAc();
    await sec('Proje 8');

    expect(await screen.findByRole('heading', { name: 'Çeyrek final 2/4' })).toBeInTheDocument();
    expect(api.duelloKaydet).toHaveBeenCalledWith({ profil_id: 5, kazanan_proje_id: 48, kaybeden_proje_id: 41, tur: 'ceyrek' });
    expect(screen.getByRole('heading', { name: 'Proje 4' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proje 5' })).toBeInTheDocument();
    expect(ilerleme()).toBe(1);
  });

  it('7 seçim: 4 çeyrek final, 2 yarı final, final; sonunda şampiyon görünür', async () => {
    await duelloAc();
    await sec('Proje 1');
    await sec('Proje 4');
    await sec('Kantin Sırası Tahmini');
    await sec('Proje 3');

    expect(await screen.findByRole('heading', { name: 'Yarı final 1/2' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proje 1' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Proje 4' })).toBeInTheDocument();
    await sec('Proje 1');
    expect(await screen.findByRole('heading', { name: 'Yarı final 2/2' })).toBeInTheDocument();
    await sec('Kantin Sırası Tahmini');

    expect(await screen.findByRole('heading', { name: 'Final' })).toBeInTheDocument();
    await sec('Kantin Sırası Tahmini');

    expect(await screen.findByRole('heading', { name: 'Şampiyon belli oldu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kantin Sırası Tahmini' })).toBeInTheDocument();
    expect(screen.getByText('Şampiyon')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bunu seç/ })).not.toBeInTheDocument();
    expect(ilerleme()).toBe(7);
    expect(api.duelloKaydet.mock.calls.map(([s]) => s.tur)).toEqual(['ceyrek', 'ceyrek', 'ceyrek', 'ceyrek', 'yari', 'yari', 'final']);
    expect(api.duelloKaydet).toHaveBeenLastCalledWith({ profil_id: 5, kazanan_proje_id: 42, kaybeden_proje_id: 41, tur: 'final' });
  });

  it('sunucuda oynanmış maçlar varsa kaldığı maçtan devam eder', async () => {
    vi.mocked(api.duellolariGetir).mockResolvedValue([oynanan(1, 41, 48, 'ceyrek'), oynanan(2, 44, 45, 'ceyrek')]);
    await duelloAc();
    expect(screen.getByRole('heading', { name: 'Çeyrek final 3/4' })).toBeInTheDocument();
    expect(ilerleme()).toBe(2);
  });

  it('düello bitmişse doğrudan şampiyon görünür', async () => {
    vi.mocked(api.duellolariGetir).mockResolvedValue([
      oynanan(1, 41, 48, 'ceyrek'),
      oynanan(2, 44, 45, 'ceyrek'),
      oynanan(3, 42, 47, 'ceyrek'),
      oynanan(4, 43, 46, 'ceyrek'),
      oynanan(5, 41, 44, 'yari'),
      oynanan(6, 42, 43, 'yari'),
      oynanan(7, 42, 41, 'final'),
    ]);
    ac('/duello/5');
    expect(await screen.findByRole('heading', { name: 'Şampiyon belli oldu' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kantin Sırası Tahmini' })).toBeInTheDocument();
  });

  it('tarayıcıda hiçbir şey yokken (başka sekme) öneriler ve maçlar sunucudan gelir', async () => {
    sessionStorage.clear();
    vi.mocked(api.onerileriGetir).mockResolvedValue(ONERILER);
    vi.mocked(api.duellolariGetir).mockResolvedValue([oynanan(1, 41, 48, 'ceyrek')]);
    await duelloAc();
    expect(api.onerileriGetir).toHaveBeenCalledWith('5');
    expect(screen.getByRole('heading', { name: 'Çeyrek final 2/4' })).toBeInTheDocument();
    expect(akisOku('oneriler')).toEqual({ profilId: '5', liste: ONERILER });
  });

  it('henüz öneri yoksa öneriler ekranına gider', async () => {
    akisYaz('oneriler', null);
    vi.mocked(api.onerileriGetir).mockResolvedValue([]);
    vi.mocked(api.onerileriUret).mockReturnValue(new Promise(() => {}));
    ac('/duello/5');
    expect(await screen.findByRole('heading', { name: 'Projelerin hazırlanıyor' })).toBeInTheDocument();
  });

  it('maçlar alınamazsa mesaj gösterir; "Tekrar dene" yeniden ister', async () => {
    vi.mocked(api.duellolariGetir)
      .mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0))
      .mockResolvedValueOnce([]);
    ac('/duello/5');
    expect(await screen.findByRole('heading', { name: 'Düello açılamadı' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor.');
    await userEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByRole('heading', { name: 'Çeyrek final 1/4' })).toBeInTheDocument();
  });

  it('"İçerik" projenin ayrıntısını açar', async () => {
    await duelloAc();
    const [dugme] = screen.getAllByRole('button', { name: 'İçerik' });
    await userEvent.click(dugme);
    expect(dugme).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Proje 1 ne yapar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'İçeriği gizle' })).toBeInTheDocument();
  });

  it('kaydedilirken iki kart da kilitlenir, ikinci kez gönderilemez', async () => {
    vi.mocked(api.duelloKaydet).mockReturnValue(new Promise(() => {}));
    await duelloAc();
    await sec('Proje 1');
    expect(screen.getByRole('button', { name: 'Bunu seç: Proje 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bunu seç: Proje 8' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bunu seç: Proje 8' }));
    expect(api.duelloKaydet).toHaveBeenCalledTimes(1);
  });

  it('sunucu seçimi kabul etmezse (400) mesajını gösterir, aynı maçta kalır', async () => {
    vi.mocked(api.duelloKaydet).mockRejectedValueOnce(new SunucuHatasi('41 numaralı proje daha önce elendi.', 400));
    await duelloAc();
    await sec('Proje 1');
    expect(await screen.findByRole('alert')).toHaveTextContent('41 numaralı proje daha önce elendi.');
    expect(screen.getByRole('heading', { name: 'Çeyrek final 1/4' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bunu seç: Proje 1' })).toBeEnabled();
    expect(ilerleme()).toBe(0);
  });

  it('oturum düştüyse (401) girişe gönderir', async () => {
    vi.mocked(api.duelloKaydet).mockImplementation(async () => {
      api.cikisYap();
      throw new SunucuHatasi('Oturumun süresi doldu, tekrar giriş yap.', 401);
    });
    await duelloAc();
    await sec('Proje 1');
    expect(await screen.findByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });

  it('geri düğmesi öneriler ekranına döner', async () => {
    await duelloAc();
    await userEvent.click(screen.getByRole('button', { name: '← Geri' }));
    expect(await screen.findByRole('heading', { name: 'Sana uygun 10 proje' })).toBeInTheDocument();
  });
});

// --- Sürpriz proje -----------------------------------------------------------

describe('Sürpriz proje', () => {
  beforeEach(() => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    akisYaz('oneriler', { profilId: '5', liste: ONERILER });
  });

  it('"🎁 Sürpriz proje" GET /surpriz ile tek projeyi kart olarak gösterir', async () => {
    vi.mocked(api.surprizGetir).mockResolvedValue(
      proje(60, { baslik: 'Kampüs Bitki Takibi', alan: 'gomulu_iot', alan_adi: 'Gömülü Sistemler ve IoT', surpriz: true, duelloda: false }),
    );
    ac('/oneriler/5');
    await userEvent.click(screen.getByRole('button', { name: '🎁 Sürpriz proje' }));

    expect(await screen.findByRole('heading', { name: 'Kampüs Bitki Takibi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '🎁 Sürpriz proje' })).toBeInTheDocument();
    expect(screen.getByText('Sürpriz')).toBeInTheDocument();
    expect(api.surprizGetir).toHaveBeenCalledWith('5');
    expect(screen.queryByRole('button', { name: '🎁 Sürpriz proje' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'İçerik' }));
    expect(screen.getByText('Proje 60 ne yapar')).toBeInTheDocument();
  });

  it('profil onaylı değilse (400) ya da uygun proje yoksa (404) sunucunun mesajını gösterir', async () => {
    vi.mocked(api.surprizGetir)
      .mockRejectedValueOnce(new SunucuHatasi('Önce profilini onaylaman gerekiyor.', 400))
      .mockRejectedValueOnce(new SunucuHatasi('Şu an sana uygun bir sürpriz proje bulunamadı.', 404));
    ac('/oneriler/5');
    await userEvent.click(screen.getByRole('button', { name: '🎁 Sürpriz proje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Önce profilini onaylaman gerekiyor.');

    await userEvent.click(screen.getByRole('button', { name: '🎁 Sürpriz proje' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Şu an sana uygun bir sürpriz proje bulunamadı.');
    expect(screen.getByRole('button', { name: '🎁 Sürpriz proje' })).toBeEnabled();
  });
});

// --- Sonuç -------------------------------------------------------------------

// Bitmiş bir düello: şampiyon Kantin Sırası Tahmini (42).
const TAM_DUELLO = [
  oynanan(1, 41, 48, 'ceyrek'),
  oynanan(2, 44, 45, 'ceyrek'),
  oynanan(3, 42, 47, 'ceyrek'),
  oynanan(4, 43, 46, 'ceyrek'),
  oynanan(5, 41, 44, 'yari'),
  oynanan(6, 42, 43, 'yari'),
  oynanan(7, 42, 41, 'final'),
];

function adimListesi(bitenler = []) {
  // Sunucu sıralı gönderir; sıralamayı da denemek için karışık
  return [3, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((sira) => ({
    sira,
    baslik: `Adım ${sira}`,
    aciklama: `Adım ${sira} açıklaması`,
    tamamlandi: bitenler.includes(sira),
    tamamlanma_tarihi: null,
  }));
}

const HARITA = { secim_id: 3, proje_id: 42, zorluk_modu: 'efsane', adimlar: adimListesi([1, 2, 3]) };

describe('Sonuç', () => {
  beforeEach(() => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    akisYaz('oneriler', { profilId: '5', liste: ONERILER });
    vi.mocked(api.duellolariGetir).mockResolvedValue(TAM_DUELLO);
    vi.mocked(api.haritaGetir).mockResolvedValue(HARITA);
    vi.mocked(api.projeGetir).mockResolvedValue(ONERILER.find((p) => p.id === 42));
  });

  it('şampiyon ekranındaki "Devam et" sonuç ekranını açar', async () => {
    ac('/duello/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Devam et' }));
    expect(await screen.findByRole('heading', { name: 'Zorluğunu seç' })).toBeInTheDocument();
  });

  it('şampiyon ve üç zorluk kartı görünür: kolay ve efsane projenin metinleri, orta projenin kendisi', async () => {
    ac('/sonuc/5');
    expect(await screen.findByRole('heading', { name: 'Zorluğunu seç' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kantin Sırası Tahmini' })).toBeInTheDocument();
    expect(screen.getByText('Şampiyon')).toBeInTheDocument();

    const [kolay, orta, efsane] = screen.getAllByRole('radio');
    expect(kolay.closest('label')).toHaveTextContent('Kolay');
    expect(kolay.closest('label')).toHaveTextContent('Sadece ortalama');
    expect(orta.closest('label')).toHaveTextContent('Projenin kendisi');
    expect(orta.closest('label')).toHaveTextContent('Proje 2 ne yapar');
    expect(efsane.closest('label')).toHaveTextContent('Efsane');
    expect(efsane.closest('label')).toHaveTextContent('Anlık bildirim');
    expect(orta).toBeChecked();
  });

  it('"Bu projeyi seç" POST /secim gönderir; beklerken bekleme, bitince haritaya geçer', async () => {
    let bitir;
    vi.mocked(api.secimYap).mockReturnValue(new Promise((cozum) => (bitir = cozum)));
    ac('/sonuc/5');
    await screen.findByRole('heading', { name: 'Zorluğunu seç' });
    await userEvent.click(screen.getByRole('radio', { name: /Efsane/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Bu projeyi seç' }));

    expect(screen.getByRole('heading', { name: 'Görev haritan hazırlanıyor' })).toBeInTheDocument();
    expect(api.secimYap).toHaveBeenCalledWith({ proje_id: 42, zorluk_modu: 'efsane' });
    bitir(HARITA);

    expect(await screen.findByRole('heading', { name: 'Görev haritan' })).toBeInTheDocument();
    expect(api.haritaGetir).toHaveBeenCalledWith('3');
  });

  it('harita hazırlanamazsa mesajı gösterir; "Zorluk seçimine dön" geri götürür, "Tekrar dene" yeniden ister', async () => {
    vi.mocked(api.secimYap)
      .mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0))
      .mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0))
      .mockResolvedValueOnce(HARITA);
    ac('/sonuc/5');
    await userEvent.click(await screen.findByRole('button', { name: 'Bu projeyi seç' }));
    expect(await screen.findByRole('heading', { name: 'Görev haritası hazırlanamadı' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor.');

    await userEvent.click(screen.getByRole('button', { name: 'Zorluk seçimine dön' }));
    expect(screen.getByRole('heading', { name: 'Zorluğunu seç' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bu projeyi seç' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }));
    expect(await screen.findByRole('heading', { name: 'Görev haritan' })).toBeInTheDocument();
    expect(api.secimYap).toHaveBeenCalledTimes(3);
  });

  it('düello bitmediyse düelloya döner', async () => {
    vi.mocked(api.duellolariGetir).mockResolvedValue(TAM_DUELLO.slice(0, 2));
    ac('/sonuc/5');
    expect(await screen.findByRole('heading', { name: 'Çeyrek final 3/4' })).toBeInTheDocument();
  });

  it('tarayıcıda hiçbir şey yokken (başka sekme) öneriler ve maçlar sunucudan gelir', async () => {
    sessionStorage.clear();
    vi.mocked(api.onerileriGetir).mockResolvedValue(ONERILER);
    ac('/sonuc/5');
    expect(await screen.findByRole('heading', { name: 'Zorluğunu seç' })).toBeInTheDocument();
    expect(api.onerileriGetir).toHaveBeenCalledWith('5');
  });
});

// --- Görev haritası ----------------------------------------------------------

function adimKutusu(sira) {
  // Adı "4. Adım 4Adım 4 açıklaması" gibi; (?!\d): 1. adım 10, 11, 12 ile karışmasın
  return screen.getByRole('checkbox', { name: new RegExp(`^${sira}\\. Adım ${sira}(?!\\d)`) });
}

function haritaIlerlemesi() {
  return screen.getByRole('progressbar', { name: 'Görev haritası' });
}

describe('Görev haritası', () => {
  beforeEach(() => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    vi.mocked(api.haritaGetir).mockResolvedValue(HARITA);
    vi.mocked(api.projeGetir).mockResolvedValue(ONERILER.find((p) => p.id === 42));
    vi.mocked(api.adimIsaretle).mockImplementation(async (secimId, { sira, tamamlandi }) => ({
      ...HARITA,
      adimlar: HARITA.adimlar.map((a) => (a.sira === sira ? { ...a, tamamlandi } : a)),
    }));
  });

  it('açılışta GET /harita; 12 adım sırayla, işaretliler işaretli; üstte "3/12 tamamlandı"', async () => {
    ac('/harita/3');
    expect(await screen.findByRole('heading', { name: 'Görev haritan' })).toBeInTheDocument();
    expect(api.haritaGetir).toHaveBeenCalledWith('3');

    const kutular = screen.getAllByRole('checkbox');
    expect(kutular).toHaveLength(12);
    expect(kutular.map((k) => k.closest('label').querySelector('b').textContent)).toEqual(
      Array.from({ length: 12 }, (_, i) => `${i + 1}. Adım ${i + 1}`),
    );
    expect(adimKutusu(1)).toBeChecked();
    expect(adimKutusu(4)).not.toBeChecked();
    expect(screen.getByText('Adım 4 açıklaması')).toBeInTheDocument();
    expect(haritaIlerlemesi()).toHaveTextContent('3/12 tamamlandı');
    expect(await screen.findByText('Kantin Sırası Tahmini')).toBeInTheDocument();
    expect(screen.getByText(/Efsane mod/)).toBeInTheDocument();
  });

  it('kutu işaretlenince PUT { sira, tamamlandi: true }; ilerleme artar', async () => {
    ac('/harita/3');
    await screen.findByRole('heading', { name: 'Görev haritan' });
    await userEvent.click(adimKutusu(4));

    expect(api.adimIsaretle).toHaveBeenCalledWith('3', { sira: 4, tamamlandi: true });
    await waitFor(() => expect(haritaIlerlemesi()).toHaveTextContent('4/12 tamamlandı'));
    expect(adimKutusu(4)).toBeChecked();
  });

  it('işaret kaldırılınca tamamlandi: false gider', async () => {
    ac('/harita/3');
    await screen.findByRole('heading', { name: 'Görev haritan' });
    await userEvent.click(adimKutusu(2));

    expect(api.adimIsaretle).toHaveBeenCalledWith('3', { sira: 2, tamamlandi: false });
    await waitFor(() => expect(haritaIlerlemesi()).toHaveTextContent('2/12 tamamlandı'));
    expect(adimKutusu(2)).not.toBeChecked();
  });

  it('kaydedilirken kutular kilitlenir', async () => {
    vi.mocked(api.adimIsaretle).mockReturnValue(new Promise(() => {}));
    ac('/harita/3');
    await screen.findByRole('heading', { name: 'Görev haritan' });
    await userEvent.click(adimKutusu(4));
    expect(adimKutusu(4)).toBeChecked();
    expect(adimKutusu(5)).toBeDisabled();
    await userEvent.click(adimKutusu(5));
    expect(api.adimIsaretle).toHaveBeenCalledTimes(1);
  });

  it('sunucu kabul etmezse işaret geri alınır, mesaj görünür', async () => {
    vi.mocked(api.adimIsaretle).mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0));
    ac('/harita/3');
    await screen.findByRole('heading', { name: 'Görev haritan' });
    await userEvent.click(adimKutusu(4));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor.');
    expect(adimKutusu(4)).not.toBeChecked();
    expect(haritaIlerlemesi()).toHaveTextContent('3/12 tamamlandı');
    expect(adimKutusu(5)).toBeEnabled();
  });

  it('sayfa yeniden açılınca işaretler sunucudan gelir, kaybolmaz', async () => {
    vi.mocked(api.haritaGetir).mockResolvedValue({ ...HARITA, adimlar: adimListesi([1, 2, 3, 4, 9]) });
    ac('/harita/3');
    await screen.findByRole('heading', { name: 'Görev haritan' });
    expect(adimKutusu(9)).toBeChecked();
    expect(haritaIlerlemesi()).toHaveTextContent('5/12 tamamlandı');
  });

  it('harita bulunamazsa (404) mesaj gösterir', async () => {
    vi.mocked(api.haritaGetir).mockRejectedValue(new SunucuHatasi('Seçim bulunamadı.', 404));
    ac('/harita/99');
    expect(await screen.findByRole('heading', { name: 'Görev haritası açılamadı' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Seçim bulunamadı.');
  });

  it('proje başlığı alınamazsa harita yine açılır', async () => {
    vi.mocked(api.projeGetir).mockRejectedValue(new SunucuHatasi('Proje bulunamadı.', 404));
    ac('/harita/3');
    expect(await screen.findByRole('heading', { name: 'Görev haritan' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(12);
  });

  it('oturum düştüyse (401) girişe gönderir', async () => {
    vi.mocked(api.haritaGetir).mockImplementation(async () => {
      api.cikisYap();
      throw new SunucuHatasi('Oturumun süresi doldu, tekrar giriş yap.', 401);
    });
    ac('/harita/3');
    expect(await screen.findByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
  });
});
