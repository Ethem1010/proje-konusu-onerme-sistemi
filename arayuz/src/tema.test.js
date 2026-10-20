import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TemaDugmesi from './bilesenler/TemaDugmesi.jsx';
import { TEMA_ANAHTARI, baslangicTemasi, temaAyarla, temaOku } from './tema.js';

function bilgisayarKoyuMu(koyu) {
  vi.stubGlobal('matchMedia', (sorgu) => ({ matches: koyu && sorgu.includes('dark') }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.tema;
});

describe('tema', () => {
  it('seçim yoksa bilgisayarın ayarına uyar', () => {
    bilgisayarKoyuMu(true);
    expect(baslangicTemasi()).toBe('koyu');
    bilgisayarKoyuMu(false);
    expect(baslangicTemasi()).toBe('acik');
  });

  it('kaydedilmiş seçim bilgisayarın ayarından önce gelir', () => {
    bilgisayarKoyuMu(true);
    localStorage.setItem(TEMA_ANAHTARI, 'acik');
    expect(baslangicTemasi()).toBe('acik');
  });

  it('bozuk kayıt yok sayılır', () => {
    bilgisayarKoyuMu(false);
    localStorage.setItem(TEMA_ANAHTARI, 'mor');
    expect(baslangicTemasi()).toBe('acik');
  });

  it('tema sayfaya uygulanır ve saklanır', () => {
    temaAyarla('koyu');
    expect(document.documentElement.dataset.tema).toBe('koyu');
    expect(temaOku()).toBe('koyu');
    expect(localStorage.getItem(TEMA_ANAHTARI)).toBe('koyu');
  });
});

describe('TemaDugmesi', () => {
  it('dokununca tema değişir, düğmenin adı da değişir', async () => {
    document.documentElement.dataset.tema = 'acik';
    render(createElement(TemaDugmesi));

    await userEvent.click(screen.getByRole('button', { name: 'Koyu temaya geç' }));
    expect(document.documentElement.dataset.tema).toBe('koyu');
    expect(localStorage.getItem(TEMA_ANAHTARI)).toBe('koyu');

    await userEvent.click(screen.getByRole('button', { name: 'Açık temaya geç' }));
    expect(document.documentElement.dataset.tema).toBe('acik');
  });
});
