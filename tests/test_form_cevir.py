"""form_cevir.py testleri. Gerçek form dosyası gerekmez, küçük sahte bir form kullanılır."""
import csv
import tempfile
import unittest
from pathlib import Path

from oneri_motoru.form_cevir import _araliklar, cevir

ALANLAR = [
    "Web Geliştirme (site, web uygulaması)", "Mobil Uygulama (Android, iOS)", "Yapay Zekâ / Makine Öğrenmesi",
    "Görüntü İşleme (kamera, fotoğraf)", "Doğal Dil İşleme (metin, chatbot, ses)", "Veri Bilimi (veri analizi, grafik)",
    "Siber Güvenlik", "Gömülü Sistemler / IoT (Arduino, sensör)", "Oyun Geliştirme", "Bulut / DevOps (Docker, sunucu)",
    "Veritabanı", "Ağ ve Dağıtık Sistemler",
]
BASLIKLAR = (
    ["Zaman damgası", "Bölümün", "Kaçıncı sınıftasın?", "Kendini birkaç cümleyle anlat: Nasıl bir proje yapmak istersin?"]
    + [f"Aşağıdaki alanlar sana ne kadar ilgi çekici geliyor? [{a}]" for a in ALANLAR]
    + ["Hangilerini biliyorsun? (Hiç bilmiyorsan boş bırakabilirsin)", "Onay"]
)
FARK = ["Fark etmez"] * 12


def _satir(metin, tablo=FARK, beceriler="", onay="Kabul ediyorum"):
    return ["2026/10/16", "Bilgisayar Mühendisliği", "4", metin, *tablo, beceriler, onay]


class FormCevirTesti(unittest.TestCase):
    def _cevir(self, satirlar, **ayar):
        with tempfile.TemporaryDirectory() as klasor:
            dosya = Path(klasor) / "form.csv"
            with open(dosya, "w", encoding="utf-8", newline="") as f:
                csv.writer(f).writerows([BASLIKLAR, *satirlar])
            return cevir(dosya, **ayar)

    def test_tablo_etikete_cevrilir(self):
        tablo = ["Çok ilgimi çeker", "Biraz ilgimi çeker", "İstemem"] + FARK[3:]
        test, _, _ = self._cevir([_satir("Web sitesi yapmak istiyorum, yapay zekâ istemem.", tablo, "Python;Ağ Temelleri")])
        self.assertEqual(test[0]["web"], "2")
        self.assertEqual(test[0]["mobil"], "1")
        self.assertEqual(test[0]["yapay_zeka"], "-1")
        self.assertEqual(test[0]["oyun"], "")
        self.assertEqual(test[0]["beceriler (virgülle)"], "Python, Ağ Temelleri")

    def test_isa_yaramayanlar_elenir(self):
        cok = ["Çok ilgimi çeker"] + FARK[1:]
        _, _, elenen = self._cevir([
            _satir("kısa", cok),                                      # metin çok kısa
            _satir("Hiçbir alanı işaretlemedim ama uzun yazdım."),     # tablo boş
            _satir("Web sitesi yapmak istiyorum bu dönem.", cok, onay=""),  # onay yok
            _satir("Oyun yapmak istiyorum Unity ile.", cok),
            _satir("oyun yapmak istiyorum unity ile.", cok),           # aynı metin
        ])
        self.assertEqual([no for no, _, _ in elenen], [1, 2, 3, 5])

    def test_test_ve_egitim_ayrilir_cikarilanlar_atlanir(self):
        cok = ["Çok ilgimi çeker"] + FARK[1:]
        satirlar = [_satir(f"{i}. öğrenci olarak web sitesi yapmak istiyorum.", cok) for i in range(1, 8)]
        test, egitim, elenen = self._cevir(satirlar, cikar=_araliklar("2-3"), test_sayisi=3)
        self.assertEqual([t["yazan"] for t in test], ["form-1", "form-4", "form-5"])
        self.assertEqual([t["yazan"] for t in egitim], ["form-6", "form-7"])
        self.assertEqual(len(elenen), 2)


if __name__ == "__main__":
    unittest.main()
