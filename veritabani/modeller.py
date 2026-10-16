"""Veritabanı tablolarının Python karşılıkları.

Her sınıf bir tabloya, her alan bir sütuna karşılık gelir.
Tabloları bu dosya kurmaz; tablolar.sql kurar. Bu dosya sadece Python'dan
okuyup yazabilmemiz için tabloların "haritası"dır. tablolar.sql değişirse
burası da aynı şekilde değişmeli.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .baglanti import Taban

BOS_LISTE = text("'[]'::jsonb")


def otomatik_id():
    """Numarayı veritabanı verir (1, 2, 3...); biz hiç yazmayız."""
    return mapped_column(Integer, Identity(always=True), primary_key=True)


def simdi():
    """Satır eklendiği anın tarih ve saati."""
    return mapped_column(DateTime(timezone=True), server_default=func.now())


class Kullanici(Taban):
    __tablename__ = "kullanicilar"

    id: Mapped[int] = otomatik_id()
    ad: Mapped[str] = mapped_column(String(100))
    eposta: Mapped[str] = mapped_column(String(255), unique=True)
    sifre_ozeti: Mapped[str] = mapped_column(String(255))
    rol: Mapped[str] = mapped_column(String(20), server_default="ogrenci")
    olusturma_tarihi: Mapped[datetime] = simdi()

    profiller: Mapped[list["Profil"]] = relationship(back_populates="kullanici")
    secimler: Mapped[list["SecilenProje"]] = relationship(back_populates="kullanici")


class Bolum(Taban):
    __tablename__ = "bolumler"

    id: Mapped[int] = otomatik_id()
    ad: Mapped[str] = mapped_column(String(150), unique=True)
    grup: Mapped[str] = mapped_column(String(20))  # 'muhendislik' ya da 'diger'


class Profil(Taban):
    __tablename__ = "profiller"

    id: Mapped[int] = otomatik_id()
    kullanici_id: Mapped[int] = mapped_column(ForeignKey("kullanicilar.id", ondelete="CASCADE"))
    bolum_id: Mapped[Optional[int]] = mapped_column(ForeignKey("bolumler.id"))
    bolum_diger: Mapped[Optional[str]] = mapped_column(String(150))
    proje_turu: Mapped[str] = mapped_column(String(20))  # ders, donem, bitirme, yarisma, kisisel
    sure_hafta: Mapped[int] = mapped_column(SmallInteger)
    metin: Mapped[str] = mapped_column(Text)
    haftalik_saat: Mapped[int] = mapped_column(SmallInteger)
    ekip: Mapped[int] = mapped_column(SmallInteger)
    tercih: Mapped[str] = mapped_column(String(20))  # uretmek, arastirmak, farketmez
    alanlar: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)  # [{"kod","ad","puan"}] x5
    istemedikleri: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)  # ["web", ...]
    beceriler: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)  # ["Python", ...]
    onaylandi: Mapped[bool] = mapped_column(Boolean, server_default="false")
    olusturma_tarihi: Mapped[datetime] = simdi()

    kullanici: Mapped[Kullanici] = relationship(back_populates="profiller")
    bolum: Mapped[Optional[Bolum]] = relationship()
    projeler: Mapped[list["Proje"]] = relationship(back_populates="profil")


class HavuzProjesi(Taban):
    """Ekibin hazırladığı proje havuzu. veri/projeler.csv'den yüklenir."""

    __tablename__ = "havuz_projeleri"

    id: Mapped[int] = otomatik_id()
    baslik: Mapped[str] = mapped_column(String(200), unique=True)
    ne: Mapped[str] = mapped_column(Text)
    alan: Mapped[str] = mapped_column(String(30))  # 12 alan kodundan biri (oneri_motoru/etiketler.py)
    alan2: Mapped[Optional[str]] = mapped_column(String(30))
    beceriler: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)
    zorluk: Mapped[int] = mapped_column(SmallInteger)  # 1-3
    hafta: Mapped[int] = mapped_column(SmallInteger)
    tercih: Mapped[str] = mapped_column(String(20), server_default="uretmek")  # uretmek, arastirmak
    kim: Mapped[Optional[str]] = mapped_column(Text)
    cikti: Mapped[Optional[str]] = mapped_column(Text)
    adimlar: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)
    kolay: Mapped[Optional[str]] = mapped_column(Text)
    efsane: Mapped[Optional[str]] = mapped_column(Text)
    esin_kaynagi: Mapped[Optional[str]] = mapped_column(String(500))
    ekleyen: Mapped[Optional[str]] = mapped_column(String(50))
    secilme_sayisi: Mapped[int] = mapped_column(Integer, server_default="0")  # çok seçilen geri plana düşer
    olusturma_tarihi: Mapped[datetime] = simdi()


