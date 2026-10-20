"""Google Form cevaplarını eğitim ve test verisine çevirir. Ana klasörden çalıştır:

    python -m oneri_motoru.form_cevir veri/form_yanitlari.csv
    python -m oneri_motoru.form_cevir veri/form_yanitlari.csv --cikar 31-40

Ne yapar?
1. Formdaki "Aşağıdaki alanlar sana ne kadar ilgi çekici geliyor?" tablosunu etikete çevirir:
       Çok ilgimi çeker -> 2,  Biraz ilgimi çeker -> 1,  Fark etmez -> boş,  İstemem -> -1
2. İşe yaramayan cevapları ayıklar: onay yok, metin çok kısa, aynı metin iki kez,
   tabloda hiçbir alan işaretlenmemiş (hepsi "Fark etmez"), elle çıkarılanlar (--cikar).
3. Kalan cevapların ilk 30'unu (gönderilme sırasıyla) test setine, gerisini eğitime ayırır:
       veri/test_seti.csv    -> modelin hiç görmediği cevaplar, sadece başarı ölçmek için
       veri/form_egitim.csv  -> eğitime eklenir
   İkisi de veri/metinler.csv ile aynı kalıpta. Gerçek öğrenci cevabı oldukları için
   .gitignore'da, GitHub'a gitmezler.

Satır numaraları formdaki sıradır: 1 = ilk cevap (başlık satırı sayılmaz).
"""
import argparse
import csv
from pathlib import Path

from .etiketler import ALAN_KODLARI, beceri_duzelt, sade
from .veri import VERI_KLASORU

TEST_DOSYASI = VERI_KLASORU / "test_seti.csv"
EGITIM_DOSYASI = VERI_KLASORU / "form_egitim.csv"
TEST_SAYISI = 30
EN_KISA_METIN = 20

CEVAPLAR = {"cok ilgimi ceker": 2, "biraz ilgimi ceker": 1, "fark etmez": 0, "istemem": -1, "": 0}

# Formdaki köşeli parantez içindeki alan adı -> alan kodu (sade yazımla aranır)
FORM_ALANLARI = [
    ("web", "web"),
    ("mobil", "mobil"),
    ("yapay zeka", "yapay_zeka"),
    ("goruntu", "goruntu_isleme"),
    ("dogal dil", "dogal_dil"),
    ("veri bilimi", "veri_bilimi"),
    ("siber", "siber_guvenlik"),
    ("gomulu", "gomulu_iot"),
    ("oyun", "oyun"),
    ("bulut", "bulut_devops"),
    ("veritabani", "veritabani"),
    ("ag ve", "ag_dagitik"),
]

SUTUNLAR = ["yazan", "metin", *ALAN_KODLARI, "beceriler (virgülle)", "kontrol_eden", "not"]


def _alan_kodu(baslik):
    """'... [Görüntü İşleme (kamera, fotoğraf)]' -> 'goruntu_isleme'"""
    if "[" not in baslik:
        return None
    ad = sade(baslik.split("[", 1)[1])
    for anahtar, kod in FORM_ALANLARI:
        if ad.startswith(anahtar):
            return kod
    raise ValueError(f"Formdaki alan tanınmadı: {baslik!r}")


def _sutunlari_bul(basliklar):
    sutun = {"alanlar": {}}
    for i, baslik in enumerate(basliklar):
        b = sade(baslik)
        kod = _alan_kodu(baslik)
        if kod:
            sutun["alanlar"][kod] = i
        elif b.startswith("kendini"):
            sutun["metin"] = i
        elif b.startswith("hangilerini"):
            sutun["beceriler"] = i
        elif b.startswith("onay"):
            sutun["onay"] = i
    eksik = {"metin", "onay"} - set(sutun) or set(ALAN_KODLARI) - set(sutun["alanlar"])
    if eksik:
        raise ValueError(f"Formda şu sütunlar bulunamadı: {sorted(eksik)}")
    return sutun


