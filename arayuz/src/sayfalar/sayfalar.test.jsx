import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { akisOku, akisYaz } from '../akis.js';
import { SunucuHatasi } from '../api.js';
import * as api from '../api.js';
import { TASLAK_ANAHTARI } from './Anlat.jsx';
import Oneriler from './Oneriler.jsx';

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

  it('profil yoksa "Seni tanıyalım"a döner', async () => {
    ac('/profil/5');
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
  });

  it('adresteki numara saklanan profilden farklıysa da döner', async () => {
    akisYaz('profil', PROFIL);
    ac('/profil/9');
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

// Düello ekranı henüz yok; "Düelloyu başlat"ın hangi adrese geçtiğini görmek için yerine bir başlık konur.
function DuelloYeri() {
  const { profilId } = useParams();
  return <h1>Düello {profilId}</h1>;
}

function onerileriAc(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/oneriler/5', state }]}>
      <Routes>
        <Route path="/oneriler/:profilId" element={<Oneriler />} />
        <Route path="/duello/:profilId" element={<DuelloYeri />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Öneriler', () => {
  beforeEach(() => {
    api.jetonuKaydet({ erisim_jetonu: 'j', ad: 'Ayşe' });
    akisYaz('profil', { ...PROFIL, onaylandi: true });
  });

  it('profil yoksa "Seni tanıyalım"a döner, sunucuya gitmez', async () => {
    sessionStorage.clear();
    ac('/oneriler/5');
    expect(await screen.findByRole('heading', { name: 'Seni tanıyalım' })).toBeInTheDocument();
    expect(api.onerileriGetir).not.toHaveBeenCalled();
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
    expect(oneriKartlari()[9]).toHaveTextContent('Elendi');
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

  it('"Düelloyu başlat" düello ekranına geçer', async () => {
    akisYaz('oneriler', { profilId: '5', liste: ONERILER });
    onerileriAc();
    await userEvent.click(screen.getByRole('button', { name: 'Düelloyu başlat' }));
    expect(screen.getByRole('heading', { name: 'Düello 5' })).toBeInTheDocument();
  });

  it('hata olursa mesaj gösterir; "Tekrar dene" yeniden ister', async () => {
    vi.mocked(api.onerileriUret)
      .mockRejectedValueOnce(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0))
      .mockResolvedValueOnce(ONERILER);
    onerileriAc({ yeniUret: true });
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
