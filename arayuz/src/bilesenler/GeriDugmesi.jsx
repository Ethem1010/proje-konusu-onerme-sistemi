import { useNavigate } from 'react-router';
import Dugme from './Dugme.jsx';

// Sol üstteki "← Geri". adres verilirse oraya, verilmezse bir önceki sayfaya gider.
export default function GeriDugmesi({ adres }) {
  const git = useNavigate();
  return (
    <Dugme tur="ghost" kucuk onClick={() => (adres ? git(adres) : git(-1))}>
      ← Geri
    </Dugme>
  );
}
