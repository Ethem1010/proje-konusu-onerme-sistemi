import { useState } from 'react';
import { temaAyarla, temaOku } from '../tema.js';
import Dugme from './Dugme.jsx';

// Açık / koyu tema düğmesi. Koyu temadayken güneş, açıktayken ay gösterir.
export default function TemaDugmesi() {
  const [tema, setTema] = useState(temaOku);
  const sonraki = tema === 'koyu' ? 'acik' : 'koyu';
  const etiket = sonraki === 'koyu' ? 'Koyu temaya geç' : 'Açık temaya geç';

  function degistir() {
    temaAyarla(sonraki);
    setTema(sonraki);
  }

  return (
    <Dugme tur="ghost" kucuk className="tema-dugmesi" onClick={degistir} aria-label={etiket} title={etiket}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {tema === 'koyu' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        )}
      </svg>
    </Dugme>
  );
}
