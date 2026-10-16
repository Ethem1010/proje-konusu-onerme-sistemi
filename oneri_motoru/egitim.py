"""Profil modelini eğitir, başarısını ölçer ve kaydeder. Ana klasörden çalıştır:

    python -m oneri_motoru.egitim

1. veri/metinler.csv dosyasını okur.
2. Çapraz doğrulama yapar: veriyi 5 parçaya böler, her seferinde 4 parçayla eğitip
   modelin hiç görmediği 1 parçada dener. Böylece modelin ezber değil gerçekten
   öğrenip öğrenmediği ölçülür.
3. Beceri sözlüğünün (etiketler.py) ne kadar doğru bulduğunu da ölçer.
4. Modeli bütün veriyle son kez eğitip oneri_motoru/model/ klasörüne kaydeder.
"""
import argparse
import random

from .etiketler import ALAN_KODLARI, beceri_bul
from .model import MODEL_DOSYASI, OLUMLU, OLUMSUZ, ProfilModeli, _sinif
from .veri import METINLER_DOSYASI, metinleri_oku

AZ_VERI = 50


def _f1(dogru, tahmin_sayisi, gercek_sayisi):
    kesinlik = dogru / tahmin_sayisi if tahmin_sayisi else 0.0
    duyarlilik = dogru / gercek_sayisi if gercek_sayisi else 0.0
    f1 = 2 * kesinlik * duyarlilik / (kesinlik + duyarlilik) if kesinlik + duyarlilik else 0.0
    return kesinlik, duyarlilik, f1


def capraz_dogrulama(veri, parca_sayisi=5, tohum=42):
    """Modelin görmediği metinlerdeki tahminlerini toplar."""
    sira = list(range(len(veri)))
    random.Random(tohum).shuffle(sira)
    parcalar = [sira[i::parca_sayisi] for i in range(parca_sayisi)]
    gercekler, tahminler, olasiliklar = [None] * len(veri), [None] * len(veri), [None] * len(veri)
    for test in parcalar:
        egitim = [i for i in sira if i not in set(test)]
        model = ProfilModeli().egit([veri[i]["metin"] for i in egitim], [veri[i]["etiketler"] for i in egitim])
        test_metinleri = [veri[i]["metin"] for i in test]
        for i, t, p in zip(test, model.tahmin(test_metinleri), model.olasiliklar(test_metinleri)):
            gercekler[i] = {k: _sinif(v) for k, v in veri[i]["etiketler"].items()}
            tahminler[i] = t
            olasiliklar[i] = p
    return gercekler, tahminler, olasiliklar


def olcumler(gercekler, tahminler, olasiliklar):
    sonuc = {"alanlar": {}}
    for hedef, ad in ((OLUMLU, "ilgi"), (OLUMSUZ, "istememe")):
        toplam_dogru = toplam_tahmin = toplam_gercek = 0
        for kod in ALAN_KODLARI:
            dogru = sum(1 for g, t in zip(gercekler, tahminler) if g[kod] == hedef and t[kod] == hedef)
            tahmin_sayisi = sum(1 for t in tahminler if t[kod] == hedef)
            gercek_sayisi = sum(1 for g in gercekler if g[kod] == hedef)
            sonuc["alanlar"].setdefault(kod, {})[ad] = _f1(dogru, tahmin_sayisi, gercek_sayisi) + (gercek_sayisi,)
            toplam_dogru += dogru
            toplam_tahmin += tahmin_sayisi
            toplam_gercek += gercek_sayisi
        sonuc[ad] = _f1(toplam_dogru, toplam_tahmin, toplam_gercek)

    # İlk tahmin isabeti: modelin en yüksek puan verdiği alan, öğrencinin gerçekten ilgilendiği alanlardan biri mi?
    isabet = sayilan = 0
    for g, p in zip(gercekler, olasiliklar):
        ilgili = {k for k, v in g.items() if v == OLUMLU}
        if not ilgili:
            continue
        en_iyi = max(p, key=lambda k: p[k]["ilgi"])
        isabet += en_iyi in ilgili
        sayilan += 1
    sonuc["ilk_tahmin_isabeti"] = isabet / sayilan if sayilan else 0.0
    return sonuc


def beceri_olcumu(veri):
    dogru = tahmin_sayisi = gercek_sayisi = 0
    for v in veri:
        bulunan, gercek = set(beceri_bul(v["metin"])), set(v["beceriler"])
        dogru += len(bulunan & gercek)
        tahmin_sayisi += len(bulunan)
        gercek_sayisi += len(gercek)
    return _f1(dogru, tahmin_sayisi, gercek_sayisi)


def _yuzde(x):
    return f"%{100 * x:5.1f}"


def rapor_yaz(veri, sonuc, beceri):
    print(f"\nVeri: {len(veri)} öğrenci metni")
    print("\n=== Çapraz doğrulama (model bu metinleri eğitimde görmedi) ===")
    print(f"İlgi alanı bulma      kesinlik {_yuzde(sonuc['ilgi'][0])}  duyarlılık {_yuzde(sonuc['ilgi'][1])}  F1 {_yuzde(sonuc['ilgi'][2])}")
    print(f"İstemediğini bulma    kesinlik {_yuzde(sonuc['istememe'][0])}  duyarlılık {_yuzde(sonuc['istememe'][1])}  F1 {_yuzde(sonuc['istememe'][2])}")
    print(f"İlk tahmin isabeti    {_yuzde(sonuc['ilk_tahmin_isabeti'])}  (en yüksek puanlı alan gerçekten ilgilendiği alan mı)")
    print("\nAlan bazında ilgi F1 (örnek sayısı):")
    for kod in ALAN_KODLARI:
        _, _, f1, n = sonuc["alanlar"][kod]["ilgi"]
        print(f"  {kod:<16} {_yuzde(f1)}  ({n})")
    print("\n=== Beceri sözlüğü ===")
    print(f"kesinlik {_yuzde(beceri[0])}  duyarlılık {_yuzde(beceri[1])}  F1 {_yuzde(beceri[2])}")


def main():
    ayar = argparse.ArgumentParser(description="Profil modelini eğitir ve kaydeder.")
    ayar.add_argument("--veri", default=METINLER_DOSYASI, help="öğrenci metinleri CSV dosyası")
    ayar.add_argument("--kaydetme", action="store_true", help="sadece ölç, modeli kaydetme")
    secenek = ayar.parse_args()

    veri = metinleri_oku(secenek.veri)
    if not veri:
        print("Hiç metin bulunamadı.")
        return
    if len(veri) < AZ_VERI:
        print(f"UYARI: Sadece {len(veri)} metin var. Ölçümler güvenilir olmaz, en az {AZ_VERI} metin önerilir.")

    if len(veri) >= 10:
        sonuc = olcumler(*capraz_dogrulama(veri))
        rapor_yaz(veri, sonuc, beceri_olcumu(veri))
    else:
        print("Çapraz doğrulama için en az 10 metin gerekiyor, ölçüm atlandı.")

    if not secenek.kaydetme:
        ProfilModeli().egit([v["metin"] for v in veri], [v["etiketler"] for v in veri]).kaydet()
        print(f"\nModel kaydedildi: {MODEL_DOSYASI}")


if __name__ == "__main__":
    main()
