"""Bizim model ile Gemini'yi aynı test setinde karşılaştırır. Ana klasörden çalıştır:

    python -m oneri_motoru.karsilastir

Neden? Hoca "neden yapay zekâ yerine kendi modelinizi eğittiniz?" diye soracak.
Cevap ölçerek verilir: aynı 30 gerçek öğrenci metni hem bizim modele hem Gemini'ye verilir,
ikisinin cevabı öğrencinin formda işaretledikleriyle karşılaştırılır.

- Gemini'ye sadece öğrencinin yazısı ve 12 alan verilir, bizim modelin gördüğünden fazlası değil.
- Gemini'nin cevapları veri/test_gemini.csv dosyasına kaydedilir. Komut tekrar çalıştırılırsa
  Gemini'ye yeniden sorulmaz (günlük kota boşa harcanmaz). Yeniden sormak için: --yeniden
- Bizim model önce eğitilmiş olmalı: python -m oneri_motoru.egitim
"""
import argparse
import csv
import time

from .egitim import TEST_DOSYASI, _yuzde, olcumler, taban_isabet, test_et
from .etiketler import ALAN_ADI, ALAN_KODLARI
from .model import OLUMLU, OLUMSUZ, YOK, ProfilModeli
from .veri import METINLER_DOSYASI, VERI_KLASORU, metinleri_oku

GEMINI_CEVAPLARI = VERI_KLASORU / "test_gemini.csv"  # .gitignore'da (test*)

SEMA = {
    "type": "object",
    "properties": {
        "alanlar": {
            "type": "object",
            "properties": {kod: {"type": "integer", "enum": [-1, 0, 1, 2]} for kod in ALAN_KODLARI},
            "required": ALAN_KODLARI,
        },
        "en_ilgili": {"type": "string", "enum": ALAN_KODLARI},
    },
    "required": ["alanlar", "en_ilgili"],
}

SISTEM = (
    "Bir öğrencinin kendini anlattığı kısa yazıyı okuyup hangi yazılım alanlarıyla ilgilendiğini çıkarıyorsun. "
    "Her alan için bir puan ver: 2 = çok ilgileniyor, 1 = biraz ilgileniyor, 0 = bahsetmiyor ya da belli değil, "
    "-1 = istemiyor. 'en_ilgili' alanına en çok ilgilendiği tek alanın kodunu yaz."
)


def _komut(metin):
    alanlar = "\n".join(f"- {kod}: {ad}" for kod, ad in ALAN_ADI.items())
    return f"Alanlar:\n{alanlar}\n\nÖğrencinin yazısı:\n{metin}"


def gemini_sor(test, yeniden=False):
    """Her test metni için Gemini'nin cevabı: {"alanlar": {kod: -1..2}, "en_ilgili": kod, "sure": saniye}."""
    from .yapay_zeka import YapayZekaHatasi, sor  # Gemini kütüphanesi sadece burada gerekir

    kayitli = {} if yeniden else _kayitlilari_oku()
    cevaplar = []
    for i, t in enumerate(test, start=1):
        if t["metin"] in kayitli:
            cevaplar.append(kayitli[t["metin"]])
            continue
        print(f"  Gemini'ye soruluyor: {i}/{len(test)}", end="\r")
        bas = time.perf_counter()
        try:
            cevap = sor(_komut(t["metin"]), sistem=SISTEM, sema=SEMA, sicaklik=0)
        except YapayZekaHatasi as hata:
            print(f"\n  {i}. metinde Gemini cevap vermedi ({hata}), bu metin 'hiçbir alan' sayıldı.")
            cevap = {"alanlar": {}, "en_ilgili": ""}
        cevap["sure"] = round(time.perf_counter() - bas, 2)
        cevaplar.append(cevap)
        kayitli[t["metin"]] = cevap
        _kaydet(test, kayitli)
    print()
    return cevaplar


def _kayitlilari_oku():
    if not GEMINI_CEVAPLARI.exists():
        return {}
    with open(GEMINI_CEVAPLARI, encoding="utf-8", newline="") as f:
        return {
            s["metin"]: {
                "alanlar": {k: int(s[k]) for k in ALAN_KODLARI if s.get(k, "") != ""},
                "en_ilgili": s["en_ilgili"],
                "sure": float(s["sure"] or 0),
            }
            for s in csv.DictReader(f)
        }


def _kaydet(test, kayitli):
    with open(GEMINI_CEVAPLARI, "w", encoding="utf-8", newline="") as f:
        yazici = csv.DictWriter(f, fieldnames=["metin", *ALAN_KODLARI, "en_ilgili", "sure"])
        yazici.writeheader()
        for t in test:
            if t["metin"] in kayitli:
                c = kayitli[t["metin"]]
                yazici.writerow({"metin": t["metin"], **c["alanlar"], "en_ilgili": c["en_ilgili"], "sure": c["sure"]})


