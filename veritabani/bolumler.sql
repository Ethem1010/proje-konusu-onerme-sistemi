-- Konu Kartları: bölüm listesi
-- Çalıştırma: psql -U postgres -d konu_kartlari -f veritabani/bolumler.sql
-- Tekrar çalıştırmak güvenli: var olan bölümleri ikinci kez eklemez.

-- Sistem Bilgisayar ve Yazılım Mühendisliği öğrencileri için. Başka bölümden gelen
-- öğrenci arayüzde "Diğer" seçip bölümünü yazar (profiller.bolum_diger).
INSERT INTO bolumler (ad, grup) VALUES
  ('Bilgisayar Mühendisliği', 'muhendislik'),
  ('Yazılım Mühendisliği', 'muhendislik')
ON CONFLICT (ad) DO NOTHING;
