"""Yapay zekâ bağlantısı çalışıyor mu? Ana klasörden çalıştır:

    python -m oneri_motoru.deneme_yz

1. Anahtarınla kullanılabilen Flash modellerini listeler.
2. Örnek bir öğrenci yazısından profil çıkartır (JSON kalıbında).
3. Cevabın ne kadar sürdüğünü yazar.
"""
import json
import time

from .uretim import DUSUNME
from .yapay_zeka import MODEL, ZAMAN_ASIMI_SANIYE, YapayZekaHatasi, kullanilabilir_modeller, sor

ORNEK_METIN = (
    "Makine mühendisliği 3. sınıftayım. SolidWorks ve Arduino biliyorum, Python'u orta seviyede "
    "kullanıyorum. Robotik ve otomasyon ilgimi çekiyor, özellikle depo robotları. Sadece kâğıt "
    "üstünde kalan araştırma işlerinden hoşlanmıyorum, elle tutulur bir şey üretmek istiyorum."
)

PROFIL_SEMASI = {
    "type": "object",
    "properties": {
        "alanlar": {
            "type": "array",
            "description": "Öğrencinin ilgi alanları, en ilgili olandan başlayarak tam 5 tane",
            "items": {
                "type": "object",
                "properties": {
                    "ad": {"type": "string"},
                    "puan": {"type": "integer", "minimum": 1, "maximum": 5},
                },
                "required": ["ad", "puan"],
            },
        },
        "beceriler": {
            "type": "array",
            "description": "Öğrencinin bildiğini söylediği beceriler",
            "items": {"type": "string"},
        },
    },
    "required": ["alanlar", "beceriler"],
}


def main():
    print("1) Kullanılabilen Flash modelleri:")
    try:
        flashlar = [ad for ad in kullanilabilir_modeller() if "flash" in ad]
    except YapayZekaHatasi as hata:
        print("   HATA:", hata)
        return
    except Exception as hata:  # anahtar yanlışsa liste de alınamaz
        print("   Liste alınamadı:", hata)
        return
    for ad in flashlar:
        print("   -", ad, "  <-- şu an kullanılan" if ad == MODEL else "")

    print(f"\n2) Profil çıkarma denemesi (model: {MODEL}, düşünme: {DUSUNME}, en fazla {ZAMAN_ASIMI_SANIYE:g} sn)")
    baslangic = time.perf_counter()
    try:
        profil = sor(
            f"Öğrencinin yazısı:\n{ORNEK_METIN}",
            sistem="Sen bir proje danışmanısın. Öğrencinin yazısından ilgi alanlarını (1-5 puan) "
            "ve bildiği becerileri çıkar. Türkçe yaz.",
            sema=PROFIL_SEMASI,
            sicaklik=0.2,
            dusunme=DUSUNME,  # sistemle aynı ayar: deneme gerçek kullanımdaki hızı göstersin
        )
    except YapayZekaHatasi as hata:
        print("   HATA:", hata)
        return
    sure = time.perf_counter() - baslangic

    print(json.dumps(profil, ensure_ascii=False, indent=2))
    print(f"\n3) Cevap süresi: {sure:.1f} saniye")
    print("Yapay zekâ bağlantısı çalışıyor.")


if __name__ == "__main__":
    main()