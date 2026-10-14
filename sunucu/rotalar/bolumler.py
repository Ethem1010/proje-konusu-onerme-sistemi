"""GET /bolumler: Arayüzdeki bölüm açılır listesi için."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from veritabani.baglanti import oturum_al
from veritabani.modeller import Bolum

router = APIRouter(tags=["Bölümler"])


class BolumCevabi(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ad: str
    grup: str  # 'muhendislik' ya da 'diger'


@router.get("/bolumler", response_model=list[BolumCevabi])
def bolumleri_getir(oturum: Session = Depends(oturum_al)):
    """Bütün bölümler: önce mühendislikler, sonra diğerleri.

    "Diğer (listede yok)" seçeneği veritabanında değil, arayüzde en alta eklenir.
    """
    sorgu = select(Bolum).order_by(Bolum.grup.desc(), Bolum.id)
    return oturum.scalars(sorgu).all()