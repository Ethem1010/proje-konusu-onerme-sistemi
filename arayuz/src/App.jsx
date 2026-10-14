import { Navigate, Route, Routes } from 'react-router';
import { jetonuAl } from './api.js';
import Anlat from './sayfalar/Anlat.jsx';
import Giris from './sayfalar/Giris.jsx';
import Kayit from './sayfalar/Kayit.jsx';

// Giriş yapmamış öğrenci giriş ekranına, giriş yapmış olan "Seni tanıyalım"a gider.
function GirisGerekli({ children }) {
  return jetonuAl() ? children : <Navigate to="/giris" replace />;
}

function GirisliyseAtla({ children }) {
  return jetonuAl() ? <Navigate to="/anlat" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/anlat" replace />} />
      <Route path="/giris" element={<GirisliyseAtla><Giris /></GirisliyseAtla>} />
      <Route path="/kayit" element={<GirisliyseAtla><Kayit /></GirisliyseAtla>} />
      <Route path="/anlat" element={<GirisGerekli><Anlat /></GirisGerekli>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
