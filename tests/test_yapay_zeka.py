"""yapay_zeka.sor() hata durumları. Gerçek Gemini'ye bağlanmaz, istemci taklit edilir."""
import unittest
from unittest import mock

from oneri_motoru import yapay_zeka
from oneri_motoru.yapay_zeka import YapayZekaHatasi, sor


def _sahte_istemci(*sonuclar):
    """generate_content sırayla bu sonuçları verir (hata nesnesiyse fırlatır)."""
    istemci = mock.MagicMock()
    istemci.models.generate_content.side_effect = list(sonuclar)
    return istemci


class SorHatalari(unittest.TestCase):
    def setUp(self):
        # Testler beklemesin
        bekleme = mock.patch("oneri_motoru.yapay_zeka.time.sleep")
        bekleme.start()
        self.addCleanup(bekleme.stop)

    def _calistir(self, istemci, **ayar):
        with mock.patch.object(yapay_zeka, "_istemci_al", return_value=istemci):
            return sor("merhaba", **ayar)

    def test_internet_koparsa_yapay_zeka_hatasi(self):
        istemci = _sahte_istemci(ConnectionError("ağ yok"), ConnectionError("ağ yok"))
        with self.assertRaises(YapayZekaHatasi):
            self._calistir(istemci)
        self.assertEqual(istemci.models.generate_content.call_count, 2)  # bir kez de tekrar denedi

    def test_ilk_denemede_kopup_ikincide_gelirse_cevap_doner(self):
        istemci = _sahte_istemci(TimeoutError("zaman aşımı"), mock.Mock(text='{"tamam": true}'))
        self.assertEqual(self._calistir(istemci, sema={"type": "object"}), {"tamam": True})

    def test_anahtar_yoksa_tekrar_denemez(self):
        with mock.patch.object(yapay_zeka, "_istemci_al", side_effect=YapayZekaHatasi("anahtar yok")) as al:
            with self.assertRaises(YapayZekaHatasi):
                sor("merhaba")
        self.assertEqual(al.call_count, 1)


if __name__ == "__main__":
    unittest.main()
