"""Projeleri puanlar ve öğrenciye gösterilecek 10 projeyi seçer.

Akış:
1. Aday toplama: havuzdan öğrencinin ilgi alanlarındaki projeler (istemediği alanlar elenir)
   + Gemini'den 5 yeni proje (Gemini cevap vermezse sadece havuz).
2. Puanlama (her biri 0-100):
     uyum           : projenin alanı öğrencinin ilgi puanına ve becerilerine ne kadar uyuyor
     yapılabilirlik : projenin gerektirdiği emek öğrencinin süresine, saatine, ekibine sığıyor mu
     özgünlük       : proje ne kadar az seçilmiş (çok seçilen proje geri plana düşer)
     toplam = 0.50 x uyum + 0.30 x yapılabilirlik + 0.20 x özgünlük
3. Seçim: en iyi 25 aday arasından, hem puanı yüksek hem birbirine benzemeyen 10 proje seçilir
   (MMR yöntemi). Küçük bir rastgelelik eklenir; aynı profile sahip iki öğrenci aynı listeyi görmez.

Sunucu kullanımı:
    from oneri_motoru.siralama import oner
    projeler = oner(profil, havuz=havuz_listesi, gemini_kullan=True)
"""
import logging
import random
import sys

from .etiketler import ALAN_ADI
from .yapay_zeka import YapayZekaHatasi

AGIRLIK_UYUM, AGIRLIK_YAPILABILIRLIK, AGIRLIK_OZGUNLUK = 0.50, 0.30, 0.20
GOSTERILECEK = 10       # öğrenciye gösterilen proje
DUELLO = 8              # ilk 8'i düelloya girer
ADAY_SAYISI = 25        # seçim bu kadar en iyi aday arasından yapılır
EN_AZ_GEMINI = 2        # Gemini çalışıyorsa listede en az bu kadar "sana özel" proje olsun
AYNI_ALAN_EN_FAZLA = 5  # listede aynı ana alandan en fazla bu kadar proje
ADAYDA_AYNI_ALAN = 10   # 25 adaylık havuzda aynı ana alandan en fazla bu kadar proje
YAPILAMAZ = 20          # yapılabilirliği bunun altındaki projeler, yeterince seçenek varsa elenir
CESITLILIK = 0.30       # 0: sadece puan, 1: sadece farklılık
RASTGELELIK = 4.0       # puana eklenen rastgele oynama (puan biriminde)

# Bir projenin kişi başı haftalık yaklaşık emeği (saat), zorluğa göre
HAFTALIK_EMEK = {1: 6, 2: 9, 3: 13}
GEMINI_OZGUNLUK = 90


# ---------- Puanlar ----------

def _ilgi(profil):
    """{alan_kodu: 0-1}: profilde olmayan alan 0."""
    return {a["kod"]: a["puan"] / 5 for a in profil["alanlar"]}


def uyum_puani(proje, profil):
    ilgi = _ilgi(profil)
    alan_skoru = max(ilgi.get(proje["alan"], 0.0), 0.6 * ilgi.get(proje.get("alan2") or "", 0.0))
    gereken = set(proje.get("beceriler", []))
    bilinen = set(profil.get("beceriler", []))
    if not gereken:
        beceri_skoru = 0.5
    elif not bilinen:
        beceri_skoru = 0.4  # öğrenci beceri yazmamış: tarafsız sayılır
    else:
        beceri_skoru = len(gereken & bilinen) / len(gereken)
    skor = 0.75 * alan_skoru + 0.25 * beceri_skoru
    tercih = profil.get("tercih", "farketmez")
    if tercih in ("uretmek", "arastirmak") and proje.get("tercih") and proje["tercih"] != tercih:
        skor -= 0.10
    return round(100 * min(1.0, max(0.0, skor)))


def yapilabilirlik_puani(proje, profil):
    """Öğrencinin ayırabileceği toplam saat / projenin gerektirdiği toplam saat."""
    kapasite = profil.get("sure_hafta", 8) * profil.get("haftalik_saat", 8) * profil.get("ekip", 1)
    ihtiyac = proje.get("hafta", 8) * HAFTALIK_EMEK.get(proje.get("zorluk", 2), 9)
    oran = kapasite / ihtiyac if ihtiyac else 1.0
    if oran < 1:
        skor = oran ** 1.5                       # süreye sığmıyor: hızla düşer
    elif oran <= 3:
        skor = 1.0                               # rahat sığıyor
    else:
        skor = max(0.6, 1.0 - 0.1 * (oran - 3))  # çok küçük kalıyor: biraz düşer
    return round(100 * skor)


