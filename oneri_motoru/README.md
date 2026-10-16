# Öneri motoru (Ethem)

Öğrencinin yazısından profil çıkarır, projeleri puanlar ve sıralar.

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `etiketler.py` | 12 alan ve 32 beceri listesi, metinden beceri bulma |
| `veri.py` | `veri/` klasöründeki proje havuzunu ve öğrenci metinlerini okur |
| `model.py` | Kendi eğittiğimiz model: TF-IDF + her alan için Lojistik Regresyon |
| `egitim.py` | Modeli eğitir, çapraz doğrulamayla başarısını ölçer, kaydeder |
| `profil.py` | Yeni bir yazıdan profil çıkarır (5 alan, istemedikleri, beceriler) |
| `siralama.py` | Projeleri puanlar (uyum, yapılabilirlik, özgünlük) ve 10 projeyi seçer: `oner(profil)` |
| `uretim.py` | Gemini ile öğrenciye özel 5 yeni proje ve 12 adımlık görev haritası |
| `yapay_zeka.py` | Gemini bağlantısı (sadece `uretim.py` kullanır) |

## Kullanım (ana klasörden)

```
pip install -r requirements.txt
python -m oneri_motoru.egitim                       # modeli eğit ve ölç
python -m oneri_motoru.profil "unity ile oyun yapmak istiyorum"
python -m oneri_motoru.siralama "unity ile oyun yapmak istiyorum"   # 10 öneri (sonuna --gemini eklenebilir)
python -m unittest                                  # testler
```

Eğitilmiş model `oneri_motoru/model/` klasörüne kaydedilir. Bu klasör GitHub'a gönderilmez,
her bilgisayarda `egitim` komutuyla yeniden üretilir (birkaç saniye sürer).

## Model nasıl çalışıyor?

1. **Ön işleme:** Türkçe küçük harfe çevirme (I → ı). Olumsuz cümle parçalarındaki kelimelerin
   başına `olmz_` eklenir, böylece "oyun istiyorum" ile "oyun istemiyorum" ayrılır.
2. **Özellik çıkarma (TF-IDF):** Kelimeler ve kelime ikilileri, ayrıca 3-5 harflik kelime
   parçaları. Parçalar Türkçenin ekleri için önemli: "docker", "dockerla", "docker'ı".
3. **Sınıflandırma:** Her alan için ayrı Lojistik Regresyon, üç sınıf: istemiyor / bahsetmiyor / ilgileniyor.
4. **Profil:** İlgi olasılığı en yüksek 5 alan (puan 1-5), istememe olasılığı yüksek alanlar ve
   sözlükten bulunan beceriler.

Bilinen sınır: "oyun yapmadım ama yapmak istiyorum" gibi cümlelerde ilk parça olumsuz sayılır.

## Sıralama nasıl çalışıyor?

1. **Adaylar:** Havuzdan öğrencinin 5 ilgi alanındaki projeler; istemediği alanlar elenir. Gemini'den 5 yeni proje.
   Gemini cevap vermezse sadece havuz kullanılır, öğrenci hata görmez.
2. **Puanlar (0-100):**
   - Uyum: alanın ilgi puanı (%75) + becerilerin örtüşmesi (%25), tercihe (üretmek/araştırmak) uymayana -10
   - Yapılabilirlik: öğrencinin toplam saati (hafta x saat x kişi) / projenin gerektirdiği saat
   - Özgünlük: çok seçilen havuz projesi geri plana düşer; Gemini projeleri 90
   - Toplam = 0,50 x uyum + 0,30 x yapılabilirlik + 0,20 x özgünlük
3. **Seçim:** En iyi 25 aday arasından MMR yöntemiyle 10 proje: puanı yüksek ama birbirine benzemeyenler.
   Aynı alandan en fazla 5 proje, Gemini çalışıyorsa en az 2 "sana özel" proje. Küçük bir rastgelelik
   sayesinde aynı profile sahip iki öğrenci aynı listeyi görmez.
