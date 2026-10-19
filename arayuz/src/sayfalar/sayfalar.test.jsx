import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { SunucuHatasi } from '../api.js';
import * as api from '../api.js';
import Anlat, { TASLAK_ANAHTARI } from './Anlat.jsx';

// Sunucu yerine sahte cevaplar; jeton işlemleri gerçek kalır.
vi.mock('../api.js', async (gercek) => ({
  ...(await gercek()),
  girisYap: vi.fn(),
  kayitOl: vi.fn(),
  bolumleriGetir: vi.fn(),
  profilOlustur: vi.fn(),
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

// Profil ekranı henüz yok; "Devam et"in hangi adrese geçtiğini görmek için yerine bir başlık konur.
function ProfilYeri() {
  const { id } = useParams();
  return <h1>Profil {id}</h1>;
}

function anlatAc() {
  return render(
    <MemoryRouter initialEntries={['/anlat']}>
      <Routes>
        <Route path="/anlat" element={<Anlat />} />
        <Route path="/profil/:id" element={<ProfilYeri />} />
      </Routes>
    </MemoryRouter>,
  );
}

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

  it('"Dönem projesi" seçilince sunucuya donem gider; dönen id ile profil ekranına geçer', async () => {
    vi.mocked(api.profilOlustur).mockResolvedValue({ id: 5, alanlar: [], istemedikleri: [], beceriler: [], onaylandi: false });
    anlatAc();
    await doldur();
    await userEvent.selectOptions(screen.getByLabelText('Proje türü'), 'Dönem projesi');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    expect(await screen.findByRole('heading', { name: 'Profil 5' })).toBeInTheDocument();
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
    vi.mocked(api.profilOlustur).mockResolvedValue({ id: 9 });
    anlatAc();
    await doldur({ bolum: 'diger', saat: '10', ekip: '1', tercih: 'arastirmak', metin: 'Yemek fotoğrafçılığını seviyorum, Excel biliyorum.' });
    await userEvent.type(screen.getByLabelText('Bölümünün adı'), ' Gastronomi ');
    await userEvent.selectOptions(screen.getByLabelText('Proje türü'), 'Bitirme projesi');
    await userEvent.selectOptions(screen.getByLabelText('Süre'), '16');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    expect(await screen.findByRole('heading', { name: 'Profil 9' })).toBeInTheDocument();
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
    anlatAc();
    await doldur();
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    const dugme = screen.getByRole('button', { name: 'Gönderiliyor…' });
    expect(dugme).toBeDisabled();
    await userEvent.click(dugme);
    expect(api.profilOlustur).toHaveBeenCalledTimes(1);

    bitir({ id: 5 });
    expect(await screen.findByRole('heading', { name: 'Profil 5' })).toBeInTheDocument();
  });

  it('sunucu hata verirse mesajı gösterir, ekranda kalır, yazılanlar kaybolmaz', async () => {
    vi.mocked(api.profilOlustur).mockRejectedValue(new SunucuHatasi('Sunucuya ulaşılamıyor.', 0));
    anlatAc();
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
    anlatAc();
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

  it('"Çıkış" jetonu siler ve girişe döner', async () => {
    ac('/anlat');
    await userEvent.click(screen.getByRole('button', { name: 'Çıkış' }));
    expect(screen.getByRole('heading', { name: 'Giriş yap' })).toBeInTheDocument();
    expect(api.jetonuAl()).toBeNull();
  });
});
