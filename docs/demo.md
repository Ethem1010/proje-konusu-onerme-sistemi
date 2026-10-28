# Demo: kurulum ve prova listesi

Demo Ethem'in laptopundan yapılacak. Bu liste, demodan birkaç gün önce sıfırdan kurulumu,
bir gün önce provayı ve demo gününü adım adım anlatır. Her maddeyi yaptıkça işaretleyin.

## 1. Demodan 2-3 gün önce: temiz kurulum

- [ ] Bütün PR'lar birleşti, VS Code'da `main` dalı seçili ve **Sync** yapıldı.
- [ ] Paketler güncel: `pip install -r requirements.txt` ve `cd arayuz; npm install`
- [ ] Demo için **ayrı ve boş bir veritabanı** (asıl veritabanı silinmez, demodan sonra ona dönülür):

  ```powershell
  psql -U postgres -c "CREATE DATABASE konu_kartlari_demo"
  psql -U postgres -d konu_kartlari_demo -f veritabani/tablolar.sql
  psql -U postgres -d konu_kartlari_demo -f veritabani/bolumler.sql
  ```

- [ ] `.env`'de `DATABASE_URL` satırının sonunu `/konu_kartlari_demo` yap.
- [ ] `python -m veritabani.havuz_yukle` → "325 proje eklendi."
- [ ] `python -m oneri_motoru.egitim` → sonunda "Model kaydedildi". Form dosyaları laptopta olduğu
      için test sonucu da yazar (ilk tahmin isabeti %86,7 civarı olmalı).
- [ ] Bütün testler geçiyor: `python -m unittest` ve `cd arayuz; npm test`

## 2. Demo anahtarı

- [ ] `.env`'de `GEMINI_API_KEY` satırına demo anahtarını yaz (anahtar proje klasörünün dışında saklanıyor).
- [ ] `.env`'e `GEMINI_ZAMAN_ASIMI=15` ekle: Gemini takılırsa sınıfta 30 değil en fazla 15 saniye beklenir.
- [ ] Demo anahtarının günlük istek sınırı düşük (yaklaşık 20). Bir tam tur (öneri + görev haritası)
      yaklaşık 2 istek harcar. **Provada en fazla 1-2 tam tur** yap, provayı demodan en az bir gün önce bitir.
- [ ] Demo anahtarını kimseye gönderme, `.env` açıkken ekran görüntüsü alma.

## 3. Prova (demodan bir gün önce, yaklaşık 15 dakika)

İki terminal: `uvicorn sunucu.main:app --reload` ve `cd arayuz; npm run dev`. Tarayıcıda http://localhost:5173

- [ ] Yeni hesap aç (ör. `demo1@ornek.com`). Demo günü için ayrıca `demo2@ornek.com` açılabilir.
- [ ] Bölüm, "Dönem projesi", 12 hafta seç. Kendini anlatan metni yaz; içinde bir istemediğin alan
      geçsin (ör. "web işlerinden hiç hoşlanmıyorum"). Metni bir yere kaydet, demoda aynısını kullan.
- [ ] Profil ekranında alanlar mantıklı, istemediğin alan "Bunları önermeyeceğiz" kutusunda görünüyor.
- [ ] Öneriler 20 saniyeden kısa sürede geldi, listede "Sana özel" (Gemini) projeler var.
- [ ] Bir projenin detayını aç, "Sürpriz proje" düğmesini dene.
- [ ] Düelloda 7 seçim yap, şampiyon çıkıyor.
- [ ] "Bu projeyi seç" → 12 adımlık harita geldi. İki adımı işaretle, sayfayı yenile: işaretler duruyor.
- [ ] Çıkış yap, tekrar gir: "Devam eden projelerin" panelinden haritaya gidilebiliyor.
- [ ] Prova sırasında her ekranın görüntüsünü al (projeksiyon ya da internet sorunu olursa yedek).

## 4. İnternet yokken (yedek prova, anahtar harcamaz)

- [ ] Wi-Fi'yi kapat, yeni bir profil oluştur: öneriler yine geliyor (sadece havuzdan),
      görev haritası yedek haritayla oluşuyor, sistem hata vermiyor.
- [ ] Hoca sorarsa: "Gemini cevap vermezse sistem havuz ve yedek haritayla devam ediyor, öğrenci hata görmüyor."

## 5. Telefondan göstermek (isteğe bağlı)

Okul Wi-Fi'ı aynı ağdaki cihazların birbirini görmesini çoğu zaman engeller. En garantisi
laptopu **telefonun hotspot'una** bağlamak. Bunu mutlaka demodan önce dene.

1. Laptopu telefonun hotspot'una bağla. PowerShell'de `ipconfig` yaz, "IPv4 Address" satırındaki adresi not al
   (ör. `192.168.43.20`; aşağıda bu adresi kendi adresinle değiştir).
2. Ana klasördeki `.env`'e ekle: `CORS_EK_ADRESLER=http://192.168.43.20:5173`
3. `arayuz` klasöründe `.env.local` adında bir dosya oluştur, içine: `VITE_SUNUCU_ADRESI=http://192.168.43.20:8000`
4. Sunucuyu şöyle başlat: `uvicorn sunucu.main:app --host 0.0.0.0 --port 8000`
5. Arayüzü şöyle başlat: `cd arayuz; npm run dev -- --host`
6. Windows Güvenlik Duvarı izin sorarsa "Özel ağlar" için izin ver.
7. Telefonun tarayıcısında `http://192.168.43.20:5173` adresini aç.

Demodan sonra `arayuz/.env.local` dosyasını sil ve `.env`'deki `CORS_EK_ADRESLER` satırını kaldır.
Hotspot değişince adres de değişir, adımları yeni adresle tekrarla.

## 6. Demo günü

- [ ] Laptop şarjlı, şarj aleti ve görüntü adaptörü (HDMI) yanında.
- [ ] Demodan 15 dakika önce iki terminali aç, siteyi giriş ekranına kadar aç (Gemini isteği harcama).
- [ ] Provada kaydettiğin metin ve demo hesabının şifresi elinin altında.
- [ ] Ekranda `.env` dosyası açık değil.
- [ ] Yedek ekran görüntüleri masaüstünde.

## 7. Demodan sonra

- [ ] `.env`'de kendi Gemini anahtarına ve `konu_kartlari` veritabanına geri dön.
- [ ] `GEMINI_ZAMAN_ASIMI` ve `CORS_EK_ADRESLER` satırlarını kaldır, `arayuz/.env.local` varsa sil.
