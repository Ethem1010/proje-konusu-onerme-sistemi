import { describe, expect, it } from 'vitest';
import { duelloProjeleri, MAC_SAYISI, maclar, sampiyon, siradakiMac, turAdi } from './duello.js';

// 10 öneri: puanı 100-no, ilk 8'i düelloda. Karışık sırayla.
const LISTE = [3, 1, 10, 2, 4, 9, 5, 6, 7, 8].map((no) => ({ id: no, puan_toplam: 100 - no, duelloda: no <= 8 }));
const PROJELER = duelloProjeleri(LISTE);
const id = (m) => [m.a?.id ?? null, m.b?.id ?? null];

describe('duello', () => {
  it('düelloya puanı en yüksek, duelloda olan 8 proje girer', () => {
    expect(PROJELER.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(duelloProjeleri([...LISTE, { id: 11, puan_toplam: 99.5, duelloda: false }])).toHaveLength(8);
  });

  it('çeyrek final 1-8, 4-5, 2-7, 3-6; sonraki turlar henüz belli değil', () => {
    const liste = maclar(PROJELER, []);
    expect(liste).toHaveLength(MAC_SAYISI);
    expect(liste.slice(0, 4).map(id)).toEqual([
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ]);
    expect(liste.slice(4).map(id)).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
    expect(liste.map((m) => m.tur)).toEqual(['ceyrek', 'ceyrek', 'ceyrek', 'ceyrek', 'yari', 'yari', 'final']);
    expect(siradakiMac(liste)).toBe(0);
  });

  it('kazananlar bir üst tura çıkar: yarı finalde (1-8)·(4-5) ve (2-7)·(3-6) kazananları', () => {
    const liste = maclar(PROJELER, [8, 4, 2, 6]);
    expect(liste.slice(0, 4).map((m) => m.kazanan.id)).toEqual([8, 4, 2, 6]);
    expect(liste.slice(4, 6).map(id)).toEqual([
      [8, 4],
      [2, 6],
    ]);
    expect(id(liste[6])).toEqual([null, null]);
    expect(siradakiMac(liste)).toBe(4);
  });

  it('7 seçimden sonra şampiyon belli olur, oynanacak maç kalmaz', () => {
    const liste = maclar(PROJELER, [1, 4, 2, 3, 1, 3, 3]);
    expect(id(liste[6])).toEqual([1, 3]);
    expect(sampiyon(liste).id).toBe(3);
    expect(siradakiMac(liste)).toBe(-1);
    expect(sampiyon(maclar(PROJELER, [1, 4]))).toBeNull();
  });

  it('tur adları', () => {
    expect(['ceyrek', 'yari', 'final'].map(turAdi)).toEqual(['Çeyrek final', 'Yarı final', 'Final']);
  });
});
