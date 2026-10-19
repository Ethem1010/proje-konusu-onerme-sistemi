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
| `yapay_zeka.py` | Gemini bağlantısı (yeni proje ve görev haritası üretimi için) |

## Kullanım (ana klasörden)

```
pip install -r requirements.txt
python -m oneri_motoru.egitim                       # modeli eğit ve ölç
python -m oneri_motoru.profil "unity ile oyun yapmak istiyorum"
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
