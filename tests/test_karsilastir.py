"""karsilastir.py testleri. Gerçek Gemini'ye bağlanmaz."""
import unittest

from oneri_motoru.egitim import olcumler
from oneri_motoru.etiketler import ALAN_KODLARI
from oneri_motoru.karsilastir import gemini_tahminleri


def _ogrenci(**etiket):
    return {"metin": "deneme", "etiketler": {k: etiket.get(k, 0) for k in ALAN_KODLARI}, "beceriler": []}


class KarsilastirTesti(unittest.TestCase):
    def test_gemini_cevabi_olcumlere_cevrilir(self):
        test = [_ogrenci(oyun=2, web=-1), _ogrenci(mobil=1)]
        cevaplar = [
            {"alanlar": {"oyun": 2, "web": -1}, "en_ilgili": "oyun", "sure": 1.0},  # tam doğru
            {"alanlar": {"web": 2}, "en_ilgili": "web", "sure": 1.0},              # yanlış
        ]
        sonuc = olcumler(*gemini_tahminleri(test, cevaplar))
        self.assertEqual(sonuc["ilk_tahmin_isabeti"], 0.5)
        self.assertEqual(sonuc["ilgi"][0], 0.5)       # kesinlik: 2 tahminden 1'i doğru
        self.assertEqual(sonuc["istememe"][2], 1.0)   # web istemediğini doğru buldu

    def test_cevap_alinamayan_metin_bos_sayilir(self):
        test = [_ogrenci(oyun=2)]
        sonuc = olcumler(*gemini_tahminleri(test, [{"alanlar": {}, "en_ilgili": "", "sure": 0}]))
        self.assertEqual(sonuc["ilgi"][1], 0.0)


if __name__ == "__main__":
    unittest.main()
