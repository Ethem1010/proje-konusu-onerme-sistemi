"""yapay_zeka.sor() hata durumları. Gerçek Gemini'ye bağlanmaz, istemci taklit edilir."""
import socket
import threading
import time
import unittest
from unittest import mock

import httpx
from google import genai
from google.genai import types

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

    def test_zaman_asiminda_tekrar_denemez(self):
        istemci = _sahte_istemci(httpx.ReadTimeout("geç kaldı"), mock.Mock(text="cevap"))
        with self.assertRaises(YapayZekaHatasi) as hata:
            self._calistir(istemci)
        self.assertEqual(istemci.models.generate_content.call_count, 1)
        self.assertIn("saniyede cevap gelmedi", str(hata.exception))

    def test_isteğe_zaman_siniri_eklenir(self):
        istemci = _sahte_istemci(mock.Mock(text="cevap"))
        self._calistir(istemci, zaman_asimi=12)
        ayar = istemci.models.generate_content.call_args.kwargs["config"]
        self.assertEqual(ayar.http_options.timeout, 12000)  # milisaniye


class GercekZamanAsimiTesti(unittest.TestCase):
    """Hiç cevap vermeyen bir sunucuya gerçekten bağlanır: sor() beklemede takılı kalmamalı."""

    def test_cevap_vermeyen_sunucuda_takilmaz(self):
        sunucu = socket.socket()
        sunucu.bind(("127.0.0.1", 0))
        sunucu.listen()
        self.addCleanup(sunucu.close)
        threading.Thread(target=lambda: sunucu.accept(), daemon=True).start()  # bağlantıyı alır, cevap vermez
        istemci = genai.Client(api_key="deneme", http_options=types.HttpOptions(
            base_url=f"http://127.0.0.1:{sunucu.getsockname()[1]}"))
        baslangic = time.monotonic()
        with mock.patch.object(yapay_zeka, "_istemci_al", return_value=istemci), \
                self.assertRaises(YapayZekaHatasi):
            sor("merhaba", zaman_asimi=1)
        self.assertLess(time.monotonic() - baslangic, 5)


if __name__ == "__main__":
    unittest.main()
