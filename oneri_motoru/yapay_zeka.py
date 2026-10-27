"""Yapay zekâ servisiyle konuşan tek yer.

Projenin geri kalanı yapay zekâya hep buradaki sor() fonksiyonuyla ulaşır.
Başka bir servise geçmek gerekirse sadece bu dosya değişir.

Ayarlar ana klasördeki .env dosyasında:
    GEMINI_API_KEY=...            (zorunlu)
    GEMINI_MODEL=gemini-flash-lite-latest
                                  (isteğe bağlı, yazılmazsa bu kullanılır. Hafif model seçtik: gemini-3.8-flash
                                   ücretsiz katmanda çoğu zaman yoğun (503/504), hafif model 1-2 saniyede cevap veriyor.)
    GEMINI_DUSUNME=low            (isteğe bağlı: minimal, low, medium, high. Gemini cevaplamadan önce
                                   ne kadar "düşünsün"? Az düşünce daha hızlı cevap verir.)
    GEMINI_ZAMAN_ASIMI=30         (isteğe bağlı: bir isteğe en fazla kaç saniye beklensin. Google takılırsa
                                   sunucu sonsuza kadar beklemesin, süre dolunca sistem yedeğe geçsin.)
"""
import json
import os
import time

import httpx
from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

load_dotenv()

API_ANAHTARI = os.getenv("GEMINI_API_KEY")
MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")

# Bu durum kodlarında sorun geçicidir (yoğunluk, kota, sunucu hatası); bir süre sonra tekrar denenebilir.
GECICI_HATALAR = {429, 500, 502, 503, 504}
BEKLEME_SANIYE = 3

# Bir isteğe en fazla bu kadar beklenir. Süre dolarsa tekrar denenmez (Google zaten yavaş, ikinci deneme
# öğrenciyi bir o kadar daha bekletir); YapayZekaHatasi fırlar ve sistem havuz / yedek haritaya geçer.
ZAMAN_ASIMI_SANIYE = float(os.getenv("GEMINI_ZAMAN_ASIMI", "30"))


class YapayZekaHatasi(Exception):
    """Yapay zekâdan cevap alınamadı. Sunucu bunu yakalayıp öğrenciye
    "Şu an öneri üretilemedi, birazdan tekrar dene" diyecek."""


_istemci = None


def _istemci_al():
    global _istemci
    if _istemci is None:
        if not API_ANAHTARI:
            raise YapayZekaHatasi("GEMINI_API_KEY bulunamadı. .env dosyasına ekle (.env.example'a bak).")
        _istemci = genai.Client(api_key=API_ANAHTARI)
    return _istemci


def _dusunme_ayari(dusunme):
    """'low' gibi bir seviyeyi Gemini ayarına çevirir. Kütüphane ya da seviye tanınmazsa None (varsayılan)."""
    if not dusunme or dusunme.lower() not in ("minimal", "low", "medium", "high"):
        return None
    try:
        return types.ThinkingConfig(thinking_level=dusunme.upper())
    except Exception:
        return None


def sor(komut, *, sistem=None, sema=None, sicaklik=0.7, deneme_sayisi=2, dusunme=None, zaman_asimi=None):
    """Yapay zekâya bir istek gönderir, cevabı döner.

    komut:    yapay zekâya gönderilecek metin
    sistem:   yapay zekânın rolünü anlatan talimat (isteğe bağlı)
    sema:     JSON şeması. Verilirse cevap tam o kalıpta istenir ve
              Python sözlüğü/listesi olarak döner. Verilmezse düz metin döner.
    sicaklik: 0'a yakınsa hep benzer cevap, 1'e yakınsa daha yaratıcı cevap

    Geçici bir hata, ağ sorunu ya da bozuk JSON gelirse birkaç saniye bekleyip tekrar dener.
    Yine olmazsa YapayZekaHatasi fırlatır. Yani bu fonksiyondan YapayZekaHatasi dışında hata çıkmaz.
    """
    ayar = types.GenerateContentConfig(
        system_instruction=sistem,
        temperature=sicaklik,
        response_mime_type="application/json" if sema else None,
        response_json_schema=sema,
        thinking_config=_dusunme_ayari(dusunme),  # dusunme: "minimal", "low", "medium", "high" ya da None
        http_options=types.HttpOptions(timeout=int((zaman_asimi or ZAMAN_ASIMI_SANIYE) * 1000)),  # milisaniye
    )

    son_hata = None
    for deneme in range(1, deneme_sayisi + 1):
        try:
            cevap = _istemci_al().models.generate_content(model=MODEL, contents=komut, config=ayar)
            metin = cevap.text or ""
            return json.loads(metin) if sema else metin
        except errors.APIError as hata:
            son_hata = hata
            if hata.code not in GECICI_HATALAR:
                break  # anahtar yanlış, model adı yanlış gibi: tekrar denemenin faydası yok
        except json.JSONDecodeError as hata:
            son_hata = hata  # cevap kalıba uymadı, bir kez daha iste
        except YapayZekaHatasi:
            raise  # API anahtarı yok: tekrar denemenin faydası yok
        except httpx.TimeoutException as hata:
            son_hata = TimeoutError(f"{zaman_asimi or ZAMAN_ASIMI_SANIYE:g} saniyede cevap gelmedi ({type(hata).__name__})")
            break  # zaman aşımı: tekrar denemek öğrenciyi bir o kadar daha bekletir
        except Exception as hata:
            # İnternet koptu, bağlantı zaman aşımına uğradı gibi ağ sorunları (httpx hataları).
            # Bunlar da geçicidir, bir kez daha denenir.
            son_hata = hata
        if deneme < deneme_sayisi:
            time.sleep(BEKLEME_SANIYE)

    raise YapayZekaHatasi(f"Yapay zekâdan cevap alınamadı: {son_hata}") from son_hata


def kullanilabilir_modeller():
    """Bu API anahtarıyla kullanılabilen ve metin üretebilen Gemini modellerinin adları."""
    adlar = []
    for model in _istemci_al().models.list():
        if "generateContent" in (model.supported_actions or []):
            adlar.append(model.name.removeprefix("models/"))
    return sorted(adlar)