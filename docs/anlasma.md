# Konu Kartları: Ekip Anlaşma Belgesi

Üç parçanın (arayüz, sunucu, öneri motoru) birbiriyle nasıl konuşacağını burada yazıyoruz.
Bu dosyayı değiştirmeden önce gruba haber verin; biri değiştirirse diğer ikisinin kodu bozulabilir.

## 1. Genel kurallar

| Konu | Karar |
|---|---|
| Sunucu adresi | `http://127.0.0.1:8000` (çalıştırma: ana klasörden `uvicorn sunucu.main:app --reload`) |
| Arayüz adresi | `http://localhost:5173` (CORS sadece buna izin veriyor) |
| Veri biçimi | İstek ve cevaplar JSON |
| Giriş gerektiren adresler | Başlıkta `Authorization: Bearer <erisim_jetonu>` |
| Hata cevabı | `{"detail": "Kullanıcıya gösterilebilecek Türkçe cümle"}` |
| Gizli ayarlar | `.env` dosyasında, GitHub'a gitmez. Hangi ayarların gerektiği `.env.example`'da |
| Dosya kodlaması | UTF-8 (`.editorconfig` bunu sağlıyor) |
| Dallar | `ethem/...`, `seyithan/...`, `yunus/...`; `main`'e doğrudan gönderim yok |
| PR onayı | Ethem'inkini Seyithan, Seyithan'ınkini Yunus, Yunus'unkini Ethem onaylar |

### Hata kodları

| Kod | Ne zaman |
|---|---|
| 400 | İstek anlamsız (örn. şifre çok uzun) |
| 401 | Giriş yapılmamış, jeton geçersiz ya da süresi dolmuş, şifre yanlış |
| 404 | İstenen kayıt yok |
| 409 | Çakışma (örn. bu e-postayla zaten hesap var) |
| 422 | Alanlar eksik ya da kurala uymuyor (FastAPI otomatik verir) |
| 429 | Öğrencinin günlük yapay zekâ hakkı doldu |
| 503 | Yapay zekâ şu an cevap vermiyor: "Şu an öneri üretilemedi, birazdan tekrar dene." |

## 2. Adresler (endpoint)

Durum: ✅ çalışıyor, ⏳ yazılacak (hangi hafta).

| Adres | Jeton | Durum | Ne yapar |
|---|---|---|---|
| `POST /auth/kayit` | - | ✅ | Hesap açar, jeton verir |
| `POST /auth/giris` | - | ✅ | Jeton verir |
| `GET /auth/ben` | ✓ | ✅ | Jetonun sahibini verir |
| `GET /bolumler` | - | ✅ | Bölüm listesi |
| `POST /profil` | ✓ | ⏳ 2. hafta | Öğrencinin yazısından profil çıkarır |
| `PUT /profil/{id}` | ✓ | ⏳ 2. hafta | Öğrencinin düzelttiği profili kaydeder ve onaylar |
| `POST /oneriler/{profil_id}` | ✓ | ⏳ 2. hafta | 10 proje üretir, puanlar, kaydeder |
| `GET /oneriler/{profil_id}` | ✓ | ⏳ 2. hafta | Kayıtlı 10 projeyi tekrar verir |
| `GET /projeler/{id}` | ✓ | ⏳ 2. hafta | Tek projenin bütün detayı |
| `POST /duello` | ✓ | ⏳ 3. hafta | Düello seçimini kaydeder |
| `POST /secim` | ✓ | ⏳ 3. hafta | Seçilen projeyi kaydeder, 12 adımlık haritayı oluşturur |
| `GET /harita/{secim_id}` | ✓ | ⏳ 3. hafta | Görev haritasını verir |
| `PUT /harita/{secim_id}` | ✓ | ⏳ 3. hafta | Bir adımı tamamlandı/tamamlanmadı yapar |
| `GET /surpriz/{profil_id}` | ✓ | ⏳ 3. hafta | Sürpriz proje verir |

### 2.1 Çalışan adresler

**`POST /auth/kayit`**
```json
// istek
{ "ad": "Ayşe Yılmaz", "eposta": "ayse@ornek.com", "sifre": "gizli123" }
// cevap (201)
{ "erisim_jetonu": "eyJ...", "jeton_turu": "bearer", "kullanici_id": 1, "ad": "Ayşe Yılmaz" }
```
Kurallar: ad 2-100 karakter, şifre en az 6 karakter. E-posta küçük harfe çevrilip kaydedilir. Aynı e-posta: 409.

**`POST /auth/giris`**: istek `{ "eposta": "...", "sifre": "..." }`, cevap kayıttakiyle aynı. Yanlış bilgi: 401 "E-posta veya şifre hatalı."

**`GET /auth/ben`**: cevap `{ "id": 1, "ad": "Ayşe Yılmaz", "eposta": "ayse@ornek.com", "rol": "ogrenci" }`

