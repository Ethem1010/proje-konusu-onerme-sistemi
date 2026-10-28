"""Sunucu testleri: bütün adresler gerçek bir veritabanıyla, baştan sona denenir.

Akış: kayıt → profil → onay → öneri → düello → seçim → görev haritası,
ve her adımın hata durumları (giriş yok, başkasının verisi, sıra dışı istek...).

GÜVENLİK: Bu testler veritabanındaki bütün tabloları silip yeniden kurar.
Bu yüzden SADECE ayrı bir test veritabanında çalışır:
  - .env'de TEST_DATABASE_URL yoksa testler hiç çalışmaz (atlanır).
  - Adres bu bilgisayarda değilse (localhost değilse) çalışmaz.
  - Veritabanının adında "test" geçmiyorsa çalışmaz.
  - Asıl veritabanıyla (DATABASE_URL) aynıysa çalışmaz.

Gemini'ye hiç bağlanılmaz: sahte cevap kullanılır, günlük hak harcanmaz.
Profil modeli yerine de sabit bir sahte profil kullanılır; modelin kendisi
test_oneri_motoru.py'de ayrıca test ediliyor.

Kurulum (bir kere):
    psql -U postgres -c "CREATE DATABASE konu_kartlari_test"
    .env dosyasına:  TEST_DATABASE_URL=postgresql+psycopg://postgres:SIFREN@localhost:5432/konu_kartlari_test
Çalıştırma:
    python -m unittest tests.test_sunucu -v
"""
import os
import unittest
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from dotenv import load_dotenv
from sqlalchemy.engine import make_url

load_dotenv()

TEST_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_URL:
    raise unittest.SkipTest(
        "TEST_DATABASE_URL tanımlı değil, sunucu testleri atlandı (dosyanın başındaki kuruluma bak)."
    )


def _guvenli_mi(test_url, asil_url):
    """Test veritabanı adresi güvenli değilse sebebini döner, güvenliyse None."""
    test = make_url(test_url)
    if test.host not in ("localhost", "127.0.0.1", "::1"):
        return f"Test veritabanı bu bilgisayarda değil ({test.host}). Testler sadece localhost'ta çalışır."
    if "test" not in (test.database or "").lower():
        return f"Test veritabanının adında 'test' geçmeli (şu an: {test.database})."
    if asil_url:
        asil = make_url(asil_url)
        if (asil.host, asil.port, asil.database) == (test.host, test.port, test.database):
            return "TEST_DATABASE_URL ile DATABASE_URL aynı veritabanını gösteriyor."
    return None


_sorun = _guvenli_mi(TEST_URL, os.getenv("DATABASE_URL"))
if _sorun:
    # Atlamak yerine hata veriyoruz: yanlış ayar sessizce geçmesin, ama hiçbir şey silinmeden dursun.
    raise RuntimeError("Sunucu testleri durduruldu: " + _sorun)

# Sunucu modülleri yüklenmeden ÖNCE: her şey test veritabanına gitsin.
os.environ["DATABASE_URL"] = TEST_URL
os.environ.setdefault("JWT_GIZLI_ANAHTAR", "sadece-test-icin-anahtar-" + uuid.uuid4().hex)

import jwt  # noqa: E402
import psycopg  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, select  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from oneri_motoru import uretim  # noqa: E402
from oneri_motoru.veri import projeleri_oku  # noqa: E402
from oneri_motoru.yapay_zeka import YapayZekaHatasi  # noqa: E402
from sunucu import guvenlik  # noqa: E402
from sunucu.main import app  # noqa: E402
from veritabani.baglanti import oturum_al  # noqa: E402
from veritabani.modeller import HavuzProjesi, YapayZekaKullanimi  # noqa: E402

KOK = Path(__file__).resolve().parents[1]
motor = create_engine(TEST_URL, pool_pre_ping=True)
TestOturumu = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


def _test_oturumu():
    oturum = TestOturumu()
    try:
        yield oturum
    finally:
        oturum.close()


