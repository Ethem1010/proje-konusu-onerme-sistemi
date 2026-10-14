// Alan etiketi (ör. "Web"). renk: 1-8 arası alan rengi (--c1 … --c8).
export default function Etiket({ renk = 1, children }) {
  return (
    <span className="tag" style={{ '--fc': `var(--c${renk})` }}>
      {children}
    </span>
  );
}
