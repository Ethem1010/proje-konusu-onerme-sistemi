-- Konu Kartları: 3. hafta veritabanı güncellemesi (kendi modelimiz + proje havuzu)
-- Çalıştırma: psql -U postgres -d konu_kartlari -f veritabani/guncelleme.sql
--
-- tablolar.sql'in aksine HİÇBİR ŞEYİ SİLMEZ, sadece ekler. Tekrar çalıştırmak güvenli.
-- Yeni kurulumda gerek yok: tablolar.sql zaten bu hâliyle kuruyor.

BEGIN;

-- 1. Proje havuzu tablosu
CREATE TABLE IF NOT EXISTS havuz_projeleri (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  baslik           VARCHAR(200) NOT NULL UNIQUE,
  ne               TEXT         NOT NULL,
  alan             VARCHAR(30)  NOT NULL,
  alan2            VARCHAR(30),
  beceriler        JSONB        NOT NULL DEFAULT '[]',
  zorluk           SMALLINT     NOT NULL CHECK (zorluk BETWEEN 1 AND 3),
  hafta            SMALLINT     NOT NULL CHECK (hafta BETWEEN 1 AND 52),
  tercih           VARCHAR(20)  NOT NULL DEFAULT 'uretmek' CHECK (tercih IN ('uretmek', 'arastirmak')),
  kim              TEXT,
  cikti            TEXT,
  adimlar          JSONB        NOT NULL DEFAULT '[]',
  kolay            TEXT,
  efsane           TEXT,
  esin_kaynagi     VARCHAR(500),
  ekleyen          VARCHAR(50),
  secilme_sayisi   INTEGER      NOT NULL DEFAULT 0 CHECK (secilme_sayisi >= 0),
  olusturma_tarihi TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS havuz_projeleri_alan_idx ON havuz_projeleri(alan);

-- 2. Profil: öğrencinin istemediği alanlar
ALTER TABLE profiller ADD COLUMN IF NOT EXISTS istemedikleri JSONB NOT NULL DEFAULT '[]';

-- 3. Önerilen projeler: havuzdan mı geldi, Gemini mi üretti
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS kaynak VARCHAR(10) NOT NULL DEFAULT 'havuz';
ALTER TABLE projeler DROP CONSTRAINT IF EXISTS projeler_kaynak_check;
ALTER TABLE projeler ADD CONSTRAINT projeler_kaynak_check CHECK (kaynak IN ('havuz', 'gemini'));
ALTER TABLE projeler ADD COLUMN IF NOT EXISTS havuz_proje_id INTEGER
  REFERENCES havuz_projeleri(id) ON DELETE SET NULL;

-- 4. Bölüm listesi: sadece BM ve YM kalsın.
--    Bir profilin kullandığı bölüm silinmez (deneme verisi bozulmasın diye).
INSERT INTO bolumler (ad, grup) VALUES
  ('Bilgisayar Mühendisliği', 'muhendislik'),
  ('Yazılım Mühendisliği', 'muhendislik')
ON CONFLICT (ad) DO NOTHING;
DELETE FROM bolumler
WHERE ad NOT IN ('Bilgisayar Mühendisliği', 'Yazılım Mühendisliği')
  AND id NOT IN (SELECT bolum_id FROM profiller WHERE bolum_id IS NOT NULL);

COMMIT;
