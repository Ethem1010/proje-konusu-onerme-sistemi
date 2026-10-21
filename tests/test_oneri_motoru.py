"""Öneri motoru testleri. Ana klasörden çalıştır:  python -m unittest"""
import unittest

from oneri_motoru.etiketler import ALAN_KODLARI, beceri_bul, sade, turkce_kucuk
from oneri_motoru.model import ProfilModeli, _on_isle
from oneri_motoru.veri import metinleri_oku, projeleri_oku


class BeceriTesti(unittest.TestCase):
    def test_ekli_yazilislar(self):
        self.assertEqual(beceri_bul("Python'u ve dockerla çalışmayı seviyorum"), ["Python", "Docker"])

    def test_javascript_java_sayilmaz(self):
        self.assertEqual(beceri_bul("javascript biliyorum"), ["JavaScript"])

    def test_benzer_kelimeler_karismaz(self):
        self.assertEqual(beceri_bul("cihaz yapmak, gitar çalmak, ağaç dikmek"), [])

    def test_turkce_buyuk_harf(self):
        self.assertEqual(turkce_kucuk("IŞIK İSTANBUL"), "ışık istanbul")

    def test_turkce_harfsiz_yazim(self):
        # Telefonda Türkçe harf kullanmadan yazan öğrenci
        self.assertEqual(beceri_bul("ag temelleri biliyorum"), ["Ağ Temelleri"])
        self.assertEqual(beceri_bul("AĞ TEMELLERİ biliyorum"), ["Ağ Temelleri"])
        self.assertEqual(sade("Ağ Güvenliği ÇIKIŞ"), "ag guvenligi cikis")


class OlumsuzlukTesti(unittest.TestCase):
    def test_olumsuz_parca_isaretlenir(self):
        sonuc = _on_isle("unity ilgimi çekiyor, web istemiyorum")
        self.assertIn("olmz_web", sonuc)
        self.assertNotIn("olmz_unity", sonuc)

    def test_turkce_harfsiz_ve_konusma_dili(self):
        for metin in ("web istemiyom", "webden sikildim", "webden sıkıldım", "web degil"):
            self.assertIn("olmz_web", _on_isle(metin), metin)

    def test_sevmek_istemek_olumsuz_degil(self):
        for metin in ("oyun yapmayı sevmek güzel", "oyun yapmak istemek"):
            self.assertNotIn("olmz_", _on_isle(metin), metin)


class VeriTesti(unittest.TestCase):
    def test_proje_havuzu(self):
        projeler = projeleri_oku()
        self.assertGreaterEqual(len(projeler), 300)
        for p in projeler:
            self.assertIn(p["zorluk"], (1, 2, 3))
            self.assertEqual(len(p["adimlar"]), 4, p["baslik"])

    def test_metin_etiketleri(self):
        for m in metinleri_oku():
            self.assertTrue(set(m["etiketler"].values()) <= {-1, 0, 1, 2})


class ModelTesti(unittest.TestCase):
    def test_egit_ve_tahmin_et(self):
        metinler = ["unity ile oyun yapmak istiyorum", "web sitesi yapmak istiyorum, oyun istemem"] * 3
        etiketler = [{"oyun": 2, "web": 0}, {"oyun": -1, "web": 2}] * 3
        etiketler = [{**{k: 0 for k in ALAN_KODLARI}, **e} for e in etiketler]
        model = ProfilModeli().egit(metinler, etiketler)
        p = model.olasiliklar(["unity'de oyun yapmak istiyorum"])[0]
        self.assertGreater(p["oyun"]["ilgi"], p["web"]["ilgi"])


if __name__ == "__main__":
    unittest.main()