**`GET /bolumler`**: cevap `[{ "id": 1, "ad": "Bilgisayar Mühendisliği", "grup": "muhendislik" }, ...]`
Önce `muhendislik`, sonra `diger` gelir. "Diğer (bölümünü yaz)" seçeneğini arayüz kendisi ekler.

### 2.2 Yazılacak adresler

**`POST /profil`**
```json
// istek: bolum_id ya da bolum_diger'den biri dolu olmalı
{
  "bolum_id": 6,
  "bolum_diger": null,
  "proje_turu": "donem",
  "sure_hafta": 12,
  "metin": "SolidWorks ve Arduino biliyorum...",
  "haftalik_saat": 8,
  "ekip": 3,
  "tercih": "uretmek"
}
// cevap (201)
{
  "id": 5,
  "alanlar": [ { "ad": "Robotik", "puan": 5 }, "... toplam 5 tane" ],
  "beceriler": [ "SolidWorks", "Arduino", "Python" ],
  "onaylandi": false
}
```

**`PUT /profil/{id}`**: istek `{ "alanlar": [...], "beceriler": [...] }`, cevap aynı profil, `"onaylandi": true`.

**`POST /oneriler/{profil_id}`** ve **`GET /oneriler/{profil_id}`**: cevap 10 projelik liste (bkz. 4. bölüm), `puan_toplam`'a göre büyükten küçüğe. İlk 8'inde `"duelloda": true`. Profil onaylanmamışsa 400.

**`POST /duello`**: istek `{ "profil_id": 5, "kazanan_proje_id": 12, "kaybeden_proje_id": 15, "tur": "ceyrek" }` (`tur`: `ceyrek`, `yari`, `final`).

**`POST /secim`**: istek `{ "proje_id": 12, "zorluk_modu": "orta" }` (`kolay`, `orta`, `efsane`), cevap `{ "secim_id": 3, "adimlar": [ { "sira": 1, "baslik": "...", "aciklama": "...", "tamamlandi": false }, "... 12 tane" ] }`.

**`PUT /harita/{secim_id}`**: istek `{ "sira": 4, "tamamlandi": true }`, cevap güncel harita.

## 3. Seçenek kodları

Arayüz kullanıcıya soldaki metni gösterir, sunucuya sağdaki kodu gönderir.

| Alan | Arayüzde | Sunucuya giden |
|---|---|---|
| `proje_turu` | Ders ödevi / Dönem projesi / Bitirme projesi / Yarışma projesi / Kişisel proje | `ders` / `donem` / `bitirme` / `yarisma` / `kisisel` |
| `tercih` | Bir şey üretmek / Araştırmak / Fark etmez | `uretmek` / `arastirmak` / `farketmez` |
| `zorluk_modu` | Kolay / Orta / Efsane | `kolay` / `orta` / `efsane` |
| `sure_hafta` | 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24 hafta | sayı, 1-24 |
| `haftalik_saat` | saat | sayı, 1 ve üstü |
| `ekip` | kişi sayısı | sayı, 1 ve üstü |

## 4. Proje kalıbı

Yapay zekâ projeleri bu kalıpta üretir, sunucu aynı kalıpta arayüze gönderir.

| Alan | Tür | Açıklama |
|---|---|---|
| `id` | sayı | Veritabanı numarası |
| `baslik` | metin | Kısa ve akılda kalan başlık |
| `alan` | metin | Ana alan (örn. "Robotik") |
| `alan2` | metin ya da null | İkinci alan |
| `beceriler` | metin listesi | Gereken beceriler |
| `zorluk` | 1, 2, 3 | 1 kolay, 3 zor |
| `hafta` | sayı | Tahmini süre |
| `ne` | metin | Ne yapılacak, 2-3 cümle |
| `kim` | metin | Kimin işine yarar |
| `cikti` | metin | Sonunda elde ne olacak |
| `adimlar` | 4 metinlik liste | Nasıl yapılır |
| `kolay` | metin | Kolay modda ne değişir |
| `efsane` | metin | Efsane modda ne eklenir |
| `puan_uyum` | 0-100 | Öğrenciye uyum |
| `puan_yapilabilirlik` | 0-100 | Süre, saat ve ekibe sığma |
| `puan_ozgunluk` | 0-100 | GitHub'daki benzerlere göre |
| `puan_toplam` | 0-100 | 0,50 x uyum + 0,30 x yapılabilirlik + 0,20 x özgünlük |
| `benzer_baslik` | metin ya da null | En benzer GitHub projesinin adı |
| `benzer_link` | metin ya da null | O projenin bağlantısı |
| `benzerlik` | 0,00-1,00 ya da null | 0,75 ve üstü "Çok benzeri var" uyarısı |
| `duelloda` | true/false | İlk 8'de mi |
| `surpriz` | true/false | Sürpriz proje mi |

## 5. Profil kalıbı

| Alan | Tür | Açıklama |
|---|---|---|
| `alanlar` | liste | Tam 5 tane `{ "ad": "Robotik", "puan": 5 }`, puan 1-5 |
| `beceriler` | metin listesi | Öğrencinin bildiği beceriler, örn. `["SolidWorks", "Python"]` |