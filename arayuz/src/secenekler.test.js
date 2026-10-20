import { describe, expect, it } from 'vitest';
import { ALANLAR, BECERILER, ZORLUKLAR, alanBul } from './secenekler.js';

describe('seçenekler', () => {
  it('veri tablosundaki 12 ilgi alanı; kodlar ve renkler benzersiz', () => {
    expect(ALANLAR).toHaveLength(12);
    expect(new Set(ALANLAR.map((a) => a.kod)).size).toBe(12);
    expect(new Set(ALANLAR.map((a) => a.renk)).size).toBe(12);
    expect(ALANLAR.every((a) => a.renk >= 1 && a.renk <= 12)).toBe(true);
  });

  it('veri tablosundaki 32 beceri, benzersiz', () => {
    expect(BECERILER).toHaveLength(32);
    expect(new Set(BECERILER).size).toBe(32);
  });

  it('zorluk 1 kolay, 3 zor', () => {
    expect(ZORLUKLAR).toEqual({ 1: 'Kolay', 2: 'Orta', 3: 'Zor' });
  });

  it('alan hem koduyla hem adıyla bulunur', () => {
    expect(alanBul('gomulu_iot').ad).toBe('Gömülü Sistemler ve IoT');
    expect(alanBul('Gömülü Sistemler ve IoT').kod).toBe('gomulu_iot');
    expect(alanBul('yok')).toBeNull();
  });
});
