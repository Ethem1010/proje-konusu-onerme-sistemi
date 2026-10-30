"""Öneri adresleri: POST /oneriler/{profil_id}, GET /oneriler/{profil_id}.

Projeleri Ethem'in sıralama fonksiyonu seçer (oneri_motoru/siralama.py):
301 projelik havuz + Gemini'nin ürettiği 5 yeni proje, puanlanır, 10'u seçilir.
Gemini çökerse ya da öğrencinin günlük hakkı dolduysa sadece havuzdan önerilir;
öğrenci hata görmez.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from oneri_motoru.etiketler import ALAN_ADI
from oneri_motoru.siralama import oner
from veritabani.baglanti import oturum_al
from veritabani.modeller import DuelloSecimi, HavuzProjesi, Proje, SecilenProje

from .. import yz_hakki
from ..guvenlik import aktif_kullanici_id
from .profil import kullanicinin_profili

router = APIRouter(prefix="/oneriler", tags=["Öneriler"])
logger = logging.getLogger(__name__)

# Proje tablosundaki sütunlar; oner()'in döndürdüğü alan_adi gibi fazlalıklar kaydedilmez
PROJE_SUTUNLARI = {c.name for c in Proje.__table__.columns} - {"id", "profil_id", "olusturma_tarihi"}
HAVUZ_SUTUNLARI = [c.name for c in HavuzProjesi.__table__.columns]


class ProjeCevabi(BaseModel):
    """Anlaşma belgesindeki proje kalıbı (docs/anlasma.md, 4. bölüm)."""

    id: int
    kaynak: str
    havuz_proje_id: Optional[int]
    baslik: str
    alan: str
    alan_adi: str
    alan2: Optional[str]
    beceriler: list[str]
    zorluk: int
    hafta: int
    ne: str
    kim: Optional[str]
    cikti: Optional[str]
    adimlar: list[str]
    kolay: Optional[str]
    efsane: Optional[str]
    puan_uyum: Optional[int]
    puan_yapilabilirlik: Optional[int]
    puan_ozgunluk: Optional[int]
    puan_toplam: Optional[int]
    benzer_baslik: Optional[str]
    benzer_link: Optional[str]
    benzerlik: Optional[float]
    duelloda: bool
    surpriz: bool


def _cevap(proje: Proje) -> ProjeCevabi:
    return ProjeCevabi(
        id=proje.id,
        alan_adi=ALAN_ADI.get(proje.alan, proje.alan),
        benzerlik=float(proje.benzerlik) if proje.benzerlik is not None else None,
        **{s: getattr(proje, s) for s in PROJE_SUTUNLARI if s != "benzerlik"},
    )


def _profil_sozlugu(profil) -> dict:
    """oner()'in istediği profil kalıbı."""
    return {
        "alanlar": profil.alanlar,
        "istemedikleri": profil.istemedikleri,
        "beceriler": profil.beceriler,
        "sure_hafta": profil.sure_hafta,
        "haftalik_saat": profil.haftalik_saat,
        "ekip": profil.ekip,
        "tercih": profil.tercih,
        "proje_turu": profil.proje_turu,
        "metin": profil.metin,
    }


def _havuzu_oku(oturum: Session) -> list[dict]:
    """Veritabanındaki havuz projeleri, her biri id ve secilme_sayisi ile."""
    return [
        {s: getattr(p, s) for s in HAVUZ_SUTUNLARI}
        for p in oturum.scalars(select(HavuzProjesi))
    ]


def _kayitli_projeler(oturum: Session, profil_id: int) -> list[Proje]:
    sorgu = (
        select(Proje)
        .where(Proje.profil_id == profil_id, Proje.surpriz.is_(False))
        .order_by(Proje.puan_toplam.desc().nulls_last(), Proje.id)
    )
    return list(oturum.scalars(sorgu))


@router.post("/{profil_id}", response_model=list[ProjeCevabi])
def oneri_uret(
    profil_id: int,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Onaylanmış profile göre 10 proje seçer, kaydeder ve döner.

    Aynı profil için tekrar çağrılırsa eski liste silinip yenisi üretilir;
    ama düello başladıysa ya da proje seçildiyse liste korunur (409).
    """
    profil = kullanicinin_profili(profil_id, kullanici_id, oturum)
    # Aynı profil için aynı anda iki istek gelirse (çift tıklama, iki sekme) sırayla çalışsınlar;
    # yoksa ikisi de eski listeyi silip kendi 10 projesini ekler ve 20 proje olur.
    oturum.refresh(profil, with_for_update=True)
    if not profil.onaylandi:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Önce profilini onaylaman gerekiyor.")

    eski_idler = select(Proje.id).where(Proje.profil_id == profil_id)
    basladi = oturum.scalar(
        select(
            exists().where(DuelloSecimi.profil_id == profil_id)
            | exists().where(SecilenProje.proje_id.in_(eski_idler))
        )
    )
    if basladi:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Bu profil için düello başladı, öneriler artık değiştirilemez. Yeni öneri için yeni profil oluştur.",
        )

    havuz = _havuzu_oku(oturum)
    if not havuz:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "Proje havuzu boş. Sunucuda önce 'python -m veritabani.havuz_yukle' çalıştırılmalı.",
        )

    gemini_kullan = yz_hakki.hakki_var_mi(oturum, kullanici_id)  # hak dolduysa hata yok, sadece havuz
    try:
        projeler = oner(_profil_sozlugu(profil), havuz=havuz, gemini_kullan=gemini_kullan)
    except Exception:
        # oner() Gemini'nin bilinen hatalarını kendisi yakalar. Beklenmedik bir hata olursa
        # (internet kopması gibi) öğrenci yine de havuzdan önerisini alsın.
        if not gemini_kullan:
            raise
        logger.exception("Gemini ile öneride beklenmedik hata, sadece havuzdan öneriliyor")
        projeler = oner(_profil_sozlugu(profil), havuz=havuz, gemini_kullan=False)

    oturum.execute(delete(Proje).where(Proje.profil_id == profil_id))
    kayitlar = [
        Proje(profil_id=profil_id, **{k: v for k, v in p.items() if k in PROJE_SUTUNLARI})
        for p in projeler
    ]
    oturum.add_all(kayitlar)

    # Gemini gerçekten cevap verdiyse listede "gemini" kaynaklı proje vardır; sadece o zaman hak düşer
    if any(p["kaynak"] == "gemini" for p in projeler):
        yz_hakki.hak_kullan(oturum, kullanici_id)

    oturum.commit()
    return [_cevap(p) for p in sorted(kayitlar, key=lambda p: (-(p.puan_toplam or 0), p.id))]


@router.get("/{profil_id}", response_model=list[ProjeCevabi])
def onerileri_getir(
    profil_id: int,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Kayıtlı 10 projeyi puan_toplam'a göre büyükten küçüğe döner. Henüz üretilmediyse boş liste."""
    kullanicinin_profili(profil_id, kullanici_id, oturum)
    return [_cevap(p) for p in _kayitli_projeler(oturum, profil_id)]