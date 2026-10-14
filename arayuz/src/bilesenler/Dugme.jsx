// Sarı ana düğme. tur="ghost": saydam, çizgili. kucuk: küçük boy.
export default function Dugme({ tur = 'ana', kucuk = false, type = 'button', className = '', ...digerleri }) {
  const siniflar = ['btn', tur === 'ghost' && 'ghost', kucuk && 'sm', className].filter(Boolean).join(' ');
  return <button type={type} className={siniflar} {...digerleri} />;
}