def _araliklar(yazi):
    """'31-40,45' -> {31, ..., 40, 45}"""
    sayilar = set()
    for parca in filter(None, (p.strip() for p in (yazi or "").split(","))):
        bas, _, son = parca.partition("-")
        sayilar.update(range(int(bas), int(son or bas) + 1))
    return sayilar


def cevir(dosya, cikar=(), test_sayisi=TEST_SAYISI):
    """Form dosyasını okur. (test, egitim, elenenler) döner; ilk ikisi metinler.csv kalıbında satırlar."""
    with open(dosya, encoding="utf-8-sig", newline="") as f:
        okuyucu = csv.reader(f)
        sutun = _sutunlari_bul(next(okuyucu))
        satirlar = list(okuyucu)

    kalanlar, elenenler, gorulen = [], [], set()
    for no, satir in enumerate(satirlar, start=1):
        metin = " ".join(satir[sutun["metin"]].split())
        etiketler = {}
        for kod, i in sutun["alanlar"].items():
            cevap = sade(satir[i].strip())
            if cevap not in CEVAPLAR:
                raise ValueError(f"{no}. cevapta tanınmayan seçenek: {satir[i]!r}")
            etiketler[kod] = CEVAPLAR[cevap]

        if no in cikar:
            sebep = "elle çıkarıldı (--cikar)"
        elif not satir[sutun["onay"]].strip():
            sebep = "onay vermemiş"
        elif len(metin) < EN_KISA_METIN:
            sebep = "metin çok kısa"
        elif sade(metin) in gorulen:
            sebep = "aynı metin daha önce gelmiş"
        elif not any(etiketler.values()):
            sebep = "tabloda hiçbir alan işaretlenmemiş"
        else:
            sebep = None
        if sebep:
            elenenler.append((no, sebep, metin))
            continue
        gorulen.add(sade(metin))

        beceriler = []
        if "beceriler" in sutun:
            for ad in satir[sutun["beceriler"]].split(";"):
                beceri = beceri_duzelt(ad) if ad.strip() else None
                if beceri and beceri not in beceriler:
                    beceriler.append(beceri)
        kalanlar.append({
            "yazan": f"form-{no}",
            "metin": metin,
            **{kod: (str(v) if v else "") for kod, v in etiketler.items()},
            "beceriler (virgülle)": ", ".join(beceriler),
            "kontrol_eden": "",
            "not": "",
        })
    return kalanlar[:test_sayisi], kalanlar[test_sayisi:], elenenler


def _yaz(dosya, satirlar):
    with open(dosya, "w", encoding="utf-8", newline="") as f:
        yazici = csv.DictWriter(f, fieldnames=SUTUNLAR)
        yazici.writeheader()
        yazici.writerows(satirlar)


def main():
    ayar = argparse.ArgumentParser(description="Google Form cevaplarını eğitim ve test verisine çevirir.")
    ayar.add_argument("dosya", type=Path, help="Formun cevap tablosundan indirilen CSV")
    ayar.add_argument("--cikar", default="", help="çıkarılacak cevap numaraları, örn. 31-40,45")
    ayar.add_argument("--test-sayisi", type=int, default=TEST_SAYISI, help="test setine ayrılacak cevap sayısı")
    secenek = ayar.parse_args()

    test, egitim, elenenler = cevir(secenek.dosya, _araliklar(secenek.cikar), secenek.test_sayisi)
    _yaz(TEST_DOSYASI, test)
    _yaz(EGITIM_DOSYASI, egitim)

    print(f"Toplam cevap: {len(test) + len(egitim) + len(elenenler)}")
    print(f"Elenen: {len(elenenler)}")
    for no, sebep, metin in elenenler:
        print(f"  {no:>3}. cevap: {sebep}  ({metin[:50]}...)")
    print(f"Test seti:  {len(test)} cevap  -> {TEST_DOSYASI}")
    print(f"Eğitim:     {len(egitim)} cevap  -> {EGITIM_DOSYASI}")


if __name__ == "__main__":
    main()
