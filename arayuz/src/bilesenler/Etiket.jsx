// Etiket (ör. bir alan ya da beceri). renk: 1-12 arası alan rengi (--c1 … --c12); verilmezse gri.
// buyuk: küçük harfli, biraz daha büyük yazı. kaldir: verilirse sağda × düğmesi çıkar, dokununca çağrılır.
export default function Etiket({ renk, buyuk = false, kaldir, children }) {
  return (
    <span className={buyuk ? 'tag buyuk' : 'tag'} style={renk ? { '--fc': `var(--c${renk})` } : undefined}>
      {children}
      {kaldir && (
        <button type="button" className="tag-x" onClick={kaldir} aria-label={`${children} kaldır`}>
          ×
        </button>
      )}
    </span>
  );
}