def ozgunluk_puani(proje):
    if proje.get("kaynak") == "gemini":
        return GEMINI_OZGUNLUK
    # Her 5 seçilişte puan yaklaşık yarıya iner; hiç seçilmemiş proje 100
    return round(100 / (1 + proje.get("secilme_sayisi", 0) / 5))


def puanla(proje, profil):
    u, y, o = uyum_puani(proje, profil), yapilabilirlik_puani(proje, profil), ozgunluk_puani(proje)
    return {
        **proje,
        "puan_uyum": u,
        "puan_yapilabilirlik": y,
        "puan_ozgunluk": o,
        "puan_toplam": round(AGIRLIK_UYUM * u + AGIRLIK_YAPILABILIRLIK * y + AGIRLIK_OZGUNLUK * o),
    }


# ---------- Aday toplama ----------

def havuzdan_adaylar(profil, havuz):
    istemedikleri = set(profil.get("istemedikleri", []))
    ilgili = {a["kod"] for a in profil["alanlar"]}
    uygun = [
        p for p in havuz
        if p["alan"] not in istemedikleri and (p.get("alan2") or "") not in istemedikleri
    ]
    adaylar = [p for p in uygun if p["alan"] in ilgili or (p.get("alan2") or "") in ilgili]
    return adaylar if len(adaylar) >= GOSTERILECEK else uygun


# ---------- Seçim ----------

def _benzerlik(a, b):
    """0-1: aynı alan ve ortak beceriler benzerliği artırır."""
    if a["alan"] == b["alan"]:
        alan = 0.6
    elif {a["alan"], a.get("alan2")} & {b["alan"], b.get("alan2")} - {None}:
        alan = 0.3
    else:
        alan = 0.0
    ba, bb = set(a.get("beceriler", [])), set(b.get("beceriler", []))
    beceri = len(ba & bb) / len(ba | bb) if ba | bb else 0.0
    return min(1.0, alan + 0.4 * beceri)


def sec(adaylar, adet=GOSTERILECEK, rastgele=None, en_az_gemini=0):
    """Puanı yüksek ve birbirine benzemeyen projeleri seçer (MMR + kontrollü rastgelelik)."""
    rastgele = rastgele or random.Random()
    oynamis = {id(p): p["puan_toplam"] + rastgele.uniform(-RASTGELELIK, RASTGELELIK) for p in adaylar}
    havuz, sayac = [], {}
    for p in sorted(adaylar, key=lambda p: oynamis[id(p)], reverse=True):
        if len(havuz) == ADAY_SAYISI:
            break
        if sayac.get(p["alan"], 0) < ADAYDA_AYNI_ALAN:
            havuz.append(p)
            sayac[p["alan"]] = sayac.get(p["alan"], 0) + 1
    alinan = {id(p) for p in havuz}
    havuz += [p for p in adaylar if p.get("kaynak") == "gemini" and id(p) not in alinan]  # Gemini her zaman yarışa girer

    secilen = []
    alan_sayisi = {}
    while havuz and len(secilen) < adet:
        kalan_yer = adet - len(secilen)
        eksik_gemini = en_az_gemini - sum(p.get("kaynak") == "gemini" for p in secilen)
        adaylar_simdi = havuz
        if eksik_gemini >= kalan_yer:
            adaylar_simdi = [p for p in havuz if p.get("kaynak") == "gemini"] or havuz
        uygunlar = [p for p in adaylar_simdi if alan_sayisi.get(p["alan"], 0) < AYNI_ALAN_EN_FAZLA] or adaylar_simdi

        def mmr(p):
            benzerlik = max((_benzerlik(p, s) for s in secilen), default=0.0)
            return (1 - CESITLILIK) * oynamis[id(p)] / 100 - CESITLILIK * benzerlik

        en_iyi = max(uygunlar, key=mmr)
        secilen.append(en_iyi)
        havuz.remove(en_iyi)
        alan_sayisi[en_iyi["alan"]] = alan_sayisi.get(en_iyi["alan"], 0) + 1

    return sorted(secilen, key=lambda p: p["puan_toplam"], reverse=True)


