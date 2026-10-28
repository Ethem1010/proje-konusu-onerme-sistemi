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
(Telefondan gösterilecekse provayı da 5. bölümdeki komutlarla ve telefondan yap.)

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

## 5. Telefondan göstermek

Site telefonun tarayıcısında açılır; sunucu ve veritabanı yine laptopta çalışır.
Okul Wi-Fi'ı aynı ağdaki cihazların birbirini görmesini çoğu zaman engeller. Bu yüzden
laptopu **telefonun hotspot'una** bağla: telefon ve laptop aynı küçük ağda olur.

**Bir kere yapılacaklar**

1. Ana klasördeki `.env` dosyasına şu satırı ekle: `TELEFON_DEMO=1`
   (Bu satır olmadan sunucu sadece laptoptan gelen isteklere cevap verir.)
2. Laptopu telefonun hotspot'una bağla. Windows'ta **Ayarlar → Ağ ve İnternet → Wi-Fi →**
   bağlı olduğun ağın adı → **Ağ profili türü: Özel** seç. ("Ortak" kalırsa güvenlik duvarı telefonu engeller.)

**Her açılışta**

1. Sunucuyu şöyle başlat (ana klasörde): `uvicorn sunucu.main:app --host 0.0.0.0 --port 8000`
2. Arayüzü şöyle başlat: `cd arayuz; npm run dev:telefon`
3. Windows Güvenlik Duvarı "Python" ve "Node.js" için izin sorarsa **Özel ağlar** kutusu işaretliyken **İzin ver**.
4. Vite'ın terminalinde `Network: http://192.168.x.x:5173/` gibi bir satır çıkar. Telefonun tarayıcısına **o adresi** yaz.
5. Laptopta da her zamanki gibi http://localhost:5173 açılır; ikisi aynı anda çalışır.

Sunucu adresini elle yazmaya gerek yok: site telefondan açılınca sunucunun laptopta olduğunu kendisi bulur.
Hotspot kapanıp açılırsa adres değişebilir; 4. adımdaki satıra yeniden bak.

**Telefonda açılmazsa:** (1) Telefon ve laptop aynı hotspot'ta mı? (2) Ağ profili "Özel" mi?
(3) `.env`'de `TELEFON_DEMO=1` var mı, sunucu bundan sonra yeniden başlatıldı mı?
(4) Sunucu `--host 0.0.0.0` ile mi başlatıldı? Çözülmezse demoyu laptoptan göster, sistem aynı.

## 6. Demo günü

- [ ] Laptop şarjlı, şarj aleti ve görüntü adaptörü (HDMI) yanında.
- [ ] Telefonun şarjı dolu, hotspot açık, laptop hotspot'a bağlı.
- [ ] Demodan 15 dakika önce iki terminali (5. bölümdeki komutlarla) aç, siteyi giriş ekranına kadar aç (Gemini isteği harcama).
- [ ] Provada kaydettiğin metin ve demo hesabının şifresi elinin altında.
- [ ] Ekranda `.env` dosyası açık değil.
- [ ] Yedek ekran görüntüleri masaüstünde.

## 7. Demodan sonra

- [ ] `.env`'de kendi Gemini anahtarına ve `konu_kartlari` veritabanına geri dön.
- [ ] `GEMINI_ZAMAN_ASIMI` ve `TELEFON_DEMO` satırlarını kaldır.
