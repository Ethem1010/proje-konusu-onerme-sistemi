import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUNUCU_ADRESI, ben, bolumleriGetir, cikisYap, girisYap, jetonuAl, jetonuKaydet, kullaniciAdi } from './api.js';

function sahteCevap(durum, govde) {
  return Promise.resolve({ ok: durum >= 200 && durum < 300, status: durum, json: () => Promise.resolve(govde) });
}

afterEach(() => vi.unstubAllGlobals());

describe('api', () => {
  it('bölüm listesini sunucu adresinden ister', async () => {
    const liste = [{ id: 1, ad: 'Bilgisayar Mühendisliği', grup: 'muhendislik' }];
    const fetchSahte = vi.fn(() => sahteCevap(200, liste));
    vi.stubGlobal('fetch', fetchSahte);

    expect(await bolumleriGetir()).toEqual(liste);
    expect(fetchSahte).toHaveBeenCalledWith(`${SUNUCU_ADRESI}/bolumler`, expect.objectContaining({ method: 'GET' }));
  });

  it('girişte e-posta ve şifreyi JSON olarak gönderir', async () => {
    const fetchSahte = vi.fn(() => sahteCevap(200, { erisim_jetonu: 'j', ad: 'Ayşe' }));
    vi.stubGlobal('fetch', fetchSahte);

    await girisYap({ eposta: 'ayse@ornek.com', sifre: 'gizli123' });
    const [adres, ayar] = fetchSahte.mock.calls[0];
    expect(adres).toBe(`${SUNUCU_ADRESI}/auth/giris`);
    expect(ayar.method).toBe('POST');
    expect(ayar.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(ayar.body)).toEqual({ eposta: 'ayse@ornek.com', sifre: 'gizli123' });
  });

  it('sunucunun hata cümlesini olduğu gibi verir', async () => {
    vi.stubGlobal('fetch', () => sahteCevap(401, { detail: 'E-posta veya şifre hatalı.' }));
    await expect(girisYap({ eposta: 'a@b.com', sifre: 'x' })).rejects.toMatchObject({
      message: 'E-posta veya şifre hatalı.',
      durum: 401,
    });
  });

  it('alan kontrolü hatasında (422) teknik metin yerine sade cümle verir', async () => {
    vi.stubGlobal('fetch', () => sahteCevap(422, { detail: [{ loc: ['body', 'eposta'], msg: 'x' }] }));
    await expect(girisYap({ eposta: 'a', sifre: 'x' })).rejects.toThrow('Bilgileri kontrol edip tekrar dene.');
  });

  it('sunucuya ulaşılamazsa anlaşılır mesaj verir', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(bolumleriGetir()).rejects.toMatchObject({ durum: 0, message: expect.stringContaining('ulaşılamıyor') });
  });

  it('jetonlu isteklerde jetonu Authorization başlığına koyar', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    const fetchSahte = vi.fn(() => sahteCevap(200, { id: 1 }));
    vi.stubGlobal('fetch', fetchSahte);

    await ben();
    expect(fetchSahte.mock.calls[0][1].headers.Authorization).toBe('Bearer abc');
  });

  it('jeton kaydedilir ve çıkışta silinir', () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    expect(jetonuAl()).toBe('abc');
    expect(kullaniciAdi()).toBe('Ayşe');
    cikisYap();
    expect(jetonuAl()).toBeNull();
  });
});
