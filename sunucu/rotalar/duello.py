"""Düello adresi: POST /duello.

8 proje → 4 çeyrek final, 2 yarı final, 1 final. Bir öğrenci için toplam 7 kayıt.
Her eşleşmenin sonucu duello_secimleri tablosuna yazılır.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from veritabani.baglanti import oturum_al
from veritabani.modeller import DuelloSecimi, Proje

from ..guvenlik import aktif_kullanici_id
from .profil import kullanicinin_profili

router = APIRouter(tags=["Düello"])

TUR_ESLESME_SAYISI = {"ceyrek": 4, "yari": 2, "final": 1}


class DuelloIstegi(BaseModel):
    profil_id: int = Field(examples=[5])
    kazanan_proje_id: int = Field(examples=[12])
    kaybeden_proje_id: int = Field(examples=[15])
    tur: str = Field(examples=["ceyrek"])  # ceyrek, yari, final


class DuelloCevabi(BaseModel):
    id: int
    profil_id: int
    kazanan_proje_id: int
    kaybeden_proje_id: int
    tur: str


def _hata(mesaj: str):
    raise HTTPException(status.HTTP_400_BAD_REQUEST, mesaj)


@router.post("/duello", response_model=DuelloCevabi, status_code=status.HTTP_201_CREATED)
def duello_kaydet(
    istek: DuelloIstegi,
    kullanici_id: int = Depends(aktif_kullanici_id),
    oturum: Session = Depends(oturum_al),
):
    """Bir düello eşleşmesinin sonucunu kaydeder."""
    kullanicinin_profili(istek.profil_id, kullanici_id, oturum)  # başkasınınsa 404

    if istek.tur not in TUR_ESLESME_SAYISI:
        _hata("tur 'ceyrek', 'yari' ya da 'final' olmalı.")
    if istek.kazanan_proje_id == istek.kaybeden_proje_id:
        _hata("Bir proje kendisiyle düello yapamaz.")

    for proje_id in (istek.kazanan_proje_id, istek.kaybeden_proje_id):
        proje = oturum.get(Proje, proje_id)
        if proje is None or proje.profil_id != istek.profil_id:
            _hata(f"{proje_id} numaralı proje bu profilin değil.")
        if not proje.duelloda:
            _hata(f"{proje_id} numaralı proje düelloda değil.")

    onceki = oturum.scalars(select(DuelloSecimi).where(DuelloSecimi.profil_id == istek.profil_id)).all()

    bu_turda = sum(1 for d in onceki if d.tur == istek.tur)
    if bu_turda >= TUR_ESLESME_SAYISI[istek.tur]:
        _hata(f"Bu turun bütün eşleşmeleri zaten kaydedildi ({TUR_ESLESME_SAYISI[istek.tur]} tane).")

    elenenler = {d.kaybeden_proje_id for d in onceki}
    for proje_id in (istek.kazanan_proje_id, istek.kaybeden_proje_id):
        if proje_id in elenenler:
            _hata(f"{proje_id} numaralı proje daha önce elendi.")

    kayit = DuelloSecimi(
        profil_id=istek.profil_id,
        kazanan_proje_id=istek.kazanan_proje_id,
        kaybeden_proje_id=istek.kaybeden_proje_id,
        tur=istek.tur,
    )
    oturum.add(kayit)
    oturum.commit()
    return DuelloCevabi(
        id=kayit.id,
        profil_id=kayit.profil_id,
        kazanan_proje_id=kayit.kazanan_proje_id,
        kaybeden_proje_id=kayit.kaybeden_proje_id,
        tur=kayit.tur,
    )