def setUpModule():
    """Test veritabanını sıfırdan kurar: tablolar, bölümler, proje havuzu."""
    adres = make_url(TEST_URL).set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(adres, autocommit=True) as baglanti:
        for dosya in ("tablolar.sql", "bolumler.sql"):
            baglanti.execute((KOK / "veritabani" / dosya).read_text(encoding="utf-8"))

    sutunlar = {c.name for c in HavuzProjesi.__table__.columns}
    with TestOturumu() as oturum:
        oturum.add_all(HavuzProjesi(**{k: v for k, v in p.items() if k in sutunlar}) for p in projeleri_oku())
        oturum.commit()

    app.dependency_overrides[oturum_al] = _test_oturumu


def tearDownModule():
    app.dependency_overrides.pop(oturum_al, None)
    motor.dispose()


# --- Sahte Gemini ve sahte profil ------------------------------------------------

SAHTE_PROFIL = {
    "alanlar": [
        {"kod": "oyun", "ad": "Oyun Geliştirme", "puan": 5},
        {"kod": "yapay_zeka", "ad": "Yapay Zekâ ve Makine Öğrenmesi", "puan": 3},
        {"kod": "mobil", "ad": "Mobil Uygulama", "puan": 2},
    ],
    "istemedikleri": ["web"],
    "beceriler": ["Unity", "C#"],
}

GEMINI_PROJELERI = {"projeler": [
    {"baslik": f"Sahte Gemini Oyunu {i}", "ne": "Test için üretilmiş bir oyun projesi.", "alan": "oyun",
     "alan2": "", "beceriler": ["Unity"], "zorluk": 2, "hafta": 8, "tercih": "uretmek",
     "kim": "öğrenciler", "cikti": "oynanabilir oyun", "adimlar": ["Tasarla", "Kodla", "Dene", "Sun"],
     "kolay": "tek bölüm", "efsane": "çok oyunculu"}
    for i in range(5)
]}

GEMINI_HARITASI = {"adimlar": [
    {"baslik": f"Gemini adımı {i}", "aciklama": f"{i}. adımda yapılacak iş."} for i in range(1, 13)
]}


def sahte_sor(komut, sema=None, **ayar):
    """uretim.sor'un yerine geçer: Gemini'ye gitmeden kalıba uygun cevap döner."""
    if sema is uretim.HARITA_SEMASI:
        return GEMINI_HARITASI
    return GEMINI_PROJELERI


def sahte_profil_cikar(metin):
    return {k: [dict(a) for a in v] if k == "alanlar" else list(v) for k, v in SAHTE_PROFIL.items()}


PROFIL_ISTEGI = {
    "bolum_id": 1,
    "proje_turu": "donem",
    "sure_hafta": 12,
    "metin": "Unity ile oyun yapmayı seviyorum, C# biliyorum ama web işlerine hiç ilgim yok.",
    "haftalik_saat": 8,
    "ekip": 2,
    "tercih": "uretmek",
}


class SunucuTesti(unittest.TestCase):
    """Ortak hazırlık: istemci, sahte Gemini, yeni öğrenci açma kısayolları."""

    def setUp(self):
        self.istemci = TestClient(app)
        yama = mock.patch("oneri_motoru.uretim.sor", side_effect=sahte_sor)
        self.sor = yama.start()
        self.addCleanup(yama.stop)
        yama = mock.patch("sunucu.rotalar.profil.profil_cikar", side_effect=sahte_profil_cikar)
        yama.start()
        self.addCleanup(yama.stop)

    # Kısayollar
    def ogrenci(self):
        """Yeni bir öğrenci açar; (başlık, kullanici_id) döner."""
        cevap = self.istemci.post("/auth/kayit", json={
            "ad": "Test Öğrenci", "eposta": f"ogr_{uuid.uuid4().hex[:10]}@test.com", "sifre": "gizli123",
        })
        self.assertEqual(cevap.status_code, 201, cevap.text)
        veri = cevap.json()
        return {"Authorization": f"Bearer {veri['erisim_jetonu']}"}, veri["kullanici_id"]

    def profil(self, baslik, onayla=True, **degisen):
        cevap = self.istemci.post("/profil", json={**PROFIL_ISTEGI, **degisen}, headers=baslik)
        self.assertEqual(cevap.status_code, 201, cevap.text)
        profil = cevap.json()
        if onayla:
            cevap = self.istemci.put(f"/profil/{profil['id']}", headers=baslik, json={
                "alanlar": [{"kod": a["kod"], "puan": a["puan"]} for a in profil["alanlar"]],
                "istemedikleri": profil["istemedikleri"],
                "beceriler": profil["beceriler"],
            })
            self.assertEqual(cevap.status_code, 200, cevap.text)
            profil = cevap.json()
        return profil

    def oneriler(self, baslik, profil_id):
        cevap = self.istemci.post(f"/oneriler/{profil_id}", headers=baslik)
        self.assertEqual(cevap.status_code, 200, cevap.text)
        return cevap.json()

    def duelloyu_bitir(self, baslik, profil_id, projeler):
        """8 düello projesini oynatır, her maçta soldaki kazanır. Şampiyonun id'sini döner."""
        kalanlar = [p["id"] for p in projeler if p["duelloda"]]
        for tur in ("ceyrek", "yari", "final"):
            kazananlar = []
            for sol, sag in zip(kalanlar[::2], kalanlar[1::2]):
                cevap = self.istemci.post("/duello", headers=baslik, json={
                    "profil_id": profil_id, "kazanan_proje_id": sol, "kaybeden_proje_id": sag, "tur": tur,
                })
                self.assertEqual(cevap.status_code, 201, cevap.text)
                kazananlar.append(sol)
            kalanlar = kazananlar
        return kalanlar[0]

    def bugunku_hak(self, kullanici_id):
        with TestOturumu() as oturum:
            kayit = oturum.get(YapayZekaKullanimi, (kullanici_id, date.today()))
            return kayit.sayi if kayit else 0


