"""Öğrencinin günlük Gemini hakkı (yapay_zeka_kullanimi tablosu).

Repo herkese açık ve her kişinin Gemini kotası sınırlı. Bir öğrenci gün içinde
en fazla GUNLUK_HAK kez Gemini'ye istek yaptırabilir.

- Öneri (/oneriler) hak dolunca hata VERMEZ, sadece havuzdan önerir.
- Görev haritası gibi Gemini'ye mecbur işler (4. hafta) hak dolunca 429 verir.

Sınırı değiştirmek için .env'e GUNLUK_YZ_HAKKI=20 gibi bir satır eklenebilir.
"""
import os
from datetime import date

from dotenv import load_dotenv
from sqlalchemy.orm import Session

from veritabani.modeller import YapayZekaKullanimi

load_dotenv()

GUNLUK_HAK = int(os.getenv("GUNLUK_YZ_HAKKI", "10"))


def bugunku_sayi(oturum: Session, kullanici_id: int) -> int:
    kayit = oturum.get(YapayZekaKullanimi, (kullanici_id, date.today()))
    return kayit.sayi if kayit else 0


def hakki_var_mi(oturum: Session, kullanici_id: int) -> bool:
    return bugunku_sayi(oturum, kullanici_id) < GUNLUK_HAK


def hak_kullan(oturum: Session, kullanici_id: int) -> None:
    """Bugünkü sayacı 1 artırır. commit'i çağıran yapar."""
    kayit = oturum.get(YapayZekaKullanimi, (kullanici_id, date.today()))
    if kayit is None:
        oturum.add(YapayZekaKullanimi(kullanici_id=kullanici_id, tarih=date.today(), sayi=1))
    else:
        kayit.sayi += 1