"""Sıralama ve üretim testleri. Gemini'ye gerçekten bağlanmaz, sahte cevap kullanır."""
import random
import unittest
from unittest import mock

from oneri_motoru import siralama
from oneri_motoru.uretim import yedek_harita
from oneri_motoru.yapay_zeka import YapayZekaHatasi

PROFIL = {
    "alanlar": [
        {"kod": "oyun", "ad": "Oyun Geliştirme", "puan": 5},
        {"kod": "yapay_zeka", "ad": "Yapay Zekâ", "puan": 3},
        {"kod": "mobil", "ad": "Mobil", "puan": 2},
        {"kod": "veri_bilimi", "ad": "Veri Bilimi", "puan": 1},
        {"kod": "gomulu_iot", "ad": "Gömülü", "puan": 1},
    ],
    "istemedikleri": ["web"],
    "beceriler": ["Unity", "C#"],
    "sure_hafta": 12, "haftalik_saat": 8, "ekip": 2, "tercih": "uretmek",
}

GEMINI_CEVABI = {"projeler": [
    {"baslik": f"Özel Oyun {i}", "ne": "Bir oyun. Veri: test", "alan": "oyun", "alan2": "", "beceriler": ["Unity"],
     "zorluk": 2, "hafta": 8, "tercih": "uretmek", "kim": "öğrenciler", "cikti": "oyun",
     "adimlar": ["a", "b", "c", "d"], "kolay": "k", "efsane": "e"} for i in range(5)
] + [{"baslik": "İstenmeyen Web", "ne": "x", "alan": "web", "alan2": "", "beceriler": [], "zorluk": 1, "hafta": 4,
      "tercih": "uretmek", "kim": "", "cikti": "", "adimlar": ["a", "b", "c", "d"], "kolay": "", "efsane": ""}]}


class SiralamaTesti(unittest.TestCase):
    def oner(self, **ek):
        return siralama.oner({**PROFIL, **ek}, gemini_kullan=False, rastgele=random.Random(1))

    def test_on_proje_ilk_sekizi_duelloda(self):
        projeler = self.oner()
        self.assertEqual(len(projeler), 10)
        self.assertEqual([p["duelloda"] for p in projeler], [True] * 8 + [False] * 2)

    def test_istenmeyen_alan_gelmez(self):
        for p in self.oner():
            self.assertNotIn("web", (p["alan"], p["alan2"]))

    def test_cesitlilik(self):
        alanlar = [p["alan"] for p in self.oner()]
        self.assertLessEqual(alanlar.count("oyun"), siralama.AYNI_ALAN_EN_FAZLA)
        self.assertEqual(alanlar[0], "oyun")  # en ilgili alan en üstte

    def test_puanlar_sinirlar_icinde_ve_sirali(self):
        projeler = self.oner()
        for p in projeler:
            for anahtar in ("puan_uyum", "puan_yapilabilirlik", "puan_ozgunluk", "puan_toplam"):
                self.assertTrue(0 <= p[anahtar] <= 100)
        toplamlar = [p["puan_toplam"] for p in projeler]
        self.assertEqual(toplamlar, sorted(toplamlar, reverse=True))

    def test_kisa_surede_zor_proje_gelmez(self):
        for p in self.oner(sure_hafta=3, haftalik_saat=4, ekip=1):
            self.assertEqual(p["zorluk"], 1)

    def test_cok_secilen_proje_geri_duser(self):
        proje = {"baslik": "x", "alan": "oyun", "secilme_sayisi": 0}
        self.assertGreater(siralama.ozgunluk_puani(proje), siralama.ozgunluk_puani({**proje, "secilme_sayisi": 20}))

    def test_rastgelelik_farkli_liste_verir(self):
        a = siralama.oner(PROFIL, gemini_kullan=False, rastgele=random.Random(1))
        b = siralama.oner(PROFIL, gemini_kullan=False, rastgele=random.Random(7))
        self.assertNotEqual([p["baslik"] for p in a], [p["baslik"] for p in b])


class GeminiTesti(unittest.TestCase):
    def test_gemini_projeleri_eklenir_istenmeyen_elenir(self):
        with mock.patch("oneri_motoru.uretim.sor", return_value=GEMINI_CEVABI):
            projeler = siralama.oner(PROFIL, rastgele=random.Random(1))
        gemini = [p for p in projeler if p["kaynak"] == "gemini"]
        self.assertGreaterEqual(len(gemini), siralama.EN_AZ_GEMINI)
        self.assertNotIn("İstenmeyen Web", [p["baslik"] for p in projeler])

    def test_gemini_cokerse_havuzla_devam(self):
        with mock.patch("oneri_motoru.uretim.sor", side_effect=YapayZekaHatasi("cevap yok")):
            projeler = siralama.oner(PROFIL, rastgele=random.Random(1))
        self.assertEqual(len(projeler), 10)
        self.assertTrue(all(p["kaynak"] == "havuz" for p in projeler))

    def test_yedek_harita_12_adim(self):
        harita = yedek_harita({"adimlar": ["A", "B", "C", "D"]})
        self.assertEqual([a["sira"] for a in harita], list(range(1, 13)))


class DusunmeTesti(unittest.TestCase):
    def test_dusunme_ayari_desteklenmezse_ayarsiz_sorulur(self):
        from oneri_motoru import uretim
        istekler = []

        def sahte_sor(komut, **ayar):
            istekler.append(ayar.get("dusunme"))
            if ayar.get("dusunme"):
                raise YapayZekaHatasi("400 thinking_level is not supported for this model")
            return {"adimlar": [{"baslik": "Adım", "aciklama": "Açıklama"}] * 12}

        with mock.patch("oneri_motoru.uretim.sor", side_effect=sahte_sor), mock.patch.object(uretim, "DUSUNME", "low"):
            harita = uretim.gorev_haritasi({"baslik": "Deneme", "ne": "Deneme projesi"})
        self.assertEqual(len(harita), 12)
        self.assertEqual(istekler, ["low", None])


if __name__ == "__main__":
    unittest.main()