class Proje(Taban):
    """Bir öğrenciye önerilen proje (profil başına 10)."""

    __tablename__ = "projeler"

    id: Mapped[int] = otomatik_id()
    profil_id: Mapped[int] = mapped_column(ForeignKey("profiller.id", ondelete="CASCADE"))
    kaynak: Mapped[str] = mapped_column(String(10), server_default="havuz")  # havuz, gemini
    havuz_proje_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("havuz_projeleri.id", ondelete="SET NULL")
    )
    baslik: Mapped[str] = mapped_column(String(200))
    alan: Mapped[str] = mapped_column(String(100))
    alan2: Mapped[Optional[str]] = mapped_column(String(100))
    beceriler: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)
    zorluk: Mapped[int] = mapped_column(SmallInteger)  # 1-3
    hafta: Mapped[int] = mapped_column(SmallInteger)
    ne: Mapped[str] = mapped_column(Text)
    kim: Mapped[Optional[str]] = mapped_column(Text)
    cikti: Mapped[Optional[str]] = mapped_column(Text)
    adimlar: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)
    kolay: Mapped[Optional[str]] = mapped_column(Text)
    efsane: Mapped[Optional[str]] = mapped_column(Text)
    puan_uyum: Mapped[Optional[int]] = mapped_column(SmallInteger)
    puan_yapilabilirlik: Mapped[Optional[int]] = mapped_column(SmallInteger)
    puan_ozgunluk: Mapped[Optional[int]] = mapped_column(SmallInteger)
    puan_toplam: Mapped[Optional[int]] = mapped_column(SmallInteger)
    benzer_baslik: Mapped[Optional[str]] = mapped_column(String(300))
    benzer_link: Mapped[Optional[str]] = mapped_column(String(500))
    benzerlik: Mapped[Optional[Decimal]] = mapped_column(Numeric(3, 2))
    duelloda: Mapped[bool] = mapped_column(Boolean, server_default="false")
    surpriz: Mapped[bool] = mapped_column(Boolean, server_default="false")
    olusturma_tarihi: Mapped[datetime] = simdi()

    profil: Mapped[Profil] = relationship(back_populates="projeler")
    havuz_projesi: Mapped[Optional[HavuzProjesi]] = relationship()


class DuelloSecimi(Taban):
    __tablename__ = "duello_secimleri"

    id: Mapped[int] = otomatik_id()
    profil_id: Mapped[int] = mapped_column(ForeignKey("profiller.id", ondelete="CASCADE"))
    kazanan_proje_id: Mapped[int] = mapped_column(ForeignKey("projeler.id", ondelete="CASCADE"))
    kaybeden_proje_id: Mapped[int] = mapped_column(ForeignKey("projeler.id", ondelete="CASCADE"))
    tur: Mapped[str] = mapped_column(String(10))  # ceyrek, yari, final
    tarih: Mapped[datetime] = simdi()


class SecilenProje(Taban):
    __tablename__ = "secilen_projeler"

    id: Mapped[int] = otomatik_id()
    kullanici_id: Mapped[int] = mapped_column(ForeignKey("kullanicilar.id", ondelete="CASCADE"))
    proje_id: Mapped[int] = mapped_column(ForeignKey("projeler.id", ondelete="CASCADE"))
    zorluk_modu: Mapped[str] = mapped_column(String(10), server_default="orta")  # kolay, orta, efsane
    secim_tarihi: Mapped[datetime] = simdi()

    kullanici: Mapped[Kullanici] = relationship(back_populates="secimler")
    proje: Mapped[Proje] = relationship()
    adimlar: Mapped[list["GorevAdimi"]] = relationship(
        back_populates="secim", order_by="GorevAdimi.sira"
    )


class GorevAdimi(Taban):
    __tablename__ = "gorev_adimlari"
    __table_args__ = (UniqueConstraint("secim_id", "sira"),)

    id: Mapped[int] = otomatik_id()
    secim_id: Mapped[int] = mapped_column(ForeignKey("secilen_projeler.id", ondelete="CASCADE"))
    sira: Mapped[int] = mapped_column(SmallInteger)  # 1-12
    baslik: Mapped[str] = mapped_column(String(150))
    aciklama: Mapped[Optional[str]] = mapped_column(Text)
    tamamlandi: Mapped[bool] = mapped_column(Boolean, server_default="false")
    tamamlanma_tarihi: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    secim: Mapped[SecilenProje] = relationship(back_populates="adimlar")


class BenzerlikOnbellegi(Taban):
    __tablename__ = "benzerlik_onbellegi"

    id: Mapped[int] = otomatik_id()
    arama_metni: Mapped[str] = mapped_column(Text, unique=True)
    sonuclar: Mapped[list] = mapped_column(JSONB, server_default=BOS_LISTE)
    tarih: Mapped[datetime] = simdi()


class YapayZekaKullanimi(Taban):
    __tablename__ = "yapay_zeka_kullanimi"

    kullanici_id: Mapped[int] = mapped_column(
        ForeignKey("kullanicilar.id", ondelete="CASCADE"), primary_key=True
    )
    tarih: Mapped[date] = mapped_column(Date, primary_key=True, server_default=func.current_date())
    sayi: Mapped[int] = mapped_column(Integer, server_default="0")