import { alanBul } from '../secenekler.js';
import Dugme from './Dugme.jsx';
import Etiket from './Etiket.jsx';
import ProjeAyrintisi from './ProjeAyrintisi.jsx';
import PuanHalkasi from './PuanHalkasi.jsx';

// Proje kartı (demodaki .dcard): alan, "✨ Sana özel", isteğe bağlı rozet (ör. "Şampiyon"), başlık, puan,
// "İçerik" düğmesi; onSec verilirse "Bunu seç". Düello, sonuç ve sürpriz projede kullanılır.
// secildi / kaybetti: düelloda seçilen kart büyür, öbürü kaybolur.
export default function ProjeKarti({ proje, icerik, onIcerik, rozet, secildi, kaybetti, kilitli, onSec }) {
  const renk = alanBul(proje.alan)?.renk;
  const icerikId = `proje-icerik-${proje.id}`;
  const siniflar = ['dcard', secildi && 'win', kaybetti && 'lose'].filter(Boolean).join(' ');

  return (
    <article className={siniflar} style={renk ? { '--fc': `var(--c${renk})` } : undefined}>
      <span className="oneri-etiketler">
        <Etiket renk={renk}>{proje.alan_adi}</Etiket>
        {proje.kaynak === 'gemini' && <span className="ozel">✨ Sana özel</span>}
        {rozet && <span className="crown">{rozet}</span>}
      </span>
      <h2 className="ttl">{proje.baslik}</h2>
      <PuanHalkasi puan={proje.puan_toplam ?? 0} />
      <span className="acts">
        <Dugme tur="ghost" kucuk aria-expanded={icerik} aria-controls={icerikId} onClick={onIcerik}>
          {icerik ? 'İçeriği gizle' : 'İçerik'}
        </Dugme>
        {onSec && (
          <Dugme kucuk disabled={kilitli} aria-label={`Bunu seç: ${proje.baslik}`} onClick={onSec}>
            Bunu seç
          </Dugme>
        )}
      </span>
      {/* Ayrıntı düğmelerin altında açılır; "Bunu seç" yerinden kaymaz. */}
      {icerik && <ProjeAyrintisi proje={proje} id={icerikId} />}
    </article>
  );
}
