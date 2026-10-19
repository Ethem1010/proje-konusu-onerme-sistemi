import { describe, expect, it } from 'vitest';
import { anlatHatasi, bolumleriGrupla, girisHatasi, kayitHatasi } from './dogrulama.js';

describe('girisHatasi', () => {
  it('boş alan varsa uyarır', () => {
    expect(girisHatasi({ eposta: '', sifre: 'gizli123' })).toBe('E-posta ve şifreni yaz.');
    expect(girisHatasi({ eposta: 'a@b.com', sifre: '' })).toBe('E-posta ve şifreni yaz.');
  });
  it('dolu ise sorun yok', () => {
    expect(girisHatasi({ eposta: 'a@b.com', sifre: 'x' })).toBeNull();
  });
});

describe('kayitHatasi', () => {
  const iyi = { ad: 'Ayşe Yılmaz', eposta: 'ayse@ornek.com', sifre: 'gizli123' };

  it('doğru bilgide sorun yok', () => {
    expect(kayitHatasi(iyi)).toBeNull();
  });
  it('ad en az 2 harf', () => {
    expect(kayitHatasi({ ...iyi, ad: ' A ' })).toBe('Adını ve soyadını yaz.');
  });
  it('e-posta sunucudaki kalıba uymalı', () => {
    expect(kayitHatasi({ ...iyi, eposta: 'ayse' })).toBe('Geçerli bir e-posta adresi yaz.');
    expect(kayitHatasi({ ...iyi, eposta: 'ayse@ornek' })).toBe('Geçerli bir e-posta adresi yaz.');
  });
  it('şifre en az 6 karakter', () => {
    expect(kayitHatasi({ ...iyi, sifre: '12345' })).toBe('Şifre en az 6 karakter olmalı.');
  });
  it('şifre 72 baytı geçemez (Türkçe harf 2 bayt)', () => {
    expect(kayitHatasi({ ...iyi, sifre: 'a'.repeat(72) })).toBeNull();
    expect(kayitHatasi({ ...iyi, sifre: 'ş'.repeat(37) })).toBe('Şifre çok uzun.');
  });
});

describe('anlatHatasi', () => {
  const iyi = {
    bolum: '1',
    bolumAdi: '',
    saat: '8',
    ekip: '3',
    tercih: 'uretmek',
    metin: 'Web sitesi yapmayı seviyorum, React biliyorum.',
  };

  it('doğru bilgide sorun yok', () => {
    expect(anlatHatasi(iyi)).toBeNull();
  });
  it('bölüm seçilmeli', () => {
    expect(anlatHatasi({ ...iyi, bolum: '' })).toBe('Bölümünü seç.');
  });
  it('"Diğer" seçilince bölüm adı en az 3 harf', () => {
    expect(anlatHatasi({ ...iyi, bolum: 'diger', bolumAdi: 'ab' })).toBe('Bölümünün adını yaz.');
    expect(anlatHatasi({ ...iyi, bolum: 'diger', bolumAdi: 'Gastronomi' })).toBeNull();
  });
  it('haftalık saat en az 1', () => {
    for (const saat of ['', '0', 0, -2, '1.5']) {
      expect(anlatHatasi({ ...iyi, saat })).toBe('Haftada en az 1 saat ayırmalısın.');
    }
    expect(anlatHatasi({ ...iyi, saat: '1' })).toBeNull();
    expect(anlatHatasi({ ...iyi, saat: 40 })).toBeNull();
  });
  it('ekip en az 1 kişi', () => {
    for (const ekip of ['', '0', 0]) {
      expect(anlatHatasi({ ...iyi, ekip })).toBe('Ekip en az 1 kişi olmalı.');
    }
    expect(anlatHatasi({ ...iyi, ekip: '1' })).toBeNull();
  });
  it('tercih seçilmeli', () => {
    expect(anlatHatasi({ ...iyi, tercih: '' })).toBe('Tercihini seç.');
  });
  it('metin 20 karakterden kısaysa uyarır', () => {
    expect(anlatHatasi({ ...iyi, metin: 'Bilmiyorum.' })).toBe('Kendini birkaç cümleyle anlat.');
    expect(anlatHatasi({ ...iyi, metin: '   ' + 'a'.repeat(19) + '   ' })).toBe('Kendini birkaç cümleyle anlat.');
    expect(anlatHatasi({ ...iyi, metin: 'a'.repeat(20) })).toBeNull();
  });
});

describe('bolumleriGrupla', () => {
  it('mühendislikleri ve diğerlerini ayırır, sırayı korur', () => {
    const liste = [
      { id: 1, ad: 'Bilgisayar Mühendisliği', grup: 'muhendislik' },
      { id: 27, ad: 'İşletme', grup: 'diger' },
      { id: 2, ad: 'Yazılım Mühendisliği', grup: 'muhendislik' },
    ];
    const { muhendislik, diger } = bolumleriGrupla(liste);
    expect(muhendislik.map((b) => b.id)).toEqual([1, 2]);
    expect(diger.map((b) => b.id)).toEqual([27]);
  });
});
