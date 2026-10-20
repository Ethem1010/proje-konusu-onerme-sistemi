# Veri seti

Aslı Google Sheets'teki **Konu Kartları Veri Seti** tablosunda. Buradaki dosyalar oradan indirilir:

| Dosya | Tablodaki sekme | İçerik |
|---|---|---|
| `projeler.csv` | Projeler | Proje havuzu (12 alan x 25 proje) |
| `metinler.csv` | Öğrenci Metinleri | Ekibin yazdığı, etiketli öğrenci metinleri (model eğitimi) |

Güncellemek için: Google Sheets'te sekmeyi aç > **Dosya > İndir > Virgülle ayrılmış değerler (.csv)**,
inen dosyanın adını değiştirip bu klasöre koy.

Etiketler: `2` çok istiyor, `1` biraz ilgili, `-1` istemiyor, boş = bahsetmemiş.

Formdan gelen gerçek öğrenci cevapları (`form*`, `test*`) herkese açık repoya gönderilmez.

## Form cevapları

1. Google Drive'da "Öğrenci Anketi (Yanıtlar)" tablosunu aç > **Dosya > İndir > .csv**,
   adını `form_yanitlari.csv` yapıp bu klasöre koy.
2. Ana klasörden: `python -m oneri_motoru.form_cevir veri/form_yanitlari.csv --cikar 31-40`
   (`--cikar`: test setine girmemesi gereken cevaplar. 31-40'ı ekip yazdı: test setinde olmaz, çünkü sınav
   modeli yazanlardan değil gerçek öğrencilerden olmalı. Bu metinler metne göre etiketlenip
   "Öğrenci Metinleri" sekmesine eklendi, eğitimde oradan kullanılıyor).
   Çıkan dosyalar: `test_seti.csv` (ilk 30 cevap, sadece ölçüm için) ve `form_egitim.csv` (eğitime eklenir).
3. `python -m oneri_motoru.egitim`: metinler.csv + form_egitim.csv ile eğitir, test setinde ölçer.