# --- 1. Durum ve bölümler --------------------------------------------------------

class DurumVeBolumTestleri(SunucuTesti):
    def test_sunucu_ayakta(self):
        cevap = self.istemci.get("/")
        self.assertEqual(cevap.status_code, 200)
        self.assertEqual(cevap.json(), {"durum": "çalışıyor"})

    def test_bolum_listesi(self):
        cevap = self.istemci.get("/bolumler")
        self.assertEqual(cevap.status_code, 200)
        adlar = [b["ad"] for b in cevap.json()]
        self.assertIn("Bilgisayar Mühendisliği", adlar)
        self.assertIn("Yazılım Mühendisliği", adlar)


# --- 2. Kayıt ve giriş -----------------------------------------------------------

class GirisTestleri(SunucuTesti):
    def test_kayit_giris_ve_ben(self):
        eposta = f"ayse_{uuid.uuid4().hex[:8]}@test.com"
        cevap = self.istemci.post("/auth/kayit", json={"ad": "Ayşe", "eposta": eposta, "sifre": "gizli123"})
        self.assertEqual(cevap.status_code, 201)
        self.assertEqual(cevap.json()["jeton_turu"], "bearer")

        # E-posta büyük harfle ve boşlukla yazılsa da aynı hesap
        cevap = self.istemci.post("/auth/giris", json={"eposta": f"  {eposta.upper()} ", "sifre": "gizli123"})
        self.assertEqual(cevap.status_code, 200)
        jeton = cevap.json()["erisim_jetonu"]

        cevap = self.istemci.get("/auth/ben", headers={"Authorization": f"Bearer {jeton}"})
        self.assertEqual(cevap.status_code, 200)
        self.assertEqual(cevap.json()["eposta"], eposta)
        self.assertEqual(cevap.json()["rol"], "ogrenci")
        self.assertNotIn("sifre_ozeti", cevap.json())

    def test_ayni_eposta_ikinci_kez_kayit_olamaz(self):
        eposta = f"ali_{uuid.uuid4().hex[:8]}@test.com"
        self.istemci.post("/auth/kayit", json={"ad": "Ali", "eposta": eposta, "sifre": "gizli123"})
        cevap = self.istemci.post("/auth/kayit", json={"ad": "Ali 2", "eposta": eposta.upper(), "sifre": "baska123"})
        self.assertEqual(cevap.status_code, 409)

    def test_hatali_kayit_bilgisi(self):
        for istek in (
            {"ad": "Ali", "eposta": "ali@test.com", "sifre": "123"},          # şifre kısa
            {"ad": "Ali", "eposta": "bu-eposta-degil", "sifre": "gizli123"},   # e-posta kalıbı
            {"ad": "A", "eposta": "a@test.com", "sifre": "gizli123"},          # ad kısa
        ):
            with self.subTest(istek=istek):
                self.assertEqual(self.istemci.post("/auth/kayit", json=istek).status_code, 422)

    def test_yanlis_sifre_ve_olmayan_hesap_ayni_cevabi_alir(self):
        eposta = f"veli_{uuid.uuid4().hex[:8]}@test.com"
        self.istemci.post("/auth/kayit", json={"ad": "Veli", "eposta": eposta, "sifre": "gizli123"})
        yanlis_sifre = self.istemci.post("/auth/giris", json={"eposta": eposta, "sifre": "yanlis1"})
        olmayan = self.istemci.post("/auth/giris", json={"eposta": "yok_" + eposta, "sifre": "gizli123"})
        self.assertEqual(yanlis_sifre.status_code, 401)
        self.assertEqual(olmayan.status_code, 401)
        self.assertEqual(yanlis_sifre.json(), olmayan.json())  # hangisinin yanlış olduğu söylenmez

    def test_jetonsuz_bozuk_ve_suresi_dolmus_jeton(self):
        _, kullanici_id = self.ogrenci()
        eski = jwt.encode(
            {"sub": str(kullanici_id), "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
            guvenlik.GIZLI_ANAHTAR, algorithm=guvenlik.ALGORITMA,
        )
        baska_anahtarla = jwt.encode({"sub": str(kullanici_id)}, "baska-bir-anahtar-" + "x" * 32, algorithm="HS256")
        for baslik in ({}, {"Authorization": "Bearer bozuk.jeton"}, {"Authorization": f"Bearer {eski}"},
                       {"Authorization": f"Bearer {baska_anahtarla}"}):
            with self.subTest(baslik=baslik):
                self.assertEqual(self.istemci.get("/auth/ben", headers=baslik).status_code, 401)

    def test_giris_isteyen_adresler_jetonsuz_401(self):
        for yontem, adres in (
            ("post", "/profil"), ("get", "/profil/1"), ("post", "/oneriler/1"), ("get", "/oneriler/1"),
            ("get", "/projeler/1"), ("get", "/surpriz/1"), ("post", "/duello"), ("get", "/duello/1"),
            ("post", "/secim"), ("get", "/harita/1"), ("put", "/harita/1"),
        ):
            with self.subTest(adres=adres):
                self.assertEqual(getattr(self.istemci, yontem)(adres).status_code, 401)


# --- 3. Profil -------------------------------------------------------------------

class ProfilTestleri(SunucuTesti):
    def test_profil_once_onaysiz_sonra_onayli(self):
        baslik, _ = self.ogrenci()
        profil = self.profil(baslik, onayla=False)
        self.assertFalse(profil["onaylandi"])
        self.assertEqual([a["kod"] for a in profil["alanlar"]], ["oyun", "yapay_zeka", "mobil"])

        cevap = self.istemci.put(f"/profil/{profil['id']}", headers=baslik, json={
            "alanlar": [{"kod": "oyun", "puan": 4}, {"kod": "siber_guvenlik", "puan": 2}],
            "istemedikleri": ["web", "web"],
            "beceriler": [" Unity ", "Unity", ""],
        })
        self.assertEqual(cevap.status_code, 200)
        veri = cevap.json()
        self.assertTrue(veri["onaylandi"])
        self.assertEqual(veri["alanlar"][1], {"kod": "siber_guvenlik", "ad": "Siber Güvenlik", "puan": 2})
        self.assertEqual(veri["istemedikleri"], ["web"])   # tekrar atıldı
        self.assertEqual(veri["beceriler"], ["Unity"])     # boşluk ve tekrar temizlendi

        cevap = self.istemci.get(f"/profil/{profil['id']}", headers=baslik)
        self.assertEqual(cevap.json(), veri)

    def test_diger_bolum_yazilabilir(self):
        baslik, _ = self.ogrenci()
        istek = {**PROFIL_ISTEGI, "bolum_id": None, "bolum_diger": "Makine Mühendisliği"}
        self.assertEqual(self.istemci.post("/profil", json=istek, headers=baslik).status_code, 201)

    def test_hatali_profil_istekleri(self):
        baslik, _ = self.ogrenci()
        for degisen, kod in (
            ({"metin": "kısa"}, 422),                         # en az 20 harf
            ({"bolum_id": None, "bolum_diger": ""}, 422),     # bölüm boş
            ({"sure_hafta": 30}, 422),                        # 1-24 hafta
            ({"proje_turu": "tez"}, 422),
            ({"bolum_id": 9999}, 400),                        # olmayan bölüm
        ):
            with self.subTest(degisen=degisen):
                cevap = self.istemci.post("/profil", json={**PROFIL_ISTEGI, **degisen}, headers=baslik)
                self.assertEqual(cevap.status_code, kod, cevap.text)

    def test_hatali_onay_istekleri(self):
        baslik, _ = self.ogrenci()
        profil_id = self.profil(baslik, onayla=False)["id"]
        alti_alan = [{"kod": k, "puan": 3} for k in ("web", "mobil", "oyun", "dogal_dil", "veri_bilimi", "bulut_devops")]
        for istek in (
            {"alanlar": []},                                                    # en az 1 alan
            {"alanlar": alti_alan},                                             # en çok 5 alan
            {"alanlar": [{"kod": "uzay", "puan": 3}]},                          # bilinmeyen alan
            {"alanlar": [{"kod": "oyun", "puan": 9}]},                          # puan 1-5
            {"alanlar": [{"kod": "oyun", "puan": 3}, {"kod": "oyun", "puan": 2}]},
            {"alanlar": [{"kod": "web", "puan": 3}], "istemedikleri": ["web"]},  # çelişki
        ):
            with self.subTest(istek=istek):
                cevap = self.istemci.put(f"/profil/{profil_id}", json=istek, headers=baslik)
                self.assertEqual(cevap.status_code, 422, cevap.text)

    def test_baskasinin_profili_404(self):
        ayse, _ = self.ogrenci()
        ali, _ = self.ogrenci()
        profil_id = self.profil(ayse, onayla=False)["id"]
        self.assertEqual(self.istemci.get(f"/profil/{profil_id}", headers=ali).status_code, 404)
        cevap = self.istemci.put(f"/profil/{profil_id}", headers=ali, json={"alanlar": [{"kod": "oyun", "puan": 5}]})
        self.assertEqual(cevap.status_code, 404)
        self.assertEqual(self.istemci.get("/profil/999999", headers=ayse).status_code, 404)


# --- 4. Öneriler -----------------------------------------------------------------

class OneriTestleri(SunucuTesti):
    def test_onaysiz_profile_oneri_yok(self):
        baslik, _ = self.ogrenci()
        profil_id = self.profil(baslik, onayla=False)["id"]
        self.assertEqual(self.istemci.post(f"/oneriler/{profil_id}", headers=baslik).status_code, 400)
        self.assertEqual(self.istemci.get(f"/surpriz/{profil_id}", headers=baslik).status_code, 400)

    def test_on_oneri_sirali_kayitli_ve_gemini_hakki_dusuyor(self):
        baslik, kullanici_id = self.ogrenci()
        profil_id = self.profil(baslik)["id"]
        projeler = self.oneriler(baslik, profil_id)

        self.assertEqual(len(projeler), 10)
        puanlar = [p["puan_toplam"] for p in projeler]
        self.assertEqual(puanlar, sorted(puanlar, reverse=True))
        self.assertEqual(sum(p["duelloda"] for p in projeler), 8)
        self.assertTrue(any(p["kaynak"] == "gemini" for p in projeler))
        self.assertTrue(any(p["kaynak"] == "havuz" for p in projeler))
        for p in projeler:  # öğrencinin istemediği alan hiç gelmez
            self.assertNotIn("web", (p["alan"], p["alan2"]))
            self.assertEqual(len(p["adimlar"]), 4)
        self.assertEqual(self.bugunku_hak(kullanici_id), 1)

        # Sayfa yenilenince aynı liste gelir
        cevap = self.istemci.get(f"/oneriler/{profil_id}", headers=baslik)
        self.assertEqual([p["id"] for p in cevap.json()], [p["id"] for p in projeler])

    def test_gemini_cevap_vermezse_havuzdan_onerir_hak_dusmez(self):
        baslik, kullanici_id = self.ogrenci()
        profil_id = self.profil(baslik)["id"]
        self.sor.side_effect = YapayZekaHatasi("zaman aşımı")
        projeler = self.oneriler(baslik, profil_id)
        self.assertEqual(len(projeler), 10)
        self.assertTrue(all(p["kaynak"] == "havuz" for p in projeler))
        self.assertEqual(self.bugunku_hak(kullanici_id), 0)

    def test_gunluk_hak_dolunca_gemini_cagrilmaz(self):
        baslik, kullanici_id = self.ogrenci()
        profil_id = self.profil(baslik)["id"]
        with TestOturumu() as oturum:
            oturum.add(YapayZekaKullanimi(kullanici_id=kullanici_id, tarih=date.today(), sayi=10_000))
            oturum.commit()
        projeler = self.oneriler(baslik, profil_id)
        self.assertEqual(len(projeler), 10)
        self.sor.assert_not_called()
        self.assertTrue(all(p["kaynak"] == "havuz" for p in projeler))

    def test_duellodan_once_yenilenir_sonra_409(self):
        baslik, _ = self.ogrenci()
        profil_id = self.profil(baslik)["id"]
        ilk = self.oneriler(baslik, profil_id)
        ikinci = self.oneriler(baslik, profil_id)  # düello yokken yeniden üretmek serbest
        self.assertEqual(len(ikinci), 10)
        self.assertTrue(set(p["id"] for p in ilk).isdisjoint(p["id"] for p in ikinci))

        mac = [p["id"] for p in ikinci if p["duelloda"]][:2]
        self.istemci.post("/duello", headers=baslik, json={
            "profil_id": profil_id, "kazanan_proje_id": mac[0], "kaybeden_proje_id": mac[1], "tur": "ceyrek",
        })
        self.assertEqual(self.istemci.post(f"/oneriler/{profil_id}", headers=baslik).status_code, 409)

    def test_baskasinin_onerileri_ve_projesi_404(self):
        ayse, _ = self.ogrenci()
        ali, _ = self.ogrenci()
        profil_id = self.profil(ayse)["id"]
        proje_id = self.oneriler(ayse, profil_id)[0]["id"]
        self.assertEqual(self.istemci.get(f"/oneriler/{profil_id}", headers=ali).status_code, 404)
        self.assertEqual(self.istemci.post(f"/oneriler/{profil_id}", headers=ali).status_code, 404)
        self.assertEqual(self.istemci.get(f"/projeler/{proje_id}", headers=ali).status_code, 404)
        self.assertEqual(self.istemci.get(f"/surpriz/{profil_id}", headers=ali).status_code, 404)
        self.assertEqual(self.istemci.get(f"/projeler/{proje_id}", headers=ayse).status_code, 200)
        self.assertEqual(self.istemci.get("/projeler/999999", headers=ayse).status_code, 404)

    def test_surpriz_proje_ilgi_disindan_ve_hep_ayni(self):
        baslik, _ = self.ogrenci()
        profil = self.profil(baslik)
        projeler = self.oneriler(baslik, profil["id"])
        cevap = self.istemci.get(f"/surpriz/{profil['id']}", headers=baslik)
        self.assertEqual(cevap.status_code, 200)
        surpriz = cevap.json()
        self.assertTrue(surpriz["surpriz"])
        self.assertFalse(surpriz["duelloda"])
        self.assertNotIn(surpriz["alan"], {a["kod"] for a in profil["alanlar"]})
        self.assertNotIn("web", (surpriz["alan"], surpriz["alan2"]))
        self.assertNotIn(surpriz["id"], {p["id"] for p in projeler})

        tekrar = self.istemci.get(f"/surpriz/{profil['id']}", headers=baslik).json()
        self.assertEqual(tekrar["id"], surpriz["id"])
        # Sürpriz, 10'luk öneri listesine karışmaz
        self.assertEqual(len(self.istemci.get(f"/oneriler/{profil['id']}", headers=baslik).json()), 10)


# --- 5. Düello -------------------------------------------------------------------

class DuelloTestleri(SunucuTesti):
    def hazirla(self):
        baslik, _ = self.ogrenci()
        profil_id = self.profil(baslik)["id"]
        projeler = self.oneriler(baslik, profil_id)
        return baslik, profil_id, projeler

    def mac(self, baslik, profil_id, kazanan, kaybeden, tur):
        return self.istemci.post("/duello", headers=baslik, json={
            "profil_id": profil_id, "kazanan_proje_id": kazanan, "kaybeden_proje_id": kaybeden, "tur": tur,
        })

    def test_yedi_macla_sampiyon_ve_sekizinci_mac_yok(self):
        baslik, profil_id, projeler = self.hazirla()
        sampiyon = self.duelloyu_bitir(baslik, profil_id, projeler)

        kayitlar = self.istemci.get(f"/duello/{profil_id}", headers=baslik).json()
        self.assertEqual([k["tur"] for k in kayitlar], ["ceyrek"] * 4 + ["yari"] * 2 + ["final"])
        self.assertEqual(kayitlar[-1]["kazanan_proje_id"], sampiyon)

        cevap = self.mac(baslik, profil_id, sampiyon, kayitlar[-1]["kaybeden_proje_id"], "final")
        self.assertEqual(cevap.status_code, 400)

    def test_kurala_uymayan_maclar_400(self):
        baslik, profil_id, projeler = self.hazirla()
        d = [p["id"] for p in projeler if p["duelloda"]]
        disarida = next(p["id"] for p in projeler if not p["duelloda"])

        self.assertEqual(self.mac(baslik, profil_id, d[0], d[0], "ceyrek").status_code, 400)       # kendisiyle
        self.assertEqual(self.mac(baslik, profil_id, d[0], d[1], "son16").status_code, 400)        # olmayan tur
        self.assertEqual(self.mac(baslik, profil_id, d[0], disarida, "ceyrek").status_code, 400)   # düelloda değil
        self.assertEqual(self.mac(baslik, profil_id, d[0], 999999, "ceyrek").status_code, 400)     # olmayan proje

        self.assertEqual(self.mac(baslik, profil_id, d[0], d[1], "ceyrek").status_code, 201)
        self.assertEqual(self.mac(baslik, profil_id, d[1], d[2], "ceyrek").status_code, 400)       # d[1] elendi

    def test_baska_profilin_projesiyle_mac_400(self):
        baslik, profil_id, projeler = self.hazirla()
        baska_profil = self.profil(baslik)["id"]
        baska = [p["id"] for p in self.oneriler(baslik, baska_profil) if p["duelloda"]]
        benim = [p["id"] for p in projeler if p["duelloda"]]
        self.assertEqual(self.mac(baslik, profil_id, benim[0], baska[0], "ceyrek").status_code, 400)

    def test_baskasinin_duellosu_404(self):
        baslik, profil_id, projeler = self.hazirla()
        ali, _ = self.ogrenci()
        d = [p["id"] for p in projeler if p["duelloda"]]
        self.assertEqual(self.mac(ali, profil_id, d[0], d[1], "ceyrek").status_code, 404)
        self.assertEqual(self.istemci.get(f"/duello/{profil_id}", headers=ali).status_code, 404)
        self.assertEqual(self.istemci.get(f"/duello/{profil_id}", headers=baslik).json(), [])


# --- 6. Seçim ve görev haritası -------------------------------------------------

class HaritaTestleri(SunucuTesti):
    def sampiyon(self):
        baslik, kullanici_id = self.ogrenci()
        profil_id = self.profil(baslik)["id"]
        projeler = self.oneriler(baslik, profil_id)
        return baslik, kullanici_id, self.duelloyu_bitir(baslik, profil_id, projeler), projeler

    def test_secim_12_adimlik_harita_uretir(self):
        baslik, kullanici_id, proje_id, _ = self.sampiyon()
        hak_once = self.bugunku_hak(kullanici_id)
        cevap = self.istemci.post("/secim", headers=baslik, json={"proje_id": proje_id, "zorluk_modu": "efsane"})
        self.assertEqual(cevap.status_code, 201, cevap.text)
        harita = cevap.json()
        self.assertEqual(harita["proje_id"], proje_id)
        self.assertEqual(harita["zorluk_modu"], "efsane")
        self.assertEqual([a["sira"] for a in harita["adimlar"]], list(range(1, 13)))
        self.assertEqual(harita["adimlar"][0]["baslik"], "Gemini adımı 1")
        self.assertFalse(any(a["tamamlandi"] for a in harita["adimlar"]))
        self.assertEqual(self.bugunku_hak(kullanici_id), hak_once + 1)

        # Aynı proje tekrar seçilirse yeni harita açılmaz
        tekrar = self.istemci.post("/secim", headers=baslik, json={"proje_id": proje_id}).json()
        self.assertEqual(tekrar["secim_id"], harita["secim_id"])
        self.assertEqual(self.bugunku_hak(kullanici_id), hak_once + 1)

    def test_gemini_yoksa_yedek_harita_hak_dusmez(self):
        baslik, kullanici_id, proje_id, _ = self.sampiyon()
        hak_once = self.bugunku_hak(kullanici_id)
        self.sor.side_effect = YapayZekaHatasi("zaman aşımı")
        with self.assertLogs("sunucu.rotalar.secim", level="ERROR"):
            cevap = self.istemci.post("/secim", headers=baslik, json={"proje_id": proje_id})
        self.assertEqual(cevap.status_code, 201)
        adimlar = cevap.json()["adimlar"]
        self.assertEqual(len(adimlar), 12)
        self.assertTrue(all(a["baslik"] for a in adimlar))
        self.assertNotIn("Gemini adımı 1", [a["baslik"] for a in adimlar])
        self.assertEqual(self.bugunku_hak(kullanici_id), hak_once)

    def test_havuz_projesi_secilince_secilme_sayisi_artar(self):
        baslik, _, _, projeler = self.sampiyon()
        havuzdan = next(p for p in projeler if p["kaynak"] == "havuz")
        with TestOturumu() as oturum:
            once = oturum.get(HavuzProjesi, havuzdan["havuz_proje_id"]).secilme_sayisi
        self.istemci.post("/secim", headers=baslik, json={"proje_id": havuzdan["id"]})
        with TestOturumu() as oturum:
            sonra = oturum.get(HavuzProjesi, havuzdan["havuz_proje_id"]).secilme_sayisi
        self.assertEqual(sonra, once + 1)

    def test_adim_isaretleme_ve_geri_alma(self):
        baslik, _, proje_id, _ = self.sampiyon()
        secim_id = self.istemci.post("/secim", headers=baslik, json={"proje_id": proje_id}).json()["secim_id"]

        cevap = self.istemci.put(f"/harita/{secim_id}", headers=baslik, json={"sira": 3, "tamamlandi": True})
        self.assertEqual(cevap.status_code, 200)
        ucuncu = cevap.json()["adimlar"][2]
        self.assertTrue(ucuncu["tamamlandi"])
        self.assertIsNotNone(ucuncu["tamamlanma_tarihi"])

        harita = self.istemci.get(f"/harita/{secim_id}", headers=baslik).json()
        self.assertTrue(harita["adimlar"][2]["tamamlandi"])  # kaydedildi, yenileyince de duruyor

        cevap = self.istemci.put(f"/harita/{secim_id}", headers=baslik, json={"sira": 3, "tamamlandi": False})
        ucuncu = cevap.json()["adimlar"][2]
        self.assertFalse(ucuncu["tamamlandi"])
        self.assertIsNone(ucuncu["tamamlanma_tarihi"])

        for sira in (0, 13):
            cevap = self.istemci.put(f"/harita/{secim_id}", headers=baslik, json={"sira": sira, "tamamlandi": True})
            self.assertEqual(cevap.status_code, 422)

    def test_baskasinin_secimi_ve_haritasi_404(self):
        baslik, _, proje_id, _ = self.sampiyon()
        ali, _ = self.ogrenci()
        self.assertEqual(self.istemci.post("/secim", headers=ali, json={"proje_id": proje_id}).status_code, 404)
        secim_id = self.istemci.post("/secim", headers=baslik, json={"proje_id": proje_id}).json()["secim_id"]
        self.assertEqual(self.istemci.get(f"/harita/{secim_id}", headers=ali).status_code, 404)
        cevap = self.istemci.put(f"/harita/{secim_id}", headers=ali, json={"sira": 1, "tamamlandi": True})
        self.assertEqual(cevap.status_code, 404)
        self.assertEqual(self.istemci.get("/harita/999999", headers=baslik).status_code, 404)

    def test_hatali_zorluk_modu_422(self):
        baslik, _, proje_id, _ = self.sampiyon()
        cevap = self.istemci.post("/secim", headers=baslik, json={"proje_id": proje_id, "zorluk_modu": "imkansiz"})
        self.assertEqual(cevap.status_code, 422)


if __name__ == "__main__":
    unittest.main()