def gemini_tahminleri(test, cevaplar):
    """Gemini'nin cevaplarını bizim modelin çıktısıyla aynı kalıba çevirir (egitim.olcumler için)."""
    gercekler, tahminler, olasiliklar = test_et(_SabitModel(cevaplar), test)
    return gercekler, tahminler, olasiliklar


class _SabitModel:
    """Gemini'nin hazır cevaplarını, bizim modelin tahmin()/olasiliklar() kalıbında veren küçük yardımcı."""

    def __init__(self, cevaplar):
        self.cevaplar = cevaplar

    def tahmin(self, metinler):
        sonuc = []
        for c in self.cevaplar:
            puanlar = c["alanlar"]
            sonuc.append({
                k: OLUMLU if puanlar.get(k, 0) > 0 else OLUMSUZ if puanlar.get(k, 0) < 0 else YOK
                for k in ALAN_KODLARI
            })
        return sonuc

    def olasiliklar(self, metinler):
        # "İlk tahmin" için en_ilgili alan en yüksek puanı alır, sonra Gemini'nin verdiği puan sırası
        return [
            {k: {"ilgi": (1.0 if k == c["en_ilgili"] else 0.0) + c["alanlar"].get(k, 0) / 10} for k in ALAN_KODLARI}
            for c in self.cevaplar
        ]


def _satir(ad, bizim, gemini, yuzde=True):
    bicim = _yuzde if yuzde else (lambda x: f"{x:6.2f}")
    print(f"{ad:<28} {bicim(bizim):>10} {bicim(gemini):>10}")


def main():
    ayar = argparse.ArgumentParser(description="Bizim model ile Gemini'yi test setinde karşılaştırır.")
    ayar.add_argument("--yeniden", action="store_true", help="kayıtlı cevapları kullanma, Gemini'ye yeniden sor")
    secenek = ayar.parse_args()

    if not TEST_DOSYASI.exists():
        print("Test seti yok. Önce: python -m oneri_motoru.form_cevir veri/form_yanitlari.csv --cikar 31-40")
        return
    test = metinleri_oku(TEST_DOSYASI)
    model = ProfilModeli.yukle()

    bas = time.perf_counter()
    bizim = olcumler(*test_et(model, test))
    bizim_sure = (time.perf_counter() - bas) / len(test)

    print(f"Gemini'ye {len(test)} metin soruluyor (kayıtlı olanlar tekrar sorulmaz)...")
    cevaplar = gemini_sor(test, secenek.yeniden)
    gemini = olcumler(*gemini_tahminleri(test, cevaplar))
    gemini_sure = sum(c["sure"] for c in cevaplar) / len(cevaplar)

    egitim = metinleri_oku(METINLER_DOSYASI)
    form_egitim = VERI_KLASORU / "form_egitim.csv"
    if form_egitim.exists():
        egitim += metinleri_oku(form_egitim)
    taban = taban_isabet(egitim, test)

    print(f"\n=== Test seti: {len(test)} gerçek öğrenci (iki taraf da bu metinleri önceden görmedi) ===")
    print(f"{'':<28} {'Bizim model':>10} {'Gemini':>10}")
    _satir("İlgi alanı bulma: kesinlik", bizim["ilgi"][0], gemini["ilgi"][0])
    _satir("İlgi alanı bulma: duyarlılık", bizim["ilgi"][1], gemini["ilgi"][1])
    _satir("İlgi alanı bulma: F1", bizim["ilgi"][2], gemini["ilgi"][2])
    _satir("İstemediğini bulma: F1", bizim["istememe"][2], gemini["istememe"][2])
    _satir("İlk tahmin isabeti", bizim["ilk_tahmin_isabeti"], gemini["ilk_tahmin_isabeti"])
    _satir("Metin başına süre (saniye)", bizim_sure, gemini_sure, yuzde=False)
    print(f"\nKarşılaştırma: metni okumadan herkese '{taban[0]}' deseydik ilk tahmin isabeti {_yuzde(taban[1])}")
    print("Bizim model: internet ve kota gerektirmez, ücretsiz. Gemini: her metin için bir istek harcar.")

    print("\nAlan bazında ilgi F1:")
    print(f"{'':<18} {'Bizim':>8} {'Gemini':>8}")
    for kod in ALAN_KODLARI:
        print(f"  {kod:<16} {_yuzde(bizim['alanlar'][kod]['ilgi'][2]):>8} {_yuzde(gemini['alanlar'][kod]['ilgi'][2]):>8}")


if __name__ == "__main__":
    main()
