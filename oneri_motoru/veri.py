"""Veri setini okur.

Veri setinin aslı Google Sheets'teki "Konu Kartları Veri Seti" tablosu.
Oradan sekmeler CSV olarak indirilip ana klasördeki veri/ klasörüne konur:

    Projeler sekmesi          -> veri/projeler.csv
    Öğrenci Metinleri sekmesi -> veri/metinler.csv

(Google Sheets: ilgili sekmeyi aç > Dosya > İndir > Virgülle ayrılmış değerler (.csv))
"""
import csv
from pathlib import Path

from .etiketler import ALAN_KODLARI, beceri_duzelt

VERI_KLASORU = Path(__file__).resolve().parent.parent / "veri"
PROJELER_DOSYASI = VERI_KLASORU / "projeler.csv"
METINLER_DOSYASI = VERI_KLASORU / "metinler.csv"


def _sutun_adi(baslik):
    # "beceriler (virgülle)" -> "beceriler", "kolay modda" -> "kolay"
    ilk = baslik.split("(")[0].split()
    return ilk[0].lower() if ilk else ""


def _satirlar(dosya):
    if not dosya.exists():
        raise FileNotFoundError(
            f"{dosya} bulunamadı. Google Sheets'ten ilgili sekmeyi CSV olarak indirip buraya koy."
        )
    with open(dosya, encoding="utf-8-sig", newline="") as f:
        okuyucu = csv.reader(f)
        basliklar = [_sutun_adi(b) for b in next(okuyucu)]
        for satir in okuyucu:
            satir = dict(zip(basliklar, (h.strip() for h in satir)))
            # Tablodaki örnek satırlar ve boş satırlar veri değildir
            if satir.get("ekleyen", satir.get("yazan", "")) in ("", "ÖRNEK"):
                continue
            yield satir


def _etiket(deger):
    """Hücredeki değeri sayıya çevirir: boş -> 0, '2' -> 2, '-1' -> -1."""
    if not deger:
        return 0
    sayi = int(float(deger.replace(",", ".")))
    if sayi not in (-1, 0, 1, 2):
        raise ValueError(f"Geçersiz etiket: {deger!r} (sadece 2, 1, -1 ya da boş olabilir)")
    return sayi


def _beceri_listesi(hucre):
    sonuc = []
    for parca in hucre.split(","):
        beceri = beceri_duzelt(parca) if parca.strip() else None
        if beceri and beceri not in sonuc:
            sonuc.append(beceri)
    return sonuc


def metinleri_oku(dosya=METINLER_DOSYASI):
    """Her öğrenci metni için {"yazan", "metin", "etiketler": {alan: -1/0/1/2}, "beceriler": [...]}."""
    metinler = []
    for satir in _satirlar(Path(dosya)):
        if not satir.get("metin"):
            continue
        metinler.append({
            "yazan": satir.get("yazan", ""),
            "metin": satir["metin"],
            "etiketler": {kod: _etiket(satir.get(kod, "")) for kod in ALAN_KODLARI},
            "beceriler": _beceri_listesi(satir.get("beceriler", "")),
        })
    return metinler


def projeleri_oku(dosya=PROJELER_DOSYASI):
    """Proje havuzundaki her proje için anlaşma belgesindeki proje kalıbına yakın bir sözlük."""
    projeler = []
    for satir in _satirlar(Path(dosya)):
        if not satir.get("baslik"):
            continue
        projeler.append({
            "ekleyen": satir.get("ekleyen", ""),
            "baslik": satir["baslik"],
            "ne": satir.get("aciklama", ""),
            "alan": satir.get("alan", ""),
            "alan2": satir.get("alan2") or None,
            "beceriler": _beceri_listesi(satir.get("beceriler", "")),
            "zorluk": int(satir.get("zorluk") or 2),
            "hafta": int(satir.get("hafta") or 8),
            "tercih": satir.get("tercih") or "uretmek",
            "kim": satir.get("kim") or None,
            "cikti": satir.get("cikti") or None,
            "adimlar": [a.strip() for a in satir.get("adimlar", "").split(";") if a.strip()],
            "kolay": satir.get("kolay") or None,
            "efsane": satir.get("efsane") or None,
            "esin_kaynagi": satir.get("esin_kaynagi") or None,
        })
    return projeler
