# Konu Kartları

Öğrencilerin ilgi alanlarına göre proje konusu önerme sistemi.
Fırat Üniversitesi, Mühendislik Tasarımı dersi, 6. Grup.

## Ne yapar?

1. Öğrenci kayıt olur, bölümünü, proje türünü ve süresini seçer, kendini kendi cümleleriyle anlatır.
2. **Kendi eğittiğimiz model** yazıdan ilgi alanlarını (12 alan içinden), istemediği alanları ve
   becerilerini çıkarır. Öğrenci bu profili görür, düzeltir ve onaylar.
3. Sistem **325 projelik havuzdan** ve **Gemini'nin öğrenciye özel ürettiği 5 yeni fikirden**
   10 proje seçer. Her proje uyum, yapılabilirlik ve özgünlük açısından puanlanır:
   `Toplam = 0,50 × Uyum + 0,30 × Yapılabilirlik + 0,20 × Özgünlük`.
4. İlk 8 proje düelloya girer; öğrenci ikişer ikişer seçerek 7 maçta şampiyonu bulur.
5. Seçilen proje 12 adımlık **görev haritasına** dönüşür (sade / orta / efsane modu).
   Öğrenci adımları işaretler; geri geldiğinde kaldığı yerden devam eder.

Gemini cevap vermezse ya da öğrencinin günlük hakkı (10) dolarsa sistem durmaz:
öneriler sadece havuzdan gelir, görev haritası projenin kendi adımlarından üretilir.

## Ekip

| Kişi | Görev | Klasör |
|---|---|---|
| Ahmet Ethem Akyol | Öneri motoru, model eğitimi, proje havuzu, veritabanı | `oneri_motoru/`, `veritabani/`, `veri/` |
| Seyithan Yeşilkaya | Sunucu ve kimlik doğrulama | `sunucu/` |
| Yunus Emre Aydın | Arayüz | `arayuz/` |

## Klasörler

- `arayuz/`: React arayüzü (Vite)
- `sunucu/`: FastAPI sunucusu ([adresler](docs/anlasma.md#2-adresler-endpoint))
- `oneri_motoru/`: Profil modeli, puanlama, Gemini bağlantısı ([nasıl çalışır](oneri_motoru/README.md))
- `veritabani/`: Tablolar, bağlantı, havuz yükleme ([tablolar](veritabani/README.md))
- `veri/`: Proje havuzu ve eğitim metinleri ([veri](veri/README.md))
- `tests/`: Python testleri (öneri motoru ve sunucu)
- `docs/`: Anlaşma belgesi, [demo kurulum ve prova listesi](docs/demo.md)

## Teknolojiler

React 19 + Vite · FastAPI (Python) · PostgreSQL · scikit-learn · Google Gemini (flash-lite)

## Kurulum (Windows)

Gerekenler: Python 3.11 ya da üstü, Node.js 22 (LTS), PostgreSQL 16, Git.
Komutlar PowerShell'de, aksi yazmıyorsa **projenin ana klasöründe** çalıştırılır.

**1. Projeyi indir ve Python paketlerini kur**

```powershell
git clone https://github.com/Ethem1010/proje-konusu-onerme-sistemi.git
cd proje-konusu-onerme-sistemi
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**2. Veritabanını kur** (şifre sorarsa PostgreSQL kurulurken verdiğin şifre)

```powershell
psql -U postgres -c "CREATE DATABASE konu_kartlari"
psql -U postgres -d konu_kartlari -f veritabani/tablolar.sql
psql -U postgres -d konu_kartlari -f veritabani/bolumler.sql
```

`tablolar.sql` tabloları silip yeniden kurar; içinde veri olan veritabanında çalıştırma.

`psql` komutu bulunamadı derse PostgreSQL'in `bin` klasörünü (ör. `C:\Program Files\PostgreSQL\16\bin`)
Windows'ta Path'e ekle ya da aynı SQL dosyalarını pgAdmin'de **Query Tool** ile çalıştır.

**3. Ayarlar:** `.env.example` dosyasını kopyalayıp adını `.env` yap ve içini doldur.

- `DATABASE_URL`: PostgreSQL şifreni yaz.
- `JWT_GIZLI_ANAHTAR`: `python -c "import secrets; print(secrets.token_hex(32))"` çıktısını yapıştır.
- `GEMINI_API_KEY`: [aistudio.google.com](https://aistudio.google.com) adresinden alınan anahtar.
  Anahtar olmasa da sistem çalışır, sadece Gemini'nin yeni fikirleri gelmez.

`.env` GitHub'a gönderilmez; anahtarını kimseyle paylaşma, ekran görüntüsünde gösterme.

**4. Proje havuzunu yükle ve modeli eğit**

```powershell
python -m veritabani.havuz_yukle      # "325 proje eklendi." yazmalı
python -m oneri_motoru.egitim         # modeli eğitir, sonuna "Model kaydedildi" yazar
```

**5. Çalıştır** (iki ayrı terminal)

```powershell
# 1. terminal: sunucu (ana klasörde, .venv açıkken)
uvicorn sunucu.main:app --reload
```

```powershell
# 2. terminal: arayüz
cd arayuz
npm install        # sadece ilk sefer
npm run dev
```

Tarayıcıda **http://localhost:5173** adresini aç. Sunucunun bütün adresleri http://127.0.0.1:8000/docs adresinde denenebilir.

Siteyi telefondan açmak için (aynı ağda): [docs/demo.md, 5. bölüm](docs/demo.md#5-telefondan-göstermek).

## Testler

```powershell
python -m unittest -v          # öneri motoru ve sunucu testleri
cd arayuz; npm test            # arayüz testleri
```

Sunucu testleri (`tests/test_sunucu.py`) bütün adresleri gerçek bir veritabanıyla dener.
Testler veritabanını silip kurduğu için **ayrı bir test veritabanı** ister; tanımlı değilse atlanır:

```powershell
psql -U postgres -c "CREATE DATABASE konu_kartlari_test"
```

`.env` dosyasına ekle: `TEST_DATABASE_URL=postgresql+psycopg://postgres:SIFREN@localhost:5432/konu_kartlari_test`

Güvenlik için testler sadece bu bilgisayardaki (localhost), adında `test` geçen ve
`DATABASE_URL`'den farklı bir veritabanında çalışır. Gemini'ye bağlanmaz, günlük hak harcamaz.

## Bilinen sınırlar ve gelecek çalışmalar

- **Benzer çalışma araması** (GitHub ve açık arşivlerde aynı projeyi bulma) ertelendi.
  `projeler` tablosundaki `benzer_baslik`, `benzer_link`, `benzerlik` sütunları bu yüzden şimdilik boş.
- `POST /secim` öğrencinin öneri listesindeki her projeyi kabul ediyor; sadece düello şampiyonu
  zorunlu değil. Arayüz zaten şampiyonu gönderiyor.
- Ücretsiz Gemini anahtarının günlük istek sınırı düşük. Sınır dolunca sistem havuz ve yedek haritayla devam eder.
- Karakter kartı, iki projeyi birleştirme, takım kimyası, yönetici ekranı ve hesap silme ileriye bırakıldı.
