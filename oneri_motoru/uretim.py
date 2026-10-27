"""Gemini ile üretim: öğrenciye özel yeni projeler ve görev haritası.

Profil çıkarma ve sıralama bizim kodumuzda; Gemini sadece burada, iki iş için kullanılır:
1. yeni_projeler(): havuzda olmayan, öğrenciye özel 5 yeni proje fikri
2. gorev_haritasi(): seçilen proje için 12 adımlık yol haritası

Gemini cevap vermezse YapayZekaHatasi fırlar. Sıralama bunu yakalar ve sadece havuzla devam eder.
"""
import os

from .etiketler import ALAN_ADI, ALAN_KODLARI, BECERI_ADLARI
from .yapay_zeka import YapayZekaHatasi, sor

YENI_PROJE_SAYISI = 5

# Gemini cevap vermeden önce ne kadar düşünsün? Varsayılan "düşünme" çok yavaş (cevap başına onlarca saniye).
# "low" öğrenciyi daha az bekletir. .env'de GEMINI_DUSUNME=minimal / low / medium / high ile değişir.
DUSUNME = os.getenv("GEMINI_DUSUNME", "low")


def _sor(komut, **ayar):
    """sor() ile aynı, ama düşünme seviyesini ekler. Model bu ayarı desteklemezse ayarsız tekrar sorar."""
    try:
        return sor(komut, dusunme=DUSUNME, **ayar)
    except YapayZekaHatasi as hata:
        if DUSUNME and "think" in str(hata).lower():
            return sor(komut, **ayar)
        raise

_PROJE_OZELLIKLERI = {
    "baslik": {"type": "string", "description": "Kısa, akılda kalıcı başlık"},
    "ne": {"type": "string", "description": "Ne yapılacağı, 2-3 cümle. Sonunda 'Veri: ...' ile hangi veriyle yapılacağı"},
    "alan": {"type": "string", "enum": ALAN_KODLARI},
    "alan2": {"type": "string", "enum": ALAN_KODLARI + [""], "description": "İkinci alan, yoksa boş"},
    "beceriler": {"type": "array", "items": {"type": "string", "enum": BECERI_ADLARI}},
    "zorluk": {"type": "integer", "minimum": 1, "maximum": 3},
    "hafta": {"type": "integer", "minimum": 2, "maximum": 24},
    "tercih": {"type": "string", "enum": ["uretmek", "arastirmak"]},
    "kim": {"type": "string", "description": "Kimin işine yarar, kısa"},
    "cikti": {"type": "string", "description": "Sonunda elde ne olacak, kısa"},
    "adimlar": {"type": "array", "items": {"type": "string"}, "minItems": 4, "maxItems": 4},
    "kolay": {"type": "string", "description": "Kolay modda proje nasıl küçülür, tek cümle"},
    "efsane": {"type": "string", "description": "Efsane modda ne eklenir, tek cümle"},
}
PROJE_SEMASI = {
    "type": "object",
    "properties": {
        "projeler": {
            "type": "array",
            "items": {"type": "object", "properties": _PROJE_OZELLIKLERI, "required": list(_PROJE_OZELLIKLERI)},
        }
    },
    "required": ["projeler"],
}

HARITA_SEMASI = {
    "type": "object",
    "properties": {
        "adimlar": {
            "type": "array",
            "minItems": 12,
            "maxItems": 12,
            "items": {
                "type": "object",
                "properties": {
                    "baslik": {"type": "string", "description": "En fazla 8 kelime"},
                    "aciklama": {"type": "string", "description": "1-2 cümle, somut ne yapılacağı"},
                },
                "required": ["baslik", "aciklama"],
            },
        }
    },
    "required": ["adimlar"],
}

_SISTEM = (
    "Sen Bilgisayar ve Yazılım Mühendisliği öğrencilerine proje öneren bir danışmansın. "
    "Gerçekçi, bir üniversite öğrencisinin yapabileceği, gerçek bir soruna çözüm olan projeler önerirsin. "
    "Türkçe yazarsın. 'Akıllı' kelimesiyle başlayan başlıklardan kaçınırsın. Link uydurmazsın."
)


def _profil_ozeti(profil):
    alanlar = ", ".join(f"{ALAN_ADI[a['kod']]} ({a['puan']}/5)" for a in profil["alanlar"])
    istemedikleri = ", ".join(ALAN_ADI[k] for k in profil.get("istemedikleri", [])) or "yok"
    return (
        f"İlgi alanları: {alanlar}\n"
        f"İstemediği alanlar: {istemedikleri}\n"
        f"Bildiği beceriler: {', '.join(profil.get('beceriler', [])) or 'belirtmedi'}\n"
        f"Proje türü: {profil.get('proje_turu', 'donem')}, süre: {profil.get('sure_hafta', 8)} hafta, "
        f"haftada {profil.get('haftalik_saat', 8)} saat, ekip: {profil.get('ekip', 1)} kişi\n"
        f"Tercih: {profil.get('tercih', 'farketmez')}\n"
        f"Öğrencinin kendi sözleri: {profil.get('metin', '')}"
    )


