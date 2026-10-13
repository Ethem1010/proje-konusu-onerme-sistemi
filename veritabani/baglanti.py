"""Veritabanı bağlantısı.

Bağlantı adresi ana klasördeki .env dosyasında, DATABASE_URL satırında durur.
Şifre koda yazılmaz; böylece kod GitHub'a gitse bile şifre gitmez.
"""
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL bulunamadı. Ana klasörde .env dosyası var mı? "
        ".env.example dosyasına bakarak oluştur."
    )

# Motor: veritabanıyla aradaki kalıcı hat. Programda bir kere oluşturulur.
# pool_pre_ping: kopmuş bağlantıyı kullanmadan önce fark edip yenisini açar.
motor = create_engine(DATABASE_URL, pool_pre_ping=True)

# Oturum: tek bir iş için açılan konuşma (oku, yaz, kaydet, kapat).
OturumYapici = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


class Taban(DeclarativeBase):
    """Bütün tablo sınıflarının (modeller.py) türediği ortak sınıf."""


def oturum_al():
    """FastAPI için: her istekte bir oturum açar, iş bitince mutlaka kapatır.

    Seyithan sunucuda şöyle kullanacak:
        def bolumleri_getir(oturum = Depends(oturum_al)): ...
    """
    oturum = OturumYapici()
    try:
        yield oturum
    finally:
        oturum.close()