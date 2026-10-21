import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { jetonuAl } from './api.js';
import Anlat from './sayfalar/Anlat.jsx';
import Duello from './sayfalar/Duello.jsx';
import Giris from './sayfalar/Giris.jsx';
import Kayit from './sayfalar/Kayit.jsx';
import Oneriler from './sayfalar/Oneriler.jsx';
import Profil from './sayfalar/Profil.jsx';

// Giriş yapmamış öğrenci giriş ekranına, giriş yapmış olan "Seni tanıyalım"a gider.
function GirisGerekli({ children }) {
  return jetonuAl() ? children : <Navigate to="/giris" replace />;
}

function GirisliyseAtla({ children }) {
  return jetonuAl() ? <Navigate to="/anlat" replace /> : children;
}

// Yeni ekrana geçince sayfa en üstten başlasın (önceki ekranın kaydırması kalmasın).
function SayfaBasinaKaydir() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <SayfaBasinaKaydir />
      <AppRotalari />
    </>
  );
}

function AppRotalari() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/anlat" replace />} />
      <Route path="/giris" element={<GirisliyseAtla><Giris /></GirisliyseAtla>} />
      <Route path="/kayit" element={<GirisliyseAtla><Kayit /></GirisliyseAtla>} />
      <Route path="/anlat" element={<GirisGerekli><Anlat /></GirisGerekli>} />
      <Route path="/profil/:id" element={<GirisGerekli><Profil /></GirisGerekli>} />
      <Route path="/oneriler/:profilId" element={<GirisGerekli><Oneriler /></GirisGerekli>} />
      <Route path="/duello/:profilId" element={<GirisGerekli><Duello /></GirisGerekli>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