def _temizle(proje, profil):
    """Gemini'nin cevabını kontrol eder; kalıba uymayanı atar (None döner)."""
    istemedikleri = set(profil.get("istemedikleri", []))
    if proje.get("alan") not in ALAN_KODLARI or proje["alan"] in istemedikleri:
        return None
    alan2 = proje.get("alan2") or None
    if alan2 not in ALAN_KODLARI or alan2 in istemedikleri or alan2 == proje["alan"]:
        alan2 = None
    adimlar = [a.strip() for a in proje.get("adimlar", []) if a and a.strip()][:4]
    if not proje.get("baslik") or not proje.get("ne") or len(adimlar) < 4:
        return None
    return {
        "baslik": proje["baslik"].strip()[:200],
        "ne": proje["ne"].strip(),
        "alan": proje["alan"],
        "alan2": alan2,
        "beceriler": [b for b in proje.get("beceriler", []) if b in BECERI_ADLARI],
        "zorluk": min(3, max(1, int(proje.get("zorluk", 2)))),
        "hafta": min(24, max(2, int(proje.get("hafta", 8)))),
        "tercih": proje.get("tercih") if proje.get("tercih") in ("uretmek", "arastirmak") else "uretmek",
        "kim": proje.get("kim") or None,
        "cikti": proje.get("cikti") or None,
        "adimlar": adimlar,
        "kolay": proje.get("kolay") or None,
        "efsane": proje.get("efsane") or None,
        "kaynak": "gemini",
        "havuz_proje_id": None,
        "secilme_sayisi": 0,
    }


def yeni_projeler(profil, adet=YENI_PROJE_SAYISI, haric_basliklar=()):
    """Profile özel yeni proje fikirleri. Gemini cevap vermezse YapayZekaHatasi fırlar."""
    haric = "; ".join(list(haric_basliklar)[:60])
    komut = (
        f"{_profil_ozeti(profil)}\n\n"
        f"Bu öğrenciye {adet} YENİ proje öner. Projeler ilgi alanlarından olsun, istemediği alanlardan "
        f"kesinlikle olmasın. Süresine ve ekibine sığsın. Becerilerinden yararlansın ama yeni bir şey de öğretsin. "
        f"Şu projelerle aynı ya da çok benzer olmasın: {haric or 'yok'}"
    )
    cevap = _sor(komut, sistem=_SISTEM, sema=PROJE_SEMASI, sicaklik=0.9)
    temiz = [p for p in (_temizle(p, profil) for p in cevap.get("projeler", [])) if p]
    if not temiz:
        raise YapayZekaHatasi("Gemini'nin ürettiği projelerin hiçbiri kalıba uymadı.")
    return temiz[:adet]


ZORLUK_MODLARI = {
    "kolay": "Kolay mod: projenin küçültülmüş hâli. Kolay modda değişen: {kolay}",
    "orta": "Orta mod: projenin normal hâli.",
    "efsane": "Efsane mod: projenin büyütülmüş hâli. Efsane modda eklenen: {efsane}",
}


def gorev_haritasi(proje, zorluk_modu="orta", profil=None):
    """Seçilen proje için 12 adımlık görev haritası: [{"sira": 1, "baslik", "aciklama"}, ...]."""
    mod = ZORLUK_MODLARI.get(zorluk_modu, ZORLUK_MODLARI["orta"]).format(
        kolay=proje.get("kolay") or "-", efsane=proje.get("efsane") or "-"
    )
    komut = (
        f"Proje: {proje['baslik']}\nNe yapılacak: {proje['ne']}\n"
        f"Ana adımlar: {'; '.join(proje.get('adimlar', []))}\n"
        f"Süre: {proje.get('hafta', 8)} hafta\n{mod}\n"
        + (f"\nÖğrenci:\n{_profil_ozeti(profil)}\n" if profil else "")
        + "\nBu projeyi baştan sona 12 somut adıma böl. Adımlar sırayla yapılabilir olsun; ilk adım "
        "hazırlık, son adım sunum/teslim olsun. Öğrencinin bildiği becerileri kullan, bilmediklerini "
        "öğrenmesi için adım koy."
    )
    cevap = _sor(komut, sistem=_SISTEM, sema=HARITA_SEMASI, sicaklik=0.4)
    adimlar = cevap.get("adimlar", [])[:12]
    if len(adimlar) < 12:
        raise YapayZekaHatasi("Görev haritası 12 adımdan kısa geldi.")
    return [
        {"sira": i, "baslik": a["baslik"].strip()[:150], "aciklama": a["aciklama"].strip()}
        for i, a in enumerate(adimlar, start=1)
    ]


