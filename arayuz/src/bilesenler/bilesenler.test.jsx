import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import AdimSeridi from './AdimSeridi.jsx';
import DonenKart from './DonenKart.jsx';
import Dugme from './Dugme.jsx';
import Etiket from './Etiket.jsx';
import GeriDugmesi from './GeriDugmesi.jsx';
import PuanHalkasi, { halkaRengi } from './PuanHalkasi.jsx';

describe('Dugme', () => {
  it('türüne göre sınıf alır', () => {
    render(
      <>
        <Dugme>Ana</Dugme>
        <Dugme tur="ghost" kucuk>
          Hayalet
        </Dugme>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Ana' })).toHaveClass('btn');
    expect(screen.getByRole('button', { name: 'Ana' })).not.toHaveClass('ghost');
    expect(screen.getByRole('button', { name: 'Hayalet' })).toHaveClass('btn', 'ghost', 'sm');
  });
});

describe('Etiket', () => {
  it('alan rengini kullanır; renk verilmezse kendi gri rengi kalır', () => {
    render(
      <>
        <Etiket renk={3}>Web</Etiket>
        <Etiket>Python</Etiket>
      </>,
    );
    expect(screen.getByText('Web').style.getPropertyValue('--fc')).toBe('var(--c3)');
    expect(screen.getByText('Python').style.getPropertyValue('--fc')).toBe('');
  });

  it('kaldir verilince × düğmesi çıkar ve dokununca çağrılır', async () => {
    const kaldir = vi.fn();
    render(
      <Etiket buyuk kaldir={kaldir}>
        Python
      </Etiket>,
    );
    expect(screen.getByText('Python')).toHaveClass('tag', 'buyuk');
    await userEvent.click(screen.getByRole('button', { name: 'Python kaldır' }));
    expect(kaldir).toHaveBeenCalledTimes(1);
  });

  it('kaldir verilmezse düğme yok', () => {
    render(<Etiket>Web</Etiket>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('PuanHalkasi', () => {
  it('renk sınırları demodaki gibi', () => {
    expect(halkaRengi(70)).toBe('good');
    expect(halkaRengi(69)).toBe('warn');
    expect(halkaRengi(50)).toBe('warn');
    expect(halkaRengi(49)).toBe('crit');
  });
  it('puanı yuvarlar ve 0-100 arasında tutar', () => {
    render(
      <>
        <PuanHalkasi puan={77.6} />
        <PuanHalkasi puan={140} />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Puan 78' })).toHaveTextContent('78');
    expect(screen.getByRole('img', { name: 'Puan 100' })).toBeInTheDocument();
  });
});

describe('DonenKart', () => {
  function Deneme() {
    const [acik, setAcik] = useState(false);
    return (
      <DonenKart acik={acik} onCevir={() => setAcik(!acik)} etiket="Kartı çevir">
        Ön yüz
      </DonenKart>
    );
  }
  it('dokununca açılır, tekrar dokununca kapanır', async () => {
    render(<Deneme />);
    const kart = screen.getByRole('button', { name: 'Kartı çevir' });
    expect(kart).not.toHaveClass('open');
    await userEvent.click(kart);
    expect(kart).toHaveClass('open');
    await userEvent.click(kart);
    expect(kart).not.toHaveClass('open');
  });
});

describe('AdimSeridi', () => {
  it('aktif adımı ve geçilenleri işaretler', () => {
    render(<AdimSeridi aktif="Projeler" />);
    const adim = (ad) => screen.getByText(ad).closest('li');
    expect(adim('Projeler')).toHaveClass('on');
    expect(adim('Projeler')).toHaveAttribute('aria-current', 'step');
    expect(adim('Anlat')).toHaveClass('done');
    expect(adim('Düello')).not.toHaveClass('on');
    expect(adim('Düello')).not.toHaveClass('done');
  });
});

describe('GeriDugmesi', () => {
  it('verilen adrese gider', async () => {
    render(
      <MemoryRouter initialEntries={['/kayit']}>
        <Routes>
          <Route path="/kayit" element={<GeriDugmesi adres="/giris" />} />
          <Route path="/giris" element={<p>Giriş sayfası</p>} />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: '← Geri' }));
    expect(screen.getByText('Giriş sayfası')).toBeInTheDocument();
  });
});
