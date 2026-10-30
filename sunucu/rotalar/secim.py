"""Seçim ve görev haritası: POST /secim, GET /secimler, GET /harita/{secim_id}, PUT /harita/{secim_id}.

POST /secim sırası:
1. Proje bu öğrencinin mi? (değilse 404)
2. secilen_projeler tablosuna kaydet.
3. Proje havuzdansa havuz_projeleri.secilme_sayisi 1 artar (çok seçilen proje geri plana düşer).
4. Günlük hak varsa Gemini 12 adımlık harita üretir. Gemini çökerse ya da hak dolduysa
   projenin kendi adımlarından yedek harita çıkar; öğrenci hata görmez.
5. 12 adım gorev_adimlari tablosuna yazılır.
Hak sadece Gemini gerçekten cevap verdiyse düşer.
"""
import logging
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from oneri_motoru import uretim
from veritabani.baglanti import oturum_al
from veritabani.modeller import GorevAdimi, HavuzProjesi, Proje, SecilenProje

from .. import yz_hakki
from ..guvenlik import aktif_kullanici_id
from .oneriler import _profil_sozlugu
from .projeler import kullanicinin_projesi

router = APIRouter(tags=["Seçim ve harita"])
logger = logging.getLogger(__name__)

ADIM_SAYISI = 12


class SecimIstegi(BaseModel):
    proje_id: int = Field(examples=[12])
    zorluk_modu: Literal["kolay", "orta", "efsane"] = Field(default="orta", examples=["orta"])


class AdimGuncelleme(BaseModel):
    sira: int = Field(ge=1, le=ADIM_SAYISI, examples=[4])
    tamamlandi: bool = Field(examples=[True])


class Adim(BaseModel):
    sira: int
    baslik: str
    aciklama: Optional[str]
    tamamlandi: bool
    tamamlanma_tarihi: Optional[datetime]


class HaritaCevabi(BaseModel):
    secim_id: int
    proje_id: int
    zorluk_modu: str
    adimlar: list[Adim]


class SecimOzeti(BaseModel):
    secim_id: int
    proje_id: int
    baslik: str
    alan: str
    zorluk_modu: str
    tamamlanan: int
    toplam: int
    secim_tarihi: datetime


def _cevap(secim: SecilenProje, oturum: Session) -> HaritaCevabi:
    adimlar = oturum.scalars(
        select(GorevAdimi).where(GorevAdimi.secim_id == secim.id).order_by(GorevAdimi.sira)
    )
    return HaritaCevabi(
        secim_id=secim.id,
        proje_id=secim.proje_id,
        zorluk_modu=secim.zorluk_modu,
        adimlar=[
            Adim(
                sira=a.sira,
                baslik=a.baslik,
                aciklama=a.aciklama,
                tamamlandi=a.tamamlandi,
                tamamlanma_tarihi=a.tamamlanma_tarihi,
            )
            for a in adimlar
        ],
    )


def _kullanicinin_secimi(secim_id: int, kullanici_id: int, oturum: Session) -> SecilenProje:
    secim = oturum.get(SecilenProje, secim_id)
    if secim is None or secim.kullanici_id != kullanici_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Seçim bulunamadı.")
    return secim


def _harita_uret(proje_sozlugu: dict, zorluk_modu: str, profil_sozlugu: dict, gemini_kullan: bool):
    """(adımlar, gemini_cevap_verdi_mi) döner. Ne olursa olsun 12 adım çıkar."""
    if gemini_kullan:
        try:
            adimlar = uretim.gorev_haritasi(proje_sozlugu, zorluk_modu, profil_sozlugu)
            if len(adimlar) == ADIM_SAYISI:
                return adimlar, True
        except Exception:
            # YapayZekaHatasi da, internet kopması gibi beklenmedik hatalar da buraya düşer
            logger.exception("Görev haritası Gemini ile üretilemedi, yedek harita kullanılıyor")
    return uretim.yedek_harita(proje_sozlugu, zorluk_modu, profil_sozlugu), False