def _buyuk_harfle(metin):
    """İlk harfi Türkçeye uygun büyütür: "istek" -> "İstek", "ılık" -> "Ilık"."""
    metin = (metin or "").strip()
    if not metin:
        return metin
    ilk = {"i": "İ", "ı": "I"}.get(metin[0], metin[0].upper())
    return ilk + metin[1:]


def _nokta(metin):
    """Cümlenin sonunda nokta yoksa ekler."""
    metin = (metin or "").strip()
    return metin if not metin or metin[-1] in ".!?…" else metin + "."


def _ilk_cumle(metin):
    """Proje anlatımının ilk cümlesi ("Veri: ..." kısmı olmadan)."""
    metin = " ".join((metin or "").split()).split(" Veri:")[0]
    return metin.split(". ")[0].rstrip(".")


def _kisalt(metin, uzunluk=160):
    metin = " ".join((metin or "").split())
    return metin if len(metin) <= uzunluk else metin[: uzunluk - 1].rsplit(" ", 1)[0] + "…"


def yedek_harita(proje, zorluk_modu="orta", profil=None):
    """Gemini cevap vermezse projenin kendi bilgilerinden 12 adımlık bir harita çıkarır.

    Projenin 4 adımı, gereken becerileri, ne çıkacağı ve seçilen zorluk modu kullanılır; öğrencinin
    bilmediği beceriler için öğrenme adımı eklenir. Gemini'ye hiç bağlı değildir, hep 12 adım döner.
    """
    beceriler = [b for b in proje.get("beceriler") or [] if b]
    bilinen = set((profil or {}).get("beceriler") or [])
    eksik = [b for b in beceriler if b not in bilinen] if profil else []
    hafta = proje.get("hafta")

    liste = [(
        "Projeyi tanı ve planla",
        f"Ne yapacağını netleştir: {_nokta(_kisalt(_ilk_cumle(proje.get('ne')), 200) or proje.get('baslik', 'proje'))} "
        + (f"{hafta} haftalık bir çalışma takvimi çıkar." if hafta else "Haftalık bir çalışma takvimi çıkar."),
    )]
    if eksik:
        liste.append((
            f"{', '.join(eksik[:3])} öğren",
            "Bu projede gerekecek ama henüz bilmediğin konular. Kısa bir başlangıç eğitimi bitir, "
            "küçük bir örnek yap ve ortamını kur.",
        ))
    else:
        liste.append((
            "Çalışma ortamını kur",
            (f"Gereken araçları hazırla: {', '.join(beceriler)}. " if beceriler else "Gereken araçları hazırla. ")
            + "Kodunu GitHub'da bir depoda tut.",
        ))

    adimlar = [_buyuk_harfle(a) for a in (proje.get("adimlar") or []) if a and a.strip()]
    adimlar = (adimlar + ["Projeyi geliştir"] * 4)[:4]
    baslangic = (
        "Önce en basit hâlini yap; çalışan küçük bir parça yeterli.",
        "İskeletini kur, ayrıntıları sonraya bırak.",
        "Küçük bir parçayla başla, çalıştığını gördükten sonra büyüt.",
        "İlk çalışan sürümü çıkar, sonra üzerine ekle.",
    )
    for i, adim in enumerate(adimlar):
        arac = f"{beceriler[i % len(beceriler)]} ile çalışacaksın. " if beceriler else ""
        liste.append((adim, arac + baslangic[i]))
        liste.append((f"{adim}: geliştir ve dene", "Eksikleri tamamla, birkaç farklı durumla dene, çıkan hataları düzelt."))

    if zorluk_modu == "kolay" and proje.get("kolay"):
        liste.append(("Kapsamı sade tut", f"Kolay mod: {_nokta(_buyuk_harfle(proje['kolay']))} Fazlasını ekleme, biten bir proje daha değerli."))
    elif zorluk_modu == "efsane" and proje.get("efsane"):
        liste.append(("Efsane özelliği ekle", f"Efsane mod: {_nokta(_buyuk_harfle(proje['efsane']))}"))
    else:
        liste.append(("Parçaları birleştir ve test et", "Projeyi baştan sona çalıştır, gerçek bir kullanıcı gibi dene ve hataları düzelt."))

    liste.append((
        "Raporla, sun ve teslim et",
        (f"Sonunda elinde olacak: {_nokta(_kisalt(proje['cikti'], 120))} " if proje.get("cikti") else "")
        + "Son testleri yap, kısa bir rapor ya da README yaz, canlı gösterimli bir sunum hazırla.",
    ))
    return [{"sira": i, "baslik": b[:150], "aciklama": a} for i, (b, a) in enumerate(liste, start=1)]
