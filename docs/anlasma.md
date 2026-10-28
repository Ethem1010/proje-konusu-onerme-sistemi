# Konu Kartları: Ekip Anlaşma Belgesi

Üç parçanın (arayüz, sunucu, öneri motoru) birbiriyle nasıl konuşacağını burada yazıyoruz.
Bu dosyayı değiştirmeden önce gruba haber verin; biri değiştirirse diğer ikisinin kodu bozulabilir.

## 1. Genel kurallar

| Konu | Karar |
|---|---|
| Sunucu adresi | `http://127.0.0.1:8000` (çalıştırma: ana klasörden `uvicorn sunucu.main:app --reload`) |
| Arayüz adresi | `http://localhost:5173` (CORS buna izin veriyor; telefondan demo için `.env`'de `TELEFON_DEMO=1`) |
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
| `POST /profil` | ✓ | ✅ | Öğrencinin yazısından profil çıkarır |
| `GET /profil/{id}` | ✓ | ✅ | Kayıtlı profili verir (onay ekranı yenilenince) |
| `PUT /profil/{id}` | ✓ | ✅ | Öğrencinin düzelttiği profili kaydeder ve onaylar |
| `POST /oneriler/{profil_id}` | ✓ | ✅ | 10 proje üretir, puanlar, kaydeder |
| `GET /oneriler/{profil_id}` | ✓ | ✅ | Kayıtlı 10 projeyi tekrar verir |
| `GET /projeler/{id}` | ✓ | ✅ | Tek projenin bütün detayı |
| `POST /duello` | ✓ | ✅ | Düello seçimini kaydeder |
| `GET /duello/{profil_id}` | ✓ | ✅ | Kayıtlı düello maçlarını verir (sayfa yenilenince) |
| `POST /secim` | ✓ | ✅ | Seçilen projeyi kaydeder, 12 adımlık haritayı oluşturur |
| `GET /harita/{secim_id}` | ✓ | ✅ | Görev haritasını verir |
| `PUT /harita/{secim_id}` | ✓ | ✅ | Bir adımı tamamlandı/tamamlanmadı yapar |
| `GET /surpriz/{profil_id}` | ✓ | ✅ | Sürpriz proje verir |

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

**`POST /profil`**
```json
// istek: bolum_id ya da bolum_diger'den biri dolu olmalı
{
  "bolum_id": 1,
  "bolum_diger": null,
  "proje_turu": "donem",
  "sure_hafta": 12,
  "metin": "Unity ile oyun yapmak istiyorum ama web işlerinden sıkıldım, C# biliyorum.",
  "haftalik_saat": 8,
  "ekip": 3,
  "tercih": "uretmek"
}
// cevap (201)
{
  "id": 5,
  "alanlar": [ { "kod": "oyun", "ad": "Oyun Geliştirme", "puan": 5 }, "... toplam 5 tane" ],
  "istemedikleri": [ "web" ],
  "beceriler": [ "Unity", "C#" ],
  "onaylandi": false
}
```
Kurallar: metin 20-5000 karakter, `sure_hafta` 1-24, `haftalik_saat` 1-80, `ekip` 1-20.
Olmayan `bolum_id`: 400. Profili Gemini değil kendi modelimiz çıkarır, günlük hak harcanmaz.

**`PUT /profil/{id}`**
```json
// istek: öğrencinin onay ekranında düzelttiği hâli
{
  "alanlar": [ { "kod": "oyun", "puan": 5 }, { "kod": "yapay_zeka", "puan": 3 } ],
  "istemedikleri": [ "web" ],
  "beceriler": [ "Unity", "C#" ]
}
// cevap (200): POST /profil'in cevabıyla aynı kalıp, "onaylandi": true
```
Kurallar: `alanlar` 1-5 tane, her alan bir kez. `ad` gönderilmese de olur, sunucu `kod`'dan doldurur.
`istemedikleri` ve `beceriler` gönderilmezse boş liste sayılır.
Bir alan hem `alanlar`'da hem `istemedikleri`'nde olursa ya da bilinmeyen alan kodu gelirse: 422.
Profil yoksa ya da başkasınınsa: 404.

**`POST /oneriler/{profil_id}`** ve **`GET /oneriler/{profil_id}`**: cevap 10 projelik liste (bkz. 4. bölüm), `puan_toplam`'a göre büyükten küçüğe. İlk 8'inde `"duelloda": true`.
- `POST` her çağrıldığında listeyi yeniden üretir. Profil onaylanmamışsa 400, düello başladıysa 409.
- `GET` henüz öneri üretilmediyse boş liste döner.
- Gemini cevap vermezse ya da öğrencinin günlük hakkı dolduysa hata verilmez, 10 projenin hepsi havuzdan gelir.
- Günlük hak sadece Gemini gerçekten proje ürettiyse 1 azalır. Sınır `.env`'deki `GUNLUK_YZ_HAKKI` (yazılmazsa 10).

**`GET /profil/{id}`**: cevap `POST /profil` ile aynı kalıp. Profil yoksa ya da başkasınınsa 404.

**`GET /projeler/{id}`**: cevap tek proje (bkz. 4. bölüm). Proje başka bir öğrencinin profiline aitse 404.

**`POST /duello`**
```json
// istek
{ "profil_id": 5, "kazanan_proje_id": 12, "kaybeden_proje_id": 15, "tur": "ceyrek" }
// cevap (201)
{ "id": 1, "profil_id": 5, "kazanan_proje_id": 12, "kaybeden_proje_id": 15, "tur": "ceyrek" }
```
8 proje → 4 `ceyrek`, 2 `yari`, 1 `final`: bir profil için toplam 7 kayıt.
Kurallar (uymazsa 400): `tur` `ceyrek`/`yari`/`final` olmalı; iki proje farklı, bu profilin ve `duelloda: true` olmalı;
bir turun eşleşme sayısı dolduysa ya da projelerden biri daha önce elendiyse kabul edilmez.
Profil başkasınınsa 404. İlk düello kaydından sonra `POST /oneriler` 409 verir (liste kilitlenir).

**`GET /duello/{profil_id}`**: cevap `POST /duello` cevaplarının listesi, oynanma sırasıyla (en çok 7). Henüz maç yoksa boş liste,
profil başkasınınsa 404. Düellonun ortasında sayfa yenilenirse arayüz kaldığı yeri buradan bulur.

**`POST /secim`**
```json
// istek: zorluk_modu gönderilmezse "orta"
{ "proje_id": 12, "zorluk_modu": "orta" }
// cevap (201)
{
  "secim_id": 3,
  "proje_id": 12,
  "zorluk_modu": "orta",
  "adimlar": [ { "sira": 1, "baslik": "...", "aciklama": "...", "tamamlandi": false, "tamamlanma_tarihi": null }, "... 12 tane" ]
}
```
- Proje başkasınınsa 404, `zorluk_modu` `kolay`/`orta`/`efsane` değilse 422.
- Proje havuzdansa `havuz_projeleri.secilme_sayisi` 1 artar (çok seçilen proje sonraki öğrencilerde geri plana düşer).
- Haritayı Gemini üretir. Gemini cevap vermezse ya da günlük hak dolduysa hata verilmez, projenin kendi adımlarından
  12 adımlık yedek harita çıkar. Günlük hak sadece Gemini gerçekten cevap verdiyse 1 azalır.
- Aynı proje ikinci kez seçilirse yeni kayıt açılmaz, var olan harita döner (`secilme_sayisi` tekrar artmaz).

**`GET /harita/{secim_id}`**: cevap `POST /secim` ile aynı kalıp, adımlar `sira`'ya göre. Seçim başkasınınsa 404.

**`PUT /harita/{secim_id}`**: istek `{ "sira": 4, "tamamlandi": true }`, cevap güncel harita.
Tamamlanınca `tamamlanma_tarihi` yazılır, işaret kaldırılınca silinir. `sira` 1-12 değilse 422, seçim başkasınınsa 404.

**`GET /surpriz/{profil_id}`**: cevap tek proje (bkz. 4. bölüm), `"surpriz": true`, `"duelloda": false`.
- Sürpriz proje = "bunu hiç düşünmemiştin ama bak": öğrencinin profilindeki ilgi alanlarının **dışından**,
  ama istemediği alanlardan da **olmayan** bir havuz projesi. Öneri listesindeki projeler tekrar çıkmaz.
- Adaylar arasından süresine en çok sığanlar (yapılabilirlik, sonra özgünlük) öne alınır, ilk 15'ten biri rastgele seçilir.
- Aynı profil için tekrar çağrılırsa aynı sürpriz döner. `POST /oneriler` listeyi yenilerse sürpriz de yenilenir.
- Profil onaylanmamışsa 400, başkasınınsa 404, uygun proje yoksa 404. Gemini kullanmaz, günlük hak harcanmaz.
- `GET /oneriler` sürpriz projeyi listeye katmaz.

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

Havuzdan seçilen ve Gemini'nin ürettiği projeler aynı kalıptadır; sunucu bu kalıpta arayüze gönderir.

| Alan | Tür | Açıklama |
|---|---|---|
| `id` | sayı | Veritabanı numarası |
| `kaynak` | `havuz` / `gemini` | Havuzdan mı seçildi, Gemini mi üretti. Arayüz "Havuzdan" / "Sana özel üretildi" etiketi gösterir |
| `baslik` | metin | Kısa ve akılda kalan başlık |
| `alan` | metin | Ana alanın kodu (örn. `oyun`), 12 koddan biri |
| `alan_adi` | metin | Arayüzde gösterilecek ad (örn. "Oyun Geliştirme") |
| `alan2` | metin ya da null | İkinci alanın kodu |
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
| `puan_ozgunluk` | 0-100 | Az seçilen proje yüksek alır; Gemini'nin yeni projeleri 90 |
| `puan_toplam` | 0-100 | 0,50 x uyum + 0,30 x yapılabilirlik + 0,20 x özgünlük |
| `benzer_baslik` | metin ya da null | En benzer GitHub projesinin adı |
| `benzer_link` | metin ya da null | O projenin bağlantısı |
| `benzerlik` | 0,00-1,00 ya da null | 0,75 ve üstü "Çok benzeri var" uyarısı |
| `duelloda` | true/false | İlk 8'de mi |
| `surpriz` | true/false | Sürpriz proje mi |

## 5. Profil kalıbı

| Alan | Tür | Açıklama |
|---|---|---|
| `alanlar` | liste | Tam 5 tane `{ "kod": "oyun", "ad": "Oyun Geliştirme", "puan": 5 }`, puan 1-5 |
| `istemedikleri` | metin listesi | Öğrencinin istemediğini söylediği alan kodları, örn. `["web"]`. Bu alanlardan proje önerilmez |
| `beceriler` | metin listesi | Öğrencinin bildiği beceriler, örn. `["Unity", "C#"]` |

Alanlar 12 sabit koddan biridir (`oneri_motoru/etiketler.py`): `web`, `mobil`, `yapay_zeka`, `goruntu_isleme`, `dogal_dil`, `veri_bilimi`, `siber_guvenlik`, `gomulu_iot`, `oyun`, `bulut_devops`, `veritabani`, `ag_dagitik`.
Profili artık yapay zekâ servisi değil, kendi eğittiğimiz model çıkarır (`oneri_motoru/profil.py`).