@router.post("/secim", response_model=HaritaCevabi, status_code=status.HTTP_201_CREATED)
def proje_sec(
    istek: SecimIstegi,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Öğrencinin seçtiği projeyi kaydeder ve 12 adımlık görev haritasını oluşturur.

    Aynı proje ikinci kez seçilirse yeni kayıt açılmaz, var olan harita döner.
    """
    proje = kullanicinin_projesi(istek.proje_id, kullanici_id, oturum)

    var_olan = oturum.scalar(
        select(SecilenProje).where(
            SecilenProje.kullanici_id == kullanici_id, SecilenProje.proje_id == proje.id
        )
    )
    if var_olan is not None:
        return _cevap(var_olan, oturum)

    secim = SecilenProje(kullanici_id=kullanici_id, proje_id=proje.id, zorluk_modu=istek.zorluk_modu)
    oturum.add(secim)
    oturum.flush()  # secim.id oluşsun

    if proje.kaynak == "havuz" and proje.havuz_proje_id is not None:
        oturum.execute(
            update(HavuzProjesi)
            .where(HavuzProjesi.id == proje.havuz_proje_id)
            .values(secilme_sayisi=HavuzProjesi.secilme_sayisi + 1)
        )

    proje_sozlugu = {
        "baslik": proje.baslik,
        "ne": proje.ne,
        "adimlar": proje.adimlar,
        "hafta": proje.hafta,
        "kolay": proje.kolay,
        "efsane": proje.efsane,
        "beceriler": proje.beceriler,
        "cikti": proje.cikti,
    }
    adimlar, gemini_cevap_verdi = _harita_uret(
        proje_sozlugu,
        istek.zorluk_modu,
        _profil_sozlugu(proje.profil),
        gemini_kullan=yz_hakki.hakki_var_mi(oturum, kullanici_id),
    )
    oturum.add_all(
        GorevAdimi(secim_id=secim.id, sira=a["sira"], baslik=a["baslik"][:150], aciklama=a.get("aciklama"))
        for a in adimlar
    )
    if gemini_cevap_verdi:
        yz_hakki.hak_kullan(oturum, kullanici_id)

    oturum.commit()
    return _cevap(secim, oturum)


@router.get("/secimler", response_model=list[SecimOzeti])
def secimleri_getir(
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Öğrencinin seçtiği projeler, en yenisi önce. Öğrenci tekrar girince haritasına buradan döner."""
    tamamlanan = func.count(GorevAdimi.id).filter(GorevAdimi.tamamlandi.is_(True))
    satirlar = oturum.execute(
        select(SecilenProje, Proje.baslik, Proje.alan, tamamlanan, func.count(GorevAdimi.id))
        .join(Proje, Proje.id == SecilenProje.proje_id)
        .outerjoin(GorevAdimi, GorevAdimi.secim_id == SecilenProje.id)
        .where(SecilenProje.kullanici_id == kullanici_id)
        .group_by(SecilenProje.id, Proje.baslik, Proje.alan)
        .order_by(SecilenProje.secim_tarihi.desc(), SecilenProje.id.desc())
    ).all()
    return [
        SecimOzeti(
            secim_id=secim.id,
            proje_id=secim.proje_id,
            baslik=baslik,
            alan=alan,
            zorluk_modu=secim.zorluk_modu,
            tamamlanan=biten,
            toplam=hepsi,
            secim_tarihi=secim.secim_tarihi,
        )
        for secim, baslik, alan, biten, hepsi in satirlar
    ]


@router.get("/harita/{secim_id}", response_model=HaritaCevabi)
def harita_getir(
    secim_id: int,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """12 adımı sırasıyla, tamamlanma bilgisiyle verir."""
    return _cevap(_kullanicinin_secimi(secim_id, kullanici_id, oturum), oturum)


@router.put("/harita/{secim_id}", response_model=HaritaCevabi)
def adim_isaretle(
    secim_id: int,
    istek: AdimGuncelleme,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Bir adımı tamamlandı/tamamlanmadı yapar. Tamamlanınca tarih yazılır, kaldırılınca silinir."""
    secim = _kullanicinin_secimi(secim_id, kullanici_id, oturum)
    adim = oturum.scalar(
        select(GorevAdimi).where(GorevAdimi.secim_id == secim.id, GorevAdimi.sira == istek.sira)
    )
    if adim is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Bu sırada bir adım yok.")

    if istek.tamamlandi and not adim.tamamlandi:
        adim.tamamlanma_tarihi = datetime.now(timezone.utc)
    elif not istek.tamamlandi:
        adim.tamamlanma_tarihi = None
    adim.tamamlandi = istek.tamamlandi
    oturum.commit()
    return _cevap(secim, oturum)
