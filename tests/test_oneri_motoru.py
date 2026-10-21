"""Öneri motoru testleri. Ana klasörden çalıştır:  python -m unittest"""
import unittest

from oneri_motoru.egitim import tekrarlari_at
from oneri_motoru.etiketler import ALAN_KODLARI, beceri_bul, sade, turkce_kucuk
from oneri_motoru.model import MODEL_DOSYASI, ProfilModeli, _on_isle, olumlu_kisim
from oneri_motoru.profil import acikca_istemedikleri, bilinen_beceriler, profil_cikar
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


class BilinenBeceriTesti(unittest.TestCase):
    def test_bilmedigi_beceri_sayilmaz(self):
        self.assertEqual(bilinen_beceriler("C# ile çok çalıştım. Ama Python bilmiyorum."), ["C#"])
        self.assertEqual(bilinen_beceriler("javayı hiç bilmiyorum ama python biliyorum"), ["Python"])
        self.assertEqual(bilinen_beceriler("docker yok, linux biliyorum"), ["Linux"])

    def test_uzaktaki_olumsuzluk_beceriyi_silmez(self):
        self.assertEqual(bilinen_beceriler("elimde bi tek python var başka da pek bişey bilmiyorum"), ["Python"])


class AcikIstememeTesti(unittest.TestCase):
    def test_acik_istememe_bulunur(self):
        self.assertEqual(acikca_istemedikleri("oyun yapmak istiyorum ama web işlerinden hiç hoşlanmam"), ["web"])
        self.assertEqual(acikca_istemedikleri("siber güvenlik bana acayip sıkıcı geliyor"), ["siber_guvenlik"])
        self.assertEqual(acikca_istemedikleri("mobil uygulamalardan nefret ediyorum"), ["mobil"])

    def test_ilgi_alani_istemiyor_sayilmaz(self):
        # Noktalamasız gerçek öğrenci metni: yapay zekâyı seviyor, kodlamaktan hoşlanmıyor
        self.assertEqual(acikca_istemedikleri("Yapay zeka seviyorum Kodlamaktan hoşlanmıyorum"), [])

    def test_istememek_anlatmayan_kaliplar(self):
        for metin in (
            "gömülü sistem bilmiyorum",
            "arduino kullanmadım daha önce",
            "oyun veya mobil fark etmez ikisi de olur",
            "ya web ya yapay zeka arasında kaldım",
            "yapay zeka kısmını da öğrenmem gerekebilir",
            "görüntü işleme biliyorum demem ama öğrenmeye açığım",
            "ağaç dikmek istemiyorum",
        ):
            self.assertEqual(acikca_istemedikleri(metin), [], metin)

    @unittest.skipUnless(MODEL_DOSYASI.exists(), "model henüz eğitilmemiş (python -m oneri_motoru.egitim)")
    def test_profilde_istemedigi_alan_olmaz(self):
        profil = profil_cikar("unity ile oyun yapmak istiyorum ama web işlerinden hiç hoşlanmam")
        self.assertIn("web", profil["istemedikleri"])
        self.assertNotIn("web", [a["kod"] for a in profil["alanlar"]])


class OlumsuzlukTesti(unittest.TestCase):
    def test_olumsuz_parca_isaretlenir(self):
        sonuc = _on_isle("unity ilgimi çekiyor, web istemiyorum")
        self.assertIn("olmz_web", sonuc)
        self.assertNotIn("olmz_unity", sonuc)

    def test_turkce_harfsiz_ve_konusma_dili(self):
        for metin in ("web istemiyom", "webden sikildim", "webden sıkıldım", "web degil"):
            self.assertIn("olmz_web", _on_isle(metin), metin)

    def test_parca_ozelligi_olumsuz_kismi_gormez(self):
        # "siber" parçası olumsuz cümlede de geçiyor; parça özelliği onu görmemeli
        self.assertEqual(olumlu_kisim("oyun yapcam, ama siber güvenlik sıkıcı geliyor"), "oyun yapcam")
        self.assertEqual(olumlu_kisim("web istemiyorum"), "")

    def test_sevmek_istemek_olumsuz_degil(self):
        for metin in ("oyun yapmayı sevmek güzel", "oyun yapmak istemek"):
            self.assertNotIn("olmz_", _on_isle(metin), metin)


class TekrarTesti(unittest.TestCase):
    def test_tekrar_ve_test_sizintisi_atilir(self):
        m = lambda yazi: {"metin": yazi, "etiketler": {}, "beceriler": []}
        veri = [m("oyun yapcam"), m("Oyun  yapcam"), m("web istiyorum"), m("chatbot olsun")]
        temiz = tekrarlari_at(veri, test=[m("chatbot olsun")])
        self.assertEqual([v["metin"] for v in temiz], ["oyun yapcam", "web istiyorum"])


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
