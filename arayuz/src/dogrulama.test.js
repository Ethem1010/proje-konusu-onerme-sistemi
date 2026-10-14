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
  const uzun = 'Web sitesi yapmayı seviyorum, React biliyorum.';

  it('bölüm seçilmeli', () => {
    expect(anlatHatasi({ bolum: '', bolumAdi: '', metin: uzun })).toBe('Bölümünü seç.');
  });
  it('"Diğer" seçilince bölüm adı en az 3 harf', () => {
    expect(anlatHatasi({ bolum: 'diger', bolumAdi: 'ab', metin: uzun })).toBe('Bölümünün adını yaz.');
    expect(anlatHatasi({ bolum: 'diger', bolumAdi: 'Gastronomi', metin: uzun })).toBeNull();
  });
  it('metin 20 karakterden kısaysa uyarır', () => {
    expect(anlatHatasi({ bolum: '1', bolumAdi: '', metin: 'Bilmiyorum.' })).toBe('Kendini birkaç cümleyle anlat.');
    expect(anlatHatasi({ bolum: '1', bolumAdi: '', metin: '   ' + 'a'.repeat(19) + '   ' })).toBe(
      'Kendini birkaç cümleyle anlat.',
    );
    expect(anlatHatasi({ bolum: '1', bolumAdi: '', metin: 'a'.repeat(20) })).toBeNull();
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