def _kaliba_cevir(proje, sira):
    """Anlaşma belgesindeki proje kalıbı."""
    return {
        "kaynak": proje.get("kaynak", "havuz"),
        "havuz_proje_id": (proje.get("havuz_proje_id") or proje.get("id")) if proje.get("kaynak") == "havuz" else None,
        "baslik": proje["baslik"],
        "alan": proje["alan"],
        "alan_adi": ALAN_ADI.get(proje["alan"], proje["alan"]),
        "alan2": proje.get("alan2"),
        "beceriler": proje.get("beceriler", []),
        "zorluk": proje.get("zorluk", 2),
        "hafta": proje.get("hafta", 8),
        "ne": proje["ne"],
        "kim": proje.get("kim"),
        "cikti": proje.get("cikti"),
        "adimlar": proje.get("adimlar", []),
        "kolay": proje.get("kolay"),
        "efsane": proje.get("efsane"),
        "puan_uyum": proje["puan_uyum"],
        "puan_yapilabilirlik": proje["puan_yapilabilirlik"],
        "puan_ozgunluk": proje["puan_ozgunluk"],
        "puan_toplam": proje["puan_toplam"],
        "benzer_baslik": None,
        "benzer_link": None,
        "benzerlik": None,
        "duelloda": sira < DUELLO,
        "surpriz": False,
    }


# ---------- Dışarıya açılan fonksiyon ----------

def oner(profil, havuz=None, gemini_kullan=True, rastgele=None):
    """Öğrenciye gösterilecek 10 projeyi döner (anlaşma belgesindeki proje kalıbında).

    profil: {"alanlar": [{"kod","ad","puan"}], "istemedikleri": [...], "beceriler": [...],
             "sure_hafta", "haftalik_saat", "ekip", "tercih", "proje_turu", "metin"}
    havuz:  proje sözlükleri listesi (veritabanındaki havuz_projeleri). Verilmezse veri/projeler.csv okunur.
            Veritabanından gelirken her projede "id" ve "secilme_sayisi" olmalı.
    gemini_kullan: False ise (ya da Gemini cevap vermezse) sadece havuzdan seçilir.
    """
    if havuz is None:
        from .veri import projeleri_oku
        havuz = projeleri_oku()
    havuz = [{**p, "kaynak": p.get("kaynak", "havuz")} for p in havuz]

    adaylar = [puanla(p, profil) for p in havuzdan_adaylar(profil, havuz)]
    yapilabilir = [p for p in adaylar if p["puan_yapilabilirlik"] >= YAPILAMAZ]
    if len(yapilabilir) >= GOSTERILECEK:
        adaylar = yapilabilir  # süresine hiç sığmayan projeler gösterilmez

    gemini_projeleri = []
    if gemini_kullan:
        from .uretim import yeni_projeler
        en_iyi_basliklar = [p["baslik"] for p in sorted(adaylar, key=lambda p: p["puan_toplam"], reverse=True)]
        try:
            gemini_projeleri = [puanla(p, profil) for p in yeni_projeler(profil, haric_basliklar=en_iyi_basliklar)]
        except YapayZekaHatasi:
            gemini_projeleri = []  # Gemini yoksa öğrenci fark etmez, sadece havuzdan önerilir
        except Exception:
            # Beklenmedik bir hata (ör. Gemini'nin cevabında tuhaf bir değer) de öneriyi durdurmasın
            logging.getLogger(__name__).exception("Gemini projeleri eklenemedi, sadece havuzdan öneriliyor")
            gemini_projeleri = []

    secilen = sec(
        adaylar + gemini_projeleri,
        rastgele=rastgele,
        en_az_gemini=min(EN_AZ_GEMINI, len(gemini_projeleri)),
    )
    return [_kaliba_cevir(p, i) for i, p in enumerate(secilen)]


def _ornek_goster():
    """Deneme: python -m oneri_motoru.siralama "yazı"   (Gemini'yi de katmak için sonuna --gemini ekle)"""
    import json

    from .profil import profil_cikar

    metin = " ".join(a for a in sys.argv[1:] if not a.startswith("--")) or "unity ile oyun yapmak istiyorum, c# biliyorum ama web işlerinden sıkıldım"
    profil = {**profil_cikar(metin), "sure_hafta": 12, "haftalik_saat": 8, "ekip": 2, "tercih": "uretmek", "metin": metin}
    print("Profil:", json.dumps(profil, ensure_ascii=False))
    for i, p in enumerate(oner(profil, gemini_kullan="--gemini" in sys.argv), 1):
        etiket = "Sana özel" if p["kaynak"] == "gemini" else "Havuz"
        print(f"{i:2}. [{p['puan_toplam']:3}] {p['baslik']}  ({p['alan_adi']}, zorluk {p['zorluk']}, {p['hafta']} hafta, {etiket})")


if __name__ == "__main__":
    _ornek_goster()
