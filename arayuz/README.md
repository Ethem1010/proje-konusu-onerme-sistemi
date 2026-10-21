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
- `src/secenekler.js`: 12 ilgi alanı (kod, ad, renk), puan ölçeği, zorluklar, beceriler
- `src/akis.js`: öğrencinin ekranlar arasında taşıdığı bilgiler
- `src/duello.js`: düello kuralları (hangi 8 proje, eşleşmeler 1-8, 4-5, 2-7, 3-6, şampiyon)
- `src/tema.css`: renkler (açık ve koyu tema), yazı tipleri, form ve yerleşim
- `src/tema.js`: açık/koyu tema seçimi (tarayıcıda saklanır)
- `src/bilesenler/`: Dugme, Etiket, PuanHalkasi, DonenKart, GeriDugmesi, AdimSeridi, UstCubuk,
  Logo, GirisCercevesi, TemaDugmesi, ProjeAyrintisi, ProjeKarti
- `src/sayfalar/`: Giris, Kayit, Anlat ("Seni tanıyalım" ve üç soru), Profil (profil onayı),
  Oneriler (10 proje, sürpriz proje), Duello, Sonuc (zorluk seçimi), Harita (görev haritası), Bekleme
