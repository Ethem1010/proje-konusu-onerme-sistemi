# Veri seti

Aslı Google Sheets'teki **Konu Kartları Veri Seti** tablosunda. Buradaki dosyalar oradan indirilir:

| Dosya | Tablodaki sekme | İçerik |
|---|---|---|
| `projeler.csv` | Projeler | Proje havuzu (12 alan x 25 proje) |
| `metinler.csv` | Öğrenci Metinleri | Ekibin yazdığı, etiketli öğrenci metinleri (model eğitimi) |

Güncellemek için: Google Sheets'te sekmeyi aç > **Dosya > İndir > Virgülle ayrılmış değerler (.csv)**,
inen dosyanın adını değiştirip bu klasöre koy.

Etiketler: `2` çok istiyor, `1` biraz ilgili, `-1` istemiyor, boş = bahsetmemiş.

Formdan gelen gerçek öğrenci cevapları (`form*.csv`, `test*.csv`) herkese açık repoya gönderilmez.
