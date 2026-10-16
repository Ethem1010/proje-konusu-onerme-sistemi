# Veritabanı: tablolar ve bağlantı (Ethem)

| Dosya | Ne yapar |
|---|---|
| `tablolar.sql` | Bütün tabloları **silip** baştan kurar. Sadece yeni kurulumda kullan. |
| `guncelleme.sql` | Var olan veritabanını **silmeden** günceller (proje havuzu, `istemedikleri`, `kaynak`). Tekrar çalıştırmak güvenli. |
| `bolumler.sql` | Bölüm listesi (Bilgisayar ve Yazılım Mühendisliği) |
| `modeller.py` | Tabloların Python karşılıkları (SQLAlchemy) |
| `baglanti.py` | `.env`'deki `DATABASE_URL` ile bağlantı |
| `deneme.py` | Bağlantıyı ve tabloları dener, iz bırakmaz: `python -m veritabani.deneme` |

## Tablolar

`kullanicilar`, `bolumler`, `profiller`, `havuz_projeleri` (ekibin hazırladığı ~300 proje),
`projeler` (öğrenciye önerilen 10 proje; `kaynak` = `havuz` ya da `gemini`), `duello_secimleri`,
`secilen_projeler`, `gorev_adimlari`, `benzerlik_onbellegi`, `yapay_zeka_kullanimi`.
