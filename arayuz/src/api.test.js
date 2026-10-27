import { afterEach, describe, expect, it, vi } from 'vitest';
import { akisOku, akisYaz } from './akis.js';
import {
  SUNUCU_ADRESI,
  ben,
  bolumleriGetir,
  cikisYap,
  duelloKaydet,
  adimIsaretle,
  duellolariGetir,
  girisYap,
  haritaGetir,
  jetonuAl,
  jetonuKaydet,
  kullaniciAdi,
  onerileriGetir,
  onerileriUret,
  oturumDustu,
  profilGetir,
  profilOlustur,
  profilOnayla,
  projeGetir,
  secimYap,
  secimleriGetir,
  surprizGetir,
} from './api.js';

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

  it('profili jetonla POST /profil adresine gönderir, dönen profili verir', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    const profil = { id: 5, alanlar: [], istemedikleri: [], beceriler: [], onaylandi: false };
    const fetchSahte = vi.fn(() => sahteCevap(201, profil));
    vi.stubGlobal('fetch', fetchSahte);
    const govde = { bolum_id: 1, bolum_diger: null, proje_turu: 'donem', sure_hafta: 12, metin: 'x', haftalik_saat: 8, ekip: 3, tercih: 'uretmek' };

    expect(await profilOlustur(govde)).toEqual(profil);
    const [adres, ayar] = fetchSahte.mock.calls[0];
    expect(adres).toBe(`${SUNUCU_ADRESI}/profil`);
    expect(ayar.method).toBe('POST');
    expect(ayar.headers.Authorization).toBe('Bearer abc');
    expect(JSON.parse(ayar.body)).toEqual(govde);
  });

  it('jeton kaydedilir ve çıkışta silinir', () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    expect(jetonuAl()).toBe('abc');
    expect(kullaniciAdi()).toBe('Ayşe');
    cikisYap();
    expect(jetonuAl()).toBeNull();
  });

  it('çıkışta öğrencinin cevapları da silinir', () => {
    akisYaz('anlat', { metin: 'x' });
    akisYaz('profil', { id: 1 });
    cikisYap();
    expect(akisOku('anlat')).toBeNull();
    expect(akisOku('profil')).toBeNull();
  });

  it('giriş gerektiren istekte 401 gelirse jeton silinir', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    vi.stubGlobal('fetch', () => sahteCevap(401, { detail: 'Oturumun süresi doldu, tekrar giriş yap.' }));
    const hata = await profilOlustur({}).catch((h) => h);
    expect(hata).toMatchObject({ durum: 401, message: 'Oturumun süresi doldu, tekrar giriş yap.' });
    expect(oturumDustu(hata)).toBe(true);
    expect(jetonuAl()).toBeNull();
  });

  it('yanlış şifrede (giriş, jetonsuz istek) 401 jetonu silmez', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    vi.stubGlobal('fetch', () => sahteCevap(401, { detail: 'E-posta veya şifre hatalı.' }));
    await girisYap({ eposta: 'a@b.com', sifre: 'x' }).catch(() => {});
    expect(jetonuAl()).toBe('abc');
  });

  it('422 hatasında sunucunun kendi yazdığı kural cümlesi Türkçe gösterilir', async () => {
    const detail = [
      {
        type: 'value_error',
        loc: ['body'],
        msg: 'Value error, Bir alan hem ilgi alanlarında hem istemediklerinde olamaz.',
      },
    ];
    vi.stubGlobal('fetch', () => sahteCevap(422, { detail }));
    await expect(profilOnayla(5, { alanlar: [], istemedikleri: [], beceriler: [] })).rejects.toMatchObject({
      durum: 422,
      message: 'Bir alan hem ilgi alanlarında hem istemediklerinde olamaz.',
    });
  });

  it('onay PUT /profil/{id} ile alanları, istenmeyenleri ve becerileri gönderir', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    const fetchSahte = vi.fn(() => sahteCevap(200, { id: 5, onaylandi: true }));
    vi.stubGlobal('fetch', fetchSahte);

    const govde = { alanlar: [{ kod: 'web', ad: 'Web Geliştirme', puan: 4 }], istemedikleri: ['oyun'], beceriler: ['React'] };
    await profilOnayla(5, govde);
    const [adres, ayar] = fetchSahte.mock.calls[0];
    expect(adres).toBe(`${SUNUCU_ADRESI}/profil/5`);
    expect(ayar.method).toBe('PUT');
    expect(ayar.headers.Authorization).toBe('Bearer abc');
    expect(JSON.parse(ayar.body)).toEqual(govde);
  });

  it('öneriler GET ile kayıtlı hâli alınır, POST ile üretilir', async () => {
    const fetchSahte = vi.fn(() => sahteCevap(200, []));
    vi.stubGlobal('fetch', fetchSahte);

    await onerileriGetir(5);
    await onerileriUret(5);
    expect(fetchSahte.mock.calls[0][0]).toBe(`${SUNUCU_ADRESI}/oneriler/5`);
    expect(fetchSahte.mock.calls[0][1].method).toBe('GET');
    expect(fetchSahte.mock.calls[1][0]).toBe(`${SUNUCU_ADRESI}/oneriler/5`);
    expect(fetchSahte.mock.calls[1][1].method).toBe('POST');
  });

  it('düello seçimi jetonla POST /duello adresine gider', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    const secim = { profil_id: 5, kazanan_proje_id: 48, kaybeden_proje_id: 41, tur: 'ceyrek' };
    const fetchSahte = vi.fn(() => sahteCevap(201, { id: 1, ...secim }));
    vi.stubGlobal('fetch', fetchSahte);

    expect(await duelloKaydet(secim)).toEqual({ id: 1, ...secim });
    const [adres, ayar] = fetchSahte.mock.calls[0];
    expect(adres).toBe(`${SUNUCU_ADRESI}/duello`);
    expect(ayar.method).toBe('POST');
    expect(ayar.headers.Authorization).toBe('Bearer abc');
    expect(JSON.parse(ayar.body)).toEqual(secim);
  });

  it('oynanan düello maçları ve kayıtlı profil GET ile istenir', async () => {
    const fetchSahte = vi.fn(() => sahteCevap(200, []));
    vi.stubGlobal('fetch', fetchSahte);

    await duellolariGetir(5);
    await profilGetir(5);
    expect(fetchSahte.mock.calls.map(([adres, ayar]) => [adres, ayar.method])).toEqual([
      [`${SUNUCU_ADRESI}/duello/5`, 'GET'],
      [`${SUNUCU_ADRESI}/profil/5`, 'GET'],
    ]);
  });

  it('seçim POST /secim ile proje ve zorluk modunu gönderir', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    const harita = { secim_id: 3, proje_id: 12, zorluk_modu: 'efsane', adimlar: [] };
    const fetchSahte = vi.fn(() => sahteCevap(201, harita));
    vi.stubGlobal('fetch', fetchSahte);

    expect(await secimYap({ proje_id: 12, zorluk_modu: 'efsane' })).toEqual(harita);
    const [adres, ayar] = fetchSahte.mock.calls[0];
    expect(adres).toBe(`${SUNUCU_ADRESI}/secim`);
    expect(ayar.method).toBe('POST');
    expect(ayar.headers.Authorization).toBe('Bearer abc');
    expect(JSON.parse(ayar.body)).toEqual({ proje_id: 12, zorluk_modu: 'efsane' });
  });

  it('harita GET ile alınır, adım PUT ile { sira, tamamlandi } gönderilerek işaretlenir', async () => {
    const fetchSahte = vi.fn(() => sahteCevap(200, { secim_id: 3, adimlar: [] }));
    vi.stubGlobal('fetch', fetchSahte);

    await haritaGetir(3);
    await adimIsaretle(3, { sira: 4, tamamlandi: true });
    expect(fetchSahte.mock.calls[0][0]).toBe(`${SUNUCU_ADRESI}/harita/3`);
    expect(fetchSahte.mock.calls[0][1].method).toBe('GET');
    expect(fetchSahte.mock.calls[1][0]).toBe(`${SUNUCU_ADRESI}/harita/3`);
    expect(fetchSahte.mock.calls[1][1].method).toBe('PUT');
    expect(JSON.parse(fetchSahte.mock.calls[1][1].body)).toEqual({ sira: 4, tamamlandi: true });
  });

  it('öğrencinin seçtiği projeler jetonla GET /secimler ile istenir', async () => {
    jetonuKaydet({ erisim_jetonu: 'abc', ad: 'Ayşe' });
    const fetchSahte = vi.fn(() => sahteCevap(200, []));
    vi.stubGlobal('fetch', fetchSahte);

    await secimleriGetir();
    const [adres, ayar] = fetchSahte.mock.calls[0];
    expect(adres).toBe(`${SUNUCU_ADRESI}/secimler`);
    expect(ayar.method).toBe('GET');
    expect(ayar.headers.Authorization).toBe('Bearer abc');
  });

  it('sürpriz proje ve tek proje GET ile istenir', async () => {
    const fetchSahte = vi.fn(() => sahteCevap(200, { id: 60, surpriz: true }));
    vi.stubGlobal('fetch', fetchSahte);

    await surprizGetir(5);
    await projeGetir(60);
    expect(fetchSahte.mock.calls.map(([adres, ayar]) => [adres, ayar.method])).toEqual([
      [`${SUNUCU_ADRESI}/surpriz/5`, 'GET'],
      [`${SUNUCU_ADRESI}/projeler/60`, 'GET'],
    ]);
  });
});
