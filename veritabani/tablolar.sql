-- Konu Kartları: veritabanı tabloları
-- Çalıştırma: psql -U postgres -d konu_kartlari -f veritabani/tablolar.sql
-- DİKKAT: Dosya baştaki DROP satırları yüzünden tabloları silip yeniden kurar.
-- Sadece geliştirme sırasında kullan, içinde gerçek veri varken çalıştırma.

BEGIN;

DROP TABLE IF EXISTS yapay_zeka_kullanimi, benzerlik_onbellegi, gorev_adimlari,
  secilen_projeler, duello_secimleri, projeler, havuz_projeleri, profiller, bolumler, kullanicilar CASCADE;

-- 1. Kim giriş yapıyor
CREATE TABLE kullanicilar (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ad               VARCHAR(100) NOT NULL,
  eposta           VARCHAR(255) NOT NULL UNIQUE,
  sifre_ozeti      VARCHAR(255) NOT NULL,
  rol              VARCHAR(20)  NOT NULL DEFAULT 'ogrenci' CHECK (rol IN ('ogrenci', 'yonetici')),
  olusturma_tarihi TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2. Bölüm listesi
CREATE TABLE bolumler (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ad   VARCHAR(150) NOT NULL UNIQUE,
  grup VARCHAR(20)  NOT NULL CHECK (grup IN ('muhendislik', 'diger'))
);

-- 3. Öğrencinin kendini anlattığı her sefer
CREATE TABLE profiller (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kullanici_id     INTEGER     NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  bolum_id         INTEGER     REFERENCES bolumler(id),
  bolum_diger      VARCHAR(150),
  proje_turu       VARCHAR(20) NOT NULL CHECK (proje_turu IN ('ders', 'donem', 'bitirme', 'yarisma', 'kisisel')),
  sure_hafta       SMALLINT    NOT NULL CHECK (sure_hafta BETWEEN 1 AND 24),
  metin            TEXT        NOT NULL,
  haftalik_saat    SMALLINT    NOT NULL CHECK (haftalik_saat > 0),
  ekip             SMALLINT    NOT NULL CHECK (ekip >= 1),
  tercih           VARCHAR(20) NOT NULL CHECK (tercih IN ('uretmek', 'arastirmak', 'farketmez')),
  alanlar          JSONB       NOT NULL DEFAULT '[]',
  istemedikleri    JSONB       NOT NULL DEFAULT '[]',
  beceriler        JSONB       NOT NULL DEFAULT '[]',
  onaylandi        BOOLEAN     NOT NULL DEFAULT false,
  olusturma_tarihi TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (bolum_id IS NOT NULL OR bolum_diger IS NOT NULL)
);
CREATE INDEX profiller_kullanici_idx ON profiller(kullanici_id);

-- 4a. Proje havuzu: ekibin hazırladığı ~300 proje (veri/projeler.csv'den yüklenir)
CREATE TABLE havuz_projeleri (
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
CREATE INDEX havuz_projeleri_alan_idx ON havuz_projeleri(alan);

-- 4b. Öğrenciye önerilen projeler (profil başına 10): havuzdan seçilen ya da Gemini'nin ürettiği
CREATE TABLE projeler (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profil_id           INTEGER      NOT NULL REFERENCES profiller(id) ON DELETE CASCADE,
  kaynak              VARCHAR(10)  NOT NULL DEFAULT 'havuz' CHECK (kaynak IN ('havuz', 'gemini')),
  havuz_proje_id      INTEGER      REFERENCES havuz_projeleri(id) ON DELETE SET NULL,
  baslik              VARCHAR(200) NOT NULL,
  alan                VARCHAR(100) NOT NULL,
  alan2               VARCHAR(100),
  beceriler           JSONB        NOT NULL DEFAULT '[]',
  zorluk              SMALLINT     NOT NULL CHECK (zorluk BETWEEN 1 AND 3),
  hafta               SMALLINT     NOT NULL CHECK (hafta BETWEEN 1 AND 52),
  ne                  TEXT         NOT NULL,
  kim                 TEXT,
  cikti               TEXT,
  adimlar             JSONB        NOT NULL DEFAULT '[]',
  kolay               TEXT,
  efsane              TEXT,
  puan_uyum           SMALLINT CHECK (puan_uyum BETWEEN 0 AND 100),
  puan_yapilabilirlik SMALLINT CHECK (puan_yapilabilirlik BETWEEN 0 AND 100),
  puan_ozgunluk       SMALLINT CHECK (puan_ozgunluk BETWEEN 0 AND 100),
  puan_toplam         SMALLINT CHECK (puan_toplam BETWEEN 0 AND 100),
  benzer_baslik       VARCHAR(300),
  benzer_link         VARCHAR(500),
  benzerlik           NUMERIC(3,2) CHECK (benzerlik BETWEEN 0 AND 1),
  duelloda            BOOLEAN      NOT NULL DEFAULT false,
  surpriz             BOOLEAN      NOT NULL DEFAULT false,
  olusturma_tarihi    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX projeler_profil_idx ON projeler(profil_id);

-- 5. Düelloda kim kimi yendi
CREATE TABLE duello_secimleri (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profil_id         INTEGER     NOT NULL REFERENCES profiller(id) ON DELETE CASCADE,
  kazanan_proje_id  INTEGER     NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
  kaybeden_proje_id INTEGER     NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
  tur               VARCHAR(10) NOT NULL CHECK (tur IN ('ceyrek', 'yari', 'final')),
  tarih             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kazanan_proje_id <> kaybeden_proje_id)
);

-- 6. Öğrencinin seçtiği proje
CREATE TABLE secilen_projeler (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kullanici_id INTEGER     NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  proje_id     INTEGER     NOT NULL REFERENCES projeler(id) ON DELETE CASCADE,
  zorluk_modu  VARCHAR(10) NOT NULL DEFAULT 'orta' CHECK (zorluk_modu IN ('kolay', 'orta', 'efsane')),
  secim_tarihi TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Görev haritasının 12 adımı
CREATE TABLE gorev_adimlari (
  id                INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  secim_id          INTEGER      NOT NULL REFERENCES secilen_projeler(id) ON DELETE CASCADE,
  sira              SMALLINT     NOT NULL CHECK (sira BETWEEN 1 AND 12),
  baslik            VARCHAR(150) NOT NULL,
  aciklama          TEXT,
  tamamlandi        BOOLEAN      NOT NULL DEFAULT false,
  tamamlanma_tarihi TIMESTAMPTZ,
  UNIQUE (secim_id, sira)
);

-- 8. GitHub arama sonuçları (aynı arama tekrar yapılmasın diye)
CREATE TABLE benzerlik_onbellegi (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  arama_metni TEXT        NOT NULL UNIQUE,
  sonuclar    JSONB       NOT NULL DEFAULT '[]',
  tarih       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Günlük yapay zekâ çağrı sayacı
CREATE TABLE yapay_zeka_kullanimi (
  kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  tarih        DATE    NOT NULL DEFAULT current_date,
  sayi         INTEGER NOT NULL DEFAULT 0 CHECK (sayi >= 0),
  PRIMARY KEY (kullanici_id, tarih)
);

COMMIT;