import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { SunucuHatasi } from '../api.js';
import * as api from '../api.js';
import { TASLAK_ANAHTARI } from './Anlat.jsx';

// Sunucu yerine sahte cevaplar; jeton işlemleri gerçek kalır.
vi.mock('../api.js', async (gercek) => ({
  ...(await gercek()),
  girisYap: vi.fn(),
  kayitOl: vi.fn(),
  bolumleriGetir: vi.fn(),
}));

const BOLUMLER = [
  { id: 1, ad: 'Bilgisayar Mühendisliği', grup: 'muhendislik' },
  { id: 2, ad: 'Makine Mühendisliği', grup: 'muhendislik' },
  { id: 27, ad: 'İşletme', grup: 'diger' },
];

function ac(adres) {
  return render(
    <MemoryRouter initialEntries={[adres]}>
      <App />
    </MemoryRouter>,
  );
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

  it('proje türleri ve 1-24 hafta süre seçenekleri var', async () => {
    ac('/anlat');
    const turler = [...screen.getByLabelText('Proje türü').options].map((o) => o.value);
    expect(turler).toEqual(['Ders ödevi', 'Dönem projesi', 'Bitirme projesi', 'Yarışma projesi', 'Kişisel proje']);
    const sureler = [...screen.getByLabelText('Süre').options].map((o) => Number(o.value));
    expect(sureler[0]).toBe(1);
    expect(sureler.at(-1)).toBe(24);
    await waitFor(() => expect(screen.getByLabelText('Bölüm')).toBeEnabled());
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
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());
    await userEvent.selectOptions(liste, '1');
    await userEvent.type(screen.getByLabelText(/Neyi seviyorsun/), 'Bilmiyorum.');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Kendini birkaç cümleyle anlat.');
  });

  it('doğru doldurulunca bilgileri saklar', async () => {
    ac('/anlat');
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());
    await userEvent.selectOptions(liste, 'diger');
    await userEvent.type(screen.getByLabelText('Bölümünün adı'), 'Gastronomi');
    await userEvent.selectOptions(screen.getByLabelText('Proje türü'), 'Bitirme projesi');
    await userEvent.selectOptions(screen.getByLabelText('Süre'), '16');
    await userEvent.type(screen.getByLabelText(/Neyi seviyorsun/), 'Yemek fotoğrafçılığını seviyorum, Excel biliyorum.');
    await userEvent.click(screen.getByRole('button', { name: 'Devam et' }));

    expect(screen.getByRole('status')).toHaveTextContent('Bilgilerin kaydedildi.');
    expect(JSON.parse(sessionStorage.getItem(TASLAK_ANAHTARI))).toEqual({
      bolum: 'diger',
      bolumId: null,
      bolumAdi: 'Gastronomi',
      tur: 'Bitirme projesi',
      sure: 16,
      metin: 'Yemek fotoğrafçılığını seviyorum, Excel biliyorum.',
    });
  });

  it('kaydedilen bilgiler sayfa yeniden açılınca yerinde durur', async () => {
    sessionStorage.setItem(
      TASLAK_ANAHTARI,
      JSON.stringify({ bolum: '27', bolumId: 27, bolumAdi: 'İşletme', tur: 'Kişisel proje', sure: 6, metin: 'Pazarlama ve marka işlerini seviyorum.' }),
    );
    ac('/anlat');
    const liste = screen.getByLabelText('Bölüm');
    await waitFor(() => expect(liste).toBeEnabled());

    expect(liste).toHaveValue('27');
    expect(screen.getByLabelText('Proje türü')).toHaveValue('Kişisel proje');
    expect(screen.getByLabelText('Süre')).toHaveValue('6');
    expect(screen.getByLabelText(/Neyi seviyorsun/)).toHaveValue('Pazarlama ve marka işlerini seviyorum.');
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
