# React arayüzü (Yunus Emre)

Vite + React + React Router. Yazı tipleri ve alan renkleri Ethem'in demosundan.

## Çalıştırma

`arayuz/` klasöründe:

```bash
npm install      # ilk sefer
npm run dev      # http://localhost:5173
npm test         # testler
```

Arayüz Seyithan'ın sunucusuna `http://127.0.0.1:8000` adresinden bağlanır (`src/api.js`).
Önce sunucuyu ana klasörden aç: `uvicorn sunucu.main:app --reload`.

## Klasörler

- `src/api.js`: sunucuya istek gönderen tek yer
- `src/tema.css`: renkler, yazı tipleri, form ve yerleşim
- `src/bilesenler/`: Dugme, Etiket, PuanHalkasi, DonenKart, GeriDugmesi, AdimSeridi, UstCubuk,
  Logo, GirisCercevesi
- `src/sayfalar/`: Giris, Kayit, Anlat ("Seni tanıyalım")
