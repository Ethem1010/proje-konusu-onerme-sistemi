"""Öğrencinin yazısından profil çıkarır. Yapay zekâ servisi kullanmaz, kendi modelimizle çalışır.

    from oneri_motoru.profil import profil_cikar
    profil_cikar("unity'de oyun yapmak istiyorum ama web işlerinden sıkıldım")

Denemek için ana klasörden:  python -m oneri_motoru.profil "buraya bir yazı"
"""
import re
import sys

from .etiketler import _DESENLER, ALAN_ADI, sade
from .model import _OLUMSUZLUK, _PARCA_SINIRI, ProfilModeli

ALAN_SAYISI = 5        # anlaşma belgesi: profilde tam 5 alan
ISTEMEME_ESIGI = 0.5   # bu olasılığın üstündeki alanlar "istemiyor" sayılır

_model = None


def _model_al():
    global _model
    if _model is None:
        _model = ProfilModeli.yukle()
    return _model


def _puan(ilgi):
    """0-1 arası ilgi olasılığını arayüzdeki 1-5 puana çevirir."""
    return max(1, min(5, round(1 + 4 * ilgi)))


def _olumsuz_mu(devami):
    """Becerinin hemen arkasından gelen 3 kelimede olumsuzluk var mı? ("python bilmiyorum", "javayı hiç bilmem")"""
    devami = re.sub(r"^[\w']+", "", devami)  # kelimenin kendi eki: "java|yı", "python|'u"
    kelimeler = devami.split()[:3]
    return any(k == "yok" or _OLUMSUZLUK.fullmatch(k) for k in kelimeler)


def bilinen_beceriler(metin):
    """Öğrencinin bildiğini söylediği beceriler.

    Hemen arkasından olumsuzluk gelen beceri sayılmaz: "Python bilmiyorum" diyen öğrenciye
    Python projesi önerilmesin. Türkçede fiil sonda olduğu için olumsuzluk becerinin arkasına gelir.
    "elimde bi tek python var, başka bişey bilmiyorum" ise Python'u bildiğini söyler, sayılır.
    """
    metin = sade(metin)
    bulunan = []
    for beceri, desen in _DESENLER.items():
        for eslesme in desen.finditer(metin):
            parca_sonu = _PARCA_SINIRI.search(metin, eslesme.end())
            devami = metin[eslesme.end(): parca_sonu.start() if parca_sonu else None]
            if not _olumsuz_mu(devami):
                bulunan.append(beceri)
                break
    return bulunan


def profil_cikar(metin):
    """Anlaşma belgesindeki profil kalıbı:

    {
      "alanlar": [{"kod": "oyun", "ad": "Oyun Geliştirme", "puan": 5}, ... tam 5 tane],
      "istemedikleri": ["web"],          # sıralamada bu alanlar elenir
      "beceriler": ["Unity", "C#"],
    }
    """
    olasilik = _model_al().olasiliklar([metin])[0]
    istemedikleri = [k for k, o in olasilik.items() if o["istememe"] >= ISTEMEME_ESIGI and o["istememe"] > o["ilgi"]]
    adaylar = sorted(
        (k for k in olasilik if k not in istemedikleri),
        key=lambda k: olasilik[k]["ilgi"],
        reverse=True,
    )
    return {
        "alanlar": [
            {"kod": k, "ad": ALAN_ADI[k], "puan": _puan(olasilik[k]["ilgi"])} for k in adaylar[:ALAN_SAYISI]
        ],
        "istemedikleri": istemedikleri,
        "beceriler": bilinen_beceriler(metin),
    }


if __name__ == "__main__":
    import json

    yazi = " ".join(sys.argv[1:]) or "unity ile oyun yapmak istiyorum ama web sitesi işlerinden sıkıldım, c# biliyorum"
    print(json.dumps(profil_cikar(yazi), ensure_ascii=False, indent=2))
