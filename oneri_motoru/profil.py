"""Öğrencinin yazısından profil çıkarır. Yapay zekâ servisi kullanmaz, kendi modelimizle çalışır.

    from oneri_motoru.profil import profil_cikar
    profil_cikar("unity'de oyun yapmak istiyorum ama web işlerinden sıkıldım")

Denemek için ana klasörden:  python -m oneri_motoru.profil "buraya bir yazı"
"""
import re
import sys

from .etiketler import _DESENLER, ALAN_ADI, alan_kelimeleri_bul, sade
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


# Olumsuz kelimeden geriye doğru en fazla bu kadar kelimeye bakılır (Türkçede fiil sonda: "oyun hiç sevmem").
GERI_BAKIS = 4
# Bu kelimelerde durulur: "yapay zeka seviyorum, kodlamaktan hoşlanmıyorum" -> yapay zekâ istenmiyor sayılmaz.
_OLUMLU_FIIL = re.compile(r"^(?:sev(?:iyo|erim)|isti?yo|cekiyo|ilgilen|sariyo|bayil|olur$|yap(?:ca|aca|mak))")
# Olumsuz görünen ama "istemiyorum" demeyen kalıplar:
#   "python bilmiyorum", "arduino kullanmadım" -> bilgi / deneyim, istememek değil
_NOTR_OLUMSUZ = re.compile(r"^(?:bilm|kullanmad|yapmad|denemed|gormed|farketmez)")
#   "öğrenmem gerek / lazım" -> ihtiyaç
_SONRAKI_NOTR = re.compile(r"^(?:gerek|lazim)")
#   "ikisi arasında kaldım" -> kararsızlık; "fark etmez" -> fark etmez
_ONCEKI_NOTR = {"kaldim": "arasinda", "etmez": "fark"}
#   "görüntü işleme biliyorum demem" -> bilgi hakkında
_BILGI = re.compile(r"^(?:biliyo|bilir|bilgi)")
# "yok" tek başına istememek demek değil ("docker yok" = bilmiyor). Önündeki kelime ilgiyi anlatıyorsa istememektir:
#   "donanımla aram yok", "yapay zekaya ilgim yok", "oyuna hiç hevesim yok"
_ILGI_YOK = re.compile(r"^(?:aram|arasi|ilgim|hevesim|merakim|istegim|sevgim)$")


def _ilgi_yok_mu(kelimeler, i):
    return kelimeler[i] == "yok" and i > 0 and bool(_ILGI_YOK.match(kelimeler[i - 1]))


def _notr_mu(kelimeler, i):
    kelime = kelimeler[i]
    if _NOTR_OLUMSUZ.match(kelime):
        return True
    if i + 1 < len(kelimeler) and _SONRAKI_NOTR.match(kelimeler[i + 1]):
        return True
    return i > 0 and _ONCEKI_NOTR.get(kelime) == kelimeler[i - 1]


def acikca_istemedikleri(metin):
    """Öğrencinin açıkça istemediğini yazdığı alanlar.

    Model "istemiyorum" örneğini az gördüğü için "web işlerinden hiç hoşlanmam" gibi açık bir cümlede bile
    emin olamayabiliyor; bu kural modelin üstüne eklenir. Alanın adı olumsuz kelimenin hemen önünde
    (en fazla GERI_BAKIS kelime) geçmeli ve araya olumlu bir fiil girmemeli. "Donanımla aram yok",
    "yapay zekaya ilgim yok" gibi kalıplar da istememek sayılır (_ilgi_yok_mu). "Python bilmiyorum",
    "fark etmez", "öğrenmem lazım" gibi istememek anlatmayan kalıplar sayılmaz (_notr_mu).
    """
    sonuc = []
    for parca in _PARCA_SINIRI.split(sade(metin)):
        kelimeler = (parca or "").split()
        for i, kelime in enumerate(kelimeler):
            ilgi_yok = _ilgi_yok_mu(kelimeler, i)
            if not ilgi_yok and (not _OLUMSUZLUK.search(kelime) or _notr_mu(kelimeler, i)):
                continue
            son = i - 1 if ilgi_yok else i  # "aram yok": "aram" kelimesi pencereye girmesin
            pencere = []
            for onceki in reversed(kelimeler[max(0, son - GERI_BAKIS):son]):
                if _OLUMLU_FIIL.match(onceki):
                    break
                pencere.insert(0, onceki)
            if any(_BILGI.match(k) for k in pencere):
                continue
            for kod in alan_kelimeleri_bul(" ".join(pencere)):
                if kod not in sonuc:
                    sonuc.append(kod)
    return sonuc


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
    istemedikleri += [k for k in acikca_istemedikleri(metin) if k not in istemedikleri]
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
